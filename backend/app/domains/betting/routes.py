"""HTTP routes for cross-sport betting data."""
from __future__ import annotations

from fastapi import APIRouter, Response

from app.domains.betting.schemas import WnbaOddsResponse
from app.providers.pinnacle.team_odds import get_today_odds

router = APIRouter()


@router.get("/wnba/odds/today", response_model=WnbaOddsResponse, tags=["wnba"])
async def wnba_odds_today(response: Response) -> WnbaOddsResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_today_odds()
