# Docker

Containerized **statvista** live stack: **web** (React), **api** (FastAPI), **odds** (HTTP scrapers), and optional **Postgres**.

PrizePicks scrapers are **not** in Docker — they need a real browser (Brave CDP) on the host.

## Architecture

```
Browser
  → 127.0.0.1:8080  (nginx: static React, /api → api:8000)
  → 127.0.0.1:8000  (FastAPI docs and health; the site does not use this port)
  → odds            (loop: Novig, ProphetX, Pinnacle, Underdog → Postgres)
  → postgres        (local-db profile)  or  hosted Supabase
```

Published ports bind to `127.0.0.1` only. Put a TLS proxy on the host (Caddy, or the platform) in front of `127.0.0.1:8080` before the site is reachable from another machine. The API does not need a public port: nginx already proxies `/api`.

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `web` | `docker/Dockerfile.web` | 127.0.0.1:8080 | React SPA; proxies `/api` to `api` |
| `api` | `docker/Dockerfile.api` | 127.0.0.1:8000 | Live FastAPI (`/api/mlb/*`, `/api/wnba/*`, health, `/docs`) |
| `odds` | `docker/Dockerfile.odds` | — | HTTP odds scrapers every `ODDS_INTERVAL_SECONDS` |
| `postgres` | `postgres:15.19-alpine` | 127.0.0.1:5433 | Local DB; auto-runs `db/migrations/*.sql` |

## Quick start (local Postgres)

```bash
# Only if you do not already have a .env (this overwrites):
test -f .env || cp .env.docker.example .env
docker compose -f docker-compose.yml -f docker-compose.local-db.yml --profile local-db up -d --build
```

Site: http://localhost:8080  
API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/health

Props and Legs stay empty until odds snapshots exist. The `odds` worker fills Novig / ProphetX / Pinnacle / Underdog. PrizePicks still runs on the host:

```bash
python -m src.scrapers.nba.nba_prizepick
python -m src.scrapers.mlb.mlb_prizepick
python -m src.scrapers.wnba.wnba_prizepick
python -m src.scrapers.nfl.nfl_prizepick
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
python -m src.scrapers.run_all_odds --league all --exclude wnba_prizepick,nba_prizepick,mlb_prizepick
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `ODDS_LEAGUE` | `all` | `wnba`, `nba`, `mlb`, or `all` |
| `ODDS_EXCLUDE` | `wnba_prizepick,nba_prizepick,mlb_prizepick` | Names skipped each cycle |
| `ODDS_INTERVAL_SECONDS` | `300` | Sleep between cycles |

One-shot (no loop):

```bash
docker compose run --rm --entrypoint python odds -m src.scrapers.run_all_odds --exclude wnba_prizepick,nba_prizepick,mlb_prizepick
```

## Compose profiles

| Profile | Extra services | Use case |
|---------|----------------|----------|
| *(default)* | `web`, `api`, `odds` | Uses `SUPABASE_DB_URL` from `.env` |
| `local-db` | `postgres` | Add `-f docker-compose.local-db.yml`. Postgres on 127.0.0.1:5433 |

## Volumes

| Mount | Service | Purpose |
|-------|---------|---------|
| `pgdata` | postgres | Persistent local database |
| `./db/migrations` | postgres | Schema init on first boot |
| `./data/cache` | api | ESPN / outbound HTTP cache |
| `./data/props` | odds | Scraper JSON output |

`api` and `odds` run as uid 1000. Those two directories have to be writable by that user. If a container exits saying the mount is not writable:

```bash
mkdir -p data/cache data/props
chmod a+rwx data/cache data/props
```

## Local Postgres backup

Supabase stores its own backups. For the `local-db` volume, dump from the running container and restore into a second database so the check does not touch the live one:

```bash
docker compose -f docker-compose.yml -f docker-compose.local-db.yml --profile local-db exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > pgdata.sql

docker compose -f docker-compose.yml -f docker-compose.local-db.yml --profile local-db exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE statvista_restore"
docker compose -f docker-compose.yml -f docker-compose.local-db.yml --profile local-db exec -T postgres \
  psql -U "$POSTGRES_USER" -d statvista_restore < pgdata.sql
docker compose -f docker-compose.yml -f docker-compose.local-db.yml --profile local-db exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE statvista_restore"
```

`pgdata.sql` contains the database. Keep it out of git.

## Frontend without Docker

`cd frontend && npm run dev` still proxies `/api` → `localhost:8000`. You can run only `api` (+ `postgres` or Supabase) and keep Vite on the host.

## Image security

`api`, `web`, and `odds` run as an unprivileged user (`app` or `nginx`). The official Postgres image starts as root so it can fix the data volume, then drops to the `postgres` user. Postgres is published on `127.0.0.1` only; the API and odds worker reach it on the compose network.

Secrets stay out of the image. `.dockerignore` excludes `.git`, `.env`, and `node_modules`. Put keys in `.env` and let compose inject them at runtime.

Base images are patch-pinned slim or alpine tags. After a rebuild, scan with `docker scout cves <image>`, `trivy image <image>`, or `grype <image>`, and review layers with `docker history <image>`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bind for 127.0.0.1:8000 failed: port is already allocated | Another process or container owns 8000. Set `API_PORT=8001` in `.env` and start again with `-f docker-compose.local-db.yml --profile local-db`. The site on 8080 still talks to the API inside Docker. |
| `set POSTGRES_PASSWORD in .env` | Copy `.env.docker.example` to `.env` and set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. |
| `data/cache is not writable` | `mkdir -p data/cache data/props && chmod a+rwx data/cache data/props` |
| `could not translate host name "host.docker.internal"` | Host scrapers must use `localhost:5433` in `.env` (see `.env.docker.example`). Recreate api/odds after changing compose so containers use the `postgres` hostname. |
| API `503` / DB host not found | Start with `-f docker-compose.local-db.yml --profile local-db`, or set `SUPABASE_DB_URL` and use `docker-compose.supabase.yml` |
| SSL error locally | Use `?sslmode=disable` in the local URL |
| Props/Legs empty | Wait for an `odds` cycle; run PrizePicks on the host |
| PrizePicks in the odds container | Leave `ODDS_EXCLUDE` as-is; run those modules locally |
