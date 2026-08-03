"""Shared MLB team name → abbreviation helpers for odds providers."""

from __future__ import annotations

import re

_TRICODE_RE = re.compile(r"^[A-Z]{2,3}$")

NAME_TO_ABBREV = {
    "arizona diamondbacks": "AZ",
    "atlanta braves": "ATL",
    "baltimore orioles": "BAL",
    "boston red sox": "BOS",
    "chicago cubs": "CHC",
    "chicago white sox": "CWS",
    "cincinnati reds": "CIN",
    "cleveland guardians": "CLE",
    "colorado rockies": "COL",
    "detroit tigers": "DET",
    "houston astros": "HOU",
    "kansas city royals": "KC",
    "los angeles angels": "LAA",
    "los angeles dodgers": "LAD",
    "miami marlins": "MIA",
    "milwaukee brewers": "MIL",
    "minnesota twins": "MIN",
    "new york mets": "NYM",
    "new york yankees": "NYY",
    "oakland athletics": "ATH",
    "athletics": "ATH",
    "philadelphia phillies": "PHI",
    "pittsburgh pirates": "PIT",
    "san diego padres": "SD",
    "san francisco giants": "SF",
    "seattle mariners": "SEA",
    "st. louis cardinals": "STL",
    "st louis cardinals": "STL",
    "tampa bay rays": "TB",
    "texas rangers": "TEX",
    "toronto blue jays": "TOR",
    "washington nationals": "WSH",
}


def abbrev_from_team_name(label: str | None) -> str | None:
    """Map a full team name or leading tricode to an MLB abbrev."""
    text = str(label or "").strip()
    if not text:
        return None

    mapped = NAME_TO_ABBREV.get(text.lower())
    if mapped:
        return mapped

    first = text.split()[0].upper()
    if _TRICODE_RE.match(first):
        return first

    return None
