"""Response schemas for GET /api/wnba/legs (OpenAPI names)."""

from app.domains.betting.schemas_legs import (
    LegsBookExcluded,
    LegsBookUsed,
    LegsEntry,
    LegsPlay,
    LegsRejectedSummary,
    LegsResponse,
)


class WnbaLegsBookExcluded(LegsBookExcluded):
    pass


class WnbaLegsBookUsed(LegsBookUsed):
    pass


class WnbaLegsRejectedSummary(LegsRejectedSummary):
    pass


class WnbaLegsPlay(LegsPlay):
    pass


class WnbaLegsEntry(LegsEntry):
    pass


class WnbaLegsResponse(LegsResponse):
    pass
