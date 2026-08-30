# statvista

statvista is a research site for **MLB** and **WNBA**. It shows today’s games, sportsbook vs DFS player props, and recommended PrizePicks / Underdog legs — so you can compare lines in one place.

**Status:** Not publicly deployed. Run it locally.

> Educational project only. Sports betting involves risk. Gamble responsibly.

---

## Run locally

Needs **Python 3**, **Node.js**, and two terminals. Vite proxies `/api` to port 8000, so you do not set `VITE_API_BASE_URL` for local dev.

### 1. Clone

```bash
git clone https://github.com/spon7ge/statvista.git
cd statvista
```

### 2. API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
PYTHONPATH=..:. uvicorn app.main:app --reload --port 8000
```

Optional: a repo-root `.env` with `SUPABASE_DB_URL` (and odds keys if you have them). Games still load from public APIs without it; **Props** and **Legs** need the snapshots in that database.

### 3. Site

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — `/` lands on the MLB slate.

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## What it does

Sidebar: **Props**, **Legs**, **Arbitrage**, **Games**. League pills switch MLB / WNBA (NBA is a placeholder).

| Page | What you get |
|------|----------------|
| **Games** | Dated slates and game centers (lineups, odds, live/final detail) |
| **Props** | DFS-anchored player lines next to sportsbook odds |
| **Legs** | MLB only: complete PrizePicks / Underdog entries priced vs sharp books |
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
