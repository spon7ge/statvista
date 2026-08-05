from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    games,
    health,
    matchups,
    mlb_game_detail,
    mlb_lineups,
    mlb_odds,
    mlb_scoreboard,
    players,
    props,
    slates,
    wnba_game_detail,
    wnba_leaders,
    wnba_odds,
    wnba_player,
    wnba_props,
    wnba_scoreboard,
    wnba_standings,
    wnba_futures,
)
from app.core.config import CORS_ORIGINS
from app.core.errors import register_exception_handlers

app = FastAPI(
    title="statvista API",
    version="0.3.0",
    description=(
        "statvista basketball and baseball data backend. Database-backed endpoints read "
        "from Supabase (silver / gold schemas) and make no NBA or Odds API calls. "
        "The exceptions are /api/wnba/scoreboard/today, /api/mlb/scoreboard/today, "
        "/api/mlb/scoreboard, /api/mlb/odds/today, /api/wnba/leaders, "
        "/api/wnba/player/{player_id}, /api/wnba/standings, /api/wnba/futures, "
        "/api/wnba/odds/today, /api/wnba/props/today, WNBA game detail routes, "
        "/api/mlb/games/{game_pk}, and /api/mlb/lineups, which call ESPN, "
        "stats.wnba.com, MLB Stats API, RotoWire, or SharpAPI for live league data."
    ),
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Core Phase 9 routes ────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(games.router, prefix="/api")

# ── Additional DB-backed routes ────────────────────────────────────────────
app.include_router(props.router, prefix="/api")
app.include_router(matchups.router, prefix="/api")
app.include_router(slates.router, prefix="/api")

# ── Direct upstream (non-DB) routes ────────────────────────────────────────
app.include_router(wnba_scoreboard.router, prefix="/api")
app.include_router(mlb_scoreboard.router, prefix="/api")
app.include_router(mlb_odds.router, prefix="/api")
app.include_router(mlb_game_detail.router, prefix="/api")
app.include_router(mlb_lineups.router, prefix="/api")
app.include_router(wnba_leaders.router, prefix="/api")
app.include_router(wnba_player.router, prefix="/api")
app.include_router(wnba_standings.router, prefix="/api")
app.include_router(wnba_futures.router, prefix="/api")
app.include_router(wnba_odds.router, prefix="/api")
app.include_router(wnba_props.router, prefix="/api")
app.include_router(wnba_game_detail.router, prefix="/api")
