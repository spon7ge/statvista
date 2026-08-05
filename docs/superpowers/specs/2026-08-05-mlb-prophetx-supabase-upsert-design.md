# MLB ProphetX Supabase schema + upsert

Date: 2026-08-05  
Status: Approved for planning

## Goal

Persist ProphetX MLB scraper snapshots into Supabase `odds` tables and upsert after each scrape (plus JSON file loaders for backfill). No API/frontend wiring in this slice.

## Decisions

| Topic | Choice |
| --- | --- |
| Tables | `odds.mlb_prophetx` (props) + `odds.mlb_prophetx_team` (team markets) |
| Pattern | Mirror Underdog / Pinnacle: full snapshot per `scraped_at`, upsert on conflict keys |
| Stake | Store `american_price` + `stake` on both tables |
| Scraper | Real upsert after JSON write; `PROPHETX_SKIP_DB=1` skips DB |
| Backfill | `load_prophetx_props_json_file` / `load_prophetx_team_json_file` |
| API / frontend | Out of scope |

## Architecture

```
mlb_prophetx.py
  → write *_props.json + *_team.json
  → load_prophetx_props_snapshot(games)
  → load_prophetx_team_snapshot(games)
       ↓
  snapshot_rows.py  (prophetx_*_to_rows)
       ↓
  upsert_df → odds.mlb_prophetx / odds.mlb_prophetx_team
```

Migrations: `029_odds_mlb_prophetx.sql`, `030_odds_mlb_prophetx_team.sql` (next after `028`).

## Schema

### `odds.mlb_prophetx`

| Column | Type | Notes |
| --- | --- | --- |
| `league` | TEXT NOT NULL | `mlb` |
| `event_id` | BIGINT | ProphetX event id |
| `away_team` | TEXT | from competitors |
| `home_team` | TEXT | from competitors |
| `start_time` | TIMESTAMPTZ | event scheduled |
| `player_name` | TEXT NOT NULL | |
| `stat_name` | TEXT NOT NULL | scraper `stat` (e.g. `hits`) |
| `line_score` | NUMERIC NOT NULL | |
| `side` | TEXT NOT NULL | `over` \| `under` |
| `american_price` | INTEGER | nullable if missing |
| `stake` | NUMERIC | top-of-book stake |
| `market_id` | BIGINT | ProphetX market id |
| `sub_type` | TEXT | e.g. `player_total_hits` |
| `scraped_at` | TIMESTAMPTZ NOT NULL | snapshot batch |
| `fetched_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | lineage |

Unique: `(league, event_id, player_name, stat_name, side, line_score, scraped_at)`  
Index: `(league, scraped_at DESC)`

### `odds.mlb_prophetx_team`

| Column | Type | Notes |
| --- | --- | --- |
| `league` | TEXT NOT NULL | `mlb` |
| `event_id` | BIGINT | |
| `away_team` | TEXT NOT NULL | |
| `home_team` | TEXT NOT NULL | |
| `start_time` | TIMESTAMPTZ | |
| `market_type` | TEXT NOT NULL | `moneyline`, `run_line`, `total`, `1st_inning_moneyline`, `1st_5th_inning_moneyline` |
| `side` | TEXT NOT NULL | selection label / side key |
| `team` | TEXT | team name when applicable |
| `points` | NUMERIC | line; null on moneyline |
| `american_price` | INTEGER NOT NULL | |
| `stake` | NUMERIC | |
| `scraped_at` | TIMESTAMPTZ NOT NULL | |
| `fetched_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

Unique (NULLS NOT DISTINCT): `(league, event_id, market_type, side, points, scraped_at)`  
Index: `(league, scraped_at DESC)`

## Row mapping

### Props

From each game’s `props[]`:

- Emit one row per present `over` / `under` object.
- Skip a side if `american` is missing.
- `away_team` / `home_team`: from `competitors` — ProphetX `seq` 0 = home, `seq` 1 = away (match scraper event shape).
- `start_time` from `scheduled`.

### Team

From each game’s `team_markets`:

- For each market type key and each side row: emit one DB row.
- Skip if `american` is missing.
- `points` from side `line` (null when absent / moneyline).
- `side`: prefer a stable token (`home`/`away`/`over`/`under`) when derivable from competitor match; else use selection `name`.
- Include period moneylines under their market_type keys.

## Loaders

In `src/odds/load_snapshots.py`:

- `load_prophetx_props_snapshot(games, *, league, scraped_at=None) -> int`
- `load_prophetx_team_snapshot(games, *, league, scraped_at=None) -> int`
- `load_prophetx_props_json_file(path, *, scraped_at=None) -> int`
- `load_prophetx_team_json_file(path, *, scraped_at=None) -> int`

Behavior mirrors Pinnacle/Underdog: honor `PROPHETX_SKIP_DB`, coerce floats, dedupe conflict cols, `upsert_df` with `lineage_col="fetched_at"`.

## Scraper wiring

Replace `maybe_load_supabase_stub` in `mlb_prophetx.py`:

1. After successful `write_snapshots`, call both loaders with the in-memory game lists.
2. On DB failure: log error; keep JSON (do not raise unless desired — match Underdog: catch, log, continue).
3. Log upsert row counts and output paths on success.

## Tests

Offline unit tests only:

- Props mapper: over + under + stake; skip side without american; unknown/missing fields skipped.
- Team mapper: moneyline / run_line / total rows; period market_type passthrough.
- `PROPHETX_SKIP_DB=1` → loaders return 0 without calling upsert.
- Conflict column lists align with migration unique indexes.

## Out of scope

- Backend API routes / OpenAPI
- Frontend Prop Picks or matchup cards
- Partner API auth
- Non-MLB ProphetX tournaments
- Changing other books’ tables

## Success criteria

1. Migrations `029` and `030` create both tables + indexes.
2. Scraper run upserts into both tables (unless `PROPHETX_SKIP_DB=1`).
3. JSON file loaders can backfill existing `data/props/prophetx/mlb/*` snapshots.
4. Unit tests pass without live Supabase.
