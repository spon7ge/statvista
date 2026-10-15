from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GameStatus = Literal["scheduled", "live", "halftime", "final"]

# Response models always serialize defaults; mark them required in OpenAPI so
# openapi-typescript emits `T | null` instead of `T | null | undefined`.
_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class NbaTeam(BaseModel):
    model_config = _RESPONSE_CONFIG

    abbrev: str
    name: str
    score: int | None = None
    record: str | None = None
    logo_url: str | None = None


class NbaGame(BaseModel):
    model_config = _RESPONSE_CONFIG

    id: str
    espn_event_id: str | None = None
    league: Literal["nba"] = "nba"
    status: GameStatus
    status_label: str
    away: NbaTeam
    home: NbaTeam
    start_time_et: str
    venue: str | None = None
    venue_city: str | None = None


class NbaScoreboardResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    date: str = Field(description="YYYY-MM-DD in America/New_York")
    games: list[NbaGame]
    fetched_at: str
