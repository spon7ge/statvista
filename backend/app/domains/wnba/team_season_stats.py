"""ESPN league team season stats + competition ranks for WNBA pregame."""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.domains.wnba.schemas_game_detail import (
    WnbaSeasonTeamStatLine,
    WnbaSeasonTeamStatsPair,
)

# Prefer site.web.api — site.api common/v3 byteam is often Access Denied.
ESPN_TEAM_STATS_URL = (
    "https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/statistics/byteam"
)
ESPN_TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 15 * 60.0
_ESPN_HEADERS = {"User-Agent": "Mozilla/5.0"}

# Curated response field → ESPN byteam `names` entry (first match wins).
_STAT_SPECS: tuple[tuple[str, str, bool, bool], ...] = (
    # field, espn_name, lower_is_better, is_pct_str
    ("pts", "avgPoints", False, False),
    ("fg_pct", "fieldGoalPct", False, True),
    ("fg3_pct", "threePointFieldGoalPct", False, True),
    ("ft_pct", "freeThrowPct", False, True),
    ("reb", "avgRebounds", False, False),
    ("ast", "avgAssists", False, False),
    ("stl", "avgSteals", False, False),
    ("blk", "avgBlocks", False, False),
    ("to", "avgTurnovers", True, False),
)

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def clear_team_season_stats_cache() -> None:
    """Clear cached ESPN byteam payloads for test isolation."""
    _cache.clear()


def competition_rank(
    values: list[tuple[str, float]],
    *,
    lower_is_better: bool,
) -> dict[str, int]:
    """Assign competition ranks (1 = best), leaving gaps after ties."""
    ordered = sorted(values, key=lambda item: item[1], reverse=not lower_is_better)
    ranks: dict[str, int] = {}
    index = 0
    while index < len(ordered):
        tie_end = index + 1
        while (
            tie_end < len(ordered)
            and ordered[tie_end][1] == ordered[index][1]
        ):
            tie_end += 1
        for tied_index in range(index, tie_end):
            ranks[ordered[tied_index][0]] = index + 1
        index = tie_end
    return ranks


def _numeric(raw: Any) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def _pct_display(totals: list[Any] | None, index: int, value: float) -> str:
    if isinstance(totals, list) and index < len(totals):
        raw = totals[index]
        if raw is not None and str(raw).strip() not in ("", "-"):
            return str(raw).strip()
    return f"{value:.1f}"


def _stat_locations(categories: list[Any]) -> dict[str, tuple[int, int]]:
    """Map ESPN stat name → (category_index, value_index) for first occurrence."""
    locations: dict[str, tuple[int, int]] = {}
    for cat_index, category in enumerate(categories):
        if not isinstance(category, dict):
            continue
        names = category.get("names") or []
        if not isinstance(names, list):
            continue
        for value_index, name in enumerate(names):
            key = str(name)
            if key and key not in locations:
                locations[key] = (cat_index, value_index)
    return locations


def _parse_team_values(
    team_block: dict[str, Any],
    locations: dict[str, tuple[int, int]],
) -> dict[str, float | str]:
    team_cats = team_block.get("categories") or []
    if not isinstance(team_cats, list):
        return {}

    out: dict[str, float | str] = {}
    for field, espn_name, _lower, is_pct in _STAT_SPECS:
        loc = locations.get(espn_name)
        if loc is None:
            continue
        cat_index, value_index = loc
        if cat_index >= len(team_cats) or not isinstance(team_cats[cat_index], dict):
            continue
        cat = team_cats[cat_index]
        values = cat.get("values") or []
        if not isinstance(values, list) or value_index >= len(values):
            continue
        numeric = _numeric(values[value_index])
        if numeric is None:
            continue
        if is_pct:
            totals = cat.get("totals") if isinstance(cat.get("totals"), list) else None
            out[field] = _pct_display(totals, value_index, numeric)
        else:
            # Per-game averages (PPG etc.) — one decimal matches ESPN display.
            out[field] = round(numeric, 1)
    return out


def normalize_season_team_stats_pair(
    payload: dict[str, Any],
    *,
    away_id: str,
    home_id: str,
) -> WnbaSeasonTeamStatsPair | None:
    """Normalize ESPN byteam statistics into away/home lines with league ranks."""
    away_key = str(away_id).strip()
    home_key = str(home_id).strip()
    if not away_key or not home_key:
        return None

    categories = payload.get("categories") or []
    teams = payload.get("teams") or []
    if not isinstance(categories, list) or not isinstance(teams, list):
        return None

    locations = _stat_locations(categories)
    if not locations:
        return None

    by_team: dict[str, dict[str, float | str]] = {}
    for block in teams:
        if not isinstance(block, dict):
            continue
        team = block.get("team") or {}
        if not isinstance(team, dict):
            continue
        team_id = str(team.get("id") or "").strip()
        if not team_id:
            continue
        parsed = _parse_team_values(block, locations)
        if parsed:
            by_team[team_id] = parsed

    away_values = by_team.get(away_key, {})
    home_values = by_team.get(home_key, {})
    if not away_values and not home_values:
        return None

    away = WnbaSeasonTeamStatLine(**away_values)
    home = WnbaSeasonTeamStatLine(**home_values)
    away_rank_updates: dict[str, int] = {}
    home_rank_updates: dict[str, int] = {}

    for field, _espn_name, lower_is_better, _is_pct in _STAT_SPECS:
        league_values: list[tuple[str, float]] = []
        for team_id, stats in by_team.items():
            raw = stats.get(field)
            if raw is None:
                continue
            numeric = _numeric(raw)
            if numeric is None:
                continue
            league_values.append((team_id, numeric))
        if not league_values:
            continue
        ranks = competition_rank(league_values, lower_is_better=lower_is_better)
        away_rank = ranks.get(away_key)
        home_rank = ranks.get(home_key)
        if away_rank is not None:
            away_rank_updates[f"{field}_rank"] = away_rank
        if home_rank is not None:
            home_rank_updates[f"{field}_rank"] = home_rank

    if away_rank_updates:
        away = away.model_copy(update=away_rank_updates)
    if home_rank_updates:
        home = home.model_copy(update=home_rank_updates)

    return WnbaSeasonTeamStatsPair(away=away, home=home)


async def fetch_season_team_stats_pair(
    away_id: str,
    home_id: str,
) -> WnbaSeasonTeamStatsPair | None:
    """Fetch ESPN league team stats and return the away/home pair with ranks."""
    cache_key = "byteam"
    cached = _cache.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        payload = cached[1]
    else:
        async with httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS) as client:
            response = await client.get(
                ESPN_TEAM_STATS_URL,
                params={"limit": 50},
                headers=_ESPN_HEADERS,
            )
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict):
            return None
        _cache[cache_key] = (now, payload)

    return normalize_season_team_stats_pair(
        payload, away_id=away_id, home_id=home_id
    )
