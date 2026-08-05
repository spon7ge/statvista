# MLB Preview Game Odds Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a team-perspective Odds board (Money / O-U / Run line with American prices) on the right of MLB Preview lineups, fed by an additive `board` on `GET /api/mlb/odds/today`.

**Architecture:** Extend `MlbOddsGame` with optional nested `board` built from Pinnacle FG team rows (moneyline + both-side spread/total prices). Keep flat spread/total for `/mlb/matchups`. Preview fetches `useMlbOdds`, matches the game, and renders `MlbGameOddsBoard` in a two-column layout beside projected lineups.

**Tech Stack:** FastAPI/Pydantic, pytest, React/TypeScript, Vitest/RTL, openapi-typescript

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-mlb-preview-game-odds-board-design.md`
- Markets: Moneyline + O/U + run line with prices; **no Open column**; **no Refresh**
- Header: “Odds” + sportsbook label + as-of
- Source: Pinnacle first; Sharp flat RL/total fallback when Pinnacle empty for that game; ML from Pinnacle only
- Away row = Over; home row = Under; away then home
- Matchups UI unchanged (ignore `board`)
- Brand: **statvista** in any new product copy
- Update `md/system-design.md` when Preview wiring changes

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/domains/mlb/schemas_odds.py` | `MlbOddsBoardLine`, `MlbOddsBoardTotal`, `MlbOddsBoardSide`, `MlbOddsBoard`; `board` on `MlbOddsGame` |
| `backend/app/domains/mlb/schemas.py` | Re-export new board models |
| `backend/app/domains/mlb/odds.py` | Build `board` in `normalize_pinnacle_team_rows` (keep flat fields) |
| `backend/tests/test_mlb_pinnacle_team_odds.py` | Board normalize + merge preserves board |
| `backend/openapi-golden.json` + `frontend/openapi.json` + `api.schema.d.ts` | Regenerated contract |
| `frontend/src/features/mlb/lib/mlbOddsBoard.ts` | Match game + map API → view model / formatters |
| `frontend/src/features/mlb/lib/mlbOddsBoard.test.ts` | Matcher + formatter tests |
| `frontend/src/features/mlb/game/MlbGameOddsBoard.tsx` | Odds board UI |
| `frontend/src/features/mlb/game/MlbGameOddsBoard.test.tsx` | Board render / unavailable |
| `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` | Two-column lineups \| odds; stats/injuries below |
| `frontend/src/features/mlb/game/MlbPregameCenter.tsx` | Pass odds query props into projected stack |
| `md/system-design.md` | Preview ↔ odds board note |

---

### Task 1: Odds board Pydantic schemas

**Files:**
- Modify: `backend/app/domains/mlb/schemas_odds.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Test: `backend/tests/test_mlb_odds_board_schemas.py` (create)

**Interfaces:**
- Produces:
  - `MlbOddsBoardLine(line: float, price: int | None = None)`
  - `MlbOddsBoardTotal(side: Literal["over", "under"], line: float, price: int | None = None)`
  - `MlbOddsBoardSide(moneyline: int | None = None, spread: MlbOddsBoardLine | None = None, total: MlbOddsBoardTotal | None = None)`
  - `MlbOddsBoard(away: MlbOddsBoardSide, home: MlbOddsBoardSide)`
  - `MlbOddsGame.board: MlbOddsBoard | None = None`

- [ ] **Step 1: Write failing schema smoke test**

```python
from app.domains.mlb.schemas_odds import (
    MlbOddsBoard,
    MlbOddsBoardLine,
    MlbOddsBoardSide,
    MlbOddsBoardTotal,
    MlbOddsGame,
)


def test_mlb_odds_game_board_round_trip():
    board = MlbOddsBoard(
        away=MlbOddsBoardSide(
            moneyline=113,
            spread=MlbOddsBoardLine(line=1.5, price=-182),
            total=MlbOddsBoardTotal(side="over", line=7.5, price=-113),
        ),
        home=MlbOddsBoardSide(
            moneyline=-115,
            spread=MlbOddsBoardLine(line=-1.5, price=174),
            total=MlbOddsBoardTotal(side="under", line=7.5, price=108),
        ),
    )
    game = MlbOddsGame(
        home_abbrev="BAL",
        away_abbrev="LAA",
        spread_team_abbrev="BAL",
        spread_line=-1.5,
        total=7.5,
        sportsbook="pinnacle",
        board=board,
    )
    dumped = game.model_dump()
    assert dumped["board"]["away"]["moneyline"] == 113
    assert dumped["board"]["home"]["total"]["side"] == "under"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mlb_odds_board_schemas.py -v`  
Expected: FAIL (import / missing symbols)

- [ ] **Step 3: Add models + `board` field + re-exports**

In `schemas_odds.py`:

```python
from typing import Literal

class MlbOddsBoardLine(BaseModel):
    model_config = _RESPONSE_CONFIG
    line: float
    price: int | None = None


class MlbOddsBoardTotal(BaseModel):
    model_config = _RESPONSE_CONFIG
    side: Literal["over", "under"]
    line: float
    price: int | None = None


class MlbOddsBoardSide(BaseModel):
    model_config = _RESPONSE_CONFIG
    moneyline: int | None = None
    spread: MlbOddsBoardLine | None = None
    total: MlbOddsBoardTotal | None = None


class MlbOddsBoard(BaseModel):
    model_config = _RESPONSE_CONFIG
    away: MlbOddsBoardSide
    home: MlbOddsBoardSide


class MlbOddsGame(BaseModel):
    # ...existing fields...
    board: MlbOddsBoard | None = None
```

Re-export new types from `schemas.py` `__all__`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mlb_odds_board_schemas.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_odds.py backend/app/domains/mlb/schemas.py \
  backend/tests/test_mlb_odds_board_schemas.py
git commit -m "feat(mlb): add nested odds board schemas"
```

---

### Task 2: Build `board` in Pinnacle normalize

**Files:**
- Modify: `backend/app/domains/mlb/odds.py` (`normalize_pinnacle_team_rows`)
- Modify: `backend/tests/test_mlb_pinnacle_team_odds.py`

**Interfaces:**
- Consumes: Task 1 board models; snapshot rows with `market_type` in `{moneyline,spread,total}`, `side`, `team`, `points`, `american_price` (period/alternate already filtered by fetch)
- Produces: `normalize_pinnacle_team_rows` still returns flat favorite spread/total; also sets `board` when any priced side exists
- Note: moneyline rows have `points is None` — do **not** `continue` before handling moneyline

- [ ] **Step 1: Extend failing normalize assertions**

Add to `test_mlb_pinnacle_team_odds.py`:

```python
def test_normalize_builds_team_perspective_board():
    rows = [
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "moneyline",
            "side": "away",
            "team": "Los Angeles Angels",
            "points": None,
            "american_price": 113,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "moneyline",
            "side": "home",
            "team": "Baltimore Orioles",
            "points": None,
            "american_price": -115,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Los Angeles Angels",
            "points": 1.5,
            "american_price": -182,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "spread",
            "side": "home",
            "team": "Baltimore Orioles",
            "points": -1.5,
            "american_price": 174,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "total",
            "side": "over",
            "points": 7.5,
            "american_price": -113,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "total",
            "side": "under",
            "points": 7.5,
            "american_price": 108,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    g = games[0]
    assert g.board is not None
    assert g.board.away.moneyline == 113
    assert g.board.home.moneyline == -115
    assert g.board.away.spread is not None and g.board.away.spread.line == 1.5
    assert g.board.away.spread.price == -182
    assert g.board.home.spread is not None and g.board.home.spread.line == -1.5
    assert g.board.home.spread.price == 174
    assert g.board.away.total is not None
    assert g.board.away.total.side == "over" and g.board.away.total.line == 7.5
    assert g.board.away.total.price == -113
    assert g.board.home.total is not None
    assert g.board.home.total.side == "under" and g.board.home.total.price == 108
    # flat fields still favorite-style
    assert g.spread_team_abbrev == "BAL" and g.spread_line == -1.5
    assert g.total == 7.5


def test_merge_prefers_pinnacle_board():
    from app.domains.mlb.schemas import (
        MlbOddsBoard,
        MlbOddsBoardSide,
        MlbOddsGame,
    )

    pin = [
        MlbOddsGame(
            home_abbrev="BAL",
            away_abbrev="LAA",
            spread_team_abbrev="BAL",
            spread_line=-1.5,
            total=7.5,
            sportsbook="pinnacle",
            board=MlbOddsBoard(
                away=MlbOddsBoardSide(moneyline=113),
                home=MlbOddsBoardSide(moneyline=-115),
            ),
        )
    ]
    sharp = [
        MlbOddsGame(
            home_abbrev="BAL",
            away_abbrev="LAA",
            spread_team_abbrev="BAL",
            spread_line=-1.5,
            total=8.0,
            sportsbook="draftkings",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "pinnacle"
    assert merged[0].board is not None
    assert merged[0].board.away.moneyline == 113
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_mlb_pinnacle_team_odds.py::test_normalize_builds_team_perspective_board tests/test_mlb_pinnacle_team_odds.py::test_merge_prefers_pinnacle_board -v`  
Expected: FAIL (`board` is None / moneyline rows skipped)

- [ ] **Step 3: Implement board assembly in `normalize_pinnacle_team_rows`**

Rewrite the bucket loop to:

1. Always record moneyline when `market_type == "moneyline"` and `american_price` parses (ignore missing `points`).
2. For spread/total, require parseable `points` as today; also store `(team|side, points, price)` lists.
3. After aggregation, build flat favorite spread/total **unchanged**.
4. Build `MlbOddsBoard`:
   - away/home moneyline from side or team abbrev
   - away/home spread from that team’s spread entry
   - away total = over; home total = under (same `line`)
5. Set `board` only if at least one of ML / spread / total sides is populated; else `None`.
6. Keep existing skip when flat spread and total are both missing (`_has_markets` unchanged).

Helper sketch:

```python
def _int_price(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        try:
            return int(float(raw))
        except (TypeError, ValueError):
            return None
```

Import board models from `app.domains.mlb.schemas`.

- [ ] **Step 4: Run full MLB pinnacle odds tests**

Run: `cd backend && python -m pytest tests/test_mlb_pinnacle_team_odds.py -v`  
Expected: PASS (including existing flat-field tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/odds.py backend/tests/test_mlb_pinnacle_team_odds.py
git commit -m "feat(mlb): build team-perspective board from Pinnacle rows"
```

---

### Task 3: Regenerate OpenAPI + system-design note

**Files:**
- Modify: `backend/openapi-golden.json`
- Modify: `frontend/openapi.json`
- Modify: `frontend/src/shared/lib/api.schema.d.ts`
- Modify: `md/system-design.md` (Preview row for `/mlb/games/:gamePk`)

**Interfaces:**
- Produces: OpenAPI schemas include `MlbOddsBoard*` and `MlbOddsGame.board`
- Consumes: Task 1–2 schema/runtime already live

- [ ] **Step 1: Export OpenAPI and regenerate types**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
python scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

If `export_openapi.py` writes only `frontend/openapi.json`, copy to golden as above (match recent MLB commits).

- [ ] **Step 2: Verify schema mentions board**

```bash
rg -n "MlbOddsBoard|\"board\"" frontend/src/shared/lib/api.schema.d.ts | head
```

Expected: `MlbOddsBoard`, `board` on `MlbOddsGame`

- [ ] **Step 3: Update `md/system-design.md` Preview row**

Extend the `/mlb/games/:gamePk` table cell to note Preview right-rail odds board via `useMlbOdds` → `GET /api/mlb/odds/today` (`board` when Pinnacle), beside projected lineups; Team Stats + Injuries remain below.

- [ ] **Step 4: Commit**

```bash
git add backend/openapi-golden.json frontend/openapi.json \
  frontend/src/shared/lib/api.schema.d.ts md/system-design.md
git commit -m "docs(api): expose MLB odds board on OpenAPI contract"
```

---

### Task 4: Frontend matcher + view mapper

**Files:**
- Create: `frontend/src/features/mlb/lib/mlbOddsBoard.ts`
- Create: `frontend/src/features/mlb/lib/mlbOddsBoard.test.ts`

**Interfaces:**
- Consumes: `ApiMlbOddsGame` / `ApiMlbOddsResponse` from `@/shared/lib/api`
- Produces:
  - `formatAmericanOdds(n: number): string` → `+113` / `−115` (minus U+2212 like prop picks, or ASCII `-` — match `PropPicksTable` / existing MLB chrome; prefer `+` prefix and plain `-` for negatives unless nearby MLB UI already uses U+2212)
  - `findMlbOddsGame(games, awayAbbrev, homeAbbrev, gameDate): ApiMlbOddsGame | null`
  - `toMlbOddsBoardView(game, asOf, responseSportsbook): MlbOddsBoardView | null`
  - View type:

```ts
export type MlbOddsBoardTile =
  | { kind: "money"; price: number | null }
  | { kind: "total"; side: "over" | "under"; line: number | null; price: number | null }
  | { kind: "spread"; line: number | null; price: number | null };

export type MlbOddsBoardRowView = {
  side: "away" | "home";
  money: MlbOddsBoardTile;
  total: MlbOddsBoardTile;
  spread: MlbOddsBoardTile;
};

export type MlbOddsBoardView = {
  sportsbook: string | null;
  asOf: string | null;
  rows: [MlbOddsBoardRowView, MlbOddsBoardRowView]; // away, home
};
```

Matching: reuse key style from `mergeMatchupOdds` with `wnbaAliases: false` — prefer `game_date === slateDate`, else undated, else any dated for that away@home.

Board mapping:
- If `game.board` present → map away/home tiles from it.
- Else Sharp-only: derive spread lines from `spread_team_abbrev` + `spread_line` (mirror opposite for other team); total line on both with away=over home=under; all prices + moneyline null. Return null only when no spread and no total.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  findMlbOddsGame,
  formatAmericanOdds,
  toMlbOddsBoardView,
} from "./mlbOddsBoard";

describe("mlbOddsBoard", () => {
  it("formats american odds with plus prefix", () => {
    expect(formatAmericanOdds(113)).toBe("+113");
    expect(formatAmericanOdds(-115)).toBe("-115");
  });

  it("finds game by abbrev and date", () => {
    const hit = findMlbOddsGame(
      [
        {
          away_abbrev: "LAA",
          home_abbrev: "BAL",
          game_date: "2026-08-05",
          spread_line: -1.5,
          spread_team_abbrev: "BAL",
          total: 7.5,
          sportsbook: "pinnacle",
          board: null,
        },
      ],
      "laa",
      "bal",
      "2026-08-05",
    );
    expect(hit?.home_abbrev).toBe("BAL");
  });

  it("maps pinnacle board to view rows", () => {
    const view = toMlbOddsBoardView(
      {
        away_abbrev: "LAA",
        home_abbrev: "BAL",
        game_date: "2026-08-05",
        spread_line: -1.5,
        spread_team_abbrev: "BAL",
        total: 7.5,
        sportsbook: "pinnacle",
        board: {
          away: {
            moneyline: 113,
            spread: { line: 1.5, price: -182 },
            total: { side: "over", line: 7.5, price: -113 },
          },
          home: {
            moneyline: -115,
            spread: { line: -1.5, price: 174 },
            total: { side: "under", line: 7.5, price: 108 },
          },
        },
      },
      "2026-08-05T18:00:00Z",
      "pinnacle",
    );
    expect(view?.rows[0].money).toEqual({ kind: "money", price: 113 });
    expect(view?.rows[1].total).toMatchObject({
      kind: "total",
      side: "under",
      line: 7.5,
      price: 108,
    });
  });

  it("derives thin board from flat sharp fields", () => {
    const view = toMlbOddsBoardView(
      {
        away_abbrev: "NYY",
        home_abbrev: "BOS",
        game_date: "2026-08-05",
        spread_line: -1.5,
        spread_team_abbrev: "NYY",
        total: 8.5,
        sportsbook: "draftkings",
        board: null,
      },
      null,
      "draftkings",
    );
    expect(view?.rows[0].spread).toMatchObject({
      kind: "spread",
      line: -1.5,
      price: null,
    });
    expect(view?.rows[1].spread).toMatchObject({
      kind: "spread",
      line: 1.5,
      price: null,
    });
    expect(view?.rows[0].money).toEqual({ kind: "money", price: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/mlb/lib/mlbOddsBoard.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `mlbOddsBoard.ts`**

Implement the exports above. Keep functions pure and small.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/mlb/lib/mlbOddsBoard.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/lib/mlbOddsBoard.ts \
  frontend/src/features/mlb/lib/mlbOddsBoard.test.ts
git commit -m "feat(mlb): map odds API board to preview view model"
```

---

### Task 5: `MlbGameOddsBoard` UI

**Files:**
- Create: `frontend/src/features/mlb/game/MlbGameOddsBoard.tsx`
- Create: `frontend/src/features/mlb/game/MlbGameOddsBoard.test.tsx`

**Interfaces:**
- Consumes: `MlbOddsBoardView` + `MlbGameDetailTeam` away/home for logos/abbrevs
- Produces: presentational board with `data-testid="mlb-game-odds-board"`

Props:

```ts
type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home">;
  view: MlbOddsBoardView | null;
  isPending?: boolean;
};
```

UI:
- Wrap in `GameSection` (match lineups chrome).
- Header row: **Odds** (left); sportsbook + short as-of (right), e.g. `Pinnacle · 11:22 AM` — format as-of with `toLocaleTimeString` in America/Los_Angeles or leave ISO slice if simpler; keep readable.
- Loading: “Loading odds…”
- `view == null`: “Odds unavailable”
- Else two rows away then home: logo + abbrev + three dark rounded tiles (Money / o|u line+price / spread line+price). Missing → `–`.

- [ ] **Step 1: Write failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { MlbGameOddsBoard } from "./MlbGameOddsBoard";
import { mlbScheduledDetail } from "../lib/testFixtures";

it("renders unavailable when view is null", () => {
  render(
    <MlbGameOddsBoard
      detail={mlbScheduledDetail}
      view={null}
    />,
  );
  expect(screen.getByTestId("mlb-game-odds-board")).toBeInTheDocument();
  expect(screen.getByText(/odds unavailable/i)).toBeInTheDocument();
});

it("renders money total and spread tiles from view", () => {
  render(
    <MlbGameOddsBoard
      detail={mlbScheduledDetail}
      view={{
        sportsbook: "pinnacle",
        asOf: "2026-08-05T18:00:00Z",
        rows: [
          {
            side: "away",
            money: { kind: "money", price: 113 },
            total: { kind: "total", side: "over", line: 7.5, price: -113 },
            spread: { kind: "spread", line: 1.5, price: -182 },
          },
          {
            side: "home",
            money: { kind: "money", price: -115 },
            total: { kind: "total", side: "under", line: 7.5, price: 108 },
            spread: { kind: "spread", line: -1.5, price: 174 },
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("+113")).toBeInTheDocument();
  expect(screen.getByText("o7.5")).toBeInTheDocument();
  expect(screen.getByText("u7.5")).toBeInTheDocument();
  expect(screen.getByText(/pinnacle/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbGameOddsBoard.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `MlbGameOddsBoard.tsx`**

Match existing dark game chrome (`text-white`, `bg-white/10` tiles, `GameSection`). No Open column. No Refresh button.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbGameOddsBoard.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbGameOddsBoard.tsx \
  frontend/src/features/mlb/game/MlbGameOddsBoard.test.tsx
git commit -m "feat(mlb): add Preview odds board component"
```

---

### Task 6: Wire Preview two-column layout

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.test.tsx`

**Interfaces:**
- Consumes: `useMlbOdds`, `findMlbOddsGame`, `toMlbOddsBoardView`, `MlbGameOddsBoard`
- Produces: Preview stack = `[lineups | odds]` grid on `lg+`, then Team Stats, then Injuries

- [ ] **Step 1: Write / update failing layout tests**

In `MlbPregameCenter.test.tsx`, mock `useMlbOdds` / `fetchMlbOdds` to return a board game matching `mlbScheduledDetail` abbrevs + date; assert `mlb-game-odds-board` is present on Preview.

In `MlbProjectedLineups.test.tsx`, assert stack has `data-testid="mlb-preview-lineups-odds-grid"` (or similar) wrapping lineups + odds.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbPregameCenter.test.tsx src/features/mlb/game/MlbProjectedLineups.test.tsx`  
Expected: FAIL (odds board missing)

- [ ] **Step 3: Wire data + layout**

`MlbPregameCenter`:
- Call `useMlbOdds()` when `activeTab === "preview"` (or always — cheap; prefer enabled only on preview).
- Compute `view` via `findMlbOddsGame` + `toMlbOddsBoardView`.
- Pass `oddsView` + `oddsPending` into `MlbProjectedLineups`.

`MlbProjectedLineups`:
- Change top section from `sm:w-1/2` lineups-only to:

```tsx
<div
  data-testid="mlb-preview-lineups-odds-grid"
  className="grid items-start gap-4 lg:grid-cols-2"
>
  <GameSection ... lineups ... />
  <MlbGameOddsBoard detail={detail} view={oddsView} isPending={oddsPending} />
</div>
<MlbSeasonTeamStats ... />
<MlbInjuryReport ... />
```

Keep lineups `GameSection` full width of its grid cell (drop `sm:w-1/2`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbPregameCenter.test.tsx src/features/mlb/game/MlbProjectedLineups.test.tsx src/features/mlb/game/MlbGameOddsBoard.test.tsx src/features/mlb/lib/mlbOddsBoard.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbPregameCenter.tsx \
  frontend/src/features/mlb/game/MlbPregameCenter.test.tsx \
  frontend/src/features/mlb/game/MlbProjectedLineups.tsx \
  frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx
git commit -m "feat(mlb): show odds board beside Preview lineups"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Nested `board` on `/odds/today` | 1–2 |
| Money + O/U + RL with prices; no Open | 2, 5 |
| Pinnacle first / Sharp flat fallback; ML Pinnacle-only | 2 (merge unchanged); 4 Sharp thin derive |
| Header sportsbook + as-of; no Refresh | 5 |
| Two-column Preview; stats/injuries below | 6 |
| Matchups ignore `board` | No matchups UI changes |
| Unavailable / `–` degrade | 4–5 |
| OpenAPI + system-design | 3 |
| Tests backend + frontend | 1–2, 4–6 |

No placeholders left. Types consistent: `MlbOddsBoard*` → API → `MlbOddsBoardView` → `MlbGameOddsBoard`.
