"""Response schemas for GET /api/mlb/props/game/{game_pk}."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbGamePropBestQuote(BaseModel):
    model_config = _RESPONSE_CONFIG
    american: int
    book: str


class MlbGamePropPlayer(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_name: str
    team_abbrev: str | None = None
    headshot_url: str | None = None
    line: float
    over: MlbGamePropBestQuote | None = None
    under: MlbGamePropBestQuote | None = None


class MlbGamePropCategory(BaseModel):
    model_config = _RESPONSE_CONFIG
    stat: str
    label: str
    players: list[MlbGamePropPlayer] = Field(default_factory=list)


class MlbGamePropsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    as_of: str
    app: str
    game_pk: str
    away_abbrev: str
    home_abbrev: str
    categories: list[MlbGamePropCategory] = Field(default_factory=list)
    error: str | None = None
