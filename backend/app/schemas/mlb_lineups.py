from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbLineupPitcher(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str | None = None
    hand: str | None = None
    record: str | None = None
    era: str | None = None


class MlbLineupBatter(BaseModel):
    model_config = _RESPONSE_CONFIG

    order: int
    position: str | None = None
    name: str | None = None
    hand: str | None = None


class MlbLineupSide(BaseModel):
    model_config = _RESPONSE_CONFIG

    pitcher: MlbLineupPitcher
    batters: list[MlbLineupBatter]


class MlbLineupGame(BaseModel):
    model_config = _RESPONSE_CONFIG

    away_abbrev: str
    home_abbrev: str
    status: str | None = None
    away: MlbLineupSide
    home: MlbLineupSide


class MlbLineupsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    date: str = Field(description="YYYY-MM-DD in America/New_York")
    games: list[MlbLineupGame]
    source: str = "rotowire"
    fetched_at: str


class MlbVsPitcherStats(BaseModel):
    model_config = _RESPONSE_CONFIG

    ab: int | None = None
    h: int | None = None
    hr: int | None = None
    avg: str | None = None


class MlbLineupMatchupPitcher(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str | None = None
    hand: str | None = None
    mlbam_id: int | None = None
    wins: int | None = None
    losses: int | None = None
    era: str | None = None
    innings_pitched: str | None = None
    strikeouts: int | None = None
    whip: str | None = None


class MlbLineupMatchupBatter(BaseModel):
    model_config = _RESPONSE_CONFIG

    order: int
    position: str | None = None
    name: str | None = None
    hand: str | None = None
    mlbam_id: int | None = None
    vs_pitcher: MlbVsPitcherStats | None = None


class MlbLineupMatchupSide(BaseModel):
    model_config = _RESPONSE_CONFIG

    pitcher: MlbLineupMatchupPitcher
    batters: list[MlbLineupMatchupBatter]


class MlbLineupMatchupResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    date: str = Field(description="YYYY-MM-DD in America/New_York")
    away_abbrev: str | None = None
    home_abbrev: str | None = None
    status: str | None = None
    away: MlbLineupMatchupSide | None = None
    home: MlbLineupMatchupSide | None = None
    source: str = "rotowire+statsapi"
    fetched_at: str
