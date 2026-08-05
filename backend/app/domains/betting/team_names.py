"""WNBA team name -> abbreviation helpers used by the betting domain.

The canonical alias table is shared with ``domains.wnba`` and several
providers, so it lives in ``app.core.wnba_abbrevs``. This module re-exports
it under the historical name so existing betting-domain callers are
unaffected.
"""

from __future__ import annotations

from app.core.wnba_abbrevs import (
    NAME_TO_ABBREV,
    abbrev_from_team_name,
    canonical_abbrev,
)

__all__ = ["NAME_TO_ABBREV", "abbrev_from_team_name", "canonical_abbrev"]
