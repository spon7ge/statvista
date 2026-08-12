"""Response schemas for GET /api/wnba/props/today (+EV prop picks board)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domains.wnba.prop_fair import SourceTier

Side = Literal["over", "under"]

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class WnbaPropBookQuote(BaseModel):
    """A single book's quote at the row's exact line, for the display side."""

    model_config = _RESPONSE_CONFIG

    side: Side
    fair_pct: float | None = None
    american: int | None = None
    changed_at: str | None = None
    role: Literal["comparison"] | None = None


class WnbaPropBooks(BaseModel):
    model_config = _RESPONSE_CONFIG

    prophetx: WnbaPropBookQuote | None = None
    novig: WnbaPropBookQuote | None = None
    draftkings: WnbaPropBookQuote | None = None
    fanduel: WnbaPropBookQuote | None = None
    pinnacle: WnbaPropBookQuote | None = None


class WnbaPropDfs(BaseModel):
    model_config = _RESPONSE_CONFIG

    line: float
    changed_at: str | None = None
    american: int | None = None
    payout_multiplier: float | None = None


class WnbaPropRow(BaseModel):
    model_config = _RESPONSE_CONFIG

    player_name: str
    team_abbrev: str | None = None
    headshot_url: str | None = None
    position: str | None = None
    stat: str
    line: float
    recommended_side: Side | None = None
    fair_pct: float | None = None
    edge_pct: float | None = None
    alt_edge_pct: float | None = None
    source_tier: SourceTier
    confidence_chips: list[str] = Field(default_factory=list)
    sample_chips: list[str] = Field(default_factory=list)
    recency_chip: str | None = None
    books: WnbaPropBooks = Field(default_factory=WnbaPropBooks)
    dfs: WnbaPropDfs
    fair_explain: str
    commence_time: str | None = None


class WnbaPropPicksResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: str
    app: str
    format: str
    legs: int
    breakeven_pct: float
    props: list[WnbaPropRow] = Field(default_factory=list)
    error: str | None = None
