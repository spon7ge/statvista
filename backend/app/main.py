from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    health,
)
from app.core.config import CORS_ORIGINS
from app.core.errors import register_exception_handlers
from app.domains.betting.routes import router as betting_router
from app.domains.mlb.routes import router as mlb_router
from app.domains.research.routes import router as research_router
from app.domains.wnba.routes import router as wnba_router

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
app.include_router(research_router, prefix="/api")

# ── Direct upstream (non-DB) routes ────────────────────────────────────────
app.include_router(betting_router, prefix="/api")
app.include_router(mlb_router, prefix="/api")
app.include_router(wnba_router, prefix="/api")
