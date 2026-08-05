# MLB ProphetX Supabase Upsert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase tables `odds.mlb_prophetx` and `odds.mlb_prophetx_team`, row mappers + loaders, wire the ProphetX scraper to upsert after JSON write, and support JSON-file backfill.

**Architecture:** Follow Underdog/Pinnacle: SQL migrations → `snapshot_rows.py` mappers → `load_snapshots.py` upsert helpers → replace scraper stub. Full snapshot per `scraped_at`; conflict upsert; `PROPHETX_SKIP_DB=1` skips DB.

**Tech Stack:** PostgreSQL/Supabase, Python, pandas + `upsert_df`, pytest

## Global Constraints

- Tables: exactly `odds.mlb_prophetx` and `odds.mlb_prophetx_team`
- Migrations: `029_odds_mlb_prophetx.sql`, `030_odds_mlb_prophetx_team.sql`
- Store `american_price` + `stake` on both tables
- Competitors: ProphetX `seq` 0 = home, `seq` 1 = away
- Skip DB when `PROPHETX_SKIP_DB` in `{1,true,yes}`
- No API / frontend changes
- Offline unit tests only (no live Supabase in CI)
- Spec: `docs/superpowers/specs/2026-08-05-mlb-prophetx-supabase-upsert-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `db/migrations/029_odds_mlb_prophetx.sql` | Props table + indexes |
| `db/migrations/030_odds_mlb_prophetx_team.sql` | Team table + indexes |
| `src/odds/snapshot_rows.py` | `prophetx_props_to_rows`, `prophetx_team_to_rows` |
| `src/odds/load_snapshots.py` | Loaders + JSON file helpers |
| `src/scrapers/mlb_prophetx.py` | Replace stub with real upsert + path logging |
| `src/scrapers/tests/odds/test_snapshot_rows.py` | Mapper unit tests |
| `src/scrapers/tests/odds/test_load_snapshots.py` | Skip-DB / loader unit tests (extend existing) |

---

### Task 1: Migrations

**Files:**
- Create: `db/migrations/029_odds_mlb_prophetx.sql`
- Create: `db/migrations/030_odds_mlb_prophetx_team.sql`

**Interfaces:**
- Consumes: nothing
- Produces: SQL tables matching the design spec columns and unique indexes

- [ ] **Step 1: Write `029_odds_mlb_prophetx.sql`**

```sql
-- 029_odds_mlb_prophetx.sql
-- MLB ProphetX player prop snapshots (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_prophetx (
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
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (league, event_id, player_name, stat_name, side, line_score, scraped_at)
);

CREATE INDEX IF NOT EXISTS odds_mlb_prophetx_league_scraped_at_idx
    ON odds.mlb_prophetx (league, scraped_at DESC);
```

Note: if Postgres rejects NULL `event_id` in a PRIMARY KEY, use a UNIQUE INDEX with `NULLS NOT DISTINCT` instead of PRIMARY KEY (same pattern as team table). Prefer:

```sql
-- If PRIMARY KEY is awkward with nullable event_id, use:
CREATE UNIQUE INDEX IF NOT EXISTS odds_mlb_prophetx_snapshot_uidx
    ON odds.mlb_prophetx (
        league, event_id, player_name, stat_name, side, line_score, scraped_at
    )
    NULLS NOT DISTINCT;
```

and omit the table-level PRIMARY KEY. Spec unique columns must match loader conflict cols.

- [ ] **Step 2: Write `030_odds_mlb_prophetx_team.sql`**

```sql
-- 030_odds_mlb_prophetx_team.sql
-- MLB ProphetX team / game markets (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_prophetx_team (
    league           TEXT        NOT NULL,
    event_id         BIGINT,
    away_team        TEXT        NOT NULL,
    home_team        TEXT        NOT NULL,
    start_time       TIMESTAMPTZ,
    market_type      TEXT        NOT NULL,
    side             TEXT        NOT NULL,
    team             TEXT,
    points           NUMERIC,
    american_price   INTEGER     NOT NULL,
    stake            NUMERIC,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_mlb_prophetx_team_snapshot_uidx
    ON odds.mlb_prophetx_team (
        league, event_id, market_type, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_mlb_prophetx_team_league_scraped_at_idx
    ON odds.mlb_prophetx_team (league, scraped_at DESC);
```

- [ ] **Step 3: Commit**

```bash
git add db/migrations/029_odds_mlb_prophetx.sql db/migrations/030_odds_mlb_prophetx_team.sql
git commit -m "db: add odds.mlb_prophetx and mlb_prophetx_team tables"
```

---

### Task 2: Props + team row mappers (TDD)

**Files:**
- Modify: `src/odds/snapshot_rows.py`
- Modify: `src/scrapers/tests/odds/test_snapshot_rows.py`

**Interfaces:**
- Consumes: existing `parse_american_price` / helpers in `snapshot_rows.py`
- Produces:
  - `prophetx_home_away(competitors: list[dict]) -> tuple[str | None, str | None]`  # (away, home)
  - `prophetx_props_to_rows(games, *, league, scraped_at) -> list[dict]`
  - `prophetx_team_to_rows(games, *, league, scraped_at) -> list[dict]`

- [ ] **Step 1: Write failing tests** in `test_snapshot_rows.py`

```python
from src.odds.snapshot_rows import (
    prophetx_props_to_rows,
    prophetx_team_to_rows,
)

def test_prophetx_props_to_rows_emits_over_under_with_stake():
    scraped = datetime(2026, 8, 5, tzinfo=timezone.utc)
    games = [
        {
            "event_id": 10079004,
            "scheduled": "2026-08-05T22:35:00Z",
            "competitors": [
                {"name": "Baltimore Orioles", "seq": 0},
                {"name": "Los Angeles Angels", "seq": 1},
            ],
            "props": [
                {
                    "player": "Mike Trout",
                    "stat": "hits",
                    "line": 0.5,
                    "over": {"american": -200, "stake": 134.33},
                    "under": {"american": 172, "stake": 400.37},
                    "market_id": 460000600,
                    "sub_type": "player_total_hits",
                },
                {
                    "player": "Skip Me",
                    "stat": "hits",
                    "line": 0.5,
                    "over": {"american": None, "stake": 1},
                    "under": None,
                    "market_id": 1,
                    "sub_type": "player_total_hits",
                },
            ],
        }
    ]
    rows = prophetx_props_to_rows(games, league="mlb", scraped_at=scraped)
    assert len(rows) == 2
    over = next(r for r in rows if r["side"] == "over")
    assert over["player_name"] == "Mike Trout"
    assert over["stat_name"] == "hits"
    assert float(over["line_score"]) == 0.5
    assert over["american_price"] == -200
    assert float(over["stake"]) == 134.33
    assert over["away_team"] == "Los Angeles Angels"
    assert over["home_team"] == "Baltimore Orioles"
    assert over["event_id"] == 10079004
    assert over["scraped_at"] == scraped


def test_prophetx_team_to_rows_moneyline_and_run_line():
    scraped = datetime(2026, 8, 5, tzinfo=timezone.utc)
    games = [
        {
            "event_id": 10079004,
            "scheduled": "2026-08-05T22:35:00Z",
            "competitors": [
                {"name": "Baltimore Orioles", "seq": 0},
                {"name": "Los Angeles Angels", "seq": 1},
            ],
            "team_markets": {
                "moneyline": [
                    {"name": "Baltimore Orioles", "american": -134, "line": None, "stake": 100.0},
                    {"name": "Los Angeles Angels", "american": 129, "line": None, "stake": 50.0},
                ],
                "run_line": [
                    {"name": "Baltimore Orioles -1", "american": 110, "line": -1, "stake": 2.2},
                ],
                "1st_inning_moneyline": [
                    {"name": "Baltimore Orioles", "american": -105, "line": None, "stake": 10.0},
                ],
            },
        }
    ]
    rows = prophetx_team_to_rows(games, league="mlb", scraped_at=scraped)
    types = {r["market_type"] for r in rows}
    assert types == {"moneyline", "run_line", "1st_inning_moneyline"}
    ml = [r for r in rows if r["market_type"] == "moneyline"]
    assert len(ml) == 2
    assert ml[0]["american_price"] == -134
    assert float(ml[0]["stake"]) == 100.0
    rl = next(r for r in rows if r["market_type"] == "run_line")
    assert float(rl["points"]) == -1.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/odds/test_snapshot_rows.py::test_prophetx_props_to_rows_emits_over_under_with_stake src/scrapers/tests/odds/test_snapshot_rows.py::test_prophetx_team_to_rows_moneyline_and_run_line -v`

Expected: FAIL (import / missing functions)

- [ ] **Step 3: Implement mappers in `snapshot_rows.py`**

```python
def prophetx_home_away(competitors: list[dict]) -> tuple[str | None, str | None]:
    """Return (away_team, home_team). ProphetX seq 0 = home, seq 1 = away."""
    home = away = None
    for c in competitors or []:
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or c.get("displayName") or "").strip() or None
        seq = c.get("seq")
        if seq == 0:
            home = name
        elif seq == 1:
            away = name
    return away, home


def prophetx_props_to_rows(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime,
) -> list[dict]:
    rows: list[dict] = []
    league_key = league.lower()
    for game in games:
        if not isinstance(game, dict):
            continue
        away, home = prophetx_home_away(game.get("competitors") or [])
        start_time = _parse_line_updated_at(game.get("scheduled"))
        event_id = game.get("event_id")
        for prop in game.get("props") or []:
            if not isinstance(prop, dict):
                continue
            player = prop.get("player")
            stat = prop.get("stat")
            line = prop.get("line")
            if not player or not stat or line is None:
                continue
            for side in ("over", "under"):
                payload = prop.get(side)
                if not isinstance(payload, dict):
                    continue
                american = parse_american_price(payload.get("american"))
                if american is None:
                    continue
                stake = payload.get("stake")
                rows.append(
                    {
                        "league": league_key,
                        "event_id": event_id,
                        "away_team": away,
                        "home_team": home,
                        "start_time": start_time,
                        "player_name": player,
                        "stat_name": stat,
                        "line_score": line,
                        "side": side,
                        "american_price": american,
                        "stake": stake,
                        "market_id": prop.get("market_id"),
                        "sub_type": prop.get("sub_type"),
                        "scraped_at": scraped_at,
                    }
                )
    return rows


def prophetx_team_to_rows(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime,
) -> list[dict]:
    rows: list[dict] = []
    league_key = league.lower()
    for game in games:
        if not isinstance(game, dict):
            continue
        away, home = prophetx_home_away(game.get("competitors") or [])
        if not away or not home:
            continue
        start_time = _parse_line_updated_at(game.get("scheduled"))
        event_id = game.get("event_id")
        for market_type, sides in (game.get("team_markets") or {}).items():
            if not isinstance(sides, list):
                continue
            for side_row in sides:
                if not isinstance(side_row, dict):
                    continue
                american = parse_american_price(side_row.get("american"))
                if american is None:
                    continue
                name = side_row.get("name")
                rows.append(
                    {
                        "league": league_key,
                        "event_id": event_id,
                        "away_team": away,
                        "home_team": home,
                        "start_time": start_time,
                        "market_type": str(market_type),
                        "side": str(name or ""),
                        "team": name,
                        "points": side_row.get("line"),
                        "american_price": american,
                        "stake": side_row.get("stake"),
                        "scraped_at": scraped_at,
                    }
                )
    return rows
```

Reuse existing `_parse_line_updated_at` / `parse_american_price` already in the module.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/odds/test_snapshot_rows.py::test_prophetx_props_to_rows_emits_over_under_with_stake src/scrapers/tests/odds/test_snapshot_rows.py::test_prophetx_team_to_rows_moneyline_and_run_line -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/odds/snapshot_rows.py src/scrapers/tests/odds/test_snapshot_rows.py
git commit -m "feat(odds): map ProphetX MLB props and team snapshots to rows"
```

---

### Task 3: Loaders + JSON file helpers (TDD)

**Files:**
- Modify: `src/odds/load_snapshots.py`
- Modify: `src/scrapers/tests/odds/test_load_snapshots.py` (create if missing patterns; extend existing)

**Interfaces:**
- Consumes: `prophetx_props_to_rows`, `prophetx_team_to_rows`, `upsert_df`
- Produces:
  - `_PROPHETX_PROPS_CONFLICT_COLS`
  - `_PROPHETX_TEAM_CONFLICT_COLS`
  - `load_prophetx_props_snapshot(...) -> int`
  - `load_prophetx_team_snapshot(...) -> int`
  - `load_prophetx_props_json_file(path, ...) -> int`
  - `load_prophetx_team_json_file(path, ...) -> int`

- [ ] **Step 1: Write failing skip-DB tests**

```python
def test_load_prophetx_props_skip_db(monkeypatch):
    monkeypatch.setenv("PROPHETX_SKIP_DB", "1")
    from src.odds import load_snapshots as ls
    n = ls.load_prophetx_props_snapshot(
        [{"event_id": 1, "competitors": [], "props": []}],
        league="mlb",
    )
    assert n == 0


def test_load_prophetx_team_skip_db(monkeypatch):
    monkeypatch.setenv("PROPHETX_SKIP_DB", "1")
    from src.odds import load_snapshots as ls
    n = ls.load_prophetx_team_snapshot(
        [{"event_id": 1, "competitors": [], "team_markets": {}}],
        league="mlb",
    )
    assert n == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py -k prophetx -v`

Expected: FAIL (missing functions)

- [ ] **Step 3: Implement loaders** (mirror `load_underdog_snapshot` / `load_pinnacle_team_snapshot`)

```python
from src.odds.snapshot_rows import (
    # ...existing imports...
    prophetx_props_to_rows,
    prophetx_team_to_rows,
)

_PROPHETX_PROPS_CONFLICT_COLS = [
    "league",
    "event_id",
    "player_name",
    "stat_name",
    "side",
    "line_score",
    "scraped_at",
]

_PROPHETX_TEAM_CONFLICT_COLS = [
    "league",
    "event_id",
    "market_type",
    "side",
    "points",
    "scraped_at",
]


def load_prophetx_props_snapshot(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PROPHETX_SKIP_DB"):
        return 0
    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = prophetx_props_to_rows(games, league=league, scraped_at=scraped_at)
    if not rows:
        return 0
    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score", "stake"])
    df = _dedupe_conflict_rows(df, _PROPHETX_PROPS_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        "mlb_prophetx",
        df,
        schema="odds",
        conflict_cols=_PROPHETX_PROPS_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def load_prophetx_team_snapshot(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PROPHETX_SKIP_DB"):
        return 0
    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = prophetx_team_to_rows(games, league=league, scraped_at=scraped_at)
    if not rows:
        return 0
    df = _coerce_float_columns(pd.DataFrame(rows), ["points", "stake"])
    df = _dedupe_conflict_rows(df, _PROPHETX_TEAM_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        "mlb_prophetx_team",
        df,
        schema="odds",
        conflict_cols=_PROPHETX_TEAM_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def load_prophetx_props_json_file(path: str, *, scraped_at: datetime | None = None) -> int:
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    league = str(payload.get("league") or "mlb").strip().lower()
    games = payload.get("games") or []
    if not isinstance(games, list):
        raise ValueError(f"invalid props snapshot games in {path}")
    return load_prophetx_props_snapshot(games, league=league, scraped_at=scraped_at)


def load_prophetx_team_json_file(path: str, *, scraped_at: datetime | None = None) -> int:
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    league = str(payload.get("league") or "mlb").strip().lower()
    games = payload.get("games") or []
    if not isinstance(games, list):
        raise ValueError(f"invalid team snapshot games in {path}")
    return load_prophetx_team_snapshot(games, league=league, scraped_at=scraped_at)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py -k prophetx -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/odds/load_snapshots.py src/scrapers/tests/odds/test_load_snapshots.py
git commit -m "feat(odds): upsert ProphetX MLB props and team snapshots"
```

---

### Task 4: Wire scraper + success logging

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py` (optional: assert stub removed / loader called via monkeypatch)

**Interfaces:**
- Consumes: `load_prophetx_props_snapshot`, `load_prophetx_team_snapshot`
- Produces: `load_supabase_snapshots(props_games, team_games, *, scraped_at=None) -> None` replacing stub

- [ ] **Step 1: Replace stub**

```python
def load_supabase_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    scraped_at: datetime | None = None,
    props_path: str | None = None,
    team_path: str | None = None,
) -> None:
    """Upsert snapshot games to odds.mlb_prophetx / odds.mlb_prophetx_team."""
    try:
        from src.odds.load_snapshots import (
            load_prophetx_props_snapshot,
            load_prophetx_team_snapshot,
        )

        when = scraped_at or datetime.now(timezone.utc)
        n_props = load_prophetx_props_snapshot(
            props_games, league="mlb", scraped_at=when
        )
        n_team = load_prophetx_team_snapshot(
            team_games, league="mlb", scraped_at=when
        )
        logger.info(
            "Supabase ProphetX upserted props=%s team=%s%s%s",
            n_props,
            n_team,
            f" props_path={props_path}" if props_path else "",
            f" team_path={team_path}" if team_path else "",
        )
    except Exception as exc:
        logger.error("Supabase ProphetX load failed (JSON kept): %s", exc)


def run() -> None:
    # ... existing fetch/build ...
    props_path = resolve_props_output_path()
    props_path, team_path = write_snapshots(
        props_games, team_games, props_path=props_path
    )
    logger.info(
        "Wrote ProphetX snapshots: props_games=%s team_games=%s props=%s team=%s",
        len(props_games),
        len(team_games),
        props_path,
        team_path,
    )
    load_supabase_snapshots(
        props_games,
        team_games,
        props_path=props_path,
        team_path=team_path,
    )
```

Remove `maybe_load_supabase_stub`.

- [ ] **Step 2: Update any test that referenced the stub name** (grep `maybe_load_supabase_stub`; fix imports/calls).

- [ ] **Step 3: Run focused suites**

```bash
pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py src/scrapers/tests/odds/test_snapshot_rows.py -k prophetx src/scrapers/tests/odds/test_load_snapshots.py -k prophetx -v
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): upsert ProphetX MLB snapshots to Supabase"
```

- [ ] **Step 5: Manual backfill note (operator, not CI)**

After applying migrations on Supabase:

```bash
# from repo root, with DB env configured
python -c "
from src.odds.load_snapshots import load_prophetx_props_json_file, load_prophetx_team_json_file
print(load_prophetx_props_json_file('data/props/prophetx/mlb/prophetx_mlb_2026-08-05_150945_props.json'))
print(load_prophetx_team_json_file('data/props/prophetx/mlb/prophetx_mlb_2026-08-05_150945_team.json'))
"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `029` / `030` migrations | 1 |
| Props + team columns including stake | 1, 2 |
| Row mappers with seq 0=home / 1=away | 2 |
| Loaders + `PROPHETX_SKIP_DB` | 3 |
| JSON file backfill helpers | 3 |
| Scraper upsert after JSON; keep JSON on DB error | 4 |
| Path + count logging | 4 |
| Offline unit tests | 2, 3, 4 |
| No API/frontend | all |

## Consistency notes

- Conflict cols must match migration unique indexes exactly.
- `american_price` NOT NULL on team table → mapper skips sides without american.
- Props `american_price` nullable in SQL but mapper still skips missing american (cleaner snapshots).
