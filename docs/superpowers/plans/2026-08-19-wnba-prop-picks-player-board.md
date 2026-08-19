# WNBA Prop Picks Player Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/wnba/prop_picks` into a player board (View X props) with a per-player main-line odds grid that mirrors MLB, seeding PrizePicks from Supabase only and attaching MLB-parity `books_main` columns.

**Architecture:** Keep `GET /api/wnba/props/today`. Seed PrizePicks from `fetch_latest_prizepicks("wnba")` (no Parlay PP). Widen WNBA Parlay sportsbook indexes to MLB’s cmp set. Attach `books_main` on each row. Frontend groups rows into player cards (after `excludePastGameProps`), sorts by unique-stat count, and routes to `/wnba/prop_picks/player/:playerSlug` for the odds grid.

**Tech Stack:** FastAPI + Pydantic, React Router + TanStack Query + Vitest, Parlay WNBA board + Supabase scrapers

## Global Constraints

- Product name: **statvista**
- PrizePicks board: Supabase only — never use `parlay.prizepicks_board` for `/wnba/prop_picks`
- Book grid columns (match MLB): ProphetX, Novig, DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365, Pinnacle (no OPEN/BEST)
- Book cells: **main** lines only (no alts); missing → NL
- `prop_count` / X = unique DFS `stat` values per player
- Format/legs UI removed; API defaults remain (`prizepicks`→`power`/`4`, `underdog`→`standard`/`4`)
- Filters: Team + name search only; keep client hide of finals / prior-day tips
- Game-detail Props tab out of scope
- OpenAPI must stay in sync (`export_openapi` + `npm run generate:api`)
- Spec: `docs/superpowers/specs/2026-08-19-wnba-prop-picks-player-board-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/wnba/schemas_prop_picks.py` | `WnbaPropBookMainQuote`, `WnbaPropBooksMain`, `books_main` on `WnbaPropRow` |
| `backend/app/domains/wnba/schemas.py` | Re-export new schema types |
| `backend/tests/test_wnba_prop_picks_schema.py` | Assert `books_main` field set |
| `backend/app/providers/parlay/wnba_board.py` | Expand allowlist/indexes to MLB cmp books |
| `backend/tests/test_wnba_parlay_board_books.py` | Assert schema book keys include cmp set |
| `backend/app/domains/wnba/props.py` | PP from Supabase; build/attach `books_main` |
| `backend/tests/test_wnba_props.py` | Seed + main-line + empty PP; retarget Parlay-PP fixtures to snapshot |
| `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`, `frontend/src/shared/lib/api.ts` | Contract regen + `ApiWnbaPropBookMainQuote` export |
| `frontend/src/features/basketball/lib/wnbaBookLabels.ts` | Add `kalshi` / `fliff` labels |
| `frontend/src/features/basketball/league/groupWnbaPropPlayers.ts` | Aggregate players + slug helpers (port MLB collision slugs) |
| `frontend/src/features/basketball/league/groupWnbaPropPlayers.test.ts` | Aggregation / count / slug tests |
| `frontend/src/features/basketball/league/WnbaPropPicksHeader.tsx` | Tabs only (drop legs pill); `appFromSearch` |
| `frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx` | Team + search (drop Stat/Side) |
| `frontend/src/features/basketball/league/filterWnbaPropPicks.ts` | Keep `excludePastGameProps`; add `filterWnbaPropPlayers` |
| `frontend/src/features/basketball/league/WnbaPropPicksList.tsx` | Player cards + View X props links |
| `frontend/src/pages/LeaguePropPicksPage.tsx` | Wire aggregation, filters, URL `app`, defaults |
| `frontend/src/pages/WnbaPlayerPropsPage.tsx` | Player odds grid detail page |
| `frontend/src/features/basketball/league/WnbaPlayerPropsOddsGrid.tsx` | Main-line odds table |
| `frontend/src/app/AppRouter.tsx` | Register detail route |
| `md/system-design.md` | Update `/wnba/prop_picks` + new route row |

---

### Task 1: Schema — `books_main` on `WnbaPropRow`

**Files:**
- Modify: `backend/app/domains/wnba/schemas_prop_picks.py`
- Modify: `backend/app/domains/wnba/schemas.py`
- Modify: `backend/tests/test_wnba_prop_picks_schema.py`
- Update: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`, `frontend/src/shared/lib/api.ts`

**Interfaces:**
- Produces:
  - `WnbaPropBookMainQuote(line: float, over_american: int | None, under_american: int | None, changed_at: str | None = None)`
  - `WnbaPropBooksMain` with keys: `prophetx`, `novig`, `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365`, `pinnacle` (all optional)
  - `WnbaPropRow.books_main: WnbaPropBooksMain`

- [ ] **Step 1: Write failing schema tests**

Append to `backend/tests/test_wnba_prop_picks_schema.py`:

```python
from app.domains.wnba.schemas_prop_picks import WnbaPropBooksMain, WnbaPropRow

EXPECTED_BOOKS_MAIN = (
    "prophetx",
    "novig",
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
    "pinnacle",
)


def test_wnba_prop_books_main_fields_match_mlb_set():
    assert tuple(WnbaPropBooksMain.model_fields.keys()) == EXPECTED_BOOKS_MAIN


def test_wnba_prop_row_includes_books_main():
    assert "books_main" in WnbaPropRow.model_fields
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_wnba_prop_picks_schema.py::test_wnba_prop_books_main_fields_match_mlb_set tests/test_wnba_prop_picks_schema.py::test_wnba_prop_row_includes_books_main -v`

Expected: FAIL (`WnbaPropBooksMain` not defined / `books_main` missing)

- [ ] **Step 3: Add schema types**

In `backend/app/domains/wnba/schemas_prop_picks.py`, add (mirror `MlbPropBookMainQuote` / `MlbPropBooksMain`):

```python
class WnbaPropBookMainQuote(BaseModel):
    """A book's main line for a player+stat (may differ from the DFS line)."""

    model_config = _RESPONSE_CONFIG

    line: float
    over_american: int | None = None
    under_american: int | None = None
    changed_at: str | None = None


class WnbaPropBooksMain(BaseModel):
    model_config = _RESPONSE_CONFIG

    prophetx: WnbaPropBookMainQuote | None = None
    novig: WnbaPropBookMainQuote | None = None
    draftkings: WnbaPropBookMainQuote | None = None
    fanduel: WnbaPropBookMainQuote | None = None
    betmgm: WnbaPropBookMainQuote | None = None
    caesars: WnbaPropBookMainQuote | None = None
    kalshi: WnbaPropBookMainQuote | None = None
    fliff: WnbaPropBookMainQuote | None = None
    bet365: WnbaPropBookMainQuote | None = None
    pinnacle: WnbaPropBookMainQuote | None = None
```

On `WnbaPropRow`, add:

```python
books_main: WnbaPropBooksMain = Field(default_factory=WnbaPropBooksMain)
```

Re-export `WnbaPropBookMainQuote` and `WnbaPropBooksMain` from `backend/app/domains/wnba/schemas.py` (`__all__` too).

- [ ] **Step 4: Run schema tests**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_wnba_prop_picks_schema.py -v`

Expected: PASS

- [ ] **Step 5: Regenerate OpenAPI + frontend types**

```bash
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

In `frontend/src/shared/lib/api.ts`, add next to other WNBA prop types:

```typescript
export type ApiWnbaPropBookMainQuote = Schemas["WnbaPropBookMainQuote"];
```

Confirm `WnbaPropBookMainQuote` / `WnbaPropBooksMain` / `books_main` appear in `api.schema.d.ts`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/wnba/schemas_prop_picks.py backend/app/domains/wnba/schemas.py \
  backend/tests/test_wnba_prop_picks_schema.py frontend/openapi.json \
  backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts \
  frontend/src/shared/lib/api.ts \
  docs/superpowers/specs/2026-08-19-wnba-prop-picks-player-board-design.md \
  docs/superpowers/plans/2026-08-19-wnba-prop-picks-player-board.md
git commit -m "$(cat <<'EOF'
feat(api): add books_main schema for WNBA prop player odds grid

EOF
)"
```

---

### Task 2: Widen WNBA Parlay sportsbook indexes

**Files:**
- Modify: `backend/app/providers/parlay/wnba_board.py`
- Create: `backend/tests/test_wnba_parlay_board_books.py`

**Interfaces:**
- Consumes: existing `select_parlay_main_lines` / board normalize loop
- Produces: `ParlayWnbaNormalized.book_indexes` keys include `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365` when present in Parlay payload
- Keep `prizepicks` in `_ALLOWED_BOOKS` so other consumers that still read `prizepicks_board` keep working; league prop_picks must not seed from it (Task 3)

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_wnba_parlay_board_books.py`:

```python
from app.providers.parlay import wnba_board as board

EXPECTED_SCHEMA_BOOKS = (
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
)


def test_wnba_parlay_schema_book_keys_match_mlb_cmp_set():
    assert board._SCHEMA_BOOK_KEYS == EXPECTED_SCHEMA_BOOKS
    for book in EXPECTED_SCHEMA_BOOKS:
        assert book in board._ALLOWED_BOOKS
    assert "prizepicks" in board._ALLOWED_BOOKS
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_wnba_parlay_board_books.py -v`

Expected: FAIL (tuple still `("draftkings", "fanduel")`)

- [ ] **Step 3: Expand allowlist**

In `backend/app/providers/parlay/wnba_board.py`, replace:

```python
_ALLOWED_BOOKS = frozenset({"prizepicks", "draftkings", "fanduel"})
_SCHEMA_BOOK_KEYS: tuple[str, ...] = ("draftkings", "fanduel")
```

with:

```python
_ALLOWED_BOOKS = frozenset(
    {
        "prizepicks",
        "draftkings",
        "fanduel",
        "betmgm",
        "caesars",
        "kalshi",
        "fliff",
        "bet365",
    }
)
# Sportsbook side indexes for books_main (exact-line fair stays DK/FD + scrapers).
_SCHEMA_BOOK_KEYS: tuple[str, ...] = (
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
)
```

Confirm the normalize loop already indexes every key in `_SCHEMA_BOOK_KEYS` (it should — same pattern as MLB). If any hard-coded DK/FD-only branch exists, generalize it to iterate `_SCHEMA_BOOK_KEYS`.

- [ ] **Step 4: Run test — expect PASS**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_wnba_parlay_board_books.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/parlay/wnba_board.py \
  backend/tests/test_wnba_parlay_board_books.py
git commit -m "$(cat <<'EOF'
feat(wnba): index Parlay cmp books for prop picks books_main

EOF
)"
```

---

### Task 3: PrizePicks from Supabase + attach `books_main`

**Files:**
- Modify: `backend/app/domains/wnba/props.py`
- Modify: `backend/tests/test_wnba_props.py`

**Interfaces:**
- Consumes: `fetch_latest_prizepicks("wnba")`, `fetch_latest_*` with `mains_only=True` for PX/Novig, Parlay `book_indexes`
- Produces:
  - `MainLineKey = tuple[str, str]`  # (norm_player, stat_key)
  - `MainLineIndex = dict[MainLineKey, WnbaPropBookMainQuote]`
  - `_main_from_side_index(index: SideIndex) -> MainLineIndex`
  - `_main_from_snapshot_rows(rows, *, player_field, stat_field) -> MainLineIndex` using `canonical_stat_key_from_exchange` (not MLB sharp helper)
  - `get_wnba_props_today`: PP board from Supabase only; `error="prizepicks_unavailable"` when empty; each row has `books_main`

Reference implementation: `backend/app/domains/mlb/props.py` (`_main_from_snapshot_rows`, `_main_from_side_index`, `_assemble_rows` `books_main` block, `get_mlb_props_today` seed). Port helpers into WNBA; swap MLB stat canonicalizer for `canonical_stat_key_from_exchange`.

- [ ] **Step 1: Rewrite failing / outdated assembly tests**

In `backend/tests/test_wnba_props.py`:

1. **Replace** `test_prizepicks_falls_back_to_snapshot_when_parlay_pp_empty` with:

```python
@pytest.mark.asyncio
async def test_prizepicks_board_from_supabase_not_parlay(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    pp = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[
                {
                    "player_name": "Wrong Player",
                    "stat_type": "points",
                    "line_score": 99.5,
                    "odds_type": "standard",
                    "scraped_at": now,
                }
            ],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    assert out.props[0].player_name == "Caitlin Clark"
    assert out.error is None
```

2. **Update** every PrizePicks assemble test that currently seeds via `parlay.prizepicks_board` (including `test_exact_line_only_and_px_novig_set_fair`) to put DFS rows on `fetch_latest_prizepicks` and leave Parlay `prizepicks_board=[]` (Parlay may still supply `book_indexes`).

3. Stub `fetch_latest_prophetx` / `fetch_latest_novig` with `**_kw` so `mains_only=True` calls still hit the stub.

4. Add:

```python
@pytest.mark.asyncio
async def test_books_main_attaches_main_quotes(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    pp = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=None,
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_prophetx",
        lambda league="wnba", mains_only=False, **_kw: [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 20.5,
                "side": "over",
                "american_price": -115,
                "scraped_at": now,
                "is_main": True,
            },
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 20.5,
                "side": "under",
                "american_price": -105,
                "scraped_at": now,
                "is_main": True,
            },
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
                "is_main": False,
            },
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    main = out.props[0].books_main.prophetx
    assert main is not None
    assert main.line == 20.5
    assert main.over_american == -115
    assert main.under_american == -105
```

5. Ensure empty PP still yields `error == "prizepicks_unavailable"` when Parlay is available but snapshot empty (update `test_empty_seed_sets_error` if it currently depends on Parlay-first behavior).

- [ ] **Step 2: Run targeted tests — expect FAIL**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_wnba_props.py::test_prizepicks_board_from_supabase_not_parlay tests/test_wnba_props.py::test_books_main_attaches_main_quotes -v`

Expected: FAIL (still seeds Parlay PP / no `books_main`)

- [ ] **Step 3: Implement seed + `books_main` assembly**

In `backend/app/domains/wnba/props.py`:

1. Update module docstring: PP from Supabase only; step for `books_main`.
2. Import `WnbaPropBookMainQuote`, `WnbaPropBooksMain`.
3. Port from MLB (adapt types/stat key):
   - `_row_is_main_flag`, `_balance_for_sides`, `_quote_from_sides`, `_pick_main_line`
   - `_main_from_snapshot_rows` — use `canonical_stat_key_from_exchange(stat_raw)`
   - `_main_from_side_index`
4. Extend `_assemble_rows` with optional `px_main`, `novig_main`, `pin_main`, `parlay_mains` and set `books_main=WnbaPropBooksMain(...)` on each row (same book fields as MLB).
5. In `get_wnba_props_today`:

```python
if app == "prizepicks":
    dfs_rows = fetch_latest_prizepicks("wnba")
    seed_error = "prizepicks_unavailable" if not dfs_rows else None
else:
    dfs_rows = fetch_latest_underdog("wnba")
    seed_error = None
board = _build_board(app, dfs_rows)

# … existing fair indexes …

px_main = _main_from_snapshot_rows(
    fetch_latest_prophetx("wnba", mains_only=True),
    player_field="player_name",
    stat_field="stat_name",
)
novig_main = _main_from_snapshot_rows(
    fetch_latest_novig("wnba", mains_only=True),
    player_field="player_name",
    stat_field="stat_name",
)
pin_main = _main_from_snapshot_rows(
    pinnacle_rows if "pinnacle_rows" in locals() else fetch_latest_pinnacle("wnba"),
    player_field="player_name",
    stat_field="market_type",
)
# Prefer fetching pinnacle once and reusing for both fair index + pin_main
# (match MLB: one fetch_latest_pinnacle, then index + _main_from_snapshot_rows).

parlay_mains = {
    "draftkings": _main_from_side_index(parlay.book_indexes.get("draftkings", {})),
    "fanduel": _main_from_side_index(parlay.book_indexes.get("fanduel", {})),
    "betmgm": _main_from_side_index(parlay.book_indexes.get("betmgm", {})),
    "caesars": _main_from_side_index(parlay.book_indexes.get("caesars", {})),
    "kalshi": _main_from_side_index(parlay.book_indexes.get("kalshi", {})),
    "fliff": _main_from_side_index(parlay.book_indexes.get("fliff", {})),
    "bet365": _main_from_side_index(parlay.book_indexes.get("bet365", {})),
}

rows = _assemble_rows(
    ...,
    px_main=px_main,
    novig_main=novig_main,
    pin_main=pin_main,
    parlay_mains=parlay_mains,
)

# Error precedence: empty board → seed_error or existing parlay_unavailable /
# underdog_unavailable rules. Do not treat Parlay-up + empty PP as Parlay failure.
```

Match MLB’s error precedence carefully: when PP snapshot is empty, return `prizepicks_unavailable` even if Parlay is healthy. When Underdog is empty and Parlay failed, keep existing soft-fail tokens.

- [ ] **Step 4: Run full WNBA props tests — expect PASS**

Run: `cd backend && PYTHONPATH=.:.. pytest tests/test_wnba_props.py tests/test_wnba_prop_picks_schema.py tests/test_wnba_parlay_board_books.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/wnba/props.py backend/tests/test_wnba_props.py
git commit -m "$(cat <<'EOF'
feat(wnba): seed PrizePicks from Supabase and attach books_main

EOF
)"
```

---

### Task 4: Client aggregation helpers

**Files:**
- Create: `frontend/src/features/basketball/league/groupWnbaPropPlayers.ts`
- Create: `frontend/src/features/basketball/league/groupWnbaPropPlayers.test.ts`

**Interfaces:**
- Consumes: `ApiWnbaPropRow[]`
- Produces: `WnbaPropPlayerCard`, `slugifyPlayerName`, `groupWnbaPropPlayers`, `findPlayerBySlug`, `uniqueStatRows`
- Group key: `player_name + team_abbrev` (same collision slug behavior as `groupMlbPropPlayers`)

- [ ] **Step 1: Write failing tests**

Port `frontend/src/features/mlb/league/groupMlbPropPlayers.test.ts` → WNBA names / `ApiWnbaPropRow` (include `commence_time: null` if required by the type). Cover unique-stat count sort, slugify, collision slug with team, `uniqueStatRows` keeps first line per stat.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npx vitest run src/features/basketball/league/groupWnbaPropPlayers.test.ts`

- [ ] **Step 3: Implement helpers**

Copy `groupMlbPropPlayers.ts` structure; rename types/functions to WNBA; import `ApiWnbaPropRow`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/features/basketball/league/groupWnbaPropPlayers.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/basketball/league/groupWnbaPropPlayers.ts \
  frontend/src/features/basketball/league/groupWnbaPropPlayers.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): aggregate WNBA prop rows into player cards

EOF
)"
```

---

### Task 5: Board UI — header, filters, player cards

**Files:**
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksHeader.tsx` (+ test)
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx` (+ test)
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksList.tsx` (+ test)
- Modify: `frontend/src/features/basketball/league/filterWnbaPropPicks.ts` (+ test)
- Modify: `frontend/src/pages/LeaguePropPicksPage.tsx` (+ `LeaguePropPicksPage.test.tsx`)

**Interfaces:**
- Consumes: `groupWnbaPropPlayers`, `excludePastGameProps`, `useWnbaProps({ app, format, legs: 4 })`, scoreboard for past-game hide
- Produces: Player board with `Link` to `/wnba/prop_picks/player/${slug}?app=${app}`
- URL: sync `app` via `useSearchParams` + `appFromSearch` (add to header module like MLB)

- [ ] **Step 1: Write / update failing UI tests**

- Header: no “legs” / “-pick” controls; tabs remain; export `appFromSearch`.
- Filters: Team + search present; Stat/Side absent.
- List: given grouped players, assert `View 2 props` link href includes `/wnba/prop_picks/player/...`; no Over/Under edge text.
- Page: format/legs not shown; still applies past-game exclusion when scoreboard marks final (reuse existing `excludePastGameProps` coverage or page-level case).

- [ ] **Step 2: Run targeted vitest — expect FAIL**

Run: `cd frontend && npx vitest run src/features/basketball/league/WnbaPropPicksHeader.test.tsx src/features/basketball/league/WnbaPropPicksFilters.test.tsx src/features/basketball/league/WnbaPropPicksList.test.tsx src/pages/LeaguePropPicksPage.test.tsx`

- [ ] **Step 3: Implement UI**

1. **Header** — remove `legs` / `onLegsChange` / `LegsPill`; add `appFromSearch`; keep emerald banner + tabs + `children`.
2. **Filters** — Team multi-select + `Search player` text input; drop Stat/Side (mirror `MlbPropPicksFilters`).
3. **filterWnbaPropPicks.ts** — keep `excludePastGameProps` / collect helpers needed by other callers; add:

```typescript
export type WnbaPropPlayerFilterSelection = {
  teams: Set<string>;
  query: string;
};

export function filterWnbaPropPlayers(
  players: WnbaPropPlayerCard[],
  selection: WnbaPropPlayerFilterSelection,
): WnbaPropPlayerCard[] {
  const { teams, query } = selection;
  const needle = query.trim().toLowerCase();
  return players.filter((player) => {
    if (teams.size > 0 && (!player.team_abbrev || !teams.has(player.team_abbrev))) {
      return false;
    }
    if (needle && !player.player_name.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });
}
```

Add `collectWnbaTeamOptionsFromPlayers(players)` or reuse team options from active prop rows before grouping — either is fine if page tests pass.

4. **Page** — `BOARD_LEGS = 4`; `app` from search params; `excludePastGameProps(props, games, scoreboard?.date)` then `groupWnbaPropPlayers` then `filterWnbaPropPlayers`; pass players + app to list.
5. **List** — accept `players: WnbaPropPlayerCard[]` + `app`; card: headshot, team·pos, name, `Link` “View {n} props”; drop expand / edge / side; paginate players (page size 20). Mirror `MlbPropPicksList` layout with WNBA emerald accents already in use.

```tsx
<Link
  to={`/wnba/prop_picks/player/${player.player_slug}?app=${app}`}
  className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-emerald-800"
>
  View {player.prop_count} props
</Link>
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/features/basketball/league/WnbaPropPicksHeader.test.tsx src/features/basketball/league/WnbaPropPicksFilters.test.tsx src/features/basketball/league/WnbaPropPicksList.test.tsx src/features/basketball/league/filterWnbaPropPicks.test.ts src/pages/LeaguePropPicksPage.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/basketball/league/WnbaPropPicksHeader.tsx \
  frontend/src/features/basketball/league/WnbaPropPicksHeader.test.tsx \
  frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx \
  frontend/src/features/basketball/league/WnbaPropPicksFilters.test.tsx \
  frontend/src/features/basketball/league/WnbaPropPicksList.tsx \
  frontend/src/features/basketball/league/WnbaPropPicksList.test.tsx \
  frontend/src/features/basketball/league/filterWnbaPropPicks.ts \
  frontend/src/features/basketball/league/filterWnbaPropPicks.test.ts \
  frontend/src/pages/LeaguePropPicksPage.tsx \
  frontend/src/pages/LeaguePropPicksPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): WNBA prop picks player board with View X props

EOF
)"
```

---

### Task 6: Player detail page + route

**Files:**
- Create: `frontend/src/pages/WnbaPlayerPropsPage.tsx`
- Create: `frontend/src/pages/WnbaPlayerPropsPage.test.tsx`
- Create: `frontend/src/features/basketball/league/WnbaPlayerPropsOddsGrid.tsx`
- Create: `frontend/src/features/basketball/league/WnbaPlayerPropsOddsGrid.test.tsx`
- Modify: `frontend/src/features/basketball/lib/wnbaBookLabels.ts`
- Modify: `frontend/src/app/AppRouter.tsx` (+ test if present)

**Interfaces:**
- Route: `/wnba/prop_picks/player/:playerSlug`
- Query: `app=prizepicks|underdog` (default `prizepicks`)
- Grid columns: same 10 books as MLB
- Cell: `O {line} ({american})` / `U {line} ({american})` or `NL` from `books_main`

- [ ] **Step 1: Extend book labels**

In `wnbaBookLabels.ts`, ensure keys exist for all grid books:

```typescript
export const WNBA_BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  kalshi: "Kalshi",
  fliff: "Fliff",
  bet365: "bet365",
  pinnacle: "Pinnacle",
  betrivers: "BetRivers",
};
```

- [ ] **Step 2: Write failing page + grid tests**

```typescript
it("renders player odds grid at /wnba/prop_picks/player/:playerSlug", async () => {
  // mock /api/wnba/props/today with one player, two stats, books_main populated
  renderPage("/wnba/prop_picks/player/caitlin-clark?app=prizepicks");
  expect(await screen.findByText(/Caitlin Clark/i)).toBeInTheDocument();
  expect(screen.getByText(/Points/i)).toBeInTheDocument();
  expect(screen.getByText(/DraftKings/i)).toBeInTheDocument();
});

it("shows empty state for unknown slug", async () => {
  renderPage("/wnba/prop_picks/player/nobody?app=prizepicks");
  expect(await screen.findByText(/not found|unavailable/i)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /prop picks|back/i }),
  ).toHaveAttribute("href", expect.stringMatching(/\/wnba\/prop_picks/));
});
```

Grid unit test: NL when `books_main.prophetx` null; formats O/U when present.

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd frontend && npx vitest run src/pages/WnbaPlayerPropsPage.test.tsx src/features/basketball/league/WnbaPlayerPropsOddsGrid.test.tsx`

- [ ] **Step 4: Implement page + grid + route**

Port `MlbPlayerPropsPage` / `MlbPlayerPropsOddsGrid`:

```typescript
export const WNBA_PLAYER_PROP_GRID_BOOKS = [
  "prophetx",
  "novig",
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "kalshi",
  "fliff",
  "bet365",
  "pinnacle",
] as const;
```

```tsx
// WnbaPlayerPropsPage.tsx (sketch)
const { playerSlug = "" } = useParams();
const [params] = useSearchParams();
const app = appFromSearch(params.get("app"));
const format = app === "underdog" ? "standard" : "power";
const { data, isLoading, isError, isFetched } = useWnbaProps({
  app,
  format,
  legs: 4,
});
const players = useMemo(
  () => groupWnbaPropPlayers(data?.props ?? []),
  [data],
);
const player = findPlayerBySlug(players, playerSlug);
const markets = player ? uniqueStatRows(player.rows) : [];
const boardHref = `/wnba/prop_picks?app=${app}`;
```

Wire router after the existing prop_picks route:

```tsx
<Route path="/wnba/prop_picks" element={<LeaguePropPicksPage />} />
<Route
  path="/wnba/prop_picks/player/:playerSlug"
  element={<WnbaPlayerPropsPage />}
/>
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/pages/WnbaPlayerPropsPage.test.tsx src/features/basketball/league/WnbaPlayerPropsOddsGrid.test.tsx src/app/AppRouter.test.tsx`

(Skip `AppRouter.test.tsx` if the file does not exist; otherwise add a path assertion.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/WnbaPlayerPropsPage.tsx \
  frontend/src/pages/WnbaPlayerPropsPage.test.tsx \
  frontend/src/features/basketball/league/WnbaPlayerPropsOddsGrid.tsx \
  frontend/src/features/basketball/league/WnbaPlayerPropsOddsGrid.test.tsx \
  frontend/src/features/basketball/lib/wnbaBookLabels.ts \
  frontend/src/app/AppRouter.tsx \
  frontend/src/app/AppRouter.test.tsx \
  frontend/src/shared/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(frontend): WNBA player prop odds grid detail page

EOF
)"
```

---

### Task 7: Docs — `system-design.md`

**Files:**
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-08-19-wnba-prop-picks-player-board-design.md` (Status → Implemented when shipping)

- [ ] **Step 1: Update route table + tree**

Replace `/wnba/prop_picks` row with player-board description (tabs, Team + search, View X props, unique-stat sort, PP Supabase-only, `books_main`, past-game hide, page size 20 players).

Add:

| `/wnba/prop_picks/player/:playerSlug?app=` | Per-player main-line odds grid | `useWnbaProps` | same `GET /api/wnba/props/today` | `findPlayerBySlug` + `uniqueStatRows`; grid reads `books_main` (MLB book set); unknown slug → empty + back link |

Update AppRouter tree if listed.

Set design spec Status to `Implemented`.

- [ ] **Step 2: Commit**

```bash
git add md/system-design.md \
  docs/superpowers/specs/2026-08-19-wnba-prop-picks-player-board-design.md
git commit -m "$(cat <<'EOF'
docs: WNBA prop picks player board and detail route wiring

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Player cards + View X props | 5 |
| Sort by prop count desc | 4, 5 |
| Unique-stat count | 4 |
| PP/UD tabs; no format/legs pills | 5 |
| Team + name search | 5 |
| Keep finals / prior-day hide | 5 |
| PrizePicks from Supabase, no Parlay PP fallback | 3 |
| Expand Parlay cmp books | 2 |
| Detail route + odds grid (MLB book columns) | 6 |
| Main lines only / NL / no OPEN·BEST | 3, 6 |
| `books_main` schema + OpenAPI | 1 |
| system-design update | 7 |
| Errors (empty PP, unknown slug, Parlay books NL) | 3, 6 |
| Game Props tab untouched | (non-goal — no task) |

## Plan self-review

- Spec coverage: all success criteria map to tasks 1–7; game Props explicitly non-goal.
- No TBD / “similar to Task N” hand-waves — MLB file paths cited as reference with WNBA renames and `canonical_stat_key_from_exchange`.
- Type names consistent: `WnbaPropBookMainQuote` / `WnbaPropBooksMain` / `books_main` / `ApiWnbaPropBookMainQuote`.
- Existing `test_wnba_props.py` Parlay-PP fixtures called out for retargeting in Task 3.
- `odds_snapshots.fetch_latest_prophetx/novig(..., mains_only=True)` already exists — no separate snapshot-select task.
