from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

LeagueKey = Literal["al", "nl"]


class MlbStandingsRow(BaseModel):
    rank: int
    team_id: str
    abbrev: str
    name: str
    logo_url: str | None
    wins: int
    losses: int
    wl: str
    pct: str
    gb: str
    l10: str
    streak: str


class MlbStandingsDivision(BaseModel):
    key: str
    label: str
    teams: list[MlbStandingsRow]


class MlbStandingsLeague(BaseModel):
    key: LeagueKey
    label: str
    divisions: list[MlbStandingsDivision]


class MlbStandingsResponse(BaseModel):
    season: int
    leagues: list[MlbStandingsLeague]
