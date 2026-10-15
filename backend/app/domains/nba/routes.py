from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Response

from app.domains.nba.schemas_scoreboard import NbaScoreboardResponse
from app.domains.nba.scoreboard import get_scoreboard_for_date, get_today_scoreboard

logger = logging.getLogger(__name__)

router = APIRouter(tags=["nba"])

_NO_STORE = {"Cache-Control": "no-store"}


@router.get("/nba/scoreboard", response_model=NbaScoreboardResponse)
async def nba_scoreboard_by_date(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> NbaScoreboardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_scoreboard_for_date(date)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("NBA scoreboard unavailable for %s: %s", date, exc)
        raise HTTPException(
            status_code=502,
            detail="NBA scoreboard is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/nba/scoreboard/today", response_model=NbaScoreboardResponse)
async def nba_scoreboard_today(response: Response) -> NbaScoreboardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_today_scoreboard()
    except HTTPException:
        raise
    except Exception as exc:
        # Any upstream or payload failure must surface as an uncacheable 502 so
        # clients never latch onto an error for the length of a cache TTL.
        logger.warning("NBA scoreboard unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="NBA scoreboard is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
