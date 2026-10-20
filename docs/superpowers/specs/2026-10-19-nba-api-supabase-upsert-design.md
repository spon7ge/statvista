# NBA pipeline upsert into schema `nba_api`

Date: 2026-10-19
Status: Approved for planning

## Goal

NBA runs of the game-log pipeline keep writing local Parquet, then upsert the same frames into Supabase schema `nba_api`. WNBA stays Parquet-only. The website, API, and existing `raw` / `silver` schemas stay as they are.

## Decisions

| Topic | Choice |
| --- | --- |
| Schema | `nba_api` |
| Bronze tables | `player_base`, `player_adv`, `team_base`, `team_adv`, `start_positions` |
| Silver table | `player_gamelogs`, the full current silver row, including Basketball-Reference `pos` and RotoWire `team_spread` / `game_total` |
| Columns | Typed columns for the fields the pipeline writes today. A new API field is ignored until a later migration adds it |
| Keys | `game_id` + `player_id` for player tables. `game_id` + `team_id` for team tables |
| When | Every NBA bronze save and every NBA silver build, after that step's Parquet write succeeds |
| Failure | Missing `SUPABASE_DB_URL`, or a failed direct upsert, fails the command. No Supabase API fallback on this path |
| League | NBA only. WNBA does not open a database connection |
| Readers | Pipeline only. No API or frontend change |

## Data flow

```
NBA bronze fetch
  → Parquet under data/bronze
  → upsert_nba_dataset(...)
       → nba_api.player_base | player_adv | team_base | team_adv | start_positions

NBA silver build
  → Parquet under data/silver
  → upsert_nba_silver(...)
       → nba_api.player_gamelogs

WNBA fetch or build
  → Parquet only
```

`src.pipeline.bronze.fetch` upserts whichever bronze datasets that run saved. `src.pipeline.clean` without `--fetch` upserts silver from Parquet already on disk. `src.pipeline.clean --fetch` does both, because `fetch_and_build_silver` calls the same save and build functions.

Tracking checkpoints stay local. `start_positions` upserts once, when that dataset is saved.

## Tables

| Pipeline dataset | Table | Conflict key | Lineage column |
| --- | --- | --- | --- |
| `player_base` | `nba_api.player_base` | `game_id`, `player_id` | `fetched_at` |
| `player_adv` | `nba_api.player_adv` | `game_id`, `player_id` | `fetched_at` |
| `team_base` | `nba_api.team_base` | `game_id`, `team_id` | `fetched_at` |
| `team_adv` | `nba_api.team_adv` | `game_id`, `team_id` | `fetched_at` |
| `start_positions` | `nba_api.start_positions` | `game_id`, `player_id` | `fetched_at` |
| silver player game logs | `nba_api.player_gamelogs` | `game_id`, `player_id` | `built_at` |

Primary keys only. No extra indexes.

`game_id` is `TEXT`. `player_id` and `team_id` are `BIGINT`. Lineage columns are `TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and the loader overwrites them on every upsert.

### Column lists

Migration `db/migrations/060_nba_api_gamelogs.sql` creates the schema and the six tables.

Bronze columns are copied from `db/migrations/001_raw_gamelogs.sql`:

| New table | Source table |
| --- | --- |
| `nba_api.player_base` | `raw.nba_player_base` |
| `nba_api.player_adv` | `raw.nba_player_adv` |
| `nba_api.team_base` | `raw.nba_team_base` |
| `nba_api.team_adv` | `raw.nba_team_adv` |
| `nba_api.start_positions` | `raw.nba_player_tracking` |

`start_positions` keeps the tracking endpoint names from that source (`position`, `speed`, `distance`, and the rest). Silver renames such as `start_position` and `spd` belong on `player_gamelogs` only.

Silver columns are copied from `silver.nba_player_gamelogs` in `db/migrations/003_silver_gamelogs.sql`, with one type change: `minutes` is `NUMERIC`. That matches the float `assign_playing_minutes` writes. `003` already includes `pos`, `team_spread`, `game_total`, `season_type`, and `built_at`, and it already omits the `*_rank`, `*_adv`, and redundant team columns that `drop_silver_junk` removes.

`upsert_df` snake-cases column names, then keeps only columns that exist on the target table. Columns present on the table and absent from the frame are left unchanged on conflict update.

## Loader

New module `src/pipeline/nba_api_store.py`:

- `upsert_nba_dataset(dataset: str, frame: pd.DataFrame) -> None` for the five bronze names.
- `upsert_nba_silver(frame: pd.DataFrame) -> None` for `player_gamelogs`.
- An unknown dataset name raises `ValueError`.
- An empty frame returns without touching the database.

Both functions call `upsert_df(..., schema="nba_api", postgres_only=True)` with the conflict key and lineage column from the table above.

`upsert_df` gains `postgres_only: bool = False`. When it is true, the direct Postgres path is required. A missing `SUPABASE_DB_URL` or a failed upsert raises. The PostgREST fallback stays in place for existing callers that leave the flag false.

Call sites:

- `GameLogs._save` writes Parquet, then calls `upsert_nba_dataset` when `self.league == "nba"`.
- `build_silver` writes Parquet, then calls `upsert_nba_silver` when `league == "nba"`.

WNBA takes neither call. The odds loaders are unchanged.

## Failure behavior

Parquet is written before the upsert. If the upsert raises, that Parquet file remains and the command exits non-zero through the uncaught exception.

Re-running a bronze fetch pulls from `nba_api` again, then upserts. Re-running silver without `--fetch` reads the Parquet already on disk and upserts `player_gamelogs` again.

An empty frame still writes its Parquet file and skips the upsert, so that step succeeds. Silver still raises before any write when `player_base` or `team_base` is missing or empty.

Apply `060_nba_api_gamelogs.sql` in the Supabase SQL editor before the first NBA upsert. The direct connection does not require exposing schema `nba_api` to the Supabase API. A fresh local Postgres container that mounts `db/migrations` also applies the file on first boot. Existing `raw` and `silver` tables are not altered.

## Tests

File: `src/pipeline/tests/test_nba_api_store.py`. No live database and no live `nba_api` calls.

- Each bronze dataset maps to schema `nba_api`, the table name, the conflict key, and `fetched_at`.
- Silver maps to `nba_api.player_gamelogs` with `built_at`.
- An unknown dataset name raises `ValueError`.
- An empty frame does not call `upsert_df`.
- `postgres_only=True` re-raises when the Postgres path fails, including a missing `SUPABASE_DB_URL`, and does not call the PostgREST fallback.
- NBA `GameLogs._save` writes Parquet, then calls `upsert_nba_dataset`. If that call raises, the Parquet file is still present and the exception escapes.
- WNBA `GameLogs._save` writes Parquet and does not call the loader.
- NBA `build_silver` writes Parquet, then calls `upsert_nba_silver`.
- WNBA `build_silver` writes Parquet and does not call the loader.

## Out of scope

- Rewiring season-log cache, game detail, or any API route to read `nba_api`.
- Changing `raw.*` or `silver.*`.
- WNBA tables in this schema.
- A historical backfill command. The existing `--season` argument selects the run.
- Extra indexes, row-level security, and PostgREST grants.
- Updating `md/system-design.md`. No page-to-API wiring changes.
