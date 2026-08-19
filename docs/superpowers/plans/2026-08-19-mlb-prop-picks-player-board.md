# MLB Prop Picks Player Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/mlb/prop_picks` into a player board (View X props) with a per-player main-line odds grid, seeding PrizePicks from Supabase instead of Parlay.

**Architecture:** Keep `GET /api/mlb/props/today`. Seed PrizePicks from `fetch_latest_prizepicks("mlb")`. Attach `books_main` (per-book main O/U) on each row. Frontend groups rows into player cards, sorts by unique-stat count, and routes to `/mlb/prop_picks/player/:playerSlug` for the odds grid.

**Tech Stack:** FastAPI + Pydantic, React Router + TanStack Query + Vitest, existing Parlay DK/FD indexes + Supabase scrapers

## Global Constraints

- Product name: **statvista**
- PrizePicks board: Supabase only — never fall back to `parlay.prizepicks_board`
- Book grid columns: ProphetX, Novig, DraftKings, FanDuel, Pinnacle (no OPEN/BEST)
- Book cells: **main** lines only (no alts); missing → NL
- `prop_count` / X = unique DFS `stat` values per player
- Format/legs UI removed; API defaults remain (`prizepicks`→`power`/`4`, `underdog`→`standard`/`4`)
- Filters: Team + name search only
- WNBA prop picks out of scope
- OpenAPI must stay in sync (`export_openapi` + `npm run generate:api`)

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_props.py` | `MlbPropBookMainQuote`, `MlbPropBooksMain`, `books_main` on `MlbPropRow` |
| `backend/app/core/odds_snapshots.py` | Include `is_main` in PX/Novig (and Pinnacle if column exists) selects |
| `backend/app/domains/mlb/props.py` | PP from Supabase; build/attach `books_main`; error `prizepicks_unavailable` |
| `backend/tests/test_mlb_props.py` | Seed + main-line + empty PP tests; update `_stub_snapshots` |
| `backend/tests/test_mlb_prop_books_schema.py` | Optional: assert `MlbPropBooksMain` field set |
| `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts` | Contract regen |
| `frontend/src/features/mlb/league/groupMlbPropPlayers.ts` | Aggregate players + slug helpers |
| `frontend/src/features/mlb/league/groupMlbPropPlayers.test.ts` | Aggregation / count / slug tests |
| `frontend/src/features/mlb/league/MlbPropPicksHeader.tsx` | Tabs only (drop legs pill) |
| `frontend/src/features/mlb/league/MlbPropPicksFilters.tsx` | Team + search (drop Stat/Side) |
| `frontend/src/features/mlb/league/filterMlbPropPicks.ts` | Team + name filter on player cards (or thin wrapper) |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Player cards + View X props links |
| `frontend/src/pages/MlbPropPicksPage.tsx` | Wire aggregation, filters, defaults |
| `frontend/src/pages/MlbPlayerPropsPage.tsx` | Player odds grid detail page |
| `frontend/src/app/AppRouter.tsx` | Register detail route |
| `md/system-design.md` | Update `/mlb/prop_picks` + new route row |

---

### Task 1: Schema — `books_main` on `MlbPropRow`

**Files:**
- Modify: `backend/app/domains/mlb/schemas_props.py`
- Modify: `backend/tests/test_mlb_prop_books_schema.py`
- Update: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Produces:
  - `MlbPropBookMainQuote(line: float, over_american: int | None, under_american: int | None, changed_at: str | None = None)`
  - `MlbPropBooksMain(prophetx=…, novig=…, draftkings=…, fanduel=…, pinnacle=…)` (all optional)
  - `MlbPropRow.books_main: MlbPropBooksMain`

- [ ] **Step 1: Write failing schema test**

Append to `backend/tests/test_mlb_prop_books_schema.py`:

```python
from app.domains.mlb.schemas_props import MlbPropBooksMain, MlbPropRow

def test_mlb_prop_books_main_fields_match_book_set():
    assert tuple(MlbPropBooksMain.model_fields.keys()) == EXPECTED

def test_mlb_prop_row_includes_books_main():
    assert "books_main" in MlbPropRow.model_fields
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_mlb_prop_books_schema.py::test_mlb_prop_books_main_fields_match_book_set tests/test_mlb_prop_books_schema.py::test_mlb_prop_row_includes_books_main -v`

Expected: FAIL (`MlbPropBooksMain` not defined / `books_main` missing)

- [ ] **Step 3: Add schema types**

In `backend/app/domains/mlb/schemas_props.py`, add:

```python
class MlbPropBookMainQuote(BaseModel):
    """A book's main line for a player+stat (may differ from the DFS line)."""

    model_config = _RESPONSE_CONFIG

    line: float
    over_american: int | None = None
    under_american: int | None = None
    changed_at: str | None = None


class MlbPropBooksMain(BaseModel):
    model_config = _RESPONSE_CONFIG

    prophetx: MlbPropBookMainQuote | None = None
    novig: MlbPropBookMainQuote | None = None
    draftkings: MlbPropBookMainQuote | None = None
    fanduel: MlbPropBookMainQuote | None = None
    pinnacle: MlbPropBookMainQuote | None = None
```

On `MlbPropRow`, add:

```python
books_main: MlbPropBooksMain = Field(default_factory=MlbPropBooksMain)
```

Re-export from `schemas.py` if that module lists prop schema symbols explicitly.

- [ ] **Step 4: Run schema tests**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_mlb_prop_books_schema.py -v`

Expected: PASS

- [ ] **Step 5: Regenerate OpenAPI + frontend types**

```bash
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `MlbPropBookMainQuote` / `MlbPropBooksMain` / `books_main` appear in `api.schema.d.ts`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/schemas_props.py backend/app/domains/mlb/schemas.py \
  backend/tests/test_mlb_prop_books_schema.py frontend/openapi.json \
  backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
feat(api): add books_main schema for MLB prop player odds grid

EOF
)"
```

---

### Task 2: PrizePicks from Supabase + attach `books_main`

**Files:**
- Modify: `backend/app/core/odds_snapshots.py`
- Modify: `backend/app/domains/mlb/props.py`
- Modify: `backend/tests/test_mlb_props.py`

**Interfaces:**
- Consumes: `fetch_latest_prizepicks("mlb")`, existing book indexes / snapshot rows
- Produces:
  - `MainLineKey = tuple[str, str]`  # (norm_player, stat_key)
  - `MainLineIndex = dict[MainLineKey, MlbPropBookMainQuote]`
  - `_main_from_side_index(index: SideIndex) -> MainLineIndex`
  - `_main_from_snapshot_rows(rows, *, player_field, stat_field) -> MainLineIndex` (honors `is_main` when present; else balance-pick one line)
  - `get_mlb_props_today`: PP board from Supabase; `error="prizepicks_unavailable"` when empty; each row has `books_main`

- [ ] **Step 1: Extend snapshot selects for `is_main`**

In `backend/app/core/odds_snapshots.py`, add `is_main` to ProphetX and Novig column lists (and Pinnacle if the table has the column; if not, leave Pinnacle as-is and use balance-pick):

```python
# prophetx / novig example
"player_name, stat_name, line_score, side, american_price, scraped_at, is_main"
```

If a column is missing in some environments, keep select without `is_main` and treat missing flag as “all candidates” → balance-pick (document in code comment). Prefer reading `is_main` when present.

- [ ] **Step 2: Write failing assembly tests**

Update `_stub_snapshots` in `backend/tests/test_mlb_props.py` to stub `fetch_latest_prizepicks` and stop putting PP board on Parlay:

```python
def _stub_snapshots(
    monkeypatch,
    *,
    dfs_pp: list[dict] | None = None,
    dfs_ud: list[dict] | None = None,
    prophetx: list[dict] | None = None,
    novig: list[dict] | None = None,
    pinnacle: list[dict] | None = None,
    parlay: ParlayMlbNormalized | None = None,
    parlay_error: Exception | None = None,
    parlay_soft_empty: bool = False,
):
    monkeypatch.setattr(
        svc, "fetch_latest_prizepicks", lambda league="mlb": dfs_pp or []
    )
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="mlb": dfs_ud or [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="mlb": prophetx or [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="mlb": novig or [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="mlb": pinnacle or [])

    async def fake_fetch_parlay(**_kwargs):
        if parlay_error is not None:
            raise parlay_error
        if parlay_soft_empty:
            return _parlay(unavailable=True)
        if parlay is not None:
            return parlay
        # Books only — no PrizePicks board on Parlay path
        return _parlay(book_indexes=_judge_parlay_indexes())

    monkeypatch.setattr(svc, "fetch_mlb_parlay_props_normalized", fake_fetch_parlay)
```

Add tests (adjust fixture stats/lines to match existing Judge helpers):

```python
@pytest.mark.asyncio
async def test_prizepicks_board_from_supabase_not_parlay(monkeypatch):
    now = datetime.now(timezone.utc)
    pp = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]
    # Parlay PP board would be a different player if wrongly used
    bad_parlay = _parlay(
        board=[
            {
                "player_name": "Wrong Player",
                "stat_type": "Total Bases",
                "line_score": 9.5,
                "odds_type": "standard",
            }
        ],
        book_indexes=_judge_parlay_indexes(now),
    )
    _stub_snapshots(monkeypatch, dfs_pp=pp, parlay=bad_parlay, novig=_judge_novig_snapshot(now))
    monkeypatch.setattr(
        svc, "get_mlb_player_index", lambda: _async_return({})
    )
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    assert out.props[0].player_name == "Aaron Judge"
    assert out.error is None


@pytest.mark.asyncio
async def test_prizepicks_unavailable_when_snapshot_empty(monkeypatch):
    _stub_snapshots(monkeypatch, dfs_pp=[])
    monkeypatch.setattr(svc, "get_mlb_player_index", lambda: _async_return({}))
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    assert out.props == []
    assert out.error == "prizepicks_unavailable"


@pytest.mark.asyncio
async def test_books_main_uses_book_main_line_not_dfs_only(monkeypatch):
    now = datetime.now(timezone.utc)
    pp = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]
    # Novig main at 2.5 while DFS is 1.5
    novig = [
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 2.5,
            "side": "over",
            "american_price": -115,
            "scraped_at": now,
            "is_main": True,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 2.5,
            "side": "under",
            "american_price": -105,
            "scraped_at": now,
            "is_main": True,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 1.5,
            "side": "over",
            "american_price": -200,
            "scraped_at": now,
            "is_main": False,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 1.5,
            "side": "under",
            "american_price": 150,
            "scraped_at": now,
            "is_main": False,
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp,
        novig=novig,
        parlay=_parlay(book_indexes=_judge_parlay_indexes(now)),
    )
    monkeypatch.setattr(svc, "get_mlb_player_index", lambda: _async_return({}))
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    main = out.props[0].books_main.novig
    assert main is not None
    assert main.line == 2.5
    assert main.over_american == -115
    assert main.under_american == -105
```

Fix any existing tests that assumed PP came from Parlay board after updating `_stub_snapshots`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_mlb_props.py::test_prizepicks_board_from_supabase_not_parlay tests/test_mlb_props.py::test_prizepicks_unavailable_when_snapshot_empty tests/test_mlb_props.py::test_books_main_uses_book_main_line_not_dfs_only -v`

Expected: FAIL (still seeds from Parlay / no `books_main` main-line logic)

- [ ] **Step 4: Implement main-line helpers + wire assemble**

In `props.py`:

1. Import `fetch_latest_prizepicks` and `MlbPropBookMainQuote`, `MlbPropBooksMain`.
2. Add helpers (use `balance_score` from `src.odds.parlay_main_lines` when `is_main` absent / multiple mains):

```python
MainLineKey = tuple[str, str]  # norm_player, stat_key
MainLineIndex = dict[MainLineKey, MlbPropBookMainQuote]


def _main_from_snapshot_rows(
    rows: list[dict[str, Any]],
    *,
    player_field: str,
    stat_field: str,
) -> MainLineIndex:
    """Build main O/U quotes per (player, stat). Prefer is_main=True rows."""
    # Group candidate lines; if any row has is_main True for a line, keep only those lines.
    # Else pick the line with best balance_score across over/under americans.
    ...


def _main_from_side_index(index: SideIndex) -> MainLineIndex:
    """Collapse an exact-line SideIndex (already main-filtered, e.g. Parlay DK/FD)
    into one quote per (player, stat). If multiple lines remain, balance-pick."""
    ...
```

3. In `_assemble_rows`, for each board row resolve `stat_key` (same canonical key used when building the board), then:

```python
books_main=MlbPropBooksMain(
    prophetx=px_main.get(main_key),
    novig=novig_main.get(main_key),
    draftkings=dk_main.get(main_key),
    fanduel=fd_main.get(main_key),
    pinnacle=pin_main.get(main_key),
)
```

4. In `get_mlb_props_today`:

```python
if app == "prizepicks":
    dfs_rows = fetch_latest_prizepicks("mlb")
    seed_error = "prizepicks_unavailable" if not dfs_rows else None
else:
    dfs_rows = fetch_latest_underdog("mlb")
    seed_error = "underdog_unavailable" if not dfs_rows else None  # only if existing UD behavior uses this; otherwise keep prior UD empty handling

board = _build_board(app, dfs_rows)
# build side indexes for fair/edge as today
# build main indexes for books_main
# assemble rows...

response = MlbPropsResponse(
    ...
    props=rows,
    error=seed_error or parlay_error,  # prefer seed_error when board empty; if board non-empty, parlay_error may still surface for DK/FD soft-fail — match existing error semantics unless tests require seed_error alone when empty
)
```

When PP snapshot is empty: `props=[]`, `error="prizepicks_unavailable"`, do not use Parlay PP board.

Keep exact-line `books` for fair/edge as today (even if unused on the new card face).

- [ ] **Step 5: Run MLB props tests**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_mlb_props.py -v`

Expected: PASS (update any broken stubs/assertions)

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/odds_snapshots.py backend/app/domains/mlb/props.py \
  backend/tests/test_mlb_props.py
git commit -m "$(cat <<'EOF'
feat(mlb): seed PrizePicks from Supabase and attach books_main

EOF
)"
```

---

### Task 3: Frontend — group players + slug helpers

**Files:**
- Create: `frontend/src/features/mlb/league/groupMlbPropPlayers.ts`
- Create: `frontend/src/features/mlb/league/groupMlbPropPlayers.test.ts`

**Interfaces:**
- Produces:
  - `export type MlbPropPlayerCard = { player_name: string; player_slug: string; prop_count: number; team_abbrev: string | null; position: string | null; headshot_url: string | null; stats: string[]; rows: ApiMlbPropRow[] }`
  - `export function slugifyPlayerName(name: string): string`
  - `export function groupMlbPropPlayers(props: ApiMlbPropRow[]): MlbPropPlayerCard[]` — unique stats for `prop_count`, sort count desc then name
  - `export function findPlayerBySlug(players: MlbPropPlayerCard[], slug: string): MlbPropPlayerCard | null`
  - `export function uniqueStatRows(rows: ApiMlbPropRow[]): ApiMlbPropRow[]` — first row per `stat`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from "vitest";
import {
  findPlayerBySlug,
  groupMlbPropPlayers,
  slugifyPlayerName,
  uniqueStatRows,
} from "./groupMlbPropPlayers";
import type { ApiMlbPropRow } from "@/shared/lib/api";

function row(partial: Partial<ApiMlbPropRow> & Pick<ApiMlbPropRow, "player_name" | "stat" | "line">): ApiMlbPropRow {
  return {
    team_abbrev: "NYY",
    headshot_url: null,
    position: "OF",
    recommended_side: "over",
    fair_pct: null,
    edge_pct: null,
    alt_edge_pct: null,
    source_tier: "no_sharp_read",
    confidence_chips: [],
    sample_chips: [],
    recency_chip: null,
    books: {},
    books_main: {},
    dfs: { line: partial.line, changed_at: null, american: null, payout_multiplier: null },
    fair_explain: "",
    ...partial,
  } as ApiMlbPropRow;
}

describe("groupMlbPropPlayers", () => {
  it("counts unique stats and sorts by count desc", () => {
    const players = groupMlbPropPlayers([
      row({ player_name: "A", stat: "Strikeouts", line: 6.5 }),
      row({ player_name: "B", stat: "Hits", line: 1.5 }),
      row({ player_name: "A", stat: "Walks", line: 2.5 }),
      row({ player_name: "A", stat: "Strikeouts", line: 7.5 }), // same stat
    ]);
    expect(players[0]?.player_name).toBe("A");
    expect(players[0]?.prop_count).toBe(2);
    expect(players[1]?.prop_count).toBe(1);
  });

  it("slugifies and finds by slug", () => {
    expect(slugifyPlayerName("Aaron Judge")).toBe("aaron-judge");
    const players = groupMlbPropPlayers([
      row({ player_name: "Aaron Judge", stat: "Hits", line: 1.5 }),
    ]);
    expect(findPlayerBySlug(players, "aaron-judge")?.player_name).toBe(
      "Aaron Judge",
    );
  });
});

describe("uniqueStatRows", () => {
  it("keeps first row per stat", () => {
    const rows = uniqueStatRows([
      row({ player_name: "A", stat: "Strikeouts", line: 6.5 }),
      row({ player_name: "A", stat: "Strikeouts", line: 7.5 }),
      row({ player_name: "A", stat: "Walks", line: 2.5 }),
    ]);
    expect(rows.map((r) => r.stat)).toEqual(["Strikeouts", "Walks"]);
    expect(rows[0]?.line).toBe(6.5);
  });
});
```

Adjust `as ApiMlbPropRow` / required fields to satisfy TypeScript after OpenAPI regen.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/mlb/league/groupMlbPropPlayers.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement helpers**

```typescript
export function slugifyPlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function groupMlbPropPlayers(props: ApiMlbPropRow[]): MlbPropPlayerCard[] {
  const byName = new Map<string, ApiMlbPropRow[]>();
  for (const p of props) {
    const key = p.player_name.trim();
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
  }
  const cards: MlbPropPlayerCard[] = [];
  for (const [player_name, rows] of byName) {
    const stats = [...new Set(rows.map((r) => r.stat).filter(Boolean))];
    const sample = rows[0]!;
    cards.push({
      player_name,
      player_slug: slugifyPlayerName(player_name),
      prop_count: stats.length,
      team_abbrev: sample.team_abbrev,
      position: sample.position,
      headshot_url: sample.headshot_url,
      stats,
      rows,
    });
  }
  cards.sort(
    (a, b) =>
      b.prop_count - a.prop_count ||
      a.player_name.localeCompare(b.player_name),
  );
  return cards;
}

export function findPlayerBySlug(
  players: MlbPropPlayerCard[],
  slug: string,
): MlbPropPlayerCard | null {
  return players.find((p) => p.player_slug === slug) ?? null;
}

export function uniqueStatRows(rows: ApiMlbPropRow[]): ApiMlbPropRow[] {
  const seen = new Set<string>();
  const out: ApiMlbPropRow[] = [];
  for (const row of rows) {
    if (seen.has(row.stat)) continue;
    seen.add(row.stat);
    out.push(row);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/mlb/league/groupMlbPropPlayers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/league/groupMlbPropPlayers.ts \
  frontend/src/features/mlb/league/groupMlbPropPlayers.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): aggregate MLB prop rows into player cards

EOF
)"
```

---

### Task 4: Board UI — header, filters, player cards

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksHeader.tsx` (+ test)
- Modify: `frontend/src/features/mlb/league/MlbPropPicksFilters.tsx` (+ test)
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.tsx` (+ test)
- Modify: `frontend/src/pages/MlbPropPicksPage.tsx` (+ test)
- Modify: `frontend/src/features/mlb/league/filterMlbPropPicks.ts` as needed for team/search on cards

**Interfaces:**
- Consumes: `groupMlbPropPlayers`, `useMlbProps({ app, format, legs })` with fixed defaults
- Produces: Player board with Link CTA `to={`/mlb/prop_picks/player/${slug}?app=${app}`}`

- [ ] **Step 1: Write / update failing UI tests**

Header: assert no “legs” / “-pick” controls; tabs remain.

List: given grouped players, assert `View 2 props` link, no Over/Under edge text.

Page: assert format/legs not shown; Team filter + search present; Stat/Side absent.

- [ ] **Step 2: Run targeted vitest — expect FAIL**

Run: `cd frontend && npx vitest run src/features/mlb/league/MlbPropPicksHeader.test.tsx src/features/mlb/league/MlbPropPicksList.test.tsx src/pages/MlbPropPicksPage.test.tsx`

- [ ] **Step 3: Implement UI**

1. **Header** — remove `legs` / `onLegsChange` / `LegsPill`; keep tabs + `children` slot.
2. **Filters** — Team multi-select + text search input (`Search player`); remove Stat/Side.
3. **Page** — hardcode `legs={4}` and `formatForApp(app)` for the hook; `groupMlbPropPlayers(props)` then filter by team + name query; pass players to list.
4. **List** — accept `players: MlbPropPlayerCard[]` + `app`; render card (headshot, team·pos, name, `Link` “View {n} props”); drop expand panel / edge / side; keep pagination on players (page size 20); remove format/legs/breakeven chrome that no longer applies (or keep last-updated only).

Card CTA example:

```tsx
<Link
  to={`/mlb/prop_picks/player/${player.player_slug}?app=${app}`}
  className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-black"
>
  View {player.prop_count} props
</Link>
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/features/mlb/league/MlbPropPicksHeader.test.tsx src/features/mlb/league/MlbPropPicksFilters.test.tsx src/features/mlb/league/MlbPropPicksList.test.tsx src/pages/MlbPropPicksPage.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/league/MlbPropPicksHeader.tsx \
  frontend/src/features/mlb/league/MlbPropPicksHeader.test.tsx \
  frontend/src/features/mlb/league/MlbPropPicksFilters.tsx \
  frontend/src/features/mlb/league/MlbPropPicksFilters.test.tsx \
  frontend/src/features/mlb/league/MlbPropPicksList.tsx \
  frontend/src/features/mlb/league/MlbPropPicksList.test.tsx \
  frontend/src/features/mlb/league/filterMlbPropPicks.ts \
  frontend/src/features/mlb/league/filterMlbPropPicks.test.ts \
  frontend/src/pages/MlbPropPicksPage.tsx \
  frontend/src/pages/MlbPropPicksPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): MLB prop picks player board with View X props

EOF
)"
```

---

### Task 5: Player detail page + route

**Files:**
- Create: `frontend/src/pages/MlbPlayerPropsPage.tsx`
- Create: `frontend/src/pages/MlbPlayerPropsPage.test.tsx`
- Create (optional extract): `frontend/src/features/mlb/league/MlbPlayerPropsOddsGrid.tsx` (+ test)
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`

**Interfaces:**
- Route: `/mlb/prop_picks/player/:playerSlug`
- Query: `app=prizepicks|underdog` (default `prizepicks`)
- Grid columns: ProphetX, Novig, DraftKings, FanDuel, Pinnacle
- Cell: `O {line} ({american})` / `U {line} ({american})` or `NL` from `books_main`

- [ ] **Step 1: Write failing page + router tests**

```typescript
it("renders player odds grid at /mlb/prop_picks/player/:playerSlug", async () => {
  // mock /api/mlb/props/today with one player, two stats, books_main populated
  renderWithProviders(["/mlb/prop_picks/player/aaron-judge?app=prizepicks"]);
  expect(await screen.findByText(/Aaron Judge/i)).toBeInTheDocument();
  expect(screen.getByText(/Strikeouts/i)).toBeInTheDocument();
  expect(screen.getByText(/DraftKings/i)).toBeInTheDocument();
});

it("shows empty state for unknown slug", async () => {
  renderWithProviders(["/mlb/prop_picks/player/nobody?app=prizepicks"]);
  expect(await screen.findByText(/not found|unavailable/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /prop picks|back/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npx vitest run src/pages/MlbPlayerPropsPage.test.tsx src/app/AppRouter.test.tsx`

- [ ] **Step 3: Implement page + grid**

```tsx
// MlbPlayerPropsPage.tsx (sketch)
const { playerSlug } = useParams();
const [params] = useSearchParams();
const app = (params.get("app") === "underdog" ? "underdog" : "prizepicks");
const format = app === "underdog" ? "standard" : "power";
const { data, isLoading, isError } = useMlbProps({ app, format, legs: 4 });
const players = useMemo(() => groupMlbPropPlayers(data?.props ?? []), [data]);
const player = findPlayerBySlug(players, playerSlug ?? "");
const markets = player ? uniqueStatRows(player.rows) : [];
```

Grid header row: Market | ProphetX | Novig | DraftKings | FanDuel | Pinnacle  
Each market row: `{stat}` + optional DFS `{line}` label; cells from `row.books_main[book]`.

```tsx
function MainQuoteCell({ quote }: { quote: ApiMlbPropBookMainQuote | null | undefined }) {
  if (!quote) return <span className="text-white/35">NL</span>;
  return (
    <div className="font-mono text-sm text-white">
      <div>O {quote.line} ({formatAmericanOdds(quote.over_american)})</div>
      <div>U {quote.line} ({formatAmericanOdds(quote.under_american)})</div>
    </div>
  );
}
```

Add `export type ApiMlbPropBookMainQuote = Schemas["MlbPropBookMainQuote"]` in `api.ts` if not already via schema.

Wire router:

```tsx
<Route
  path="/mlb/prop_picks/player/:playerSlug"
  element={<MlbPlayerPropsPage />}
/>
```

Keep `/mlb/prop_picks` route as-is.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/pages/MlbPlayerPropsPage.test.tsx src/app/AppRouter.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MlbPlayerPropsPage.tsx \
  frontend/src/pages/MlbPlayerPropsPage.test.tsx \
  frontend/src/features/mlb/league/MlbPlayerPropsOddsGrid.tsx \
  frontend/src/features/mlb/league/MlbPlayerPropsOddsGrid.test.tsx \
  frontend/src/app/AppRouter.tsx \
  frontend/src/app/AppRouter.test.tsx \
  frontend/src/shared/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(frontend): MLB player prop odds grid detail page

EOF
)"
```

---

### Task 6: Docs — `system-design.md`

**Files:**
- Modify: `md/system-design.md`

- [ ] **Step 1: Update route table**

- Change `/mlb/prop_picks` description to player board (tabs, Team + search, View X props, sort by prop count; PP from Supabase; format/legs defaults hidden).
- Add `/mlb/prop_picks/player/:playerSlug` → `MlbPlayerPropsPage` → same `useMlbProps` / `GET /api/mlb/props/today` → main-line odds grid via `books_main`.
- Update tree under AppRouter if listed.

- [ ] **Step 2: Commit**

```bash
git add md/system-design.md
git commit -m "$(cat <<'EOF'
docs: MLB prop picks player board and detail route wiring

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Player cards + View X props | 4 |
| Sort by prop count desc | 3, 4 |
| Unique-stat count | 3 |
| PP/UD tabs; no format/legs pills | 4 |
| Team + name search | 4 |
| PrizePicks from Supabase, no Parlay PP fallback | 2 |
| Detail route + odds grid | 5 |
| Main lines only / NL / no OPEN·BEST | 2, 5 |
| books_main schema + OpenAPI | 1 |
| system-design update | 6 |
| Errors (empty PP, unknown slug, Parlay DK/FD NL) | 2, 5 |

## Plan self-review

- No TBD placeholders left for implementers beyond optional grid file extract.
- `books_main` / `MlbPropBookMainQuote` names consistent across tasks.
- `_stub_snapshots` change called out so existing `test_mlb_props.py` cases are updated in Task 2.
- DK/FD still from Parlay indexes (spec non-goal: removing Parlay for books).
