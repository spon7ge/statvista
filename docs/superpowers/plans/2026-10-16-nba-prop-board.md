# NBA Prop Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/nba/prop_picks` as an anchor-book research table that reads the latest lines from new `odds.nba_*` Supabase tables (including DraftKings and FanDuel) and scores L5/L10/L15/H2H from stats.nba.com.

**Architecture:** Migrations add ten `odds.nba_*` tables. Loaders route `league="nba"` into those tables and define the missing `load_draftkings_snapshot` / `load_fanduel_snapshot`. `GET /api/nba/props/board?book=` is a WNBA-board copy limited to the seven scraper books. The page, nav, and prefetch wire `/nba/prop_picks`.

**Tech Stack:** Postgres migrations, SQLAlchemy upserts, FastAPI, Pydantic, pytest, httpx. React 19, React Router 7, TanStack Query, Vitest. OpenAPI export → `npm run generate:api`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-nba-prop-board-design.md`.
- Valid `book` ids, exact: `prophetx`, `novig`, `pinnacle`, `draftkings`, `fanduel`, `prizepicks`, `underdog`.
- Omitted `book` means `prizepicks`. Any other value is HTTP 422 with `Cache-Control: no-store`.
- A known book with no quotes returns 200 and `rows: []`.
- PrizePicks missing American is `-137` on the chip and inside `ip_pct`.
- `ip_pct` is the integer average raw implied percent of the anchor American plus every matching book's American. No de-vig.
- Do not change MLB or WNBA boards, `GET /api/*/props/today`, or game-detail Props.
- Do not add `odds.nba_parlay_api_odds` or a shared board module.
- Do not create `odds.mlb_draftkings` / `odds.mlb_fanduel` in this plan.
- Product name in any new copy is statvista.
- Use `python3` (not `python`). Pytest needs `PYTHONPATH=backend`. OpenAPI: `PYTHONPATH=backend python3 -c "from app.openapi_export import export_openapi; export_openapi()"` then `cp frontend/openapi.json backend/openapi-golden.json` and `cd frontend && npm run generate:api`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `db/migrations/046_odds_nba_prizepicks.sql` … `055_odds_nba_fanduel.sql` | Ten NBA odds tables |
| `src/odds/quote_specs.py` | Register `nba_*` specs |
| `src/odds/snapshot_rows.py` | `sportsbook_picks_to_book_rows` for DK/FD scrapers |
| `src/odds/load_snapshots.py` | NBA table routing; `load_draftkings_snapshot` / `load_fanduel_snapshot` |
| `backend/app/core/odds_snapshots.py` | `fetch_latest_*("nba")` + DK/FD fetchers |
| `backend/app/domains/nba/schemas_prop_board.py` | Board response schemas |
| `backend/app/domains/nba/prop_board_cluster.py` | Seven-book `BOOK_CHIP_ORDER`, cluster, IP |
| `backend/app/domains/nba/prop_board_form.py` | L5/L10/L15/H2H scorers |
| `backend/app/domains/nba/prop_board_logs.py` | stats.nba.com season + fetches |
| `backend/app/domains/nba/prop_board_mains.py` | `_main_from_snapshot_rows` helpers (copied from WNBA props) |
| `backend/app/domains/nba/prop_board.py` | Assemble board |
| `backend/app/domains/nba/routes.py` | `GET /nba/props/board` |
| `backend/app/openapi_export.py` | Require `/api/nba/props/board` |
| `frontend/src/shared/lib/api.ts` | `fetchNbaPropBoard` |
| `frontend/src/features/nba/hooks/useNbaPropBoard.ts` | Query hook |
| `frontend/src/features/nba/league/*` | Filters, header, table, sort |
| `frontend/src/pages/NbaPropPicksPage.tsx` | Page |
| `frontend/src/app/AppRouter.tsx` | Route |
| `frontend/src/features/home/lib/appNav.ts` | NBA Props href |
| `frontend/src/features/home/lib/prefetchPropsBoard.ts` | Prefetch NBA board |
| `md/system-design.md` | Page and API rows |

---

### Task 1: NBA odds tables and quote specs

**Files:**
- Create: `db/migrations/046_odds_nba_prizepicks.sql`
- Create: `db/migrations/047_odds_nba_underdogs.sql`
- Create: `db/migrations/048_odds_nba_prophetx.sql`
- Create: `db/migrations/049_odds_nba_prophetx_team.sql`
- Create: `db/migrations/050_odds_nba_novig.sql`
- Create: `db/migrations/051_odds_nba_novig_team.sql`
- Create: `db/migrations/052_odds_nba_pinnacle.sql`
- Create: `db/migrations/053_odds_nba_pinnacle_team.sql`
- Create: `db/migrations/054_odds_nba_draftkings.sql`
- Create: `db/migrations/055_odds_nba_fanduel.sql`
- Modify: `src/odds/quote_specs.py`
- Test: `src/scrapers/tests/odds/test_quote_specs_nba.py` (create)

**Interfaces:**
- Produces: tables listed above. `QUOTE_SPECS` keys for every `nba_*` table.

- [ ] **Step 1: Write the failing test**

```python
from src.odds.quote_specs import QUOTE_SPECS, get_quote_spec

def test_nba_quote_specs_registered():
    assert get_quote_spec("nba_prizepicks") is QUOTE_SPECS["mlb_prizepicks"]
    assert get_quote_spec("nba_underdogs") is QUOTE_SPECS["mlb_underdogs"]
    assert get_quote_spec("nba_pinnacle") is QUOTE_SPECS["mlb_pinnacle"]
    assert get_quote_spec("nba_pinnacle_team") is QUOTE_SPECS["mlb_pinnacle_team"]
    assert get_quote_spec("nba_prophetx") is QUOTE_SPECS["mlb_prophetx"]
    assert get_quote_spec("nba_prophetx_team") is QUOTE_SPECS["mlb_prophetx_team"]
    assert get_quote_spec("nba_novig") is QUOTE_SPECS["mlb_novig"]
    assert get_quote_spec("nba_novig_team") is QUOTE_SPECS["mlb_novig_team"]
    assert get_quote_spec("nba_draftkings") is QUOTE_SPECS["wnba_draftkings"]
    assert get_quote_spec("nba_fanduel") is QUOTE_SPECS["wnba_fanduel"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python3 -m pytest src/scrapers/tests/odds/test_quote_specs_nba.py -q`  
Expected: FAIL (KeyError or missing module)

- [ ] **Step 3: Add migrations**

For each file, copy the mirror SQL and rename `mlb_`/`wnba_` → `nba_` and index names the same way. Mirrors:

| New file | Copy from |
| --- | --- |
| `046_odds_nba_prizepicks.sql` | `028_odds_mlb_prizepicks.sql` |
| `047_odds_nba_underdogs.sql` | `027_odds_mlb_underdogs.sql` |
| `048_odds_nba_prophetx.sql` | `029_odds_mlb_prophetx.sql` then add `is_main BOOLEAN` column in the CREATE (do not rely on a separate ALTER) |
| `049_odds_nba_prophetx_team.sql` | `030_odds_mlb_prophetx_team.sql` |
| `050_odds_nba_novig.sql` | `033_odds_mlb_novig.sql` |
| `051_odds_nba_novig_team.sql` | `034_odds_mlb_novig_team.sql` |
| `052_odds_nba_pinnacle.sql` | `031_odds_mlb_pinnacle.sql` |
| `053_odds_nba_pinnacle_team.sql` | `026_odds_mlb_pinnacle_team.sql` |
| `054_odds_nba_draftkings.sql` | `020_odds_wnba_fanduel_draftkings.sql` (DraftKings table only) |
| `055_odds_nba_fanduel.sql` | `020_odds_wnba_fanduel_draftkings.sql` (FanDuel table only) |

Example for DraftKings:

```sql
-- 054_odds_nba_draftkings.sql
CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.nba_draftkings (
    league           TEXT        NOT NULL,
    player_name      TEXT        NOT NULL,
    market_type      TEXT        NOT NULL,
    stat_category    TEXT,
    side             TEXT        NOT NULL,
    line_score       NUMERIC     NOT NULL,
    american_price   INTEGER     NOT NULL,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (league, player_name, market_type, side, line_score, scraped_at)
);

CREATE INDEX IF NOT EXISTS odds_nba_draftkings_league_scraped_at_idx
    ON odds.nba_draftkings (league, scraped_at DESC);
```

ProphetX CREATE must include `is_main BOOLEAN` (MLB added it later via `032`).

- [ ] **Step 4: Register quote specs**

In `src/odds/quote_specs.py` `QUOTE_SPECS`, add:

```python
    "nba_prizepicks": _PRIZEPICKS,
    "nba_underdogs": _UNDERDOG,
    "nba_pinnacle": _BOOK_PROPS,
    "nba_pinnacle_team": _PINNACLE_TEAM,
    "nba_prophetx": _EXCHANGE_PROPS,
    "nba_prophetx_team": _EXCHANGE_TEAM,
    "nba_novig": _EXCHANGE_PROPS,
    "nba_novig_team": _EXCHANGE_TEAM,
    "nba_draftkings": _BOOK_PROPS,
    "nba_fanduel": _BOOK_PROPS,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `PYTHONPATH=. python3 -m pytest src/scrapers/tests/odds/test_quote_specs_nba.py -q`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add db/migrations/046_odds_nba_prizepicks.sql \
  db/migrations/047_odds_nba_underdogs.sql \
  db/migrations/048_odds_nba_prophetx.sql \
  db/migrations/049_odds_nba_prophetx_team.sql \
  db/migrations/050_odds_nba_novig.sql \
  db/migrations/051_odds_nba_novig_team.sql \
  db/migrations/052_odds_nba_pinnacle.sql \
  db/migrations/053_odds_nba_pinnacle_team.sql \
  db/migrations/054_odds_nba_draftkings.sql \
  db/migrations/055_odds_nba_fanduel.sql \
  src/odds/quote_specs.py \
  src/scrapers/tests/odds/test_quote_specs_nba.py
git commit -m "$(cat <<'EOF'
Add NBA odds snapshot tables and quote specs.

EOF
)"
```

---

### Task 2: Route NBA scrapes into `odds.nba_*` and load DK/FD

**Files:**
- Modify: `src/odds/snapshot_rows.py`
- Modify: `src/odds/load_snapshots.py`
- Modify: `backend/app/core/odds_snapshots.py`
- Test: `src/scrapers/tests/odds/test_load_snapshots.py` (extend)
- Test: `backend/tests/test_odds_snapshots_nba.py` (create)

**Interfaces:**
- Consumes: scrapers already call `load_*_snapshot(..., league="nba")`.
- Produces: `sportsbook_picks_to_book_rows`, `load_draftkings_snapshot`, `load_fanduel_snapshot`, `fetch_latest_draftkings`, `fetch_latest_fanduel`. Every existing `_…_table("nba")` returns the `nba_*` name.

- [ ] **Step 1: Write the failing tests**

In `src/scrapers/tests/odds/test_load_snapshots.py`, add (follow existing `mock_upsert` fixture style):

```python
def test_load_prizepicks_nba_uses_nba_table(mock_upsert):
    load_snapshots.load_prizepicks_snapshot(
        [{"player": "A", "stat_type": "Points", "line_score": 20.5, "odds_type": "standard"}],
        league="nba",
        scraped_at=SCRAPED,
    )
    assert mock_upsert.call_args[0][0] == "nba_prizepicks"

def test_load_draftkings_snapshot_nba(mock_upsert):
    picks = [
        {
            "full_name": "Jayson Tatum",
            "stat_name": "Points",
            "stat_value": 27.5,
            "choice": "over",
            "american_price": -110,
        }
    ]
    n = load_snapshots.load_draftkings_snapshot(picks, league="nba", scraped_at=SCRAPED)
    assert n == 1
    table, df = mock_upsert.call_args[0]
    assert table == "nba_draftkings"
    assert df.iloc[0]["player_name"] == "Jayson Tatum"
    assert df.iloc[0]["market_type"] == "Points"
    assert df.iloc[0]["side"] == "over"
    assert df.iloc[0]["american_price"] == -110

def test_load_fanduel_snapshot_wnba_keeps_wnba_table(mock_upsert):
    picks = [
        {
            "full_name": "A'ja Wilson",
            "stat_name": "Points",
            "stat_value": 22.5,
            "choice": "under",
            "american_price": -105,
        }
    ]
    load_snapshots.load_fanduel_snapshot(picks, league="wnba", scraped_at=SCRAPED)
    assert mock_upsert.call_args[0][0] == "wnba_fanduel"
```

Also add underdog / pinnacle / prophetx / novig `league="nba"` table assertions the same way (one assertion each).

In `backend/tests/test_odds_snapshots_nba.py`:

```python
from app.core import odds_snapshots as svc

def test_fetch_latest_prizepicks_nba_sql():
    sql = svc._latest_snapshot_sql.__doc__  # force import path
    # Call the public fetcher's SQL the same way MLB tests do:
    # inspect by monkeypatching _fetch_rows or reading the table map.
    assert svc._PRIZEPICKS_TABLE["nba"] == "nba_prizepicks"
    assert svc._UNDERDOG_TABLE["nba"] == "nba_underdogs"
    assert svc._PINNACLE_TABLE["nba"] == "nba_pinnacle"
    assert svc._PROPHETX_TABLE["nba"] == "nba_prophetx"
    assert svc._NOVIG_TABLE["nba"] == "nba_novig"
```

Prefer matching `backend/tests/test_odds_snapshots_mlb_parlay.py`: call `fetch_latest_*("nba")` after patching `_fetch_rows` to capture SQL, and assert `FROM odds.nba_…`. Add the same for `fetch_latest_draftkings` and `fetch_latest_fanduel`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=.:backend python3 -m pytest src/scrapers/tests/odds/test_load_snapshots.py -k "nba or draftkings_snapshot or fanduel_snapshot" backend/tests/test_odds_snapshots_nba.py -q`  
Expected: FAIL

- [ ] **Step 3: Map scraper picks to book rows**

In `src/odds/snapshot_rows.py`:

```python
_VALID_BOOK_SIDES = frozenset({"over", "under"})

def sportsbook_picks_to_book_rows(
    picks: list[dict],
    *,
    league: str,
    scraped_at: datetime,
) -> list[dict]:
    """Map DK/FD scraper pick dicts to odds.*_{draftkings|fanduel} rows."""
    rows: list[dict] = []
    league_key = league.lower()
    for pick in picks:
        player_name = pick.get("full_name")
        market_type = pick.get("stat_name")
        stat_value = pick.get("stat_value")
        side = str(pick.get("choice") or "").strip().lower()
        american = parse_american_price(pick.get("american_price"))
        if not player_name or not market_type or stat_value is None:
            continue
        if side not in _VALID_BOOK_SIDES or american is None:
            continue
        rows.append(
            {
                "league": league_key,
                "player_name": player_name,
                "market_type": market_type,
                "stat_category": None,
                "side": side,
                "line_score": stat_value,
                "american_price": american,
                "scraped_at": scraped_at,
            }
        )
    return rows
```

- [ ] **Step 4: Route loaders and define DK/FD loaders**

In `src/odds/load_snapshots.py`, change each `_…_table` helper so `nba` is explicit before the WNBA/MLB default. Pattern:

```python
def _prizepicks_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_prizepicks"
    if lg == "nba":
        return "nba_prizepicks"
    return "wnba_prizepicks"
```

Apply the same for underdog, pinnacle props/team, prophetx props/team, novig props/team. Do **not** change `parlay_api_odds_table` to invent `nba_parlay_api_odds`.

Add:

```python
def _draftkings_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "nba":
        return "nba_draftkings"
    if lg == "wnba":
        return "wnba_draftkings"
    raise ValueError(f"unsupported draftkings league: {league}")

def _fanduel_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "nba":
        return "nba_fanduel"
    if lg == "wnba":
        return "wnba_fanduel"
    raise ValueError(f"unsupported fanduel league: {league}")

def load_draftkings_snapshot(
    picks: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("DRAFTKINGS_SKIP_DB") or _skip_db("SHARP_PROPS_SKIP_DB"):
        return 0
    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = sportsbook_picks_to_book_rows(picks, league=league, scraped_at=scraped_at)
    if not rows:
        return 0
    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score"])
    df = _dedupe_conflict_rows(df, _SHARP_BOOK_CONFLICT_COLS)
    if df.empty:
        return 0
    table = _draftkings_table(league)
    league_norm = (league or "").strip().lower()
    df = apply_change_filter(table, df, league=league_norm)
    if df.empty:
        return 0
    upsert_df(
        table,
        df,
        schema="odds",
        conflict_cols=_SHARP_BOOK_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)

def load_fanduel_snapshot(
    picks: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    # Same body as load_draftkings_snapshot with _fanduel_table and FANDUEL_SKIP_DB
    ...
```

Import `sportsbook_picks_to_book_rows` at the top of `load_snapshots.py`.

- [ ] **Step 5: Fetch latest for NBA + DK/FD**

In `backend/app/core/odds_snapshots.py`, set:

```python
_PRIZEPICKS_TABLE = {
    "mlb": "mlb_prizepicks",
    "wnba": "wnba_prizepicks",
    "nba": "nba_prizepicks",
}
# same pattern for underdog, pinnacle, pinnacle_team, prophetx, prophetx_team, novig, novig_team
_DRAFTKINGS_TABLE = {"nba": "nba_draftkings", "wnba": "wnba_draftkings"}
_FANDUEL_TABLE = {"nba": "nba_fanduel", "wnba": "wnba_fanduel"}
```

Remove the `"nba": "wnba_prizepicks"` fallback. Add:

```python
def fetch_latest_draftkings(league: str = "nba") -> list[dict]:
    lg = _normalized_league(league, "nba")
    table = _DRAFTKINGS_TABLE.get(lg)
    if not table:
        return []
    sql = _latest_snapshot_sql(
        table,
        "player_name, market_type, side, line_score, american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)

def fetch_latest_fanduel(league: str = "nba") -> list[dict]:
    lg = _normalized_league(league, "nba")
    table = _FANDUEL_TABLE.get(lg)
    if not table:
        return []
    sql = _latest_snapshot_sql(
        table,
        "player_name, market_type, side, line_score, american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `PYTHONPATH=.:backend python3 -m pytest src/scrapers/tests/odds/test_load_snapshots.py -k "nba or draftkings_snapshot or fanduel_snapshot" backend/tests/test_odds_snapshots_nba.py -q`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/odds/snapshot_rows.py src/odds/load_snapshots.py \
  backend/app/core/odds_snapshots.py \
  src/scrapers/tests/odds/test_load_snapshots.py \
  backend/tests/test_odds_snapshots_nba.py
git commit -m "$(cat <<'EOF'
Route NBA odds scrapes into nba_* tables including DK and FD.

EOF
)"
```

---

### Task 3: NBA board schemas, cluster, form, and mains helpers

**Files:**
- Create: `backend/app/domains/nba/schemas_prop_board.py` (copy `wnba/schemas_prop_board.py`, rename `Wnba` → `Nba`)
- Create: `backend/app/domains/nba/prop_board_cluster.py` (copy WNBA; shorten `BOOK_CHIP_ORDER`)
- Create: `backend/app/domains/nba/prop_board_form.py` (copy WNBA; local abbrev helper)
- Create: `backend/app/domains/nba/prop_board_mains.py` (copy `_main_from_snapshot_rows` and its private helpers from `wnba/props.py`)
- Test: `backend/tests/test_nba_prop_board_schema.py`
- Test: `backend/tests/test_nba_prop_board_form.py`
- Test: `backend/tests/test_nba_prop_board_cluster.py`

**Interfaces:**
- Produces: `NbaPropBoardRow` with required `anchor`. `BOOK_CHIP_ORDER` = seven books. `hit_rates` / `h2h_rate` / `consensus_ip_pct` / `cluster_quotes` / `_main_from_snapshot_rows`.

- [ ] **Step 1: Write the failing tests**

Schema: require `anchor`, reject missing `anchor`, dump has no `dfs`.

Cluster:

```python
from app.domains.nba.prop_board_cluster import BOOK_CHIP_ORDER, consensus_ip_pct

def test_nba_book_chip_order_is_supabase_only():
    assert BOOK_CHIP_ORDER == (
        "prophetx", "novig", "pinnacle", "draftkings",
        "fanduel", "prizepicks", "underdog",
    )
    assert "betmgm" not in BOOK_CHIP_ORDER

def test_consensus_ip_unique_prizepicks_uses_minus_137_raw():
    # american_to_fair_pct(-137) then int average of one value
    assert consensus_ip_pct([-137]) == round(
        __import__("app.domains.wnba.prop_fair", fromlist=["american_to_fair_pct"])
        .american_to_fair_pct(-137)
    )
```

Form (fixture one game log with PTS/REB/AST/MIN/MATCHUP):

```python
def test_hit_rates_over_points_l5():
    splits = [
        {"GAME_DATE": f"2026-10-{i:02d}", "MIN": 30, "PTS": 30, "MATCHUP": "BOS @ NYK"}
        for i in range(1, 6)
    ]
    l5, l10, l15 = hit_rates("points", "over", 25.5, splits)
    assert l5 == 100
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_prop_board_schema.py backend/tests/test_nba_prop_board_cluster.py backend/tests/test_nba_prop_board_form.py -q`  
Expected: FAIL

- [ ] **Step 3: Implement by copy + edits**

1. Copy `schemas_prop_board.py`; rename types `Wnba*` → `Nba*`.
2. Copy `prop_board_cluster.py`. Set `BOOK_CHIP_ORDER` to the seven-tuple above. Drop `DFS_CHIP_ORDER` / `SPORTSBOOK_CHIP_ORDER` if unused, or leave unused. Import `american_to_fair_pct` from `app.domains.wnba.prop_fair` (shared fair helper already used by WNBA cluster) **or** copy that one function into the NBA cluster file if domain isolation is required. Prefer copying the tiny `american_to_fair_pct` into `nba/prop_board_cluster.py` only if importing `wnba.prop_fair` is rejected by review; otherwise import from `wnba.prop_fair` is acceptable for this plan because it is pure math with no WNBA I/O.
3. Copy `prop_board_form.py`. Replace `from app.core.wnba_abbrevs import canonical_abbrev` with:

```python
def canonical_abbrev(abbrev: str) -> str | None:
    text = str(abbrev or "").strip().upper()
    return text or None
```

4. Create `prop_board_mains.py` by copying from `wnba/props.py` only: `MainLineKey`, `MainLine`, `MainLineIndex`, `_VALID_SIDES`, `_parse_american`, `_line_key`, `_as_datetime`, `_row_is_main_flag`, `_pick_main_line`, `_main_from_snapshot_rows`, and their imports (`match_player_key`, `canonical_stat_key_from_exchange`). Do not copy Parlay index helpers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_prop_board_schema.py backend/tests/test_nba_prop_board_cluster.py backend/tests/test_nba_prop_board_form.py -q`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/nba/schemas_prop_board.py \
  backend/app/domains/nba/prop_board_cluster.py \
  backend/app/domains/nba/prop_board_form.py \
  backend/app/domains/nba/prop_board_mains.py \
  backend/tests/test_nba_prop_board_schema.py \
  backend/tests/test_nba_prop_board_cluster.py \
  backend/tests/test_nba_prop_board_form.py
git commit -m "$(cat <<'EOF'
Add NBA prop board schemas, clustering, and hit-rate helpers.

EOF
)"
```

---

### Task 4: stats.nba.com log fetches

**Files:**
- Create: `backend/app/domains/nba/prop_board_logs.py`
- Test: `backend/tests/test_nba_prop_board_logs.py`

**Interfaces:**
- Produces: `current_nba_season() -> str` (`YYYY-YY`), `fetch_commonallplayers(season: str)`, `fetch_leaguedashplayerstats(season: str)`, `fetch_playergamelog(player_id: str, season: str)`, `rows_as_dicts(payload) -> list[dict]`.

- [ ] **Step 1: Write the failing tests**

```python
from datetime import date
from app.domains.nba import prop_board_logs as logs

def test_current_nba_season_october_uses_new_start_year(monkeypatch):
    monkeypatch.setattr(logs, "_today", lambda: date(2026, 10, 16))
    assert logs.current_nba_season() == "2026-27"

def test_current_nba_season_january_uses_prior_start_year(monkeypatch):
    monkeypatch.setattr(logs, "_today", lambda: date(2027, 1, 5))
    assert logs.current_nba_season() == "2026-27"

@pytest.mark.asyncio
async def test_fetch_playergamelog_uses_nba_league_id(monkeypatch):
    captured = {}
    class FakeResp:
        def raise_for_status(self): pass
        def json(self): return {"resultSets": []}
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def get(self, url, params=None):
            captured["url"] = url
            captured["params"] = params
            return FakeResp()
    monkeypatch.setattr(logs.httpx, "AsyncClient", lambda **kw: FakeClient())
    await logs.fetch_playergamelog("1628369", "2026-27")
    assert "stats.nba.com" in captured["url"]
    assert captured["params"]["LeagueID"] == "00"
    assert captured["params"]["Season"] == "2026-27"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_prop_board_logs.py -q`  
Expected: FAIL

- [ ] **Step 3: Implement**

Copy URL/header patterns from `wnba/player.py`, but:

- Host: `https://stats.nba.com/stats/...`
- `LeagueID`: `"00"`
- `Season`: the `YYYY-YY` string (not `str(int)`)
- Referer/Origin: `https://www.nba.com/`

```python
def current_nba_season(today: date | None = None) -> str:
    d = today or _today()
    start = d.year if d.month >= 10 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"

def _today() -> date:
    return date.today()
```

`rows_as_dicts` can be copied from `wnba/player.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_prop_board_logs.py -q`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/nba/prop_board_logs.py backend/tests/test_nba_prop_board_logs.py
git commit -m "$(cat <<'EOF'
Fetch NBA player game logs from stats.nba.com.

EOF
)"
```

---

### Task 5: Assemble `GET /api/nba/props/board`

**Files:**
- Create: `backend/app/domains/nba/prop_board.py`
- Modify: `backend/app/domains/nba/routes.py`
- Test: `backend/tests/test_nba_prop_board.py`
- Test: `backend/tests/test_nba_prop_board_route.py`

**Interfaces:**
- Consumes: `fetch_latest_*` for the seven books; `get_nba_player_index`; `get_today_scoreboard`; Task 3–4 helpers.
- Produces: `UnknownBoardBookError`, `resolve_board_book`, `get_nba_prop_board(book: str | None = None) -> NbaPropBoardResponse`. Route maps unknown book to 422.

- [ ] **Step 1: Write the failing tests**

Mirror `backend/tests/test_wnba_prop_board.py` anchor tests, with `points` instead of baseball stats where needed:

```python
@pytest.mark.asyncio
async def test_anchor_book_keeps_only_identical_player_stat_and_line(monkeypatch):
    quotes = [
        BoardQuote("Tatum", "jayson tatum", "points", 27.5, "prizepicks", None, None),
        BoardQuote("Tatum", "jayson tatum", "points", 27.5, "draftkings", -110, -110),
        BoardQuote("Tatum", "jayson tatum", "points", 28.5, "fanduel", -105, -115),
        BoardQuote("Tatum", "jayson tatum", "rebounds", 8.5, "draftkings", -110, -110),
    ]
    # monkeypatch collect_board_quotes + load_enrichment like WNBA tests
    board = await get_nba_prop_board("prizepicks")
    keys = {(r.stat, r.line) for r in board.rows}
    assert keys == {("points", 27.5)}
    row = next(r for r in board.rows if r.side == "over")
    assert row.anchor.book == "prizepicks"
    assert row.anchor.american == -137
    assert [b.book for b in row.books] == ["draftkings"]

@pytest.mark.asyncio
async def test_betmgm_is_unknown_book():
    with pytest.raises(UnknownBoardBookError):
        resolve_board_book("betmgm")
```

Route test with `TestClient`: `GET /api/nba/props/board?book=betmgm` → 422; omitted book → 200 (monkeypatch assembler).

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_prop_board.py backend/tests/test_nba_prop_board_route.py -q`  
Expected: FAIL

- [ ] **Step 3: Implement assembler**

Copy `wnba/prop_board.py` → `nba/prop_board.py`, then:

1. Rename types/imports to NBA modules.
2. `collect_board_quotes` loads only: prophetx, novig, pinnacle, draftkings, fanduel, prizepicks, underdog via `fetch_latest_*("nba")`. Use `_main_from_snapshot_rows(..., stat_field="market_type")` for DK/FD/Pinnacle and `stat_field="stat_name"` for exchanges.
3. Delete the Parlay block and `parlay_unavailable`.
4. Enrichment: `get_nba_player_index`, `get_today_scoreboard` from `app.domains.nba.scoreboard`, logs from `prop_board_logs` with `current_nba_season()` string.
5. `resolve_board_book` checks the seven-book `BOOK_CHIP_ORDER`.

Route (add to `nba/routes.py`):

```python
@router.get("/nba/props/board", response_model=NbaPropBoardResponse)
async def nba_props_board(
    response: Response,
    book: str | None = Query(default=None),
) -> NbaPropBoardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_nba_prop_board(book)
    except UnknownBoardBookError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"unknown book: {exc}",
            headers=_NO_STORE,
        ) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_prop_board.py backend/tests/test_nba_prop_board_route.py -q`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/nba/prop_board.py backend/app/domains/nba/routes.py \
  backend/tests/test_nba_prop_board.py backend/tests/test_nba_prop_board_route.py
git commit -m "$(cat <<'EOF'
Assemble the NBA prop board from Supabase books.

EOF
)"
```

---

### Task 6: OpenAPI and `fetchNbaPropBoard`

**Files:**
- Modify: `backend/app/openapi_export.py` — add `"/api/nba/props/board"` to `REQUIRED_NBA_PATHS`
- Modify: `frontend/openapi.json`, `backend/openapi-golden.json`, generated `frontend/src/shared/lib/api.schema.d.ts`
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts`
- Create: `frontend/src/features/nba/hooks/useNbaPropBoard.ts`
- Test: `frontend/src/features/nba/hooks/useNbaPropBoard.test.tsx` (optional if page tests cover the key)

**Interfaces:**
- Produces: `fetchNbaPropBoard(book = "prizepicks")`, `useNbaPropBoard(book)`, query key `["nba", "props", "board", book]`, stale 15m, no refetch on focus.

- [ ] **Step 1: Write the failing client test**

In `api.test.ts`, mirror the WNBA board cases for `/api/nba/props/board?book=prizepicks` and `book=draftkings`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/shared/lib/api.test.ts -t "nba/props/board"`  
Expected: FAIL

- [ ] **Step 3: Export OpenAPI and generate types**

```bash
PYTHONPATH=backend python3 -c "from app.openapi_export import export_openapi; export_openapi()"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Add types and fetch:

```typescript
export type ApiNbaPropBoardBookChip = Schemas["NbaPropBoardBookChip"];
export type ApiNbaPropBoardRow = Schemas["NbaPropBoardRow"];
export type ApiNbaPropBoardResponse = Schemas["NbaPropBoardResponse"];

export async function fetchNbaPropBoard(
  book = "prizepicks",
): Promise<ApiNbaPropBoardResponse> {
  const qs = new URLSearchParams({ book });
  const res = await fetch(`${API_BASE}/api/nba/props/board?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`NBA prop board request failed: ${res.status}`);
  }
  return res.json();
}
```

Copy `useWnbaPropBoard.ts` → `useNbaPropBoard.ts` with nba keys and `fetchNbaPropBoard`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/shared/lib/api.test.ts -t "nba/props/board"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/openapi_export.py frontend/openapi.json backend/openapi-golden.json \
  frontend/src/shared/lib/api.schema.d.ts frontend/src/shared/lib/api.ts \
  frontend/src/shared/lib/api.test.ts \
  frontend/src/features/nba/hooks/useNbaPropBoard.ts
git commit -m "$(cat <<'EOF'
Expose the NBA prop board in OpenAPI and the client.

EOF
)"
```

---

### Task 7: NBA props page

**Files:**
- Create: `frontend/src/pages/NbaPropPicksPage.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/nba/league/NbaPropPicksFilters.tsx`
- Create: `frontend/src/features/nba/league/NbaPropPicksHeader.tsx`
- Create: `frontend/src/features/nba/league/NbaPropPicksTable.tsx` (+ tests as needed)
- Create: `frontend/src/features/nba/league/filterNbaPropBoard.ts`
- Create: `frontend/src/features/nba/league/sortNbaPropBoard.ts`
- Modify: `frontend/src/app/AppRouter.tsx` (+ test)

**Interfaces:**
- Produces: `/nba/prop_picks` with `?book=`, seven Bookmaker options, no DFS, no Team.

- [ ] **Step 1: Write the failing page tests**

Copy `LeaguePropPicksPage.test.tsx` patterns: default `book=prizepicks`, choosing DraftKings sets `?book=draftkings`, choosing PrizePicks clears the param, headers exclude DFS, Bookmaker options exclude BetMGM.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/pages/NbaPropPicksPage.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement**

Copy WNBA page/filters/header/table/filter/sort into `features/nba/league/` and `pages/NbaPropPicksPage.tsx`. Edits:

1. `BOOK_CHIP_ORDER` in `sortNbaPropBoard.ts` is the seven-book list.
2. Hook is `useNbaPropBoard`.
3. Types use `ApiNbaPropBoard*`.
4. Book labels: reuse `@/features/basketball/lib/wnbaBookLabels` `bookDisplayName` (same ids).

Router:

```tsx
<Route path="/nba/prop_picks" element={<NbaPropPicksPage />} />
<Route
  path="/nba/prop_picks/player/:playerSlug"
  element={<Navigate to="/nba/prop_picks" replace />}
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/pages/NbaPropPicksPage.test.tsx src/app/AppRouter.test.tsx`  
Expected: PASS (add an AppRouter case for `/nba/prop_picks`)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NbaPropPicksPage.tsx frontend/src/pages/NbaPropPicksPage.test.tsx \
  frontend/src/features/nba/league \
  frontend/src/app/AppRouter.tsx frontend/src/app/AppRouter.test.tsx
git commit -m "$(cat <<'EOF'
Add the NBA prop picks page.

EOF
)"
```

---

### Task 8: Nav, prefetch, and system-design docs

**Files:**
- Modify: `frontend/src/features/home/lib/appNav.ts`
- Modify: `frontend/src/features/home/lib/appNav.test.ts`
- Modify: `frontend/src/features/home/lib/prefetchPropsBoard.ts`
- Modify: `frontend/src/features/home/lib/prefetchPropsBoard.test.ts`
- Modify: `frontend/src/features/home/AppSidebar.test.tsx` (NBA Props → `/nba/prop_picks`)
- Modify: `frontend/src/features/home/LeagueSectionSwitcher.test.tsx` / `PropPicksLeagueSwitcher.test.tsx` as needed
- Modify: `md/system-design.md`

**Interfaces:**
- Produces: `sectionHref("nba", "Props") === "/nba/prop_picks"`; prefetch warms PrizePicks NBA board.

- [ ] **Step 1: Write the failing tests**

```typescript
expect(sectionHref("nba", "Props")).toBe("/nba/prop_picks");
expect(homePropsHref("/nba/matchups")).toBe("/nba/prop_picks");
```

Prefetch: `/nba/prop_picks` calls `prefetchNbaPropBoard`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/features/home/lib/appNav.test.ts src/features/home/lib/prefetchPropsBoard.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// appNav.ts
if (item === "Props") return `/${league}/prop_picks`;
```

(Remove the `league !== "nba"` guard.)

```typescript
// prefetchPropsBoard.ts
if (href.startsWith("/nba/prop_picks")) {
  void prefetchNbaPropBoard(client);
  return;
}
```

Update `md/system-design.md`:

- Router tree: `/nba/prop_picks`
- Page table row for `/nba/prop_picks` (same columns/filters as MLB/WNBA, seven books)
- API table: `GET /api/nba/props/board`
- Sidebar note: Props for NBA goes to `/nba/prop_picks` (no MLB fallback)
- Data-flow bullet for NBA board reading `odds.nba_*`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/features/home/lib/appNav.test.ts src/features/home/lib/prefetchPropsBoard.test.ts src/features/home/AppSidebar.test.tsx src/features/home/LeagueSectionSwitcher.test.tsx src/features/home/PropPicksLeagueSwitcher.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/home/lib/appNav.ts frontend/src/features/home/lib/appNav.test.ts \
  frontend/src/features/home/lib/prefetchPropsBoard.ts \
  frontend/src/features/home/lib/prefetchPropsBoard.test.ts \
  frontend/src/features/home/AppSidebar.test.tsx \
  frontend/src/features/home/LeagueSectionSwitcher.test.tsx \
  frontend/src/features/home/PropPicksLeagueSwitcher.test.tsx \
  md/system-design.md
git commit -m "$(cat <<'EOF'
Wire NBA Props nav and document the board.

EOF
)"
```

---

## Self-review

1. **Spec coverage:** Tables + loader routing + DK/FD loaders (Tasks 1–2). Seven-book board + hit rates + route (Tasks 3–5). Page + nav + docs (Tasks 6–8). Excluded Parlay books and MLB DK/FD tables stay out of scope.
2. **Placeholders:** None left as TBD.
3. **Type consistency:** `NbaPropBoard*` schemas, `BOOK_CHIP_ORDER` seven-tuple, `fetchNbaPropBoard(book)`, query key `["nba","props","board",book]`, season `YYYY-YY` string throughout logs.
