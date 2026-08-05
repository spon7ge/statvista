# statvista API

FastAPI backend for the statvista dashboard. **All endpoints read from Supabase only** — no NBA API or Odds API calls are made in this service.

## Setup

```bash
cd backend
pip install -r requirements.txt
```

Ensure repo-root `.env` has `SUPABASE_DB_URL`.

## Run

```bash
# from repo root — root must be on PYTHONPATH so `src.scrapers` imports work
PYTHONPATH=.:backend uvicorn app.main:app --reload --port 8000
```

WNBA game detail may call ESPN + RotoWire for scheduled projected starters.

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Dashboard read path

FastAPI serves the React app from Postgres only (no live NBA/odds calls at request time):

| UI | Endpoint | Table |
|----|----------|-------|
| Research / historical | `GET /api/games/{date}/slate` | games + gold props |

## Endpoints

### Core

| Route | Source table | Description |
|-------|--------------|-------------|
| `GET /api/player/{id}` | silver + gold | Profile, game log, and rolling stats |
| `GET /api/games/{date}` | `silver.silver_games` | Schedule for a date |
| `GET /api/games/today` | `silver.silver_games` | Today's schedule |

### Slate / lines / context

| Route | Source table | Description |
|-------|--------------|-------------|
| `GET /api/props` | `gold.gold_prop_history` | Prop lines + rolling context |
| `GET /api/games/{date}/props` | `gold.gold_prop_history` | Props for a slate date |
| `GET /api/games/{date}/slate` | multiple | Games + props bundle |
| `GET /api/games/{date}/with-props` | silver + gold | Games grouped with prop lines |
| `GET /api/slates/{book}` | `silver.silver_props` | Latest lines for a DFS book |
| `GET /api/matchups/{date}` | `gold.gold_matchup_features` | Rest, pace, opponent def context |

### Discovery

| Route | Source table | Description |
|-------|--------------|-------------|
| `GET /api/players?q=` | `silver.silver_players` | Player search |
| `GET /api/health` | Postgres ping | Liveness + DB connectivity |

## Query parameters

**`/api/props`**

- `date`, `bookmaker`, `market`, `source`, `side`, `player_id`, `limit`

**`/api/player/{id}`**

- `recent_n` — number of recent games (default 10)

Research routes no longer attach ML predictions.

## Frontend dev

With the API running on port 8000, start the React app from `frontend/`:

```bash
npm run dev
```

Vite proxies `/api` requests to the backend.
