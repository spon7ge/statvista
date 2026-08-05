"""Player list helpers used by /players (not ML feature tables)."""
from __future__ import annotations

from pydantic import BaseModel


class PlayerSummary(BaseModel):
    player_id: int
    player_name: str
    normalized_name: str
    team_abbreviation: str | None = None
    team_name: str | None = None
    career_game_count: int | None = None

    model_config = {"from_attributes": True}


class PlayerListResponse(BaseModel):
    count: int
    players: list[PlayerSummary]
