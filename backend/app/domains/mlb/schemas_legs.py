"""Response schemas for GET /api/mlb/legs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Side = Literal["over", "under"]
DevigMethod = Literal["multiplicative", "power"]
SharpAnchor = Literal["pinnacle", "exchange_only"]
_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbLegsRejectedSummary(BaseModel):
    model_config = _RESPONSE_CONFIG

    insufficient_coverage: int
    insufficient_sharp: int
    below_threshold: int
    unpriceable_payout: int


class MlbLegsBookUsed(BaseModel):
    model_config = _RESPONSE_CONFIG

    book: str
    line: float
    over: int
    under: int
    hold: float
    devig: DevigMethod
    weight: float
    devigged_prob: float


class MlbLegsBookExcluded(BaseModel):
    model_config = _RESPONSE_CONFIG

    book: str
    reason: str


class MlbLegsPlay(BaseModel):
    model_config = _RESPONSE_CONFIG

    rank: int
    player: str
    team: str
    matchup: str
    market: str
    dfs_line: float
    side: Side
    variant: Literal["standard"]
    game_id: str | None = None
    sharp_anchor: SharpAnchor
    fair_prob: float
    break_even: float
    required_margin_pts: float
    margin_pts: float
    book_disagreement_pts: float
    payout_multiplier: float
    books_used: list[MlbLegsBookUsed] = Field(default_factory=list)
    books_excluded: list[MlbLegsBookExcluded] = Field(default_factory=list)


class MlbLegsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    generated_at: datetime
    slate: str
    app: str
    format: str
    payouts_assumed: bool = True
    base_break_even: float
    break_even_min: float | None = None
    break_even_max: float | None = None
    base_required_margin_pts: float
    dfs_snapshot_age_minutes: float | None = None
    lines_seeded: int
    legs_evaluated: int
    legs_surfaced: int
    coverage_funnel_ratio: float | None = None
    flex_same_game_warning: bool
    legs: list[MlbLegsPlay] = Field(default_factory=list)
    rejected_summary: MlbLegsRejectedSummary
    warnings: list[str] = Field(default_factory=list)
    disclaimers: list[str] = Field(default_factory=list)
