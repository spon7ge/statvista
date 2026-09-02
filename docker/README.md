# Docker

Containerized **statvista** live stack: **web** (React), **api** (FastAPI), **odds** (HTTP scrapers), and optional **Postgres**.

PrizePicks scrapers are **not** in Docker — they need a real browser (Brave CDP) on the host.

## Architecture

```
Browser
  → web :8080  (nginx: static React, /api → api:8000)
  → api :8000  (FastAPI: ESPN / MLB Stats / RotoWire + odds.* reads)
  → odds       (loop: Novig, ProphetX, Pinnacle, Underdog → Postgres)
  → postgres   (local-db profile)  or  hosted Supabase
```

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `web` | `docker/Dockerfile.web` | 8080 (host) | React SPA; proxies `/api` to `api` |
| `api` | `docker/Dockerfile.api` | 8000 | Live FastAPI (`/api/mlb/*`, `/api/wnba/*`, health) |
| `odds` | `docker/Dockerfile.odds` | — | HTTP odds scrapers every `ODDS_INTERVAL_SECONDS` |
| `postgres` | `postgres:15-alpine` | 5433 (host) | Local DB; auto-runs `db/migrations/*.sql` |

## Quick start (local Postgres)

```bash
# Only if you do not already have a .env (this overwrites):
test -f .env || cp .env.docker.example .env
docker compose --profile local-db up -d --build
```

Site: http://localhost:8080  
API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/health

Props and Legs stay empty until odds snapshots exist. The `odds` worker fills Novig / ProphetX / Pinnacle / Underdog. PrizePicks still runs on the host:

```bash
python -m src.scrapers.mlb_prizepick
python -m src.scrapers.wnba_prizepick
```

## External Supabase

Skip local Postgres and point at your Supabase project:

```bash
# .env — set SUPABASE_DB_URL to the Supabase connection string
docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d --build
```

Apply migrations once in the Supabase SQL Editor (`db/migrations/`) before the first odds run.

## Odds worker

Default command is a loop:

```text
python -m src.scrapers.run_all_odds --league all --exclude wnba_prizepick,mlb_prizepick
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `ODDS_LEAGUE` | `all` | `wnba`, `mlb`, or `all` |
| `ODDS_EXCLUDE` | `wnba_prizepick,mlb_prizepick` | Names skipped each cycle |
| `ODDS_INTERVAL_SECONDS` | `300` | Sleep between cycles |

One-shot (no loop):

```bash
docker compose run --rm --entrypoint python odds -m src.scrapers.run_all_odds --exclude wnba_prizepick,mlb_prizepick
```

## Compose profiles

| Profile | Extra services | Use case |
|---------|----------------|----------|
| *(default)* | `web`, `api`, `odds` | Needs `SUPABASE_DB_URL` or combine with `local-db` |
| `local-db` | `postgres` | Local Postgres on host port 5433 |

## Volumes

| Mount | Service | Purpose |
|-------|---------|---------|
| `pgdata` | postgres | Persistent local database |
| `./db/migrations` | postgres | Schema init on first boot |
| `./data/cache` | api | ESPN / outbound HTTP cache |
| `./data/props` | odds | Scraper JSON output |

## Frontend without Docker

`cd frontend && npm run dev` still proxies `/api` → `localhost:8000`. You can run only `api` (+ `postgres` or Supabase) and keep Vite on the host.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bind for 0.0.0.0:8000 failed: port is already allocated | Another process or container owns 8000. Set `API_PORT=8001` in `.env` and `docker compose --profile local-db up -d`. The site on 8080 still talks to the API inside Docker. |
| `could not translate host name "host.docker.internal"` | Host scrapers must use `localhost:5433` in `.env` (see `.env.docker.example`). Recreate api/odds after changing compose so containers use the `postgres` hostname. |
| API `503` / DB host not found | Start with `--profile local-db`, or set `SUPABASE_DB_URL` |
| SSL error locally | Use `?sslmode=disable` in the local URL |
| Props/Legs empty | Wait for an `odds` cycle; run PrizePicks on the host |
| PrizePicks in the odds container | Leave `ODDS_EXCLUDE` as-is; run those modules locally |
