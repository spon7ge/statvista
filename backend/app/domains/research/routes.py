"""Route composition for database-backed research endpoints."""

from fastapi import APIRouter

from app.domains.research import games, matchups, players

router = APIRouter()
router.include_router(players.router)
router.include_router(games.router)
router.include_router(matchups.router)
