# WNBA Prop Picks MLB Product Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remake `/wnba/prop_picks` into the MLB +EV hybrid board (PrizePicks/Underdog tabs, legs, fair/edge/tier, expand books) while leaving game-detail Props on `get_today_props()`.

**Architecture:** New `wnba.props` assemble twins `mlb.props`: seed the selected DFS app, exact-line attach PX/Novig/DK/FD/Pinnacle, `compute_fair` + breakeven, sort by edge. `GET /api/wnba/props/today` moves to `wnba/routes.py` (betting must not import wnba). ProphetX WNBA player props get a real `odds.wnba_prophetx` table and scraper upsert. Frontend twins MLB header/filters/list and keeps today’s hide-final + prior-day-tip filter.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vite · TanStack Query · Vitest · Testing Library · Tailwind 4 · Supabase `odds.*`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-wnba-prop-picks-mlb-parity-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- League page only; do not rewrite `parlay_props.get_today_props()` or `WnbaGamePropsGrid`
- Domains must not import each other — copy `prop_fair` / `prop_formats` into `app/domains/wnba/`; do not `from app.domains.mlb import …`
- Exact DFS line only; no closest-line fallback
- PrizePicks `format=power` only; Underdog `format=standard` only; default 4 legs
- Fair: PX+Novig → DK+FD → Pinnacle comparison-only (`role="comparison"`)
- Hide past: drop **final** teams and **prior-day** ET tips; keep live/upcoming
- Route cannot stay in `betting/routes.py` if it calls `wnba.props` (betting → wnba import forbidden)
- OpenAPI: `cd backend && PYTHONPATH=..:. python -m app.openapi_export` then `cd frontend && npm run generate:api`
- Backend tests: `cd backend && PYTHONPATH=..:. python -m pytest <file> -q`
- Frontend tests: `cd frontend && npm test -- <file>`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `db/migrations/038_odds_wnba_prophetx.sql` | `odds.wnba_prophetx` player-prop table |
| `src/odds/quote_specs.py` | Register `wnba_prophetx` |
| `src/odds/load_snapshots.py` | Route WNBA PX props to `wnba_prophetx` |
| `src/scrapers/wnba_prophetx.py` | Upsert props + team |
| `backend/app/core/odds_snapshots.py` | `fetch_latest_prophetx("wnba")` / novig table maps |
| `backend/app/domains/wnba/prop_fair.py` | Copy of MLB fair/recency (no mlb import) |
| `backend/app/domains/wnba/prop_formats.py` | Copy of MLB breakeven tables |
| `backend/app/domains/betting/prop_stat_keys.py` | Exchange/PX aliases (`points_rebounds_assists` → `pts_rebs_asts`) |
| `backend/app/domains/wnba/schemas_prop_picks.py` | Board response (`WnbaPropRow`, `WnbaPropPicksResponse`) |
| `backend/app/providers/parlay/wnba_board.py` | Parlay PP board + DK/FD indexes (WNBA markets) |
| `backend/app/domains/wnba/props.py` | `validate_query` + `get_wnba_props_today` |
| `backend/app/domains/wnba/routes.py` | `GET /wnba/props/today?app=&format=&legs=` |
| `backend/app/domains/betting/routes.py` | Remove old `/wnba/props/today` handler |
| `backend/app/domains/wnba/schemas.py` | Re-export board schemas |
| `frontend/src/shared/lib/api.ts` | `fetchWnbaProps({ app, format, legs })` |
| `frontend/src/features/basketball/hooks/useWnbaProps.ts` | Query key includes app/format/legs |
| `frontend/src/features/basketball/league/filterWnbaPropPicks.ts` | Stat/team/recommended-side + hide-past on board rows |
| `frontend/src/features/basketball/league/WnbaPropPicksHeader.tsx` | Banner + mark + tabs + legs + filter slot |
| `frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx` | Banner pills (MLB twin) |
| `frontend/src/features/basketball/league/WnbaPropPicksList.tsx` | Hybrid ranked list (MLB twin) |
| `frontend/src/pages/LeaguePropPicksPage.tsx` | Wire like `MlbPropPicksPage` |
| `md/system-design.md` | Page ↔ API + flow |
| Keep | `parlay_props.get_today_props`, `WnbaPropLine`, game props grid |
| Delete from page only | `PropPicksTable` / book-column `PropPicksFilters` usage (delete files if unreferenced) |

---

### Task 1: `odds.wnba_prophetx` + load + fetch + scraper upsert

**Files:**
- Create: `db/migrations/038_odds_wnba_prophetx.sql`
- Modify: `src/odds/quote_specs.py`
- Modify: `src/odds/load_snapshots.py` (`load_prophetx_props_snapshot`)
- Modify: `src/scrapers/wnba_prophetx.py` (`load_supabase_snapshots`)
- Modify: `backend/app/core/odds_snapshots.py`
- Test: `src/scrapers/tests/odds/test_load_snapshots.py`
- Test: `backend/tests/test_odds_snapshots_mlb_props.py` (add WNBA PX/Novig cases) or create `backend/tests/test_odds_snapshots_wnba_props.py`

**Interfaces:**
- Consumes: existing `prophetx_props_to_rows(games, league=..., scraped_at=...)`
- Produces:
  - table `odds.wnba_prophetx` (same columns as current `odds.mlb_prophetx` including `is_main`)
  - `_prophetx_props_table(league: str) -> str` → `"wnba_prophetx"` when league is `wnba`, else `"mlb_prophetx"`
  - `fetch_latest_prophetx("wnba")` reads `odds.wnba_prophetx`
  - `fetch_latest_novig("wnba")` reads `odds.wnba_novig`

- [ ] **Step 1: Write the failing load-routing test**

Add to `src/scrapers/tests/odds/test_load_snapshots.py` (same fixture style as `test_load_novig_props_routes_wnba_table`):

```python
def test_load_prophetx_props_routes_wnba_table(monkeypatch, mock_upsert):
    monkeypatch.delenv("PROPHETX_SKIP_DB", raising=False)
    games = [
        {
            "event_id": 1,
            "competitors": [
                {"name": "Away", "seq": 1},
                {"name": "Home", "seq": 0},
            ],
            "props": [
                {
                    "player": "Caitlin Clark",
                    "stat": "points",
                    "line": 19.5,
                    "over": {"american": -115, "stake": 10.0},
                    "under": {"american": -105, "stake": 8.0},
                    "market_id": 99,
                    "sub_type": "player_total_points",
                    "is_main": True,
                }
            ],
        }
    ]
    count = load_snapshots.load_prophetx_props_snapshot(games, league="wnba")
    assert count >= 1
    mock_upsert.assert_called_once()
    table, df = mock_upsert.call_args[0]
    assert table == "wnba_prophetx"
    assert mock_upsert.call_args[1]["schema"] == "odds"
```

Add `backend/tests/test_odds_snapshots_wnba_props.py`:

```python
from unittest.mock import patch
from app.core import odds_snapshots as svc


def test_fetch_latest_prophetx_wnba_reads_wnba_table():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_prophetx("wnba")
    sql, league = fetch_rows.call_args.args
    assert "FROM odds.wnba_prophetx" in sql
    assert league == "wnba"


def test_fetch_latest_novig_wnba_reads_wnba_table():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_novig("wnba")
    sql, league = fetch_rows.call_args.args
    assert "FROM odds.wnba_novig" in sql
    assert league == "wnba"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_odds_snapshots_wnba_props.py -q`

From repo root: `PYTHONPATH=. python -m pytest src/scrapers/tests/odds/test_load_snapshots.py::test_load_prophetx_props_routes_wnba_table -q`

Expected: FAIL — table still `mlb_prophetx` / fetch still `odds.mlb_prophetx`.

- [ ] **Step 3: Migration + quote spec + load + fetch + scraper**

`db/migrations/038_odds_wnba_prophetx.sql`:

```sql
-- 038_odds_wnba_prophetx.sql
-- WNBA ProphetX player prop snapshots (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_prophetx (
    league           TEXT        NOT NULL,
    event_id         BIGINT,
    away_team        TEXT,
    home_team        TEXT,
    start_time       TIMESTAMPTZ,
    player_name      TEXT        NOT NULL,
    stat_name        TEXT        NOT NULL,
    line_score       NUMERIC     NOT NULL,
    side             TEXT        NOT NULL,
    american_price   INTEGER,
    stake            NUMERIC,
    market_id        BIGINT,
    sub_type         TEXT,
    is_main          BOOLEAN,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_prophetx_snapshot_uidx
    ON odds.wnba_prophetx (
        league, event_id, player_name, stat_name, side, line_score, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_prophetx_league_scraped_at_idx
    ON odds.wnba_prophetx (league, scraped_at DESC);
```

In `src/odds/quote_specs.py` add `"wnba_prophetx": _EXCHANGE_PROPS` next to `mlb_prophetx`.

In `src/odds/load_snapshots.py` add helper and use it in `load_prophetx_props_snapshot`:

```python
def _prophetx_props_table(league: str) -> str:
    key = (league or "").strip().lower()
    if key == "wnba":
        return "wnba_prophetx"
    return "mlb_prophetx"
```

Replace the hardcoded `"mlb_prophetx"` in `apply_change_filter(...)` and `upsert_df(...)` with `table = _prophetx_props_table(league_norm)`.

In `backend/app/core/odds_snapshots.py`:

```python
_PROPHETX_TABLE = {"mlb": "mlb_prophetx", "wnba": "wnba_prophetx"}
_NOVIG_TABLE = {"mlb": "mlb_novig", "wnba": "wnba_novig"}
```

Keep existing `fetch_latest_prophetx` / `fetch_latest_novig` bodies; they already do `_PROPHETX_TABLE.get(lg, ...)`. Change the novig/prophetx defaults only if needed so `"wnba"` hits the new keys (do not break `fetch_latest_prophetx()` default MLB).

In `src/scrapers/wnba_prophetx.py` `load_supabase_snapshots`, call `load_prophetx_props_snapshot` **and** `load_prophetx_team_snapshot`. Remove `del props_games, props_path`.

- [ ] **Step 4: Run tests to verify they pass**

Same commands as Step 2. Expected: PASS. Also run existing `test_fetch_latest_prophetx_reads_latest_mlb_snapshot` — still `odds.mlb_prophetx`.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/038_odds_wnba_prophetx.sql src/odds/quote_specs.py src/odds/load_snapshots.py src/scrapers/wnba_prophetx.py backend/app/core/odds_snapshots.py src/scrapers/tests/odds/test_load_snapshots.py backend/tests/test_odds_snapshots_wnba_props.py
git commit -m "feat(odds): upsert WNBA ProphetX player props to wnba_prophetx"
```

---

### Task 2: Copy fair + format helpers into the WNBA domain

**Files:**
- Create: `backend/app/domains/wnba/prop_fair.py` (copy `backend/app/domains/mlb/prop_fair.py`; update module docstring to “WNBA prop picks”)
- Create: `backend/app/domains/wnba/prop_formats.py` (copy `backend/app/domains/mlb/prop_formats.py`; same multipliers)
- Create: `backend/tests/test_wnba_prop_fair.py`

**Interfaces:**
- Produces (identical signatures to MLB):
  - `american_to_fair_pct(american: int) -> float`
  - `compute_fair(side_books: SideBooks) -> FairResult`
  - `recency_chip(*, sharp_changed_at, dfs_changed_at, now) -> str | None`
  - `breakeven_pct(app: str, format: str, legs: int) -> float`
  - `SourceTier`, `FairResult`, `SOFT_FAIR_BOOKS = ("pinnacle",)`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_wnba_prop_fair.py` importing from `app.domains.wnba.prop_fair` and `app.domains.wnba.prop_formats`:

```python
from datetime import datetime, timedelta, timezone
import pytest
from app.domains.wnba.prop_fair import american_to_fair_pct, compute_fair, recency_chip
from app.domains.wnba.prop_formats import breakeven_pct


def test_american_to_fair_pct_favorite():
    assert american_to_fair_pct(-140) == 58.3


def test_breakeven_power_4():
    assert abs(breakeven_pct("prizepicks", "power", 4) - 56.234) < 0.01


def test_breakeven_rejects_bad_app_format_legs():
    with pytest.raises(ValueError):
        breakeven_pct("prizepicks", "standard", 4)


def test_tier1_equal_avg_two_sources():
    r = compute_fair({
        "prophetx": 60.0, "novig": 50.0,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "sharp_consensus"
    assert r.fair_pct == 55.0


def test_tier1_single_prophetx():
    r = compute_fair({
        "prophetx": 54.0, "novig": None,
        "draftkings": 53.5, "fanduel": None,
    })
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 54.0
    assert "dk_fd_agrees" in r.confidence_chips


def test_no_sharp_read():
    r = compute_fair({
        "prophetx": None, "novig": None,
        "draftkings": None, "fanduel": None, "pinnacle": 51.0,
    })
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None


def test_recency_fresh_sharp():
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=5),
        dfs_changed_at=now - timedelta(minutes=12),
        now=now,
    )
    assert chip == "fresh_sharp"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_wnba_prop_fair.py -q`

Expected: FAIL — `ModuleNotFoundError: app.domains.wnba.prop_fair`

- [ ] **Step 3: Copy the two modules**

Copy `mlb/prop_fair.py` → `wnba/prop_fair.py` and `mlb/prop_formats.py` → `wnba/prop_formats.py`. Change only the module docstring (WNBA). Do not import from `app.domains.mlb`.

- [ ] **Step 4: Run tests to verify they pass**

Same pytest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/wnba/prop_fair.py backend/app/domains/wnba/prop_formats.py backend/tests/test_wnba_prop_fair.py
git commit -m "feat(wnba): copy prop fair and format helpers for +EV board"
```

---

### Task 3: Exchange stat aliases + board schemas

**Files:**
- Modify: `backend/app/domains/betting/prop_stat_keys.py`
- Modify: `backend/tests/test_prop_stat_keys.py`
- Create: `backend/app/domains/wnba/schemas_prop_picks.py`
- Modify: `backend/app/domains/wnba/schemas.py`
- Create: `backend/tests/test_wnba_prop_picks_schema.py`

**Interfaces:**
- Produces:
  - `canonical_stat_key_from_exchange(stat_name: str) -> str | None`
  - `WnbaPropBookQuote`, `WnbaPropBooks`, `WnbaPropDfs`, `WnbaPropRow`, `WnbaPropPicksResponse`
  - `WnbaPropRow.commence_time: str | None` (WNBA-only vs MLB)

Do **not** rename betting’s existing `WnbaPropsResponse` / `WnbaPropLine` (game assembly).

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_prop_stat_keys.py`:

```python
from app.domains.betting.prop_stat_keys import canonical_stat_key_from_exchange

def test_exchange_aliases_prophetx_combos():
    assert canonical_stat_key_from_exchange("points") == "points"
    assert canonical_stat_key_from_exchange("points_rebounds_assists") == "pts_rebs_asts"
    assert canonical_stat_key_from_exchange("player_total_points") == "points"
    assert canonical_stat_key_from_exchange("player_points") == "points"
    assert canonical_stat_key_from_exchange("nope") is None
```

Create `backend/tests/test_wnba_prop_picks_schema.py`:

```python
from app.domains.wnba.schemas_prop_picks import WnbaPropPicksResponse, WnbaPropRow

def test_board_row_includes_commence_time():
    row = WnbaPropRow(
        player_name="Caitlin Clark",
        stat="Points",
        line=19.5,
        source_tier="no_sharp_read",
        dfs={"line": 19.5},
        fair_explain="No Tier 1/2/3 books available.",
        commence_time="2026-08-11T23:00:00Z",
    )
    assert row.commence_time == "2026-08-11T23:00:00Z"
    body = WnbaPropPicksResponse(
        as_of="2026-08-11T20:00:00Z",
        app="prizepicks",
        format="power",
        legs=4,
        breakeven_pct=56.234,
        props=[row],
    )
    assert body.props[0].books.pinnacle is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_prop_stat_keys.py tests/test_wnba_prop_picks_schema.py -q`

Expected: FAIL — `canonical_stat_key_from_exchange` missing / schema module missing.

- [ ] **Step 3: Implement aliases + schemas**

In `prop_stat_keys.py` add aliases (keep existing maps). Example:

```python
_EXCHANGE_ALIASES: dict[str, str] = {
    "points": "points",
    "rebounds": "rebounds",
    "assists": "assists",
    "threes": "threes",
    "player_total_points": "points",
    "player_total_rebounds": "rebounds",
    "player_total_assists": "assists",
    "player_total_points_rebounds_assists": "pts_rebs_asts",
    "player_total_points_rebounds": "pts_rebs",
    "player_total_points_assists": "pts_asts",
    "player_total_rebounds_assists": "rebs_asts",
    "points_rebounds_assists": "pts_rebs_asts",
    "points_rebounds": "pts_rebs",
    "points_assists": "pts_asts",
    "rebounds_assists": "rebs_asts",
}

def canonical_stat_key_from_exchange(stat_name: str) -> str | None:
    raw = stat_name.strip().lower().replace(" ", "_").replace("+", "_")
    if raw in _EXCHANGE_ALIASES:
        return _EXCHANGE_ALIASES[raw]
    return (
        canonical_stat_key_from_pp(stat_name)
        or canonical_stat_key_from_ud(stat_name)
        or canonical_stat_key_from_parlay_market(stat_name)
    )
```

Create `backend/app/domains/wnba/schemas_prop_picks.py` as a copy of `backend/app/domains/mlb/schemas_props.py` with these renames:

- `MlbProp*` → `WnbaProp*`
- `MlbPropsResponse` → `WnbaPropPicksResponse`
- Import `SourceTier` from `app.domains.wnba.prop_fair`
- On `WnbaPropRow` add `commence_time: str | None = None`

Re-export the new types from `backend/app/domains/wnba/schemas.py` `__all__`. Do not remove old `WnbaPropLine` / `WnbaPropsResponse` re-exports used by game assembly.

- [ ] **Step 4: Run tests to verify they pass**

Same pytest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/betting/prop_stat_keys.py backend/tests/test_prop_stat_keys.py backend/app/domains/wnba/schemas_prop_picks.py backend/app/domains/wnba/schemas.py backend/tests/test_wnba_prop_picks_schema.py
git commit -m "feat(wnba): add +EV prop board schemas and exchange stat keys"
```

---

### Task 4: Parlay WNBA board normalizer (PP + DK + FD)

**Files:**
- Create: `backend/app/providers/parlay/wnba_board.py`
- Create: `backend/tests/test_parlay_wnba_board.py`

**Interfaces:**
- Consumes: `parlay_get`, `select_parlay_main_lines`, `canonical_stat_key_from_parlay_market`, `display_stat_label`
- Produces:
  - `ParlayWnbaNormalized(prizepicks_board, book_indexes, as_of, unavailable)`
  - `async def fetch_wnba_parlay_board_normalized(*, timeout: float) -> ParlayWnbaNormalized`
  - PrizePicks board rows: `{player_name, stat_type, line_score, odds_type, scraped_at, commence_time?}`
  - `book_indexes["draftkings"|"fanduel"][ (norm_player, stat_key, side, line) ] = {american, changed_at}`

- [ ] **Step 1: Write failing normalize tests**

```python
from app.providers.parlay.wnba_board import normalize_parlay_wnba_board

def test_normalize_splits_pp_and_dk_fd():
    rows = [
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "sportsbook": "prizepicks",
            "line": 19.5,
            "over_odds": None,
            "under_odds": None,
            "commence_time": "2026-08-11T23:00:00Z",
        },
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "sportsbook": "draftkings",
            "line": 19.5,
            "over_odds": -120,
            "under_odds": 100,
        },
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "sportsbook": "caesars",
            "line": 19.5,
            "over_odds": -110,
            "under_odds": -110,
        },
    ]
    out = normalize_parlay_wnba_board(rows)
    assert len(out.prizepicks_board) == 1
    assert out.prizepicks_board[0]["odds_type"] == "standard"
    assert out.prizepicks_board[0]["stat_type"] == "points"
    assert out.prizepicks_board[0]["commence_time"] == "2026-08-11T23:00:00Z"
    dk_key = ("caitlin clark", "points", "over", 19.5)
    assert dk_key in out.book_indexes["draftkings"]
    assert "caesars" not in out.book_indexes
```

Mirror `backend/app/providers/parlay/mlb_props.py` field names if the live Parlay payload uses `bookmaker` / `name` — inspect `normalize_parlay_mlb_props` and `parlay_props.normalize_parlay_props` and match **WNBA’s existing Parlay row shape** in `parlay_props.py` (not MLB’s). The test fixture must use the same keys the normalizer reads.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_parlay_wnba_board.py -q`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `wnba_board.py`**

Copy structure from `backend/app/providers/parlay/mlb_props.py`:

- `SPORT_KEY = "basketball_wnba"`
- `PROP_MARKETS` = same allowlist as `parlay_props._PROP_MARKET_KEYS`
- `_ALLOWED_BOOKS = frozenset({"prizepicks", "draftkings", "fanduel"})`
- Use `canonical_stat_key_from_parlay_market` + `display_stat_label` from `app.domains.betting.prop_stat_keys`
- For PrizePicks rows: emit board dicts with `odds_type="standard"`, `stat_type=<canonical key>`, `line_score`, `player_name`, `commence_time` from the Parlay row when present
- Drop Caesars/BetMGM/etc.
- `fetch_wnba_parlay_board_normalized` GETs `/sports/basketball_wnba/props` via `parlay_get`, runs `select_parlay_main_lines`, then `normalize_parlay_wnba_board`
- Soft in-process cache ~60s like MLB Parlay module
- `FETCH_TIMEOUT_SECONDS` can stay 12–45s; match WNBA `parlay_props` (12s) unless live tests show timeouts

- [ ] **Step 4: Run tests to verify they pass**

Same pytest. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/parlay/wnba_board.py backend/tests/test_parlay_wnba_board.py
git commit -m "feat(parlay): normalize WNBA PrizePicks DK and FD for +EV board"
```

---

### Task 5: Assemble `get_wnba_props_today`

**Files:**
- Create: `backend/app/domains/wnba/props.py`
- Create: `backend/tests/test_wnba_props.py`

**Interfaces:**
- Consumes: Task 1 fetchers, Task 2 fair/formats, Task 3 schemas/stat keys, Task 4 Parlay board, `fetch_latest_prizepicks("wnba")`, `fetch_latest_underdog("wnba")`, `fetch_latest_pinnacle("wnba")`, `get_roster_index` / `norm_player_name` from `app.providers.espn.wnba_roster`
- Produces:
  - `validate_query(app: str, format: str, legs: int) -> None`  # ValueError
  - `async def get_wnba_props_today(*, app: str, format: str, legs: int) -> WnbaPropPicksResponse`

- [ ] **Step 1: Write failing assemble tests**

Create `backend/tests/test_wnba_props.py` modeled on `backend/tests/test_mlb_props.py`, but basketball stats and `ParlayWnbaNormalized`.

Minimum cases:

```python
import pytest
from datetime import datetime, timezone
from app.domains.wnba import props as svc
from app.providers.parlay.wnba_board import ParlayWnbaNormalized


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


def test_validate_query_rejects_wrong_format():
    with pytest.raises(ValueError):
        svc.validate_query("prizepicks", "standard", 4)


@pytest.mark.asyncio
async def test_prizepicks_falls_back_to_snapshot_when_parlay_pp_empty(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=None,
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(
        svc,
        "fetch_latest_prizepicks",
        lambda league="wnba": [
            {
                "player_name": "Caitlin Clark",
                "stat_type": "points",
                "line_score": 19.5,
                "odds_type": "standard",
                "scraped_at": now,
            }
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])
    monkeypatch.setattr(svc, "get_roster_index", lambda: {})

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    assert out.props[0].player_name == "Caitlin Clark"
    assert out.props[0].line == 19.5
    assert out.props[0].source_tier == "no_sharp_read"


@pytest.mark.asyncio
async def test_exact_line_only_and_px_novig_set_fair(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    board = [{
        "player_name": "Caitlin Clark",
        "stat_type": "points",
        "line_score": 19.5,
        "odds_type": "standard",
        "scraped_at": now,
        "commence_time": "2026-08-11T23:00:00Z",
    }]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=board,
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_prophetx",
        lambda league="wnba": [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
            },
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 22.5,
                "side": "over",
                "american_price": -110,
                "scraped_at": now,
            },
        ],
    )
    monkeypatch.setattr(
        svc,
        "fetch_latest_novig",
        lambda league="wnba": [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now,
            }
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])
    monkeypatch.setattr(svc, "get_roster_index", lambda: {})

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    row = out.props[0]
    assert row.source_tier == "sharp_consensus"
    assert row.fair_pct is not None
    assert row.books.prophetx is not None
    assert row.commence_time == "2026-08-11T23:00:00Z"
    # 22.5 is not the DFS line — must not attach
    assert row.line == 19.5
```

Also copy from `test_mlb_props.py` (adapt names): empty seed → `props == []` and `error` set; `no_sharp_read` sorts last; mismatched Pinnacle line omitted.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_wnba_props.py -q`

Expected: FAIL — `app.domains.wnba.props` missing.

- [ ] **Step 3: Implement assemble**

Copy `backend/app/domains/mlb/props.py` → `backend/app/domains/wnba/props.py` and apply **all** of these deltas (do not leave MLB stat helpers):

| MLB | WNBA |
| --- | --- |
| `app.domains.mlb.prop_fair` | `app.domains.wnba.prop_fair` |
| `app.domains.mlb.prop_formats` | `app.domains.wnba.prop_formats` |
| `app.domains.mlb.prop_stat_keys` | `canonical_stat_key_from_pp` / `_ud` / `_exchange` + `display_stat_label` from `app.domains.betting.prop_stat_keys` |
| `schemas_props.Mlb*` | `schemas_prop_picks.Wnba*` |
| `fetch_mlb_parlay_props_normalized` | `fetch_wnba_parlay_board_normalized` |
| `get_mlb_player_index` | `get_roster_index` from `app.providers.espn.wnba_roster` |
| `canonical_stat_key_from_pp_mlb` | `canonical_stat_key_from_pp` |
| `canonical_stat_key_from_ud_mlb` | `canonical_stat_key_from_ud` |
| `canonical_stat_key_from_sharp_mlb` | `canonical_stat_key_from_exchange` |
| `get_mlb_props_today` | `get_wnba_props_today` |
| snapshot league `"mlb"` | `"wnba"` |

Seed rules:

- `app=prizepicks`: use `parlay.prizepicks_board` if non-empty, else `fetch_latest_prizepicks("wnba")`
- `app=underdog`: `fetch_latest_underdog("wnba")` only
- Thread `commence_time` from the seed row onto the board bucket and onto `WnbaPropRow`
- Roster enrich: `team_abbrev`, `headshot_url`, `position` like MLB
- Soft-fail Parlay: `error="parlay_unavailable"` when fetch raises **and** seed is empty; if snapshot PP seed exists, still return rows
- Empty seed: `props=[]`, `error` describing missing board (e.g. `"prizepicks_unavailable"`)
- Cache key `(app, format, legs)`, TTL 15 minutes, `Cache-Control` stays on the route

- [ ] **Step 4: Run tests to verify they pass**

Same pytest. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/wnba/props.py backend/tests/test_wnba_props.py
git commit -m "feat(wnba): assemble DFS +EV prop board for today"
```

---

### Task 6: Switch `GET /api/wnba/props/today` + OpenAPI

**Files:**
- Modify: `backend/app/domains/wnba/routes.py`
- Modify: `backend/app/domains/betting/routes.py` (delete `wnba_props_today`)
- Modify: `backend/app/domains/wnba/schemas.py` if route imports need the new response
- Modify: `backend/tests/test_wnba_props.py` (add TestClient cases)
- Run OpenAPI export + `frontend` generate

**Interfaces:**
- Produces HTTP: `GET /api/wnba/props/today?app=&format=&legs=` → `WnbaPropPicksResponse`
- 422 on `ValueError` from `validate_query`
- `Cache-Control: no-store`
- `GET /api/wnba/props/game/{id}` unchanged

- [ ] **Step 1: Write failing route tests**

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_props_today_422_on_bad_format():
    res = client.get(
        "/api/wnba/props/today",
        params={"app": "prizepicks", "format": "standard", "legs": 4},
    )
    assert res.status_code == 422


def test_props_today_requires_query():
    res = client.get("/api/wnba/props/today")
    assert res.status_code == 422
```

After wiring, add a happy-path test that monkeypatches `get_wnba_props_today` (same pattern as `test_mlb_props.py` TestClient tests).

- [ ] **Step 2: Run tests to verify 422-without-query may already fail for the old handler**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_wnba_props.py::test_props_today_requires_query -q`

Expected: old handler returns 200 with the table payload (FAIL vs 422).

- [ ] **Step 3: Move the route**

In `wnba/routes.py` add (mirror MLB):

```python
from typing import Literal
from app.domains.wnba.props import get_wnba_props_today
from app.domains.wnba.schemas_prop_picks import WnbaPropPicksResponse

@router.get("/wnba/props/today", response_model=WnbaPropPicksResponse)
async def wnba_props_today(
    response: Response,
    app: Literal["prizepicks", "underdog"] = Query(...),
    format: str = Query(..., min_length=1),
    legs: int = Query(..., ge=2, le=6),
) -> WnbaPropPicksResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_props_today(app=app, format=format, legs=legs)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc), headers=_NO_STORE) from exc
```

Delete `wnba_props_today` from `betting/routes.py`. Leave `get_today_props` imported only if still used there (it will not be — drop the unused import).

Duplicate-path check: FastAPI last-mounted router wins. `wnba_router` is included after `betting_router`, but **remove** the betting handler so there is only one path.

- [ ] **Step 4: Export OpenAPI and regenerate types**

```bash
cd backend && PYTHONPATH=..:. python -m app.openapi_export
cd ../frontend && npm run generate:api
```

Confirm `frontend/src/shared/lib/api.schema.d.ts` has `WnbaPropPicksResponse` / `WnbaPropRow` and `/api/wnba/props/today` query params. Keep `WnbaPropLine` in the schema (still used by game props assembly types if exported).

If `backend/openapi-golden.json` exists in this repo, update it the same way other props PRs did.

- [ ] **Step 5: Run tests + commit**

```bash
cd backend && PYTHONPATH=..:. python -m pytest tests/test_wnba_props.py tests/test_wnba_game_props.py -q
```

Expected: new board tests PASS; game props tests still PASS.

```bash
git add backend/app/domains/wnba/routes.py backend/app/domains/betting/routes.py backend/tests/test_wnba_props.py frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "feat(api): serve WNBA +EV prop board from /props/today"
```

---

### Task 7: Frontend fetch + hook

**Files:**
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts`
- Modify: `frontend/src/features/basketball/hooks/useWnbaProps.ts`
- Create or modify: `frontend/src/features/basketball/hooks/useWnbaProps.test.tsx` (create if missing)

**Interfaces:**
- Produces:
  - `export type WnbaPropsParams = { app: string; format: string; legs: number }`
  - `export type ApiWnbaPropRow = Schemas["WnbaPropRow"]`
  - `export type ApiWnbaPropPicksResponse = Schemas["WnbaPropPicksResponse"]`
  - `fetchWnbaProps({ app, format, legs }): Promise<ApiWnbaPropPicksResponse>`
  - `useWnbaProps({ app, format, legs })` query key `["wnba", "props", app, format, legs]`, `refetchInterval: 15 * 60_000`

Keep `ApiWnbaPropLine` / `ApiWnbaPropsResponse` **only if** they still exist in OpenAPI for game assembly. If OpenAPI dropped `WnbaPropsResponse`, grep and fix game-props types (they should use `WnbaGamePropsResponse` already).

- [ ] **Step 1: Write failing fetch test**

In `frontend/src/shared/lib/api.test.ts` update the existing `fetchWnbaProps` describe:

```ts
it("hits /api/wnba/props/today with app format legs", async () => {
  // existing fetch mock…
  const { fetchWnbaProps } = await import("./api");
  await fetchWnbaProps({ app: "prizepicks", format: "power", legs: 4 });
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining(
      "/api/wnba/props/today?app=prizepicks&format=power&legs=4",
    ),
    expect.anything(),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/shared/lib/api.test.ts`

Expected: FAIL — `fetchWnbaProps` still takes no args.

- [ ] **Step 3: Implement client + hook**

```ts
export type WnbaPropsParams = {
  app: string;
  format: string;
  legs: number;
};

export async function fetchWnbaProps({
  app,
  format,
  legs,
}: WnbaPropsParams): Promise<ApiWnbaPropPicksResponse> {
  const qs = new URLSearchParams({
    app,
    format,
    legs: String(legs),
  });
  const res = await fetch(`${API_BASE}/api/wnba/props/today?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Props request failed: ${res.status}`);
  }
  return res.json();
}
```

```ts
export function useWnbaProps({ app, format, legs }: WnbaPropsParams) {
  return useQuery({
    queryKey: ["wnba", "props", app, format, legs],
    queryFn: () => fetchWnbaProps({ app, format, legs }),
    refetchInterval: 15 * 60_000,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

`npm test -- src/shared/lib/api.test.ts` plus hook test if added. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts frontend/src/features/basketball/hooks/useWnbaProps.ts frontend/src/features/basketball/hooks/useWnbaProps.test.tsx
git commit -m "feat(frontend): fetch WNBA props board by app format and legs"
```

---

### Task 8: Client filters + hide-past on board rows

**Files:**
- Create: `frontend/src/features/basketball/league/filterWnbaPropPicks.ts`
- Create: `frontend/src/features/basketball/league/filterWnbaPropPicks.test.ts`
- Keep `filterPropLines.ts` only if game code still needs abbrev helpers — move `expandWnbaTeamAbbrevs` / `excludePastGameProps` here or import aliases from `filterPropLines` to avoid breaking game Props filters.

**Interfaces:**
- Produces:
  - `filterWnbaPropPicks(props, { stats, teams, sides })` — sides match `recommended_side`
  - `collectWnbaStatOptions` / `collectWnbaTeamOptions`
  - `excludePastGameProps(props, games, scoreboardDate)` operating on `{ team_abbrev, commence_time }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  excludePastGameProps,
  filterWnbaPropPicks,
} from "./filterWnbaPropPicks";

const row = {
  player_name: "A",
  team_abbrev: "PHO",
  stat: "Points",
  recommended_side: "over",
  commence_time: "2026-08-11T23:00:00Z",
} as const;

describe("filterWnbaPropPicks", () => {
  it("filters by recommended side not a raw side field", () => {
    const out = filterWnbaPropPicks([row as never], {
      stats: new Set(),
      teams: new Set(),
      sides: new Set(["under"]),
    });
    expect(out).toHaveLength(0);
  });
});

describe("excludePastGameProps", () => {
  it("drops final teams and keeps live", () => {
    const games = [
      { status: "final", home: { abbrev: "PHO" }, away: { abbrev: "LAS" } },
      { status: "live", home: { abbrev: "NYL" }, away: { abbrev: "ATL" } },
    ] as never;
    const rows = [
      { ...row, team_abbrev: "PHO" },
      { ...row, team_abbrev: "NYL", player_name: "B" },
    ] as never;
    const out = excludePastGameProps(rows, games, "2026-08-11");
    expect(out.map((r) => r.team_abbrev)).toEqual(["NYL"]);
  });

  it("drops prior-day tips", () => {
    const rows = [
      { ...row, commence_time: "2026-08-10T23:00:00Z" },
    ] as never;
    const out = excludePastGameProps(rows, [], "2026-08-11");
    expect(out).toHaveLength(0);
  });
});
```

Use the same ET `tipEtDate` logic as today’s `filterPropLines.ts` (copy those helpers). Expand PHO↔PHX etc. when matching finals.

- [ ] **Step 2: Run tests to verify they fail**

`cd frontend && npm test -- src/features/basketball/league/filterWnbaPropPicks.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Copy `filterMlbPropPicks.ts` for filter/collect. Copy `excludePastGameProps` + `tipEtDate` + `expandWnbaTeamAbbrevs` from `filterPropLines.ts`, changing the row type to `Pick<ApiWnbaPropRow, "team_abbrev" | "commence_time">`.

- [ ] **Step 4: Run tests to verify they pass**

Same vitest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/basketball/league/filterWnbaPropPicks.ts frontend/src/features/basketball/league/filterWnbaPropPicks.test.ts
git commit -m "feat(wnba): filter +EV prop board by stat team side and past games"
```

---

### Task 9: Header, list, and page (MLB twins)

**Files:**
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksHeader.tsx` (+ test)
- Create: `frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx` (+ test)
- Create: `frontend/src/features/basketball/league/WnbaPropPicksList.tsx` (+ test)
- Modify: `frontend/src/pages/LeaguePropPicksPage.tsx` (+ test)
- Delete if unused: `PropPicksTable.tsx`, `PropPicksFilters.tsx`, and their tests (grep first)

**Interfaces:**
- Header props match MLB plus existing mark: `{ activeApp, onAppChange, legs, onLegsChange, children? }`
- Tabs: `id={wnba-props-${app}-tab}` / panel `wnba-props-${app}-panel`
- List: same collapsed/expand/books/pagination (20) as `MlbPropPicksList`
- Page: `format = app === "underdog" ? "standard" : "power"`; default legs 4

- [ ] **Step 1: Write failing UI tests**

Header (`WnbaPropPicksHeader.test.tsx`):

```tsx
it("renders PrizePicks and Underdog tabs and a legs pill", () => {
  render(
    <WnbaPropPicksHeader
      activeApp="prizepicks"
      onAppChange={() => {}}
      legs={4}
      onLegsChange={() => {}}
    />,
  );
  expect(screen.getByRole("tab", { name: "PrizePicks" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("group", { name: "Legs" })).toHaveTextContent("4-pick");
  expect(screen.getByRole("heading", { name: "WNBA Props" })).toBeInTheDocument();
});
```

List: copy `MlbPropPicksList.test.tsx` cases (expand, empty, error, pagination) with `data-testid="wnba-prop-picks-list"` and `ApiWnbaPropRow` fixtures (`commence_time` optional).

Page: copy `MlbPropPicksPage.test.tsx` wiring (tabs refetch, filters) + keep a hide-past assertion if the page test mocks a final game.

- [ ] **Step 2: Run tests to verify they fail**

`cd frontend && npm test -- src/features/basketball/league/WnbaPropPicksHeader.test.tsx src/pages/LeaguePropPicksPage.test.tsx`

Expected: FAIL — header has no tabs.

- [ ] **Step 3: Implement UI**

1. Copy `MlbPropPicksHeader.tsx` → merge into `WnbaPropPicksHeader.tsx`: keep basketball mark + emerald `#059669` + title `WNBA Props`; add `children`, `LegsPill`, and tablist from MLB (rename `mlb-props-` → `wnba-props-`).
2. Copy `MlbPropPicksFilters.tsx` → `WnbaPropPicksFilters.tsx` (same banner pills).
3. Copy `MlbPropPicksList.tsx` → `WnbaPropPicksList.tsx`:
   - Types: `ApiWnbaPropRow` / `ApiWnbaPropDfs` / `ApiWnbaPropBookQuote`
   - Test ids: `wnba-shot-chart` style → `wnba-prop-picks-list`, `wnba-prop-row-expand`
   - Book labels: reuse `frontend/src/features/basketball/lib/wnbaBookLabels.ts` if it has PX/Novig/DK/FD/Pinnacle; otherwise copy `mlbBookLabels` keys
   - Aria: “Loading WNBA prop picks”
4. Rewrite `LeaguePropPicksPage.tsx` as a copy of `MlbPropPicksPage.tsx` with:
   - `useWnbaProps({ app, format, legs })`
   - `useWnbaScoreboard()` + `excludePastGameProps` **before** `filterWnbaPropPicks`
   - `LeagueSubnav league="wnba"`
   - Header/list/filter WNBA components

Grep `PropPicksTable` / `PropPicksFilters` / `filterPropLines`. If only the old page used them, delete those files and tests in this commit.

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && npm test -- src/features/basketball/league/WnbaPropPicksHeader.test.tsx src/features/basketball/league/WnbaPropPicksList.test.tsx src/features/basketball/league/WnbaPropPicksFilters.test.tsx src/pages/LeaguePropPicksPage.test.tsx src/features/basketball/game/WnbaGamePropsGrid.test.tsx src/features/basketball/game/WnbaPregameCenter.test.tsx
```

Expected: new board PASS; game Props still PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/basketball/league frontend/src/pages/LeaguePropPicksPage.tsx frontend/src/pages/LeaguePropPicksPage.test.tsx
git commit -m "feat(wnba): remake prop picks page as MLB +EV hybrid board"
```

---

### Task 10: Docs + spec status

**Files:**
- Modify: `md/system-design.md` (`/wnba/prop_picks` row, endpoint table, data-flow diagram)
- Modify: `docs/superpowers/specs/2026-08-11-wnba-prop-picks-mlb-parity-design.md` status → Implemented
- Modify: `docs/superpowers/specs/2026-08-10-wnba-game-props-mlb-parity-design.md` note that the league page is no longer “unchanged”
- `frontend/README.md` / `backend/README.md` only if they still describe the multi-book table

- [ ] **Step 1: Update `md/system-design.md`**

Replace the `/wnba/prop_picks` table row with:

> Filterable DFS +EV ranked board (hybrid rows + expand). `useWnbaProps({ app, format, legs })` → `GET /api/wnba/props/today?app=&format=&legs=`. Seed Parlay PrizePicks (fallback `odds.wnba_prizepicks`) or `odds.wnba_underdogs`; DK/FD from Parlay; PX/Novig/Pinnacle from snapshots; server fair/edge/tier; client hide finals + prior-day tips; Stat/Team/Side filters; page size 20.

Replace the Prop Picks data-flow diagram (lines ~130–140) with the new assemble. Update `GET /api/wnba/props/today` in the endpoint table to `wnba.props` (+ `prop_fair`, `prop_formats`, snapshots). Keep `GET /api/wnba/props/game/{id}` on `get_today_props()`.

- [ ] **Step 2: Mark specs**

Set the 2026-08-11 spec Status to `Implemented`. Add one line on the 2026-08-10 game-props spec: league `/wnba/prop_picks` superseded by 2026-08-11.

- [ ] **Step 3: Full verification**

```bash
cd backend && PYTHONPATH=..:. python -m pytest tests/test_wnba_prop_fair.py tests/test_wnba_props.py tests/test_wnba_game_props.py tests/test_parlay_wnba_board.py tests/test_odds_snapshots_wnba_props.py tests/test_prop_stat_keys.py -q
cd ../frontend && npm test -- src/pages/LeaguePropPicksPage.test.tsx src/features/basketball/league/filterWnbaPropPicks.test.ts src/features/basketball/game/WnbaGamePropsGrid.test.tsx
cd ../frontend && npm run check:api
```

Expected: all PASS; `check:api` exit 0.

- [ ] **Step 4: Commit**

```bash
git add md/system-design.md docs/superpowers/specs/2026-08-11-wnba-prop-picks-mlb-parity-design.md docs/superpowers/specs/2026-08-10-wnba-game-props-mlb-parity-design.md
git commit -m "docs: record WNBA prop picks +EV board in system design"
```

---

## Self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| League page only | 9 (page); 6 keeps game route |
| Full MLB product | 5–9 |
| Approach 1 port, no shared MLB+WNBA service | 2 copy; 9 copy UI |
| Hide finals + prior-day; keep live | 8, 9 |
| Fair ladder PX+Novig → DK+FD → Pinnacle cmp | 2, 5 |
| Exact line | 5 tests |
| Formats power/standard 2–6 default 4 | 5, 6, 9 |
| `odds.wnba_prophetx` + scraper upsert | 1 |
| Breaking `/props/today`; keep `get_today_props()` | 5, 6 |
| `commence_time` on rows | 3, 5 |
| Betting cannot import wnba | 6 move route |
| Header mark + tabs + legs + banner filters | 9 |
| Hybrid list 20 / 1–3 cols / expand 5 books | 9 |
| Empty/error/loading copy | 9 |
| OpenAPI + system-design | 6, 10 |
| Out of scope: game grid, slate, Flex, closest-line | no tasks |

No TBD/TODO placeholders. Type names: `WnbaPropRow`, `WnbaPropPicksResponse`, `get_wnba_props_today`, `fetchWnbaProps({ app, format, legs })`, `excludePastGameProps` on board rows.
