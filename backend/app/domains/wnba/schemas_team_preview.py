"""Response schemas for GET /api/wnba/games/{espn_event_id}/team-preview."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)

TeamLeaderKey = Literal["ppg", "rpg", "apg"]


class WnbaTeamLeaderCard(BaseModel):
    model_config = _RESPONSE_CONFIG
    key: TeamLeaderKey
    label: str
    rank: int | None = None
    value: str
    player_id: str
    last_name: str
    headshot_url: str | None = None


class WnbaTeamRosterRow(BaseModel):
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
    headshot_url: str | None = None


class WnbaTeamPreviewTeam(BaseModel):
    model_config = _RESPONSE_CONFIG
    id: str
    abbrev: str
    name: str
    logo_url: str | None = None


class WnbaTeamPreviewResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    side: Literal["away", "home"]
    team: WnbaTeamPreviewTeam
    leaders: list[WnbaTeamLeaderCard] = Field(default_factory=list)
    roster: list[WnbaTeamRosterRow] = Field(default_factory=list)
