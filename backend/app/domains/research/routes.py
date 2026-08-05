"""HTTP routes for database-backed research endpoints."""
from __future__ import annotations

import datetime

from fastapi import APIRouter, HTTPException, Query

from app.domains.research import games, matchups, players
from app.domains.research.schemas_feature import PlayerListResponse
from app.domains.research.schemas_game import Game, GameSlate, GameWithProps
from app.domains.research.schemas_matchup import MatchupFeatures
from app.domains.research.schemas_player import PlayerProfile
from app.schemas.prop import PropLine

router = APIRouter()


def _validate_date(date: str) -> None:
    try:
        games.validate_date(date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/games/today", response_model=list[Game], tags=["games"])
def get_todays_games() -> list[Game]:
    """Shortcut — returns today's games without specifying a date."""
    return games.get_games(str(datetime.date.today()))


@router.get("/games/{date}", response_model=list[Game], tags=["games"])
def get_games(date: str) -> list[Game]:
    """Return all games on *date* (YYYY-MM-DD) from **silver.silver_games**."""
    _validate_date(date)
    return games.get_games(date)


@router.get("/games/{date}/props", response_model=list[PropLine], tags=["games"])
def get_game_props(
    date: str,
    bookmaker: str | None = Query(default=None),
    market: str | None = Query(default=None),
) -> list[PropLine]:
    """All prop lines for a slate date from **gold.gold_prop_history**."""
    _validate_date(date)
    return games.get_game_props(date, bookmaker, market)


@router.get("/games/{date}/slate", response_model=GameSlate, tags=["games"])
def get_game_slate(date: str) -> GameSlate:
    """Combined games + props for a full slate view."""
    _validate_date(date)
    return GameSlate(
        game_date=datetime.date.fromisoformat(date),
        games=games.get_games(date),
        props=games.get_game_props(date),
    )


@router.get("/games/{date}/with-props", response_model=list[GameWithProps], tags=["games"])
def get_games_with_props(
    date: str,
    bookmaker: str | None = Query(default=None),
    market: str | None = Query(default=None),
) -> list[GameWithProps]:
    """Games on *date* with prop lines grouped per matchup."""
    _validate_date(date)
    return games.get_games_with_props(date, bookmaker, market)


@router.get("/players", response_model=PlayerListResponse, tags=["players"])
def search_players(
    q: str | None = Query(default=None, description="Name search (case-insensitive)."),
    team: str | None = Query(default=None, description="Team tricode, e.g. LAL"),
    limit: int = Query(default=25, ge=1, le=100),
) -> PlayerListResponse:
    """Search the player directory from **silver.silver_players**."""
    return players.search_players(q, team, limit)


@router.get("/player/{player_id}", response_model=PlayerProfile, tags=["players"])
def get_player(
    player_id: int,
    recent_n: int = Query(default=10, ge=1, le=82),
) -> PlayerProfile:
    """Player profile, recent games, and rolling context."""
    player = players.get_player_profile(player_id, recent_n)
    if player is None:
        raise HTTPException(status_code=404, detail=f"Player {player_id} not found.")
    return player


@router.get("/matchups/{date}", response_model=list[MatchupFeatures], tags=["matchups"])
def list_matchups(
    date: str,
    player_id: int | None = Query(default=None),
    team: str | None = Query(default=None, description="Team tricode filter."),
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[MatchupFeatures]:
    """Return opponent/schedule context for every player-game on a date."""
    return matchups.list_matchups(date, player_id, team, limit)
