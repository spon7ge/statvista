from __future__ import annotations

import logging
from datetime import date as Date

from fastapi import APIRouter, HTTPException, Query, Response

from app.schemas.mlb_lineups import MlbLineupMatchupResponse, MlbLineupsResponse
from app.services.mlb_lineup_matchup import get_mlb_lineup_matchup
from app.services.mlb_lineups import get_mlb_lineups

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mlb"])


@router.get("/mlb/lineups/matchup", response_model=MlbLineupMatchupResponse)
async def mlb_lineups_matchup(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    away: str = Query(..., min_length=1),
    home: str = Query(..., min_length=1),
) -> MlbLineupMatchupResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        Date.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date") from exc
    return await get_mlb_lineup_matchup(date, away.strip(), home.strip())


@router.get("/mlb/lineups", response_model=MlbLineupsResponse)
async def mlb_lineups_by_date(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> MlbLineupsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        Date.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date") from exc
    return await get_mlb_lineups(date)
