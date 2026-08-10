from __future__ import annotations

import logging
from datetime import date as Date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response

from app.domains.mlb.futures import get_mlb_futures
from app.domains.mlb.game_detail import get_mlb_game_detail
from app.domains.mlb.leaders import get_mlb_leaders
from app.domains.mlb.standings import get_mlb_standings
from app.domains.mlb.lineup_matchup import get_mlb_lineup_matchup
from app.domains.mlb.lineups import get_mlb_lineups
from app.domains.mlb.odds import get_today_odds
from app.domains.mlb.game_props import get_mlb_props_for_game
from app.domains.mlb.props import get_mlb_props_today
from app.domains.mlb.schemas import (
    MlbFuturesResponse,
    MlbGameDetail,
    MlbGamePropsResponse,
    MlbLineupMatchupResponse,
    MlbLineupsResponse,
    MlbOddsResponse,
    MlbPropsResponse,
    MlbScoreboardResponse,
    MlbTeamPreviewResponse,
)
from app.domains.mlb.schemas_leaders import MlbLeadersResponse
from app.domains.mlb.schemas_standings import MlbStandingsResponse
from app.domains.mlb.scoreboard import get_scoreboard_for_date, get_today_scoreboard
from app.domains.mlb.team_preview import get_mlb_team_preview

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mlb"])

_NO_STORE = {"Cache-Control": "no-store"}


@router.get("/mlb/futures", response_model=MlbFuturesResponse)
async def mlb_futures(response: Response) -> MlbFuturesResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_futures()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB futures unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB futures are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/standings", response_model=MlbStandingsResponse)
async def mlb_standings(response: Response) -> MlbStandingsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_standings()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB standings unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB standings are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/leaders", response_model=MlbLeadersResponse)
async def mlb_leaders(response: Response) -> MlbLeadersResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_leaders()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB leaders unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB leaders are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/scoreboard", response_model=MlbScoreboardResponse)
async def mlb_scoreboard_by_date(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> MlbScoreboardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_scoreboard_for_date(date)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB scoreboard unavailable for %s: %s", date, exc)
        raise HTTPException(
            status_code=502,
            detail="MLB scoreboard is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/scoreboard/today", response_model=MlbScoreboardResponse)
async def mlb_scoreboard_today(response: Response) -> MlbScoreboardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_today_scoreboard()
    except HTTPException:
        raise
    except Exception as exc:
        # Upstream or payload failure must surface as an uncacheable 502 so
        # clients never latch onto an error for the length of a cache TTL.
        logger.warning("MLB scoreboard unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB scoreboard is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/odds/today", response_model=MlbOddsResponse)
async def mlb_odds_today(response: Response) -> MlbOddsResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_today_odds()


@router.get("/mlb/props/today", response_model=MlbPropsResponse)
async def mlb_props_today(
    response: Response,
    app: Literal["prizepicks", "underdog"] = Query(...),
    format: str = Query(..., min_length=1),
    legs: int = Query(..., ge=2, le=6),
) -> MlbPropsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_props_today(app=app, format=format, legs=legs)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/props/game/{game_pk}", response_model=MlbGamePropsResponse)
async def mlb_props_game(
    game_pk: str,
    response: Response,
    app: Literal["prizepicks", "underdog"] = Query(...),
) -> MlbGamePropsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_props_for_game(game_pk=game_pk, app=app)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="game not found",
            headers=_NO_STORE,
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
            headers=_NO_STORE,
        ) from exc


@router.get("/mlb/games/{game_pk}", response_model=MlbGameDetail)
async def mlb_game_detail(game_pk: str, response: Response) -> MlbGameDetail:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_game_detail(game_pk)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
            headers=_NO_STORE,
        ) from exc
    except Exception as exc:
        logger.warning("MLB game detail unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB game detail is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc


@router.get(
    "/mlb/games/{game_pk}/team-preview",
    response_model=MlbTeamPreviewResponse,
)
async def mlb_team_preview(
    game_pk: str,
    response: Response,
    side: Literal["away", "home"] = Query(...),
) -> MlbTeamPreviewResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_team_preview(game_pk, side)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
            headers=_NO_STORE,
        ) from exc


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
