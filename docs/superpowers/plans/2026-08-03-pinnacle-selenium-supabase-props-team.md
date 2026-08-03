# Selenium Pinnacle Supabase Props + Team Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Own Pinnacle via Selenium: upsert props into `odds.wnba_pinnacle` and team lines into `odds.wnba_pinnacle_team`, split JSON outputs, fill Prop Picks’ Pinnacle column from Supabase (not Parlay), and power WNBA matchup cards with Pinnacle mains falling back to Sharp per game.

**Architecture:** Scraper writes `*_props.json` + `*_team.json` then upserts. Parlay fetch/persist drop `pinnacle`. `parlay_props` attaches latest Supabase Pinnacle onto DFS rows. `GET /api/wnba/odds/today` prefers latest team snapshot mains, Sharp only when Pinnacle has no spread and no total for that game.

**Tech Stack:** Selenium scraper, SQLAlchemy upserts, FastAPI, Pydantic, pytest, React/Vitest, Supabase Postgres

**Spec:** `docs/superpowers/specs/2026-08-03-pinnacle-selenium-supabase-props-team-design.md`

## Global Constraints

- Reuse `odds.wnba_pinnacle`; never let Parlay write it again
- New table `odds.wnba_pinnacle_team` with `UNIQUE … NULLS NOT DISTINCT` (moneyline `points` null)
- Split disk output: `pinnacle_{league}_{ts}_props.json` and `…_team.json`
- Prop Picks UI/schema unchanged; only Pinnacle source changes
- Missing Selenium props → `pinnacle: null` (no Parlay fill)
- Matchups: Supabase team → Sharp per game; no disk fallback
- Matchup cards: spread + total only; `sportsbook="pinnacle"` when used
- WNBA UI paths only in v1 (`league` column still supports nba in tables)
- `PINNACLE_SKIP_DB=1` skips upserts; files still written
- Never invent odds; fixtures only in CI

## File structure

| File | Responsibility |
| --- | --- |
| `db/migrations/024_odds_wnba_pinnacle_team.sql` | Create `odds.wnba_pinnacle_team` |
| `src/odds/snapshot_rows.py` | Map Selenium props/team JSON → row dicts |
| `src/odds/load_snapshots.py` | Upsert loaders; remove pinnacle from Parlay persist tables |
| `src/scrapers/pinnacle.py` | Split JSON writers + call loaders |
| `src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py` | Mapper unit tests |
| `backend/app/services/odds_snapshots.py` | `fetch_latest_pinnacle` + `fetch_latest_pinnacle_team` |
| `backend/app/services/dfs_attach.py` | `attach_pinnacle_snapshot` overlay |
| `backend/app/services/parlay_props.py` | Exclude pinnacle from Parlay allowlist; attach snapshot |
| `backend/app/services/pinnacle_team_odds.py` | Normalize team snapshot → `WnbaOddsGame` |
| `backend/app/api/routes/wnba_odds.py` | Wire Supabase+Sharp merge service |
| `backend/tests/test_pinnacle_snapshot_attach.py` | Props attach + Parlay exclusion |
| `backend/tests/test_pinnacle_team_odds.py` | Team normalize + Sharp fallback merge |
| `frontend/src/components/league/MatchupGameCard.tsx` | Pinnacle sportsbook caption |
| `docs/superpowers/specs/2026-08-02-website-api-system-design.md` | Note Pinnacle ownership |

---

### Task 1: Migration `odds.wnba_pinnacle_team`

**Files:**
- Create: `db/migrations/024_odds_wnba_pinnacle_team.sql`

**Interfaces:**
- Produces: table `odds.wnba_pinnacle_team` as specified in the design doc

- [ ] **Step 1: Add migration SQL**

```sql
-- 024_odds_wnba_pinnacle_team.sql
-- Selenium Pinnacle team / game markets (schema odds).

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_pinnacle_team (
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

CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_pinnacle_team_snapshot_uidx
    ON odds.wnba_pinnacle_team (
        league, away_team, home_team, market_type, period,
        is_alternate, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_pinnacle_team_league_scraped_at_idx
    ON odds.wnba_pinnacle_team (league, scraped_at DESC);
```

- [ ] **Step 2: Commit**

```bash
git add db/migrations/024_odds_wnba_pinnacle_team.sql
git commit -m "$(cat <<'EOF'
Add odds.wnba_pinnacle_team for Selenium Pinnacle game lines.

EOF
)"
```

---

### Task 2: Selenium → snapshot row mappers

**Files:**
- Modify: `src/odds/snapshot_rows.py`
- Create: `src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py`
- Fixture (optional copy): `src/scrapers/tests/fixtures/pinnacle_wnba_combined_sample.json` — slim 1-game slice from `data/props/pinnacle/wnba/pinnacle_wnba_2026-08-03_033239.json`

**Interfaces:**
- Produces: `selenium_pinnacle_props_to_rows(games: list[dict], *, league: str, scraped_at: datetime) -> list[dict]`
- Produces: `selenium_pinnacle_team_to_rows(games: list[dict], *, league: str, scraped_at: datetime) -> list[dict]`
- Prop rows use Parlay-shaped `market_type` (`player_points`, `player_assists`, `player_rebounds`, `player_pts_rebs_asts`)
- Team rows: one DB row per price line; `is_alternate` from block; moneyline `points=None`

- [ ] **Step 1: Write failing tests**

```python
# src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py
from datetime import datetime, timezone
from src.odds.snapshot_rows import (
    selenium_pinnacle_props_to_rows,
    selenium_pinnacle_team_to_rows,
)

SCRAPED = datetime(2026, 8, 3, 10, 0, tzinfo=timezone.utc)

def test_props_emit_over_under_player_points():
    games = [{
        "participants": ["Las Vegas Aces", "Atlanta Dream"],
        "props": [{
            "stat": "points",
            "player": "A'ja Wilson",
            "line": 26.5,
            "american_over": -102,
            "american_under": -130,
        }],
    }]
    rows = selenium_pinnacle_props_to_rows(games, league="wnba", scraped_at=SCRAPED)
    assert len(rows) == 2
    by_side = {r["side"]: r for r in rows}
    assert by_side["over"]["market_type"] == "player_points"
    assert by_side["over"]["line_score"] == 26.5
    assert by_side["over"]["american_price"] == -102
    assert by_side["under"]["american_price"] == -130

def test_team_mains_and_alts():
    games = [{
        "matchup_id": 1,
        "participants": ["Las Vegas Aces", "Atlanta Dream"],
        "start_time": "2026-08-03T23:00:00Z",
        "team_markets": {
            "moneyline": [{
                "period": 0,
                "lines": [
                    {"side": "home", "team": "Atlanta Dream", "american": -134, "decimal": 1.746},
                    {"side": "away", "team": "Las Vegas Aces", "american": 111, "decimal": 2.11},
                ],
            }],
            "spread": [{
                "period": 0,
                "is_alternate": True,
                "lines": [
                    {"side": "home", "team": "Atlanta Dream", "points": 1.5, "american": -151, "decimal": 1.662},
                    {"side": "away", "team": "Las Vegas Aces", "points": -1.5, "american": 119, "decimal": 2.19},
                ],
            }],
            "total": [],
        },
    }]
    rows = selenium_pinnacle_team_to_rows(games, league="wnba", scraped_at=SCRAPED)
    assert any(r["market_type"] == "moneyline" and r["points"] is None for r in rows)
    assert any(r["market_type"] == "spread" and r["is_alternate"] is True for r in rows)
    assert all(r["away_team"] == "Las Vegas Aces" and r["home_team"] == "Atlanta Dream" for r in rows)
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
./nba_model/bin/python -m pytest src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py -q
```

Expected: `AttributeError` / import failure for missing functions.

- [ ] **Step 3: Implement mappers in `snapshot_rows.py`**

```python
_SELENIUM_STAT_TO_MARKET = {
    "points": "player_points",
    "assists": "player_assists",
    "rebounds": "player_rebounds",
    "points_rebounds_assists": "player_pts_rebs_asts",
}

def selenium_pinnacle_props_to_rows(games, *, league, scraped_at):
    # For each prop with american_over/under, append two rows.
    # Skip missing player/stat/line/price.
    ...

def selenium_pinnacle_team_to_rows(games, *, league, scraped_at):
    # participants[0]=away, participants[1]=home (scraper convention).
    # For each market_type block in team_markets, each lines[] entry → one row.
    ...
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
./nba_model/bin/python -m pytest src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py -q
```

- [ ] **Step 5: Commit**

```bash
git add src/odds/snapshot_rows.py src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py
git commit -m "$(cat <<'EOF'
Map Selenium Pinnacle JSON into odds snapshot row shapes.

EOF
)"
```

---

### Task 3: Loaders + stop Parlay persisting Pinnacle

**Files:**
- Modify: `src/odds/load_snapshots.py`
- Modify: `src/scrapers/tests/odds/test_load_snapshots.py` (extend) or create focused tests there

**Interfaces:**
- Produces: `load_pinnacle_props_snapshot(games, *, league, scraped_at=None) -> int`
- Produces: `load_pinnacle_team_snapshot(games, *, league, scraped_at=None) -> int`
- Change: remove `"pinnacle": "wnba_pinnacle"` from `_PARLAY_BOOK_TABLES` so `PARLAY_PROP_SPORTSBOOKS` / `maybe_persist_parlay_props` never touch that table
- Conflict cols for props: reuse `_PARLAY_BOOK_CONFLICT_COLS`
- Team upsert: conflict columns matching unique index (including nullable `points`)

- [ ] **Step 1: Write failing test that Parlay persist list excludes pinnacle**

```python
from src.odds.load_snapshots import PARLAY_PROP_SPORTSBOOKS, _PARLAY_BOOK_TABLES

def test_parlay_persist_tables_exclude_pinnacle():
    assert "pinnacle" not in _PARLAY_BOOK_TABLES
    assert "pinnacle" not in PARLAY_PROP_SPORTSBOOKS
```

- [ ] **Step 2: Run — expect FAIL** (pinnacle still present)

- [ ] **Step 3: Remove pinnacle from `_PARLAY_BOOK_TABLES`; add loaders**

Pattern (mirror `load_prizepicks_snapshot`):

```python
def load_pinnacle_props_snapshot(games, *, league, scraped_at=None) -> int:
    if _skip_db("PINNACLE_SKIP_DB"):
        return 0
    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = selenium_pinnacle_props_to_rows(games, league=league, scraped_at=scraped_at)
    # DataFrame → upsert_df schema odds table wnba_pinnacle
    ...

def load_pinnacle_team_snapshot(games, *, league, scraped_at=None) -> int:
    if _skip_db("PINNACLE_SKIP_DB"):
        return 0
    ...
    # upsert odds.wnba_pinnacle_team
```

- [ ] **Step 4: Run tests PASS** (update any tests that assumed Parlay persists pinnacle)

- [ ] **Step 5: Commit**

```bash
git add src/odds/load_snapshots.py src/scrapers/tests/odds/
git commit -m "$(cat <<'EOF'
Load Selenium Pinnacle snapshots; stop Parlay writing wnba_pinnacle.

EOF
)"
```

---

### Task 4: Split `pinnacle.py` outputs + upsert after scrape

**Files:**
- Modify: `src/scrapers/pinnacle.py` (`run`, filename helpers, payload builders)
- Modify: `src/scrapers/tests/scrapers/test_pinnacle_discover.py` only if filename helpers are covered; else add small tests for `_pinnacle_output_filename` variants

**Interfaces:**
- Change: `_pinnacle_output_filename(league, now=None, *, kind: str = "props"|"team")` → `pinnacle_{league}_{ts}_{kind}.json`
- `run()` writes both files from the same `games_out`; props payload omits bulky alts if desired but may keep full `props`; team payload keeps `team_markets`
- After both writes, call `load_pinnacle_props_snapshot` + `load_pinnacle_team_snapshot` with shared `scraped_at`
- On DB error: log warning, set exit code non-zero if desired (mirror PrizePicks logging)

- [ ] **Step 1: Write failing test for filename kind**

```python
from pinnacle import _pinnacle_output_filename
from datetime import datetime
from zoneinfo import ZoneInfo

def test_props_and_team_filenames():
    now = datetime(2026, 8, 3, 12, 0, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert _pinnacle_output_filename("wnba", now, kind="props").endswith("_props.json")
    assert _pinnacle_output_filename("wnba", now, kind="team").endswith("_team.json")
```

- [ ] **Step 2: Implement split write + upsert in `run()`**

```python
# After games_out ready:
props_path = ... kind="props"
team_path = ... kind="team"
# write two payloads
# scraped_at = datetime.now(timezone.utc)
# load_pinnacle_props_snapshot(games_out, league=self.league, scraped_at=scraped_at)
# load_pinnacle_team_snapshot(games_out, league=self.league, scraped_at=scraped_at)
```

Keep `self.output_path` pointing at the props path for log messages (or print both).

- [ ] **Step 3: Run unit tests PASS**

```bash
./nba_model/bin/python -m pytest src/scrapers/tests/scrapers/test_pinnacle_discover.py src/scrapers/tests/scrapers/test_pinnacle_snapshot_rows.py -q
```

- [ ] **Step 4: Commit**

```bash
git add src/scrapers/pinnacle.py src/scrapers/tests/
git commit -m "$(cat <<'EOF'
Split Pinnacle scrape into props/team JSON and upsert to Supabase.

EOF
)"
```

---

### Task 5: Fetch latest Pinnacle snapshots (backend)

**Files:**
- Modify: `backend/app/services/odds_snapshots.py`
- Create: `backend/tests/test_odds_snapshots_pinnacle.py` (mock engine or skip if no DB — prefer testing SQL string constants + a thin wrapper mock)

**Interfaces:**
- Produces: `fetch_latest_pinnacle(league: str = "wnba") -> list[dict]`
- Produces: `fetch_latest_pinnacle_team(league: str = "wnba") -> list[dict]`
- SQL pattern identical to PrizePicks (`scraped_at = MAX(...)`)

```sql
SELECT player_name, market_type, side, line_score, american_price
FROM odds.wnba_pinnacle
WHERE league = :league AND scraped_at = (
  SELECT MAX(scraped_at) FROM odds.wnba_pinnacle WHERE league = :league
)

SELECT away_team, home_team, start_time, market_type, period, is_alternate,
       side, team, points, american_price, matchup_id
FROM odds.wnba_pinnacle_team
WHERE league = :league
  AND scraped_at = (SELECT MAX(scraped_at) FROM odds.wnba_pinnacle_team WHERE league = :league)
  AND period = 0
  AND is_alternate = false
```

- [ ] **Step 1: Add functions + a unit test that SQL includes `wnba_pinnacle` / excludes alternates for team query** (assert on module-level SQL constants)

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/odds_snapshots.py backend/tests/test_odds_snapshots_pinnacle.py
git commit -m "$(cat <<'EOF'
Add Supabase readers for latest Selenium Pinnacle snapshots.

EOF
)"
```

---

### Task 6: Prop Picks — exclude Parlay Pinnacle; attach Supabase

**Files:**
- Modify: `backend/app/services/parlay_props.py`
- Modify: `backend/app/services/dfs_attach.py`
- Modify: `backend/tests/test_parlay_props.py` and/or `backend/tests/test_dfs_attach.py`
- Create: `backend/tests/test_pinnacle_snapshot_attach.py`

**Interfaces:**
- Produces: `attach_pinnacle_snapshot(props: list[WnbaPropLine], pin_rows: list[dict]) -> list[WnbaPropLine]`
- Change: `fetch_parlay_prop_rows` allowlist = `frozenset(PROP_SPORTSBOOKS) - {"pinnacle"}`
- Change: `get_today_props` after `attach_dfs_snapshots(...)`, call `attach_pinnacle_snapshot(props, fetch_latest_pinnacle("wnba"))`
- Matching: `canonical_stat_key_from_parlay_market(market_type)` + `norm_player_name` + side; `pick_closest_quote` vs DFS `slot_line` when present, else exact line on the row’s DFS book

- [ ] **Step 1: Failing tests**

```python
# backend/tests/test_pinnacle_snapshot_attach.py
from app.schemas.wnba_props import WnbaPropLine, WnbaPropBookQuote
from app.services.dfs_attach import attach_pinnacle_snapshot

def test_attach_overwrites_null_pinnacle():
    props = [WnbaPropLine(
        player_name="A'ja Wilson",
        market_type="player_points",
        stat_key="points",
        display_stat="Points",
        side="over",
        slot_line=26.5,
        prizepicks=WnbaPropBookQuote(line=26.5, odds_american=100),
        pinnacle=None,
    )]
    pin_rows = [{
        "player_name": "A'ja Wilson",
        "market_type": "player_points",
        "side": "over",
        "line_score": 26.5,
        "american_price": -102,
    }]
    out = attach_pinnacle_snapshot(props, pin_rows)
    assert out[0].pinnacle is not None
    assert out[0].pinnacle.odds_american == -102

def test_fetch_allowlist_excludes_pinnacle():
    # Import the frozenset used inside fetch_parlay_prop_rows, or test via
    # monkeypatch that a row with bookmaker=pinnacle is dropped.
    ...
```

- [ ] **Step 2: Implement `attach_pinnacle_snapshot` + wire `parlay_props`**

```python
# dfs_attach.py
def attach_pinnacle_snapshot(props, pin_rows):
    # Build index (norm_player, stat_key, side) -> list[WnbaPropBookQuote]
    # For each prop, set pinnacle = pick_closest_quote(..., [prop.slot_line or dfs line])
    ...

# parlay_props.fetch_parlay_prop_rows
allowed_books = frozenset(b for b in PROP_SPORTSBOOKS if b != "pinnacle")

# get_today_props
props = attach_dfs_snapshots(...)
props = attach_pinnacle_snapshot(props, fetch_latest_pinnacle("wnba"))
```

- [ ] **Step 3: Run**

```bash
./nba_model/bin/python -m pytest backend/tests/test_pinnacle_snapshot_attach.py backend/tests/test_dfs_attach.py backend/tests/test_parlay_props.py -q
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/dfs_attach.py backend/app/services/parlay_props.py backend/tests/
git commit -m "$(cat <<'EOF'
Serve Prop Picks Pinnacle from Selenium snapshots, not Parlay.

EOF
)"
```

---

### Task 7: Matchup odds — Pinnacle team + Sharp fallback

**Files:**
- Create: `backend/app/services/pinnacle_team_odds.py`
- Create: `backend/tests/test_pinnacle_team_odds.py`
- Modify: `backend/app/api/routes/wnba_odds.py`
- Optionally modify: `backend/app/services/sharp_odds.py` to export `merge` helper reuse (already has `merge_odds_prefer_primary` — extend or add `merge_pinnacle_then_sharp`)

**Interfaces:**
- Produces: `normalize_pinnacle_team_rows(rows: list[dict]) -> list[WnbaOddsGame]`
  - Use `abbrev_from_team_name` for away/home
  - Main spread: prefer `side` matching the favorite (negative points) for `spread_team_abbrev` / `spread_line` (mirror Sharp/Parlay convention: show the team laying points)
  - Total: use `points` from over or under (same number)
  - `sportsbook="pinnacle"`
  - `game_date` from `start_time` date UTC or America/Los_Angeles — match Sharp’s `game_date` format (inspect `normalize_sharp_odds`)
- Produces: `merge_pinnacle_prefer_sharp(pinnacle: list[WnbaOddsGame], sharp: list[WnbaOddsGame]) -> list[WnbaOddsGame]`
  - Key by `(away_abbrev, home_abbrev, game_date or "")` using same abbrev canonicalization as frontend
  - Prefer Pinnacle when `spread_line is not None or total is not None`; else Sharp
- Produces: `async def get_today_odds() -> WnbaOddsResponse` in `pinnacle_team_odds.py` (or thin wrapper) that loads snapshot, normalizes, fetches Sharp via existing `sharp_odds.get_today_odds` / internals, merges
- Route: `from app.services.pinnacle_team_odds import get_today_odds`

- [ ] **Step 1: Failing tests**

```python
def test_normalize_spread_and_total():
    rows = [
        {"away_team": "Las Vegas Aces", "home_team": "Atlanta Dream",
         "start_time": "2026-08-03T23:00:00Z", "market_type": "spread",
         "side": "home", "team": "Atlanta Dream", "points": -1.5, "american_price": -117},
        {"away_team": "Las Vegas Aces", "home_team": "Atlanta Dream",
         "start_time": "2026-08-03T23:00:00Z", "market_type": "spread",
         "side": "away", "team": "Las Vegas Aces", "points": 1.5, "american_price": -103},
        {"away_team": "Las Vegas Aces", "home_team": "Atlanta Dream",
         "start_time": "2026-08-03T23:00:00Z", "market_type": "total",
         "side": "over", "team": None, "points": 186.0, "american_price": -104},
        {"away_team": "Las Vegas Aces", "home_team": "Atlanta Dream",
         "start_time": "2026-08-03T23:00:00Z", "market_type": "total",
         "side": "under", "team": None, "points": 186.0, "american_price": -120},
    ]
    games = normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    g = games[0]
    assert g.home_abbrev == "ATL" and g.away_abbrev == "LVA"
    assert g.spread_team_abbrev == "ATL" and g.spread_line == -1.5
    assert g.total == 186.0
    assert g.sportsbook == "pinnacle"

def test_merge_falls_back_to_sharp_when_pinnacle_empty_markets():
    from app.schemas.wnba_odds import WnbaOddsGame
    pin = [WnbaOddsGame(home_abbrev="ATL", away_abbrev="LVA", sportsbook="pinnacle")]
    sharp = [WnbaOddsGame(home_abbrev="ATL", away_abbrev="LVA",
                          spread_team_abbrev="ATL", spread_line=-2.0, total=180.0,
                          sportsbook="draftkings")]
    merged = merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "draftkings"
    assert merged[0].spread_line == -2.0
```

- [ ] **Step 2: Implement + wire route**

```python
# backend/app/api/routes/wnba_odds.py
from app.services.pinnacle_team_odds import get_today_odds
```

- [ ] **Step 3: Run**

```bash
./nba_model/bin/python -m pytest backend/tests/test_pinnacle_team_odds.py -q
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/pinnacle_team_odds.py backend/app/api/routes/wnba_odds.py backend/tests/test_pinnacle_team_odds.py
git commit -m "$(cat <<'EOF'
Prefer Selenium Pinnacle team lines on WNBA matchups with Sharp fallback.

EOF
)"
```

---

### Task 8: Frontend Pinnacle caption on matchup cards

**Files:**
- Modify: `frontend/src/components/league/MatchupGameCard.tsx`
- Modify: `frontend/src/components/league/MatchupGameCard.test.tsx`

**Interfaces:**
- `OddsByCaption`: if `sportsbook === "pinnacle"`, show text **Pinnacle** (no logo asset required); keep FD/DK images otherwise

- [ ] **Step 1: Failing test**

```tsx
it("shows Pinnacle caption when sportsbook is pinnacle", () => {
  render(
    <MatchupGameCard
      game={{
        ...baseGame,
        odds: {
          spreadTeamAbbrev: "ATL",
          spreadLine: -1.5,
          total: 186,
          sportsbook: "pinnacle",
        },
      }}
    />,
  );
  expect(screen.getByText(/pinnacle/i)).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "DraftKings" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement caption branch**

```tsx
function OddsByCaption({ sportsbook }: { sportsbook?: string | null }) {
  const book = (sportsbook || "draftkings").toLowerCase();
  if (book === "pinnacle") {
    return <span className="…">Odds by Pinnacle</span>;
  }
  // existing FD/DK img logic
}
```

- [ ] **Step 3: Run**

```bash
cd frontend && npm test -- --run src/components/league/MatchupGameCard.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/league/MatchupGameCard.tsx frontend/src/components/league/MatchupGameCard.test.tsx
git commit -m "$(cat <<'EOF'
Show Pinnacle sportsbook caption on matchup odds pills.

EOF
)"
```

---

### Task 9: Docs touch-up

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-website-api-system-design.md` (props/odds bullets)
- Optionally one line in `src/scrapers` / `backend` README if they document Parlay Pinnacle

- [ ] **Step 1: Update system design notes**

State explicitly:

- Prop Picks Pinnacle ← `odds.wnba_pinnacle` (Selenium)
- Matchup odds ← `odds.wnba_pinnacle_team` with Sharp fallback
- Parlay does not supply Pinnacle

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-02-website-api-system-design.md
git commit -m "$(cat <<'EOF'
Document Selenium Pinnacle as source for props column and matchup lines.

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Reuse `odds.wnba_pinnacle` | 2, 3 |
| New `odds.wnba_pinnacle_team` + NULLS NOT DISTINCT | 1 |
| Split `*_props.json` / `*_team.json` | 4 |
| Upsert after scrape + `PINNACLE_SKIP_DB` | 3, 4 |
| Remove Parlay persist/fetch of pinnacle | 3, 6 |
| Prop Picks attach Supabase Pinnacle | 5, 6 |
| Matchups Supabase → Sharp per game | 7 |
| Frontend sportsbook caption | 8 |
| Docs | 9 |
| No NBA UI / no ML on cards / no disk fallback / no scheduler | Out of scope (no tasks) |

No TBD placeholders remain. Types align: `WnbaPropLine.pinnacle`, `WnbaOddsGame.sportsbook="pinnacle"`, loader conflict cols match migration unique index.
