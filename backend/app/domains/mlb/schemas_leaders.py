from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

MlbLeaderCategoryKey = Literal[
    "avg",
    "hr",
    "rbi",
    "sb",
    "ops",
    "hits",
    "era",
    "whip",
    "so",
    "w",
    "sv",
    "ip",
]


class MlbLeaderRow(BaseModel):
    rank: int
    player_id: str
    name: str
    team_abbrev: str
    gp: int | None = None
    value: str


class MlbLeaderCategory(BaseModel):
    key: MlbLeaderCategoryKey
    label: str
    stat: str
    leaders: list[MlbLeaderRow]


class MlbLeadersResponse(BaseModel):
    season: int
    pace: Literal["season"] = "season"
    categories: list[MlbLeaderCategory]
