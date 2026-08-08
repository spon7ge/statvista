from __future__ import annotations

from pydantic import BaseModel


class MlbFuturesEntry(BaseModel):
    team_id: str
    abbrev: str
    name: str
    logo_url: str | None
    odds_american: str


class MlbFuturesMarket(BaseModel):
    id: str
    name: str
    display_name: str
    provider: str
    entries: list[MlbFuturesEntry]


class MlbFuturesResponse(BaseModel):
    season: int
    as_of: str
    markets: list[MlbFuturesMarket]
    error: str | None = None
