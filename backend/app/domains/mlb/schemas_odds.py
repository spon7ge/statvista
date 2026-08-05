from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbOddsBoardLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    line: float
    price: int | None = None


class MlbOddsBoardTotal(BaseModel):
    model_config = _RESPONSE_CONFIG

    side: Literal["over", "under"]
    line: float
    price: int | None = None


class MlbOddsBoardSide(BaseModel):
    model_config = _RESPONSE_CONFIG

    moneyline: int | None = None
    spread: MlbOddsBoardLine | None = None
    total: MlbOddsBoardTotal | None = None


class MlbOddsBoard(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: MlbOddsBoardSide
    home: MlbOddsBoardSide


class MlbOddsGame(BaseModel):
    model_config = _RESPONSE_CONFIG

    home_abbrev: str
    away_abbrev: str
    spread_team_abbrev: str | None = None
    spread_line: float | None = None
    total: float | None = None
    game_date: str | None = None
    sportsbook: str | None = None
    board: MlbOddsBoard | None = None


class MlbOddsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: str
    sportsbook: str = "draftkings"
    games: list[MlbOddsGame] = Field(default_factory=list)
    error: str | None = None
