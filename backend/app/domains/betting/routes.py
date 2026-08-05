"""HTTP routes for cross-sport betting data."""
from __future__ import annotations

import datetime

from fastapi import APIRouter, HTTPException, Query, Response

from app.core import db
from app.domains.betting.schemas import PropLine, WnbaOddsResponse, WnbaPropsResponse
from app.providers.pinnacle.team_odds import get_today_odds
from app.domains.betting.parlay_props import get_today_props

router = APIRouter()

_PROPS_SQL = """
SELECT
    bookmaker, market_category, player_id, player_name, player_name_raw,
    normalized_name, side, game_date, line, odds, prop_source, last_update_at,
    player_team_abbrev, home_team_abbrev, away_team_abbrev, game_season_year,
    min_roll5, pts_per_min_roll5, reb_per_min_roll5, ast_per_min_roll5,
    min_roll10, pts_per_min_roll10, team_min_rank_l10, team_usg_rank_l10,
    expected_pace, opp_def_rating_roll10, team_spread, game_total
FROM gold.gold_prop_history
WHERE game_date = %(game_date)s
  AND (%(bookmaker)s IS NULL OR lower(bookmaker) = lower(%(bookmaker)s))
  AND (%(market)s    IS NULL OR lower(market_category) = lower(%(market)s))
  AND (%(source)s    IS NULL OR prop_source = %(source)s)
  AND (%(side)s      IS NULL OR side = %(side)s)
  AND (%(player_id)s IS NULL OR player_id = %(player_id)s)
ORDER BY player_name, market_category, side
LIMIT %(limit)s
"""

_BOOK_ALIASES = {
    "prizepicks": ["prizepicks", "prize picks"],
    "underdog": ["underdog", "underdog fantasy"],
    "draftkings": ["draftkings", "draftkings pick6", "dk pick6"],
    "betr": ["betr", "betr dfs"],
}

_SLATE_SQL = """
SELECT
    bookmaker, market_category, player_id, player_name, player_name_raw,
    normalized_name, side, game_date, line, odds, last_update_at, prop_source
FROM silver.silver_props
WHERE game_date = %(game_date)s
  AND lower(bookmaker) = ANY(%(bookmakers)s)
ORDER BY player_name, market_category, side
LIMIT %(limit)s
"""


@router.get("/props", response_model=list[PropLine], tags=["props"])
def list_props(
    date: str | None = Query(
        default=None,
        description="Slate date YYYY-MM-DD. Defaults to today.",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    ),
    bookmaker: str | None = Query(default=None),
    market: str | None = Query(default=None, description="e.g. player_points"),
    source: str | None = Query(default=None, description="dfs or us"),
    side: str | None = Query(default=None, description="over or under"),
    player_id: int | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
) -> list[PropLine]:
    """Return prop lines enriched with rolling context from **gold.gold_prop_history**."""
    rows = db.query(
        _PROPS_SQL,
        {
            "game_date": date or str(datetime.date.today()),
            "bookmaker": bookmaker,
            "market": market,
            "source": source,
            "side": side,
            "player_id": player_id,
            "limit": limit,
        },
    )
    return [PropLine(**row) for row in rows]


def _bookmaker_names(book: str) -> list[str]:
    names = _BOOK_ALIASES.get(book.lower())
    if names is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown book '{book}'. Valid: {', '.join(_BOOK_ALIASES)}",
        )
    return [name.lower() for name in names]


@router.get("/slates/{book}", tags=["slates"])
def get_slate(
    book: str,
    date: str | None = Query(
        default=None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Slate date. Defaults to today.",
    ),
    limit: int = Query(default=500, ge=1, le=2000),
) -> dict:
    """Return the latest prop lines for a DFS book from **silver.silver_props**."""
    target_date = date or str(datetime.date.today())
    rows = db.query(
        _SLATE_SQL,
        {
            "game_date": target_date,
            "bookmakers": _bookmaker_names(book),
            "limit": limit,
        },
    )
    return {
        "book": book.lower(),
        "game_date": target_date,
        "count": len(rows),
        "props": rows,
    }


@router.get("/wnba/odds/today", response_model=WnbaOddsResponse, tags=["wnba"])
async def wnba_odds_today(response: Response) -> WnbaOddsResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_today_odds()


@router.get("/wnba/props/today", response_model=WnbaPropsResponse, tags=["wnba"])
async def wnba_props_today(response: Response) -> WnbaPropsResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_today_props()
