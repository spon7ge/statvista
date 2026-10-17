"""L5 / L10 / L15 hit rates from NBA player game logs."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from app.domains.nba.schemas_prop_board import Side

_WINDOWS: tuple[int, int, int] = (5, 10, 15)

_DIRECT_FIELDS: dict[str, str] = {
    "points": "PTS",
    "rebounds": "REB",
    "assists": "AST",
    "threes": "FG3M",
}

_COMBO_FIELDS: dict[str, tuple[str, ...]] = {
    "pts_rebs": ("PTS", "REB"),
    "pts_asts": ("PTS", "AST"),
    "rebs_asts": ("REB", "AST"),
    "pts_rebs_asts": ("PTS", "REB", "AST"),
}

_MATCHUP_OPP = re.compile(
    r"(?:vs\.?|@)\s+([A-Za-z]{2,4})\s*$",
    re.IGNORECASE,
)


# ESPN scoreboard tricodes that differ from stats.nba.com matchup tricodes.
_ABBREV_ALIASES = {
    "GS": "GSW",
    "NO": "NOP",
    "NY": "NYK",
    "SA": "SAS",
    "UTAH": "UTA",
    "WSH": "WAS",
    "PHO": "PHX",
    "BRK": "BKN",
    "CHO": "CHA",
}


def canonical_abbrev(abbrev: str) -> str | None:
    text = str(abbrev or "").strip().upper()
    if not text:
        return None
    return _ABBREV_ALIASES.get(text, text)


def _stat_blob(split: dict[str, Any]) -> dict[str, Any]:
    stat = split.get("stat")
    return stat if isinstance(stat, dict) else split


def _num(raw: Any) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def actual_for_stat(stat: str, split: dict[str, Any]) -> float | None:
    blob = _stat_blob(split)
    combo = _COMBO_FIELDS.get(stat)
    if combo is not None:
        parts = tuple(_num(blob.get(field)) for field in combo)
        if any(part is None for part in parts):
            return None
        return sum(part for part in parts if part is not None)
    field = _DIRECT_FIELDS.get(stat)
    if field is None:
        return None
    return _num(blob.get(field))


def _minutes(split: dict[str, Any]) -> float | None:
    blob = _stat_blob(split)
    return _num(blob.get("MIN"))


def qualifying_splits(splits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for split in splits:
        minutes = _minutes(split)
        if minutes is not None and minutes > 0:
            kept.append(split)
    return kept


def _window_pct(
    stat: str,
    side: Side,
    line: float,
    window: list[dict[str, Any]],
) -> int | None:
    if not window:
        return None
    hits = 0
    for split in window:
        actual = actual_for_stat(stat, split)
        if actual is None:
            return None
        if side == "over" and actual > line:
            hits += 1
        elif side == "under" and actual < line:
            hits += 1
    return int(round(hits / len(window) * 100))


def _date_key(split: dict[str, Any]) -> str:
    raw = split.get("GAME_DATE") or split.get("date")
    text = str(raw or "").strip()
    if not text:
        return ""
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return text
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return text


def hit_rates(
    stat: str,
    side: Side,
    line: float,
    splits: list[dict[str, Any]],
) -> tuple[int | None, int | None, int | None]:
    qualifying = qualifying_splits(splits)
    if not qualifying:
        return None, None, None
    newest_first = sorted(qualifying, key=_date_key, reverse=True)
    l5, l10, l15 = (
        _window_pct(stat, side, line, newest_first[:window]) for window in _WINDOWS
    )
    return l5, l10, l15


def opponent_abbrev_from_split(split: dict[str, Any]) -> str | None:
    stamped = canonical_abbrev(str(split.get("opponent_abbrev") or ""))
    if stamped:
        return stamped
    matchup = str(split.get("MATCHUP") or split.get("matchup") or "").strip()
    if not matchup:
        return None
    found = _MATCHUP_OPP.search(matchup)
    if found is None:
        return None
    return canonical_abbrev(found.group(1))


def h2h_rate(
    stat: str,
    side: Side,
    line: float,
    splits: list[dict[str, Any]],
    opponent_abbrev: str | None,
) -> int | None:
    """Calculate this side's hit rate against one opponent."""
    opponent = canonical_abbrev(str(opponent_abbrev or ""))
    if not opponent:
        return None
    against_opponent = [
        split
        for split in qualifying_splits(splits)
        if opponent_abbrev_from_split(split) == opponent
    ]
    return _window_pct(stat, side, line, against_opponent)
