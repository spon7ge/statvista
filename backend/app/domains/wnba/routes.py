from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Response

from app.domains.wnba.futures import get_wnba_futures
from app.domains.wnba.game_detail import get_game_detail
from app.domains.wnba.leaders import get_wnba_leaders
from app.domains.wnba.player import get_wnba_player
from app.domains.wnba.schemas import (
    WnbaFuturesResponse,
    WnbaGameDetail,
    WnbaLeadersResponse,
    WnbaPlayerResponse,
    WnbaScoreboardResponse,
    WnbaStandingsResponse,
)
from app.domains.wnba.scoreboard import get_scoreboard_for_date, get_today_scoreboard
from app.domains.wnba.standings import get_wnba_standings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["wnba"])

_NO_STORE = {"Cache-Control": "no-store"}


@router.get("/wnba/scoreboard", response_model=WnbaScoreboardResponse)
async def wnba_scoreboard_by_date(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> WnbaScoreboardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_scoreboard_for_date(date)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("WNBA scoreboard unavailable for %s: %s", date, exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA scoreboard is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/wnba/scoreboard/today", response_model=WnbaScoreboardResponse)
async def wnba_scoreboard_today(response: Response) -> WnbaScoreboardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_today_scoreboard()
    except HTTPException:
        raise
    except Exception as exc:
        # Any upstream or payload failure must surface as an uncacheable 502 so
        # clients never latch onto an error for the length of a cache TTL.
        logger.warning("WNBA scoreboard unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA scoreboard is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/wnba/leaders", response_model=WnbaLeadersResponse)
async def wnba_leaders(response: Response) -> WnbaLeadersResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_leaders()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("WNBA leaders unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA leaders are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/wnba/player/{player_id}", response_model=WnbaPlayerResponse)
async def wnba_player(player_id: str, response: Response) -> WnbaPlayerResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_player(player_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Player not found",
            headers=_NO_STORE,
        ) from exc
    except Exception as exc:
        logger.warning("WNBA player unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA player is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/wnba/standings", response_model=WnbaStandingsResponse)
async def wnba_standings(response: Response) -> WnbaStandingsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_standings()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("WNBA standings unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA standings are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/wnba/futures", response_model=WnbaFuturesResponse)
async def wnba_futures(response: Response) -> WnbaFuturesResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_futures()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("WNBA futures unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA futures are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/wnba/games/{espn_event_id}", response_model=WnbaGameDetail)
async def wnba_game_detail(
    espn_event_id: str, response: Response
) -> WnbaGameDetail:
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
        logger.warning("WNBA game detail unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="WNBA game detail is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
