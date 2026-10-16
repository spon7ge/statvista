from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response

from app.domains.nba.game_detail import get_game_detail
from app.domains.nba.schemas_game_detail import NbaGameDetail
from app.domains.nba.schemas_scoreboard import NbaScoreboardResponse
from app.domains.nba.schemas_team_preview import NbaTeamPreviewResponse
from app.domains.nba.scoreboard import get_scoreboard_for_date, get_today_scoreboard
from app.domains.nba.team_preview import get_nba_team_preview

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


@router.get("/nba/games/{espn_event_id}", response_model=NbaGameDetail)
async def nba_game_detail(
    espn_event_id: str, response: Response
) -> NbaGameDetail:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_game_detail(espn_event_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
            headers=_NO_STORE,
        ) from exc
    except Exception as exc:
        logger.warning("NBA game detail unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="NBA game detail is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get(
    "/nba/games/{espn_event_id}/team-preview",
    response_model=NbaTeamPreviewResponse,
)
async def nba_team_preview(
    espn_event_id: str,
    response: Response,
    side: Literal["away", "home"] = Query(...),
) -> NbaTeamPreviewResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_nba_team_preview(espn_event_id, side)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
            headers=_NO_STORE,
        ) from exc
    except Exception as exc:
        logger.warning("NBA team preview unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="NBA team preview is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
