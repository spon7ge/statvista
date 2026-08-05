from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
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

app.include_router(api_router, prefix="/api")
