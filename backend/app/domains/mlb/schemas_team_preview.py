"""Response schemas for GET /api/mlb/games/{game_pk}/team-preview."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)

TeamLeaderKey = Literal["hr", "avg", "ops", "era", "so", "whip"]


class MlbTeamLeaderCard(BaseModel):
    model_config = _RESPONSE_CONFIG
    key: TeamLeaderKey
    label: str
    rank: int | None = None
    value: str
    player_id: str
    last_name: str
    headshot_url: str | None = None


class MlbTeamBatterSeasonRow(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_id: str
    name: str
    g: int | None = None
    avg: str | None = None
    obp: str | None = None
    slg: str | None = None
    ops: str | None = None
    ab: int | None = None
    r: int | None = None
    h: int | None = None
    hr: int | None = None
    rbi: int | None = None
    bb: int | None = None
    so: int | None = None
    sb: int | None = None


class MlbTeamPitcherSeasonRow(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_id: str
    name: str
    g: int | None = None
    gs: int | None = None
    w: int | None = None
    l: int | None = None
    sv: int | None = None
    ip: str | None = None
    h: int | None = None
    er: int | None = None
    bb: int | None = None
    so: int | None = None
    era: str | None = None
    whip: str | None = None


class MlbTeamPreviewTeam(BaseModel):
    model_config = _RESPONSE_CONFIG
    id: str
    abbrev: str
    name: str
    logo_url: str | None = None


class MlbTeamPreviewResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    side: Literal["away", "home"]
    team: MlbTeamPreviewTeam
    batting_leaders: list[MlbTeamLeaderCard] = Field(default_factory=list)
    pitching_leaders: list[MlbTeamLeaderCard] = Field(default_factory=list)
    batting_roster: list[MlbTeamBatterSeasonRow] = Field(default_factory=list)
    pitching_roster: list[MlbTeamPitcherSeasonRow] = Field(default_factory=list)
