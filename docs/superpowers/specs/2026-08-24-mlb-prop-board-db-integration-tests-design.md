# MLB prop board — API ↔ Postgres integration tests

Date: 2026-08-24  
Status: Approved (design)  
Parent: `docs/superpowers/specs/2026-08-23-mlb-prop-picks-research-table-design.md`  
Does **not** change `GET /api/mlb/props/board` production behavior, snapshot SQL, or the website.

## Goal

Add a real-Postgres integration suite for the highest-value API ↔ database path: **`GET /api/mlb/props/board` reading `odds.*` snapshots**. Tests prove persistence, latest-per-quote queries, league filters, unique-key violations, and a fixed SELECT count (not per player). Unit tests stay mocked.

## Decisions

| Topic | Choice |
| --- | --- |
| Surface | `GET /api/mlb/props/board` only |
| Database | Ephemeral Postgres 15 via Testcontainers (session-scoped) |
| Schema | Odds-only: apply `db/migrations/*odds*.sql` in filename order |
| Isolation | `TRUNCATE` every table in schema `odds` before each test |
| HTTP | `TestClient` hits the real route; `load_enrichment` stubbed (no ESPN / scoreboard / Stats API) |
| Writes | Seed with SQL inserts through the same SQLAlchemy engine. Production persist/upsert is out of scope |
| Docker missing | Integration tests **skip**; unit tests still run |
| Container/migrate failure | Integration tests **fail** (do not skip) |
| CI | Existing `backend-tests` job; Docker is available on `ubuntu-latest` |
| Safety | Integration fixtures always set `SUPABASE_DB_URL` to the container DSN; never fall back to `.env` / production |

## Non-goals

- `maybe_persist_parlay_props` / scraper upserts / transaction rollback of writers
- `GET /api/wnba/props/today` and other snapshot consumers
- Research silver/gold routes (`/api/games`, `/api/props`)
- Live ESPN, MLB Stats API, or scoreboard HTTP
- SQLite, a dedicated schema on local-db:5433, or pytest-docker compose
- Replacing `backend/tests/test_mlb_prop_board.py` (mocked assembler tests stay)

## Architecture

```text
pytest (mark: integration)
  → Testcontainers Postgres 15
  → apply db/migrations/*odds*.sql
  → set SUPABASE_DB_URL + get_engine.cache_clear()
  → TestClient GET /api/mlb/props/board
        → get_mlb_prop_board()
              → collect_board_quotes()  [real odds.* via SQLAlchemy]
              → load_enrichment()       [stubbed]
        → JSON rows / warnings
```

Production code is unchanged. The board still reads through `app.core.odds_snapshots` → `src.utils.db.get_engine()`. Tests point that cached engine at the container.

## Components

| Piece | Role |
| --- | --- |
| `backend/tests/integration/` | Only this package imports Testcontainers |
| `backend/tests/integration/conftest.py` | Session: start `postgres:15-alpine`, apply odds migrations, set `SUPABASE_DB_URL`, `get_engine.cache_clear()`. Function: truncate `odds.*`. Autouse: stub `load_enrichment` |
| `backend/tests/integration/test_mlb_prop_board_db.py` | Cases below |
| `pytest.mark.integration` | Registered in `backend/pytest.ini` |
| `testcontainers[postgres]` | `backend/requirements-dev.txt` only |
| Seed helpers | Small insert helpers in the integration package for required `NOT NULL` columns; ProphetX/Novig rows used as board quotes set `is_main=true` (board fetches `mains_only=True`) |

`load_dotenv()` does not override variables already set. The session fixture sets `SUPABASE_DB_URL` to the container DSN **before** `get_engine` is created (then `cache_clear()` so a prior empty/wrong engine cannot stick). If the container never starts, do not leave `SUPABASE_DB_URL` pointing at `.env`.

Truncate target: every table in `information_schema` for schema `odds` (`TRUNCATE ... RESTART IDENTITY CASCADE`). Do not hard-code table names.

## Test cases

Each test: truncate → SQL insert → `TestClient.get("/api/mlb/props/board")` → assert JSON. Do not monkeypatch `fetch_latest_*`.

| Case | Setup | Expect |
| --- | --- | --- |
| Empty DB | no rows | `200`, `rows: []`; `parlay_unavailable` may appear in `warnings` |
| Latest-per-quote | two rows, same quote identity, different `scraped_at` and `line_score` | board uses the **newer** line only |
| League filter | mix of `league='mlb'` and `league='wnba'` in an MLB snapshot table | only `mlb` quotes appear |
| Multi-book cluster | ProphetX + DraftKings (`odds.mlb_parlay_api_odds`, `sportsbook='draftkings'`) at the same player/stat/line | one over + one under row; both books on `books` chips |
| DFS extra line | sportsbook 1.5 + PrizePicks 2.0 | two line groups; DFS-only row `ip_pct` is null |
| PK violation | insert the same primary key twice into `odds.mlb_prizepicks` | `IntegrityError` (direct SQL — the board does not write) |
| Query count | 1 player vs many players in the same tables | `collect_board_quotes` issues the **same** number of `SELECT`s (one per snapshot fetch, not one per player). Count via SQLAlchemy `engine` events on the test engine |

Latest-per-quote identity follows `src.odds.quote_specs` (e.g. PrizePicks: `league, player_name, stat_type, odds_type` — `line_score` is not part of identity). Seed two `scraped_at` values for that identity.

Stubbed enrichment means `hit_l5` / ranks / `game_start_at` may be null. Assertions target `rows` grain: player, stat, line, side, books chips, `ip_pct`. Do not assert live matchup fields.

## Error handling and CI

- No Docker: skip integration tests with a one-line reason; unit tests still pass.
- Container start or migration failure: fail the integration tests.
- Production `fetch_latest_*` still logs and returns `[]` on query failure; this suite does not add a board 500.
- GitHub Actions `backend-tests` keeps `python -m pytest backend/tests/ -q`. Add `testcontainers` so those tests run; `ubuntu-latest` provides Docker.
- `backend/README.md`: short subsection — Docker required for integration; `pytest -m "not integration"` to skip.

## Out of spec (follow-ups)

- Persist/write path (`maybe_persist_*`, unique upserts, rollback)
- WNBA props-today against the same harness
- Full `db/migrations` (silver/gold) if a later route needs it
