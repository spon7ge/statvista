"""Response schemas for GET /api/wnba/props/board."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Side = Literal["over", "under"]
HomeAway = Literal["home", "away"]
_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class WnbaPropBoardBookChip(BaseModel):
    model_config = _RESPONSE_CONFIG

    book: str
    american: int | None = None
    url: str | None = None
    # Unused on the board (Odds shows raw implied from `american`). Always null.
    devig_pct: int | None = None
    # Sportsbook main for this player+stat; may differ from the row's DFS line.
    line: float | None = None
    over_american: int | None = None
    under_american: int | None = None


class WnbaPropBoardRow(BaseModel):
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
    game_id: str | None = None
    game_start_at: datetime | None = None
    dfs: list[WnbaPropBoardBookChip] = Field(default_factory=list)
    books: list[WnbaPropBoardBookChip] = Field(default_factory=list)
    # Average raw implied of Odds Americans (not de-vigged).
    ip_pct: int | None = None
    opp_def_rank: int | None = None
    opp_def_label: str | None = None
    opp_pace_rank: int | None = None
    opp_pace_label: str | None = None
    hit_l5: int | None = None
    hit_l10: int | None = None
    hit_l15: int | None = None
    hit_h2h: int | None = None


class WnbaPropBoardResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: datetime
    warnings: list[str] = Field(default_factory=list)
    rows: list[WnbaPropBoardRow] = Field(default_factory=list)
