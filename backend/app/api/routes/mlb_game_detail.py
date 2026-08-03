from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Response

from app.schemas.mlb_game_detail import MlbGameDetail
from app.services.mlb_game_detail import get_mlb_game_detail

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mlb"])

_NO_STORE = {"Cache-Control": "no-store"}


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
