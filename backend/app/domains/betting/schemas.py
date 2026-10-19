"""Schemas owned by the cross-sport betting domain."""

from app.domains.betting.schemas_props import (
    PROP_SPORTSBOOKS,
    WnbaPropBookQuote,
    WnbaPropLine,
    WnbaPropsResponse,
)
from app.schemas.odds import WnbaOddsGame, WnbaOddsResponse

__all__ = [
    "PROP_SPORTSBOOKS",
    "WnbaOddsGame",
    "WnbaOddsResponse",
    "WnbaPropBookQuote",
    "WnbaPropLine",
    "WnbaPropsResponse",
]
