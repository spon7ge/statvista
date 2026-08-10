"""Official WNBA primary brand colors by common tricodes."""

from __future__ import annotations

WNBA_TEAM_COLORS: dict[str, str] = {
    "ATL": "#E31837",
    "CHI": "#5091CD",
    "CON": "#E03A3E",
    "CONN": "#E03A3E",
    "DAL": "#C4D600",
    "GS": "#37004D",
    "GSV": "#37004D",
    "IND": "#E03A3E",
    "LA": "#552583",
    "LAS": "#552583",
    "LV": "#C8102E",
    "LVA": "#C8102E",
    "MIN": "#236192",
    "NY": "#86CEBC",
    "NYL": "#86CEBC",
    "PHO": "#201747",
    "PHX": "#201747",
    "SEA": "#2C5234",
    "TOR": "#B4975A",
    "WAS": "#0C2340",
    "WSH": "#0C2340",
}


def team_color(abbrev: str | None) -> str | None:
    if not abbrev or not isinstance(abbrev, str):
        return None
    return WNBA_TEAM_COLORS.get(abbrev.strip().upper())
