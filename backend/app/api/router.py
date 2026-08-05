from fastapi import APIRouter

from app.api.routes import health
from app.domains.betting.routes import router as betting_router
from app.domains.mlb.routes import router as mlb_router
from app.domains.research.routes import router as research_router
from app.domains.wnba.routes import router as wnba_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(research_router)
api_router.include_router(betting_router)
api_router.include_router(wnba_router)
api_router.include_router(mlb_router)
