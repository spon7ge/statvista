"""Response schemas for GET /api/wnba/props/game/{espn_event_id}."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class WnbaGamePropBestQuote(BaseModel):
    model_config = _RESPONSE_CONFIG
    american: int
    book: str


class WnbaGamePropPlayer(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_name: str
    team_abbrev: str | None = None
    headshot_url: str | None = None
    line: float
    over: WnbaGamePropBestQuote | None = None
    under: WnbaGamePropBestQuote | None = None


class WnbaGamePropCategory(BaseModel):
    model_config = _RESPONSE_CONFIG
    stat: str
    label: str
    players: list[WnbaGamePropPlayer] = Field(default_factory=list)


class WnbaGamePropsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    as_of: str
    app: str
    espn_event_id: str
    away_abbrev: str
    home_abbrev: str
    categories: list[WnbaGamePropCategory] = Field(default_factory=list)
    error: str | None = None
