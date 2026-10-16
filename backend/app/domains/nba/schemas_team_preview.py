"""Response schemas for GET /api/nba/games/{espn_event_id}/team-preview."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)

TeamLeaderKey = Literal["ppg", "rpg", "apg", "bpg", "spg"]


class NbaTeamLeaderCard(BaseModel):
    model_config = _RESPONSE_CONFIG
    key: TeamLeaderKey
    label: str
    rank: int | None = None
    value: str
    player_id: str
    last_name: str
    headshot_url: str | None = None


class NbaTeamRosterRow(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_id: str
    name: str
    jersey: str | None = None
    position: str | None = None
    gp: int | None = None
    min: str | None = None
    pts: str | None = None
    reb: str | None = None
    ast: str | None = None
    stl: str | None = None
    blk: str | None = None
    to: str | None = None
    fg_pct: str | None = None
    fg3_pct: str | None = None
    ft_pct: str | None = None
    sh_eff: str | None = None
    sc_eff: str | None = None
    ppep: str | None = None
    rtg: str | None = None
    plus_minus: str | None = None
    headshot_url: str | None = None


class NbaTeamPreviewTeam(BaseModel):
    model_config = _RESPONSE_CONFIG
    id: str
    abbrev: str
    name: str
    logo_url: str | None = None


class NbaTeamPreviewResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    side: Literal["away", "home"]
    team: NbaTeamPreviewTeam
    leaders: list[NbaTeamLeaderCard] = Field(default_factory=list)
    roster: list[NbaTeamRosterRow] = Field(default_factory=list)
