"""Season averages from cached NBA/WNBA player and team advanced game logs.

Rates are possession-weighted. A short stint should not count the same as a
full game. Regular-season and playoff rows win; preseason is used only when
a player or team has no other games in the cache.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.domains.betting.player_match_keys import match_player_key
from app.domains.betting.season_log_cache import read_cached_logs

logger = logging.getLogger(__name__)

# ESPN spells a few NBA tricodes differently from stats.nba.com.
_NBA_STATS_ABBREV = {
    "GS": "GSW",
    "NO": "NOP",
    "NY": "NYK",
    "PHO": "PHX",
    "SA": "SAS",
    "UTAH": "UTA",
    "WSH": "WAS",
}

_PLAYER_RATES = (
    ("usg_pct", "USG_PCT"),
    ("efg_pct", "EFG_PCT"),
    ("ts_pct", "TS_PCT"),
    ("ast_pct", "AST_PCT"),
    ("oreb_pct", "OREB_PCT"),
    ("dreb_pct", "DREB_PCT"),
    ("reb_pct", "REB_PCT"),
    ("pie", "PIE"),
)
_PLAYER_RATINGS = (
    ("ast_to", "AST_TO"),
    ("off_rtg", "OFF_RATING"),
    ("def_rtg", "DEF_RATING"),
    ("net_rtg", "NET_RATING"),
)
_TEAM_RATES = (
    ("efg_pct", "EFG_PCT", False),
    ("ts_pct", "TS_PCT", False),
    ("ast_pct", "AST_PCT", False),
    ("oreb_pct", "OREB_PCT", False),
    ("dreb_pct", "DREB_PCT", False),
    ("reb_pct", "REB_PCT", False),
    ("pie", "PIE", False),
)
_TEAM_RATINGS = (
    ("ast_to", "AST_TO", False),
    ("off_rtg", "OFF_RATING", False),
    ("def_rtg", "DEF_RATING", True),
    ("net_rtg", "NET_RATING", False),
    ("pace", "PACE", False),
)

AdvancedStats = dict[str, str | int | None]


def canonical_nba_abbrev(abbrev: str) -> str:
    """Map an ESPN or stats.nba.com tricode onto the cache spelling."""
    upper = str(abbrev or "").strip().upper()
    return _NBA_STATS_ABBREV.get(upper, upper)


def load_player_advanced(league: str) -> dict[str, AdvancedStats]:
    """Player advanced displays from the on-disk season-log cache."""
    return player_advanced_index(_cached_rows(league, "player_adv"))


def load_team_advanced(
    league: str,
    *,
    canonicalize: Callable[[str], str] | None = None,
) -> dict[str, AdvancedStats]:
    """Team advanced displays from the on-disk season-log cache."""
    return team_advanced_index(
        _cached_rows(league, "team_adv"),
        canonicalize=canonicalize,
    )


def _cached_rows(league: str, key: str) -> list[Any]:
    try:
        logs = read_cached_logs(league)
    except Exception as exc:
        logger.warning("season log cache unreadable league=%s: %s", league, exc)
        return []
    rows = logs.get(key) or []
    return rows if isinstance(rows, list) else []


def player_advanced_index(rows: list[Any]) -> dict[str, AdvancedStats]:
    """Map a match-player key to possession-weighted advanced displays."""
    index: dict[str, AdvancedStats] = {}
    for key, grouped in _group(rows, _player_key).items():
        chosen = _competitive_or_all(grouped)
        stats: AdvancedStats = {}
        for field, source in _PLAYER_RATES:
            display = _percent(_weighted_mean(chosen, source))
            if display is not None:
                stats[field] = display
        for field, source in _PLAYER_RATINGS:
            display = _points(_weighted_mean(chosen, source))
            if display is not None:
                stats[field] = display
        turnover = _points(_weighted_mean(chosen, "TM_TOV_PCT", transform=_turnover_points))
        if turnover is not None:
            stats["tov_pct"] = turnover
        if stats:
            index[key] = stats
    return index


def team_advanced_index(
    rows: list[Any],
    *,
    canonicalize: Callable[[str], str] | None = None,
) -> dict[str, AdvancedStats]:
    """Map a canonical team abbreviation to advanced displays and league ranks."""
    spell = canonicalize or _upper
    numeric: dict[str, dict[str, float]] = {}
    for key, grouped in _group(rows, lambda row: _team_key(row, spell)).items():
        chosen = _competitive_or_all(grouped)
        values: dict[str, float] = {}
        for field, source, _lower in _TEAM_RATES:
            value = _weighted_mean(chosen, source)
            if value is not None:
                values[field] = value * 100
        for field, source, _lower in _TEAM_RATINGS:
            value = _weighted_mean(chosen, source)
            if value is not None:
                values[field] = value
        turnover = _weighted_mean(chosen, "TM_TOV_PCT", transform=_turnover_points)
        if turnover is not None:
            values["tov_pct"] = turnover
        if values:
            numeric[key] = values

    specs = [(field, lower) for field, _source, lower in (*_TEAM_RATES, *_TEAM_RATINGS)]
    specs.append(("tov_pct", True))
    ranks = {
        field: _ranks(
            {abbrev: values[field] for abbrev, values in numeric.items() if field in values},
            lower_is_better=lower,
        )
        for field, lower in specs
    }

    index: dict[str, AdvancedStats] = {}
    for abbrev, values in numeric.items():
        stats: AdvancedStats = {}
        for field, number in values.items():
            stats[field] = _points(number)
            rank = ranks[field].get(abbrev)
            if rank is not None:
                stats[f"{field}_rank"] = rank
        index[abbrev] = stats
    return index


def _player_key(row: dict[str, Any]) -> str:
    return match_player_key(str(row.get("PLAYER_NAME") or ""))


def _team_key(row: dict[str, Any], canonicalize: Callable[[str], str]) -> str:
    abbrev = str(row.get("TEAM_ABBREVIATION") or "").strip()
    if not abbrev:
        return ""
    return canonicalize(abbrev).strip().upper()


def _upper(abbrev: str) -> str:
    return abbrev.strip().upper()


def _group(rows: list[Any], key_fn: Callable[[dict[str, Any]], str]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = key_fn(row)
        if not key:
            continue
        grouped.setdefault(key, []).append(row)
    return grouped


def _competitive_or_all(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    competitive = [row for row in rows if row.get("SEASON_TYPE") != "Pre Season"]
    return competitive or rows


def _finite(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def _possessions(row: dict[str, Any]) -> float | None:
    possessions = _finite(row.get("POSS"))
    if possessions is None or possessions <= 0:
        return None
    return possessions


def _weighted_mean(
    rows: list[dict[str, Any]],
    field: str,
    *,
    transform: Callable[[float], float] | None = None,
) -> float | None:
    weighted = 0.0
    weight = 0.0
    unweighted: list[float] = []
    for row in rows:
        raw = _finite(row.get(field))
        if raw is None:
            continue
        value = transform(raw) if transform else raw
        possessions = _possessions(row)
        if possessions is None:
            unweighted.append(value)
            continue
        weighted += value * possessions
        weight += possessions
    if weight > 0:
        return weighted / weight
    if not unweighted:
        return None
    return sum(unweighted) / len(unweighted)


def _turnover_points(raw: float) -> float:
    # Player logs store TOV% as 4.2; team logs store the same stat as 0.175.
    if abs(raw) > 1:
        return raw
    return raw * 100


def _percent(fraction: float | None) -> str | None:
    if fraction is None:
        return None
    return _points(fraction * 100)


def _points(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{value:.1f}"


def _ranks(values: dict[str, float], *, lower_is_better: bool) -> dict[str, int]:
    ordered = sorted(values, key=lambda key: values[key], reverse=not lower_is_better)
    ranks: dict[str, int] = {}
    index = 0
    while index < len(ordered):
        tie_end = index + 1
        while tie_end < len(ordered) and values[ordered[tie_end]] == values[ordered[index]]:
            tie_end += 1
        for tied in range(index, tie_end):
            ranks[ordered[tied]] = index + 1
        index = tie_end
    return ranks
