# MLB Preview Multi-Book Odds Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preview Odds board drops Money, adds Bookmaker (name only), and stacks every available FG team book (ProphetX → Novig → Pinnacle → FanDuel → DraftKings).

**Architecture:** Keep priority-merged `games[]` for matchups. Add additive `book_boards: list[MlbOddsGame]` on `GET /api/mlb/odds/today` with one entry per book that quotes the slate. Frontend filters by matchup and renders one Away/Home block per book. Wire `fetch_latest_novig_team`.

**Tech Stack:** FastAPI/Pydantic, Supabase `odds.*_team` tables, React + Vitest, existing `MlbGameOddsBoard` / `mlbOddsBoard.ts`.

**Spec:** `docs/superpowers/specs/2026-08-10-mlb-preview-odds-all-books-design.md`

## Global Constraints

- Book order for display: `prophetx`, `novig`, `pinnacle`, `fanduel`, `draftkings`
- Matchups `games[]` merge order stays Pinnacle-first (existing `merge_odds_by_priority(pin, px, …)`)
- Full-game markets only; no F5 / 1st-inning
- Preview UI never renders moneyline
- Product name remains **statvista** in any user-facing copy
- Follow `md/claude.md`; update `md/system-design.md` if Preview ↔ API notes change
- Reuse `MlbOddsGame` for `book_boards` items (no new schema type unless OpenAPI forces it)

## File map

| File | Role |
| --- | --- |
| `backend/app/core/odds_snapshots.py` | Add `fetch_latest_novig_team` + `_NOVIG_TEAM_TABLE` |
| `backend/app/domains/mlb/schemas_odds.py` | Add `book_boards` on `MlbOddsResponse` |
| `backend/app/domains/mlb/odds.py` | Collect multi-book boards; call Novig fetch |
| `backend/tests/test_odds_snapshots_pinnacle.py` | Novig team SQL test |
| `backend/tests/test_mlb_pinnacle_team_odds.py` | `book_boards` + Novig in `get_today_odds` |
| `frontend/openapi.json` + `api.schema.d.ts` | Expose `book_boards` |
| `frontend/src/features/mlb/lib/mlbOddsBoard.ts` | Multi-book view helper |
| `frontend/src/features/mlb/game/MlbGameOddsBoard.tsx` | Bookmaker column + stacked books |
| `frontend/src/features/mlb/game/MlbPregameCenter.tsx` | Pass multi-book views |
| `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` | Prop type if needed |
| Tests beside each frontend module | Labels, multi-book render |

---

### Task 1: Fetch latest Novig team snapshot

**Files:**
- Modify: `backend/app/core/odds_snapshots.py`
- Test: `backend/tests/test_odds_snapshots_pinnacle.py`

**Interfaces:**
- Produces: `fetch_latest_novig_team(league: str = "mlb") -> list[dict]`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_odds_snapshots_pinnacle.py`:

```python
def test_fetch_latest_novig_team_filters_full_game_markets():
    engine, conn = _mock_engine([])
    with patch("src.utils.db.get_engine", return_value=engine):
        svc.fetch_latest_novig_team("mlb")
    sql = str(conn.execute.call_args[0][0])
    assert "odds.mlb_novig_team" in sql
    assert "run_line" in sql
    assert "moneyline" in sql
    params = conn.execute.call_args[0][1]
    assert params["league"] == "mlb"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_odds_snapshots_pinnacle.py::test_fetch_latest_novig_team_filters_full_game_markets -v`  
Expected: FAIL (`fetch_latest_novig_team` missing)

- [ ] **Step 3: Implement `fetch_latest_novig_team`**

In `odds_snapshots.py`:

```python
_NOVIG_TEAM_TABLE = {
    "mlb": "mlb_novig_team",
    "wnba": "wnba_novig_team",
}

def fetch_latest_novig_team(league: str = "mlb") -> list[dict]:
    """Return full-game team market rows from the latest Novig snapshot."""
    lg = _normalized_league(league, "mlb")
    table = _NOVIG_TEAM_TABLE.get(lg, "mlb_novig_team")
    sql = f"""
SELECT away_team, home_team, start_time, market_type, side, team, points,
       american_price, event_id
FROM odds.{table}
WHERE league = :league
  AND scraped_at = (
    SELECT MAX(scraped_at) FROM odds.{table} WHERE league = :league
  )
  AND market_type IN ('moneyline', 'run_line', 'spread', 'total', 'total_runs')
"""
    return _fetch_rows(sql, lg)
```

Update module docstring to mention Novig team.

- [ ] **Step 4: Run test to verify it passes**

Run: same pytest command  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/odds_snapshots.py backend/tests/test_odds_snapshots_pinnacle.py
git commit -m "feat(odds): fetch latest Novig team snapshot rows"
```

---

### Task 2: Add `book_boards` to MLB odds response

**Files:**
- Modify: `backend/app/domains/mlb/schemas_odds.py`
- Modify: `backend/app/domains/mlb/odds.py`
- Test: `backend/tests/test_mlb_pinnacle_team_odds.py`

**Interfaces:**
- Consumes: `fetch_latest_novig_team`, `normalize_team_odds_rows`, existing pin/px/sharp paths
- Produces: `MlbOddsResponse.book_boards: list[MlbOddsGame]`; helper `collect_book_boards(*sources) -> list[MlbOddsGame]`

- [ ] **Step 1: Write failing tests**

```python
def test_collect_book_boards_keeps_all_books_in_display_order():
    px = [
        MlbOddsGame(
            home_abbrev="CHC",
            away_abbrev="LAD",
            spread_team_abbrev="LAD",
            spread_line=-1.5,
            total=8.5,
            sportsbook="prophetx",
            game_date="2026-08-10",
        )
    ]
    novig = [
        MlbOddsGame(
            home_abbrev="CHC",
            away_abbrev="LAD",
            spread_team_abbrev="LAD",
            spread_line=-1.5,
            total=8.0,
            sportsbook="novig",
            game_date="2026-08-10",
        )
    ]
    pin = [
        MlbOddsGame(
            home_abbrev="CHC",
            away_abbrev="LAD",
            spread_team_abbrev="LAD",
            spread_line=-1.5,
            total=8.5,
            sportsbook="pinnacle",
            game_date="2026-08-10",
        )
    ]
    boards = svc.collect_book_boards(px, novig, pin, [])
    assert [g.sportsbook for g in boards] == ["prophetx", "novig", "pinnacle"]


def test_get_today_odds_includes_novig_in_book_boards(monkeypatch):
    # Mirror existing get_today_odds patches; stub pin=[], px=[], novig rows with RL+total,
    # sharp=[], assert body.book_boards has sportsbook == "novig" and games still merges.
    ...
```

Patch target: `app.domains.mlb.odds.fetch_latest_novig_team` (and existing pin/px/sharp patches). Update every `get_today_odds` test that patches fetchers to also patch `fetch_latest_novig_team` → `[]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_mlb_pinnacle_team_odds.py -k "book_boards or collect_book" -v`  
Expected: FAIL

- [ ] **Step 3: Schema + implementation**

`schemas_odds.py`:

```python
class MlbOddsResponse(BaseModel):
    ...
    games: list[MlbOddsGame] = Field(default_factory=list)
    book_boards: list[MlbOddsGame] = Field(default_factory=list)
    error: str | None = None
```

`odds.py`:

```python
from app.core.odds_snapshots import (
    fetch_latest_novig_team,
    fetch_latest_pinnacle_team,
    fetch_latest_prophetx_team,
)

_BOOK_BOARD_ORDER = ("prophetx", "novig", "pinnacle", "fanduel", "draftkings")

def collect_book_boards(*sources: list[MlbOddsGame]) -> list[MlbOddsGame]:
    """All FG team games that have markets, ordered for Preview display."""
    order_index = {book: i for i, book in enumerate(_BOOK_BOARD_ORDER)}
    out: list[MlbOddsGame] = []
    seen: set[tuple[str, str, str, str | None]] = set()
    for source in sources:
        for game in source:
            game = _canonicalize_game(game)
            if not _has_markets(game):
                continue
            book = (game.sportsbook or "").lower()
            key = (book, *_team_merge_key(game), game.game_date)
            if key in seen:
                continue
            seen.add(key)
            out.append(game)
    out.sort(
        key=lambda g: (
            order_index.get((g.sportsbook or "").lower(), 99),
            g.game_date or "",
            g.home_abbrev,
            g.away_abbrev,
        )
    )
    return out
```

In `get_today_odds`:

```python
novig_rows = fetch_latest_novig_team("mlb")
novig_games = normalize_team_odds_rows(novig_rows, sportsbook="novig")
games = merge_odds_by_priority(pin_games, px_games, novig_games, sharp_games)
book_boards = collect_book_boards(px_games, novig_games, pin_games, sharp_games)
response = MlbOddsResponse(
    as_of=_utcnow_iso(),
    sportsbook=_response_sportsbook(games),
    games=games,
    book_boards=book_boards,
    error=error,
)
```

Also include `novig` in `_response_sportsbook` book preference list after prophetx.

Update cached error-path constructors to pass `book_boards=cached.book_boards` when present.

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_mlb_pinnacle_team_odds.py tests/test_odds_snapshots_pinnacle.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_odds.py backend/app/domains/mlb/odds.py backend/tests/test_mlb_pinnacle_team_odds.py
git commit -m "feat(mlb): expose book_boards for all team odds sources"
```

---

### Task 3: Regenerate frontend API types

**Files:**
- Modify: `frontend/openapi.json` (export from running API or hand-patch `MlbOddsResponse`)
- Modify: `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Produces: `MlbOddsResponse.book_boards: MlbOddsGame[]`

- [ ] **Step 1: Update OpenAPI artifact**

Preferred: with API up, export schema into `frontend/openapi.json`, then:

```bash
cd frontend && npm run generate:api
```

If export is awkward, hand-edit `api.schema.d.ts` `MlbOddsResponse` to add:

```typescript
/** Book Boards */
book_boards: components["schemas"]["MlbOddsGame"][];
```

and mirror in `openapi.json`.

- [ ] **Step 2: Commit**

```bash
git add frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "chore(api): add MlbOddsResponse.book_boards to OpenAPI types"
```

---

### Task 4: Multi-book view helper

**Files:**
- Modify: `frontend/src/features/mlb/lib/mlbOddsBoard.ts`
- Test: `frontend/src/features/mlb/lib/mlbOddsBoard.test.ts`

**Interfaces:**
- Consumes: `ApiMlbOddsResponse`, `toMlbOddsBoardView`, `findMlbOddsGame` matching rules
- Produces:

```typescript
export type MlbOddsBookBoardView = {
  sportsbook: string;
  asOf: string | null;
  rows: [MlbOddsBoardRowView, MlbOddsBoardRowView];
};

export function collectMlbOddsBookBoards(
  response: ApiMlbOddsResponse | null | undefined,
  awayAbbrev: string,
  homeAbbrev: string,
  gameDate?: string,
): MlbOddsBookBoardView[];
```

- [ ] **Step 1: Write failing tests**

```typescript
it("collects book_boards for the matchup in API order", () => {
  const views = collectMlbOddsBookBoards(
    {
      as_of: "2026-08-10T15:00:00Z",
      sportsbook: "pinnacle",
      error: null,
      games: [],
      book_boards: [
        game({ sportsbook: "prophetx", total: 8.5 }),
        game({ sportsbook: "novig", total: 8.0 }),
        game({ sportsbook: "pinnacle", total: 8.5 }),
      ],
    },
    "LAD",
    "CHC",
    "2026-08-10",
  );
  expect(views.map((v) => v.sportsbook)).toEqual([
    "prophetx",
    "novig",
    "pinnacle",
  ]);
});

it("falls back to games[] when book_boards empty", () => {
  // single preferred game still yields one view
});
```

Reuse existing fixture builders in the test file; extend `game()` helper with `sportsbook` / `board` as needed.

- [ ] **Step 2: Run test — expect FAIL**

`cd frontend && npx vitest run src/features/mlb/lib/mlbOddsBoard.test.ts`

- [ ] **Step 3: Implement helper**

Filter `response.book_boards` with same matchup/date rules as `findMlbOddsGame` (extract shared predicate if DRY). Map each via `toMlbOddsBoardView(game, as_of, game.sportsbook)`. If `book_boards` missing/empty, fall back to single `findMlbOddsGame` → one view.

Keep `MlbOddsBoardRowView.money` in the type for now (unused by UI) to avoid churn in `toMlbOddsBoardView`.

- [ ] **Step 4: Tests PASS + commit**

```bash
git add frontend/src/features/mlb/lib/mlbOddsBoard.ts frontend/src/features/mlb/lib/mlbOddsBoard.test.ts
git commit -m "feat(mlb): collect multi-book odds views for preview"
```

---

### Task 5: Odds board UI — Bookmaker column + stacked books

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbGameOddsBoard.tsx`
- Modify: `frontend/src/features/mlb/game/MlbGameOddsBoard.test.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` (props)
- Optionally: `frontend/src/features/mlb/game/MlbPregameCenter.test.tsx`
- Docs: `md/system-design.md` Preview odds note if present

**Interfaces:**
- Consumes: `MlbOddsBookBoardView[]`
- Props change:

```typescript
type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home">;
  boards: MlbOddsBookBoardView[];
  isPending?: boolean;
};
```

- [ ] **Step 1: Failing UI tests**

```typescript
it("labels Bookmaker Total Spread and omits Money", () => {
  render(<MlbGameOddsBoard detail={…} boards={[oneBook]} />);
  expect(screen.getByText("Bookmaker")).toBeInTheDocument();
  expect(screen.queryByText("Money")).not.toBeInTheDocument();
  expect(screen.getAllByText("Pinnacle").length).toBeGreaterThanOrEqual(1);
});

it("stacks multiple books", () => {
  render(<MlbGameOddsBoard detail={…} boards={[pxBoard, novigBoard]} />);
  expect(screen.getAllByText("ProphetX").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("Novig").length).toBeGreaterThanOrEqual(1);
});
```

Add `novig` to `SPORTSBOOK_LABELS`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement UI**

- `COLUMN_LABELS = ["Bookmaker", "Total", "Spread"]`
- Replace money tile with a book-name cell (text only, same tile chrome or plain centered text).
- Map `boards` → for each book, Away then Home rows.
- Header: “Odds” + `asOf` only (no single sportsbook).
- Empty `boards` + not pending → “Odds unavailable”.

Wire `MlbPregameCenter`:

```typescript
const oddsBoards = collectMlbOddsBookBoards(
  oddsQuery.data,
  detail.away.abbrev,
  detail.home.abbrev,
  detail.gameDate ?? undefined,
);
// pass boards={oddsBoards} into MlbProjectedLineups → MlbGameOddsBoard
```

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && npx vitest run src/features/mlb/game/MlbGameOddsBoard.test.tsx src/features/mlb/lib/mlbOddsBoard.test.ts src/features/mlb/game/MlbPregameCenter.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbGameOddsBoard.tsx \
  frontend/src/features/mlb/game/MlbGameOddsBoard.test.tsx \
  frontend/src/features/mlb/game/MlbPregameCenter.tsx \
  frontend/src/features/mlb/game/MlbProjectedLineups.tsx \
  frontend/src/features/mlb/game/MlbPregameCenter.test.tsx \
  md/system-design.md
git commit -m "feat(mlb): stack all book team odds on preview board"
```

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| Drop Money / Bookmaker name only | 5 |
| One block per book stacked | 5 |
| PX → Novig → Pinnacle → FD → DK order | 2 (`collect_book_boards`), 4/5 display |
| Wire Novig team table | 1 + 2 |
| Keep matchups `games[]` merge | 2 |
| Additive `book_boards` | 2 + 3 |
| FG filter only | 1 (SQL) + existing normalize |
| Fallback when `book_boards` empty | 4 |
| Tests backend + frontend | 1, 2, 4, 5 |

## Placeholder / consistency self-review

- No TBD steps; `MlbOddsGame` reused for `book_boards`.
- Display order constant name `_BOOK_BOARD_ORDER` used in Task 2 only; frontend preserves API order from `collect_book_boards`.
- Prop rename `view` → `boards` must update all call sites in Task 5.
