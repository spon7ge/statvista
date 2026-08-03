# MLB Pinnacle Team Odds → Matchups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upsert MLB Pinnacle `*_team.json` into `odds.mlb_pinnacle_team` and serve Pinnacle-first (Sharp fallback) odds on `/mlb/matchups` via `GET /api/mlb/odds/today`.

**Architecture:** Mirror the WNBA path with an MLB-owned table. Route the existing Selenium row mapper / upsert by league; extend snapshot fetch for `odds.mlb_pinnacle_team`; replace Sharp-only `mlb_odds.get_today_odds` with Pinnacle normalize + `merge_pinnacle_prefer_sharp` semantics using MLB team-name maps. Frontend keeps current hooks/DTO shape.

**Tech Stack:** Postgres/Supabase SQL, Python loaders, FastAPI, pytest, existing React matchups merge

## Global Constraints

- Table name is exactly `odds.mlb_pinnacle_team` (do not write MLB into `odds.wnba_pinnacle_team`)
- Matchup markets: spread + total only; `period=0`, `is_alternate=false`
- Pinnacle first; Sharp only when that game has no Pinnacle spread **and** no total
- No disk fallback from `data/props/pinnacle/mlb/*.json` in the API
- No MLB player-props table / Prop Picks in this plan
- Do not rename or break WNBA loaders/API

---

## File Structure

| File | Responsibility |
| --- | --- |
| `db/migrations/026_odds_mlb_pinnacle_team.sql` | Create MLB team odds table + indexes |
| `src/odds/load_snapshots.py` | Route `load_pinnacle_team_snapshot` to MLB vs WNBA table; optional JSON file loader |
| `src/scrapers/mlb_pinnacle.py` | Upsert team snapshot after JSON write |
| `backend/app/services/odds_snapshots.py` | Fetch latest from correct table by league |
| `backend/app/services/mlb_team_names.py` | MLB full name → abbrev |
| `backend/app/services/mlb_odds.py` | Pinnacle-first + Sharp fallback for MLB |
| `backend/tests/...` | Loader, snapshot, odds service tests |

---

### Task 1: Migration `odds.mlb_pinnacle_team`

**Files:**
- Create: `db/migrations/026_odds_mlb_pinnacle_team.sql`
- Test: verify SQL text in a tiny unit test or by reading file in pytest (optional); primary check is migration file matches 024 shape

**Interfaces:**
- Consumes: nothing
- Produces: table `odds.mlb_pinnacle_team` with same columns/indexes as WNBA 024

- [ ] **Step 1: Write migration**

```sql
-- 026_odds_mlb_pinnacle_team.sql
-- Selenium Pinnacle MLB team / game markets (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_pinnacle_team (
    league           TEXT        NOT NULL,
    matchup_id       BIGINT,
    away_team        TEXT        NOT NULL,
    home_team        TEXT        NOT NULL,
    start_time       TIMESTAMPTZ,
    market_type      TEXT        NOT NULL,
    period           INTEGER     NOT NULL DEFAULT 0,
    is_alternate     BOOLEAN     NOT NULL DEFAULT FALSE,
    side             TEXT        NOT NULL,
    team             TEXT,
    points           NUMERIC,
    american_price   INTEGER     NOT NULL,
    decimal_price    NUMERIC,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_mlb_pinnacle_team_snapshot_uidx
    ON odds.mlb_pinnacle_team (
        league, away_team, home_team, market_type, period,
        is_alternate, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_mlb_pinnacle_team_league_scraped_at_idx
    ON odds.mlb_pinnacle_team (league, scraped_at DESC);
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/026_odds_mlb_pinnacle_team.sql
git commit -m "db: add odds.mlb_pinnacle_team for Selenium Pinnacle team lines"
```

---

### Task 2: Loader routes MLB → `mlb_pinnacle_team` + scraper upsert + file load helper

**Files:**
- Modify: `src/odds/load_snapshots.py` (`load_pinnacle_team_snapshot`)
- Modify: `src/scrapers/mlb_pinnacle.py` (`run()` after JSON write)
- Modify: `src/scrapers/tests/odds/test_load_snapshots.py`
- Create (optional helper in load_snapshots): `load_pinnacle_team_json_file(path: str) -> int`

**Interfaces:**
- Consumes: `selenium_pinnacle_team_to_rows(games, league=..., scraped_at=...)`
- Produces:
  - `load_pinnacle_team_snapshot(..., league="mlb")` upserts table `"mlb_pinnacle_team"`
  - `load_pinnacle_team_snapshot(..., league="wnba")` still upserts `"wnba_pinnacle_team"`
  - `load_pinnacle_team_json_file(path) -> int` reads a `*_team.json`, uses `payload["games"]` + `league`

- [ ] **Step 1: Write failing tests**

Add to `src/scrapers/tests/odds/test_load_snapshots.py`:

```python
def test_load_pinnacle_team_snapshot_mlb_uses_mlb_table(mock_upsert):
    count = load_snapshots.load_pinnacle_team_snapshot(
        PINNACLE_TEAM_GAMES, league="mlb", scraped_at=SCRAPED
    )
    assert count >= 1
    table, df = mock_upsert.call_args[0]
    assert table == "mlb_pinnacle_team"
    assert df.iloc[0]["league"] == "mlb"


def test_load_pinnacle_team_json_file(mock_upsert, tmp_path):
    path = tmp_path / "pinnacle_mlb_team.json"
    path.write_text(
        json.dumps(
            {
                "league": "mlb",
                "games": PINNACLE_TEAM_GAMES,
            }
        ),
        encoding="utf-8",
    )
    count = load_snapshots.load_pinnacle_team_json_file(str(path))
    assert count >= 1
    table, _df = mock_upsert.call_args[0]
    assert table == "mlb_pinnacle_team"
```

(Import `json` at top of test file if missing. Reuse existing `PINNACLE_TEAM_GAMES` fixture; if it hardcodes wnba participants, still fine — league arg drives table.)

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py::test_load_pinnacle_team_snapshot_mlb_uses_mlb_table src/scrapers/tests/odds/test_load_snapshots.py::test_load_pinnacle_team_json_file -v`

Expected: FAIL (mlb still hits `wnba_pinnacle_team` / missing helper)

- [ ] **Step 3: Implement loader routing + JSON helper**

In `src/odds/load_snapshots.py`:

```python
def _pinnacle_team_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_pinnacle_team"
    return "wnba_pinnacle_team"
```

In `load_pinnacle_team_snapshot`, replace hardcoded `"wnba_pinnacle_team"` with `_pinnacle_team_table(league)`.

Add:

```python
def load_pinnacle_team_json_file(path: str, *, scraped_at: datetime | None = None) -> int:
    """Load a Selenium *_team.json snapshot into the league-appropriate table."""
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    league = str(payload.get("league") or "mlb").strip().lower()
    games = payload.get("games") or []
    if not isinstance(games, list):
        raise ValueError(f"invalid team snapshot games in {path}")
    return load_pinnacle_team_snapshot(
        games, league=league, scraped_at=scraped_at
    )
```

Ensure `json` is imported in `load_snapshots.py`.

- [ ] **Step 4: Wire `mlb_pinnacle.py` upsert after JSON write**

In `run()`, after writing props/team JSON (before the success print), restore a try/except DB block:

```python
        scraped_at = dt.datetime.now(dt.timezone.utc)
        db_ok = True
        try:
            from src.odds.load_snapshots import load_pinnacle_team_snapshot

            n_team_db = load_pinnacle_team_snapshot(
                games_out,
                league=self.league,
                scraped_at=scraped_at,
            )
            logger.info(
                "Supabase odds.mlb_pinnacle_team upserted %s rows (%s)",
                n_team_db,
                self.league,
            )
        except Exception as exc:
            db_ok = False
            logger.warning("Supabase mlb pinnacle team load failed (JSON kept): %s", exc)

        # ... existing print ...
        if not db_ok:
            print(f"⚠ [{self.league}] Supabase upsert failed; see logs", file=sys.stderr)
        return props_payload, db_ok
```

Update `run()` return type usage: currently always `True` — return `db_ok`.

- [ ] **Step 5: Run tests — expect PASS**

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py -k pinnacle_team -v`

Expected: PASS (including existing wnba assertion still on `wnba_pinnacle_team`)

- [ ] **Step 6: Commit**

```bash
git add src/odds/load_snapshots.py src/scrapers/mlb_pinnacle.py src/scrapers/tests/odds/test_load_snapshots.py
git commit -m "feat: upsert MLB Pinnacle team snapshots into odds.mlb_pinnacle_team"
```

---

### Task 3: Backend fetch latest MLB team snapshot

**Files:**
- Modify: `backend/app/services/odds_snapshots.py`
- Modify: `backend/tests/test_odds_snapshots_pinnacle.py`

**Interfaces:**
- Consumes: Supabase tables `odds.wnba_pinnacle_team` / `odds.mlb_pinnacle_team`
- Produces: `fetch_latest_pinnacle_team("mlb")` queries `odds.mlb_pinnacle_team`; `"wnba"` unchanged

- [ ] **Step 1: Write failing test**

```python
def test_fetch_latest_pinnacle_team_mlb_uses_mlb_table():
    # Patch engine/execute; assert SQL contains odds.mlb_pinnacle_team when league=mlb
    ...
```

Concrete approach matching existing tests in `backend/tests/test_odds_snapshots_pinnacle.py`: capture the SQL string passed to `conn.execute` and assert `"mlb_pinnacle_team" in sql` for league `"mlb"`, and `"wnba_pinnacle_team" in sql` for `"wnba"`.

- [ ] **Step 2: Run — expect FAIL**

Run: `pytest backend/tests/test_odds_snapshots_pinnacle.py -k pinnacle_team -v`

- [ ] **Step 3: Implement league-aware SQL**

```python
_PINNACLE_TEAM_TABLE = {
    "mlb": "mlb_pinnacle_team",
    "wnba": "wnba_pinnacle_team",
    "nba": "wnba_pinnacle_team",
}

def fetch_latest_pinnacle_team(league: str = "wnba") -> list[dict]:
    lg = (league or "wnba").strip().lower()
    table = _PINNACLE_TEAM_TABLE.get(lg, "wnba_pinnacle_team")
    sql = f"""
SELECT away_team, home_team, start_time, market_type, period, is_alternate,
       side, team, points, american_price, matchup_id
FROM odds.{table}
WHERE league = :league
  AND scraped_at = (
    SELECT MAX(scraped_at) FROM odds.{table} WHERE league = :league
  )
  AND period = 0
  AND is_alternate = false
"""
    return _fetch_rows(sql, lg)
```

(Whitelist only — never interpolate untrusted table names.)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/odds_snapshots.py backend/tests/test_odds_snapshots_pinnacle.py
git commit -m "feat: fetch latest Pinnacle team odds from odds.mlb_pinnacle_team"
```

---

### Task 4: MLB team names + Pinnacle-first `mlb_odds`

**Files:**
- Create: `backend/app/services/mlb_team_names.py`
- Modify: `backend/app/services/mlb_odds.py`
- Create/Modify: `backend/tests/test_mlb_odds.py` (extend) and/or `backend/tests/test_mlb_pinnacle_team_odds.py`

**Interfaces:**
- Consumes: `fetch_latest_pinnacle_team("mlb")`, Sharp `run_line,total_runs`, `mlb_team_names.abbrev_from_team_name`
- Produces: `get_today_odds() -> MlbOddsResponse` with `sportsbook` reflecting pinnacle when present; games include Pinnacle-labeled rows

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_mlb_pinnacle_team_odds.py`:

```python
from app.schemas.mlb_odds import MlbOddsGame
from app.services import mlb_odds as svc

def test_normalize_mlb_pinnacle_spread_and_total():
    rows = [
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Los Angeles Dodgers",
            "points": -1.5,
            "american_price": -115,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "home",
            "team": "Chicago Cubs",
            "points": 1.5,
            "american_price": -105,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "over",
            "points": 8.5,
            "american_price": -110,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "under",
            "points": 8.5,
            "american_price": -110,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    g = games[0]
    assert g.away_abbrev == "LAD" and g.home_abbrev == "CHC"
    assert g.spread_team_abbrev == "LAD" and g.spread_line == -1.5
    assert g.total == 8.5
    assert g.sportsbook == "pinnacle"


def test_skips_junk_away_runs_events():
    rows = [
        {
            "away_team": "Away Runs (8 Games)",
            "home_team": "Home Runs (8 Games)",
            "start_time": "2026-08-03T22:39:00Z",
            "market_type": "total",
            "side": "over",
            "points": 7.5,
            "american_price": -110,
        }
    ]
    assert svc.normalize_pinnacle_team_rows(rows) == []


def test_get_today_odds_prefers_pinnacle(monkeypatch):
    # mock fetch_latest_pinnacle_team + sharp fetches; assert sportsbook pinnacle
    ...
```

Also assert existing Sharp-only path still works when Pinnacle returns `[]`.

- [ ] **Step 2: Run — expect FAIL**

Run: `pytest backend/tests/test_mlb_pinnacle_team_odds.py -v`

- [ ] **Step 3: Implement `mlb_team_names.py`**

Copy MLB entries from `sharp_odds._NAME_TO_ABBREV` into `NAME_TO_ABBREV` and implement `abbrev_from_team_name` like WNBA (tricode passthrough + lowercase full-name lookup). Return `None` for unmapped junk names.

- [ ] **Step 4: Implement normalize + merge in `mlb_odds.py`**

Port the normalize / merge helpers from `pinnacle_team_odds.py`, but:
- Use `mlb_team_names.abbrev_from_team_name`
- Emit `MlbOddsGame` (or convert via existing `_to_mlb_games` from `WnbaOddsGame`)
- Do **not** apply WNBA `canonical_abbrev` aliases when merging keys
- `_fetch_sharp_games` keeps `league="mlb"`, `market="run_line,total_runs"`, `wnba_aliases=False`

`get_today_odds` flow:

```python
pin_rows = fetch_latest_pinnacle_team("mlb")
pin_games = normalize_pinnacle_team_rows(pin_rows)  # -> list[MlbOddsGame]
sharp_games = ...  # existing DK/FD gather, as MlbOddsGame list
games = merge_pinnacle_prefer_sharp(pin_games, sharp_games)
```

If Pinnacle fetch/normalize throws, log and fall back to Sharp-only (do not hard-fail the slate).

Clear / bump cache key if needed so old Sharp-only cache does not stick incorrectly during tests (`_cache.clear()` in tests).

- [ ] **Step 5: Run — expect PASS**

Run: `pytest backend/tests/test_mlb_pinnacle_team_odds.py backend/tests/test_mlb_odds.py -v`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/mlb_team_names.py backend/app/services/mlb_odds.py backend/tests/test_mlb_pinnacle_team_odds.py backend/tests/test_mlb_odds.py
git commit -m "feat: serve MLB matchup odds from Pinnacle team snapshots with Sharp fallback"
```

---

### Task 5: Operator upload of existing JSON (smoke)

**Files:**
- Verify only (no new module unless needed): document one-liner in commit message / optional tiny script

**Interfaces:**
- Consumes: `load_pinnacle_team_json_file` from Task 2
- Produces: rows in Supabase after operator runs command

- [ ] **Step 1: Smoke command (requires DB credentials in `.env`)**

```bash
PYTHONPATH=. python3 -c "
from src.odds.load_snapshots import load_pinnacle_team_json_file
n = load_pinnacle_team_json_file('data/props/pinnacle/mlb/pinnacle_mlb_2026-08-03_142157_team.json')
print('upserted', n)
"
```

Expected: prints `upserted <N>` with N > 0 after migration applied.

If migration not yet applied on remote Supabase, apply `026_odds_mlb_pinnacle_team.sql` first.

- [ ] **Step 2: Hit API locally**

With backend running: `curl -s localhost:8000/api/mlb/odds/today | python3 -m json.tool | head`

Expected: some games with `"sportsbook": "pinnacle"` when rows exist and map to teams.

- [ ] **Step 3: Commit only if a small CLI wrapper was added; else skip**

No commit if unchanged.

---

## Spec coverage self-review

| Spec item | Task |
| --- | --- |
| `odds.mlb_pinnacle_team` | Task 1 |
| Scraper upsert + JSON upload helper | Task 2 |
| Fetch latest MLB team snapshot | Task 3 |
| API Pinnacle-first + Sharp fallback | Task 4 |
| Junk event skip | Task 4 |
| Frontend unchanged DTO | Task 4 (preserve shape) |
| Operator load existing file | Task 5 |
| No props / no disk API fallback | Global constraints |

## Placeholder scan

None. Table name, markets, and merge rule are fixed.
