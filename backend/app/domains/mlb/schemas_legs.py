"""Response schemas for GET /api/mlb/legs (OpenAPI names)."""

from app.domains.betting.schemas_legs import (
    LegsBookExcluded,
    LegsBookUsed,
    LegsEntry,
    LegsPlay,
    LegsRejectedSummary,
    LegsResponse,
)


class MlbLegsBookExcluded(LegsBookExcluded):
    pass


class MlbLegsBookUsed(LegsBookUsed):
    pass


class MlbLegsRejectedSummary(LegsRejectedSummary):
    pass


class MlbLegsPlay(LegsPlay):
    pass


class MlbLegsEntry(LegsEntry):
    pass


class MlbLegsResponse(LegsResponse):
    pass
