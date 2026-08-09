"""Response schemas for GET /api/mlb/props/today."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domains.mlb.prop_fair import SourceTier

Side = Literal["over", "under"]

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbPropBookQuote(BaseModel):
    """A single book's quote at the row's exact line, for the display side."""

    model_config = _RESPONSE_CONFIG

    side: Side
    fair_pct: float | None = None
    american: int | None = None
    changed_at: str | None = None
    role: Literal["comparison"] | None = None


class MlbPropBooks(BaseModel):
    model_config = _RESPONSE_CONFIG

    prophetx: MlbPropBookQuote | None = None
    novig: MlbPropBookQuote | None = None
    kalshi: MlbPropBookQuote | None = None
    draftkings: MlbPropBookQuote | None = None
    fanduel: MlbPropBookQuote | None = None
    pinnacle: MlbPropBookQuote | None = None
    betmgm: MlbPropBookQuote | None = None
    betonline: MlbPropBookQuote | None = None


class MlbPropDfs(BaseModel):
    model_config = _RESPONSE_CONFIG

    line: float
    changed_at: str | None = None
    american: int | None = None
    payout_multiplier: float | None = None


class MlbPropRow(BaseModel):
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
    books: MlbPropBooks = Field(default_factory=MlbPropBooks)
    dfs: MlbPropDfs
    fair_explain: str


class MlbPropsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: str
    app: str
    format: str
    legs: int
    breakeven_pct: float
    props: list[MlbPropRow] = Field(default_factory=list)
    error: str | None = None
