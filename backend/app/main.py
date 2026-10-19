from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import CORS_ORIGINS
from app.core.errors import register_exception_handlers

app = FastAPI(
    title="statvista API",
    version="0.3.0",
    description=(
        "statvista basketball and baseball data backend. Live pages read ESPN, "
        "stats.wnba.com, the MLB Stats API, RotoWire, ParlayAPI, SharpAPI game odds, "
        "and Supabase odds snapshots. Scoreboard, game detail, odds, and prop-board "
        "routes are the public surface."
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
