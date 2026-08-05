"""Shared WNBA team name / tricode canonicalization.

Both the WNBA and betting domains (and several providers) need to resolve
ESPN/Sharp/Pinnacle tricode spellings to the canonical stats.wnba.com
abbreviation so games and props from different vendors merge on the same
key. This lives in ``core`` (not a domain) because domains must not import
each other and providers must not import domains.
"""

from __future__ import annotations

import re

_TRICODE_RE = re.compile(r"^[A-Z]{2,3}$")

# Vendors spell a handful of tricodes differently. Canonical form is the
# stats.wnba.com spelling so ESPN / Sharp / Pinnacle rows merge identically.
_ABBREV_ALIASES = {
    "GS": "GSV",
    "LA": "LAS",
    "LV": "LVA",
    "NY": "NYL",
    "PHX": "PHO",
    "POR": "PDX",
    "CONN": "CON",
    "WSH": "WAS",
}

NAME_TO_ABBREV = {
    "atlanta dream": "ATL",
    "atl dream": "ATL",
    "chicago sky": "CHI",
    "chi sky": "CHI",
    "connecticut sun": "CON",
    "con sun": "CON",
    "dallas wings": "DAL",
    "dal wings": "DAL",
    "golden state valkyries": "GSV",
    "gs valkyries": "GSV",
    "indiana fever": "IND",
    "ind fever": "IND",
    "las vegas aces": "LVA",
    "lv aces": "LVA",
    "los angeles sparks": "LAS",
    "la sparks": "LAS",
    "minnesota lynx": "MIN",
    "min lynx": "MIN",
    "new york liberty": "NYL",
    "ny liberty": "NYL",
    "toronto tempo": "TOR",
    "tor tempo": "TOR",
    "phoenix mercury": "PHO",
    "phx mercury": "PHO",
    "portland fire": "PDX",
    "por fire": "PDX",
    "pdx fire": "PDX",
    "seattle storm": "SEA",
    "sea storm": "SEA",
    "washington mystics": "WAS",
    "was mystics": "WAS",
    "wsh mystics": "WAS",
}


def canonical_abbrev(abbrev: str) -> str:
    """Map a WNBA tricode to the shared stats.wnba.com spelling."""
    upper = str(abbrev or "").strip().upper()
    return _ABBREV_ALIASES.get(upper, upper)


def abbrev_from_team_name(label: str | None) -> str | None:
    """Map a full team name or leading tricode to a canonical WNBA abbrev."""
    text = str(label or "").strip()
    if not text:
        return None

    mapped = NAME_TO_ABBREV.get(text.lower())
    if mapped:
        return canonical_abbrev(mapped)

    first = text.split()[0].upper()
    if _TRICODE_RE.match(first):
        return canonical_abbrev(first)

    return None
