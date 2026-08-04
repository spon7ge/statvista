from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Response

from app.schemas.mlb_lineups import MlbLineupsResponse
from app.services.mlb_lineups import get_mlb_lineups

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mlb"])


@router.get("/mlb/lineups", response_model=MlbLineupsResponse)
async def mlb_lineups_by_date(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> MlbLineupsResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_mlb_lineups(date)
