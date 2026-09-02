# statvista

statvista is a research site for **MLB** and **WNBA**. It shows today’s games, sportsbook vs DFS player props, and recommended PrizePicks / Underdog legs — so you can compare lines in one place.

**Status:** Not publicly deployed. Run it locally.

> Educational project only. Sports betting involves risk. Gamble responsibly.

---

## Run with Docker

Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/). From the repo root:

```bash
git clone https://github.com/spon7ge/statvista.git
cd statvista
# Only if you do not already have a .env (this overwrites):
test -f .env || cp .env.docker.example .env
docker compose --profile local-db up -d --build
```

| What | URL |
|------|-----|
| Site | [http://localhost:8080](http://localhost:8080) — `/` lands on the MLB slate |
| API docs | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Health | [http://localhost:8000/api/health](http://localhost:8000/api/health) |

That starts **web** (React), **api** (FastAPI), **odds** (HTTP scrapers), and **postgres**. Games load from public APIs. **Props** and **Legs** need odds snapshots in the database — the `odds` worker fills those every five minutes.

If **8000 is already in use** (another API, or `uvicorn --port 8000` on the host), set a free host port in `.env` and start again. The site on 8080 is unchanged; only the published API port moves.

```bash
# .env
API_PORT=8001
```

```bash
docker compose --profile local-db up -d
```

API docs then: [http://localhost:8001/docs](http://localhost:8001/docs)

PrizePicks scrapers need a real browser, so they stay on the host (`.env` uses `localhost:5433` so they can reach Docker Postgres):

```bash
python -m src.scrapers.mlb_prizepick
python -m src.scrapers.wnba_prizepick
```

```bash
docker compose --profile local-db ps       # status
docker compose --profile local-db logs -f  # logs
docker compose --profile local-db down     # stop (keeps the DB volume)
```

Hosted Supabase instead of local Postgres: set `SUPABASE_DB_URL` in `.env`, then `docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d --build`.

More: **[docker/README.md](docker/README.md)**.

## Run without Docker

Needs **Python 3**, **Node.js**, and two terminals. Vite proxies `/api` to port 8000, so you do not set `VITE_API_BASE_URL`.

### API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
PYTHONPATH=..:. uvicorn app.main:app --reload --port 8000
```

Optional: a repo-root `.env` with `SUPABASE_DB_URL` (and odds keys if you have them). Games still load from public APIs without it; **Props** and **Legs** need the snapshots in that database.

### Site

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). API docs: [http://localhost:8000/docs](http://localhost:8000/docs).

---

## What it does

Sidebar: **Props**, **Legs**, **Arbitrage**, **Games**. League pills switch MLB / WNBA (NBA is a placeholder).

| Page | What you get |
|------|----------------|
| **Games** | Dated slates and game centers (lineups, odds, live/final detail) |
| **Props** | DFS-anchored player lines next to sportsbook odds |
| **Legs** | Complete PrizePicks / Underdog entries priced vs sharp books |
| **Arbitrage** | Shell — not wired yet |

Research copy only — not a lock and not a betting ticket.

How each page is wired: **[md/system-design.md](md/system-design.md)**.

---

## Screenshots

Games (landing after `/` → MLB):

![statvista home landing](assets/screenshots/home.png)

WNBA game center:

![WNBA game center](assets/screenshots/wnba-game-center.png)

MLB game center:

![MLB game center](assets/screenshots/mlb-game-center.png)

---

## Where the data comes from

| Source | Used for |
|--------|----------|
| [ESPN](https://www.espn.com/) | WNBA scoreboard, standings, game summary / win probability; MLB win-probability bridge |
| [stats.wnba.com](https://stats.wnba.com/) | Season leaders, player bio / averages / gamelog |
| [MLB Stats API](https://statsapi.mlb.com/) | MLB scoreboard and live/final game feeds |
| ParlayAPI / Sharp | Sportsbook odds (spreads, totals, player props) |
| Supabase (Postgres) | PrizePicks / Underdog snapshots and other odds tables |
| [RotoWire](https://www.rotowire.com/) | Projected starters / lineups |

---

## Tech stack

React 19, Vite, TanStack Query, Tailwind · FastAPI + Pydantic · Postgres (Supabase or local)

More setup: [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md) · [docker/README.md](docker/README.md) · [models/README.md](models/README.md)

---

This project was made for **educational purposes only**. Sports betting involves risk. Gamble responsibly.
