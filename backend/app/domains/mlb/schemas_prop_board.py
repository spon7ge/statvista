"""Response schemas for GET /api/mlb/props/board."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Side = Literal["over", "under"]
HomeAway = Literal["home", "away"]
_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbPropBoardBookChip(BaseModel):
    model_config = _RESPONSE_CONFIG

    book: str
    american: int | None = None
    url: str | None = None


class MlbPropBoardRow(BaseModel):
    model_config = _RESPONSE_CONFIG

    player_name: str
    headshot_url: str | None = None
    team_abbrev: str | None = None
    opponent_abbrev: str | None = None
    home_away: HomeAway | None = None
    stat: str
    market_label: str
    side: Side
    line: float
    game_pk: int | None = None
    game_start_at: datetime | None = None
    dfs: list[MlbPropBoardBookChip] = Field(default_factory=list)
    books: list[MlbPropBoardBookChip] = Field(default_factory=list)
    ip_pct: int | None = None
    opp_def_rank: int | None = None
    opp_def_label: str | None = None
    opp_pace_rank: int | None = None
    opp_pace_label: str | None = None
    hit_l5: int | None = None
    hit_l10: int | None = None
    hit_l15: int | None = None
    hit_h2h: int | None = None


class MlbPropBoardResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: datetime
    warnings: list[str] = Field(default_factory=list)
    rows: list[MlbPropBoardRow] = Field(default_factory=list)
