from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class WnbaOddsBoardLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    line: float
    price: int | None = None


class WnbaOddsBoardTotal(BaseModel):
    model_config = _RESPONSE_CONFIG

    side: Literal["over", "under"]
    line: float
    price: int | None = None


class WnbaOddsBoardSide(BaseModel):
    model_config = _RESPONSE_CONFIG

    moneyline: int | None = None
    spread: WnbaOddsBoardLine | None = None
    total: WnbaOddsBoardTotal | None = None


class WnbaOddsBoard(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: WnbaOddsBoardSide
    home: WnbaOddsBoardSide


class WnbaOddsGame(BaseModel):
    model_config = _RESPONSE_CONFIG

    home_abbrev: str
    away_abbrev: str
    spread_team_abbrev: str | None = None
    spread_line: float | None = None
    total: float | None = None
    away_moneyline: int | None = None
    home_moneyline: int | None = None
    game_date: str | None = None
    sportsbook: str | None = None
    board: WnbaOddsBoard | None = None


class WnbaOddsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: str
    sportsbook: str = "draftkings"
    games: list[WnbaOddsGame] = Field(default_factory=list)
    book_boards: list[WnbaOddsGame] = Field(default_factory=list)
    error: str | None = None
