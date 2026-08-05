"""MLB Stats API helpers for team season hitting and pitching statistics."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.domains.mlb.schemas_game_detail import (
    MlbSeasonTeamStatLine,
    MlbSeasonTeamStatsPair,
)

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
TEAM_SEASON_TTL_SECONDS = 900.0

_TeamSeasonStatLine = dict[str, int | str | None]
_team_season_cache: dict[str, tuple[float, _TeamSeasonStatLine]] = {}


def clear_team_season_cache() -> None:
    """Clear cached Stats API responses for test isolation."""
    _team_season_cache.clear()


def parse_hitting_split(stat: dict[str, Any]) -> _TeamSeasonStatLine:
    """Map a Stats API hitting split to the season stats response fields."""
    return {
        "hr": stat.get("homeRuns"),
        "r": stat.get("runs"),
        "h": stat.get("hits"),
        "avg": stat.get("avg"),
        "obp": stat.get("obp"),
        "slg": stat.get("slg"),
    }


def parse_pitching_split(stat: dict[str, Any]) -> _TeamSeasonStatLine:
    """Map a Stats API pitching split to the season stats response fields."""
    return {
        "era": stat.get("era"),
        "so": stat.get("strikeOuts"),
        "bb": stat.get("baseOnBalls"),
    }


async def _fetch_group(
    client: httpx.AsyncClient, team_id: int, season: int, group: str
) -> dict[str, Any]:
    try:
        response = await client.get(
            f"{STATS_BASE}/teams/{team_id}/stats",
            params={
                "stats": "season",
                "group": group,
                "season": season,
                "sportIds": 1,
            },
        )
        response.raise_for_status()
        splits = (response.json().get("stats") or [{}])[0].get("splits") or []
        return (splits[0].get("stat") or {}) if splits else {}
    except Exception as exc:
        logger.warning(
            "season %s stats failed for team=%s season=%s: %s",
            group,
            team_id,
            season,
            exc,
        )
        return {}


async def fetch_team_season_stat_line(
    client: httpx.AsyncClient, team_id: int, season: int
) -> dict:
    """Fetch and cache a team's season hitting and pitching stat line."""
    cache_key = f"{team_id}|{season}"
    cached = _team_season_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < TEAM_SEASON_TTL_SECONDS:
        return cached[1]

    hitting, pitching = await asyncio.gather(
        _fetch_group(client, team_id, season, "hitting"),
        _fetch_group(client, team_id, season, "pitching"),
    )
    line = {
        key: value
        for parsed_group in (parse_hitting_split(hitting), parse_pitching_split(pitching))
        for key, value in parsed_group.items()
        if value is not None
    }
    if line:
        _team_season_cache[cache_key] = (time.monotonic(), line)
    return line


async def fetch_season_team_stats_pair(
    client: httpx.AsyncClient,
    *,
    away_team_id: int,
    home_team_id: int,
    season: int,
) -> MlbSeasonTeamStatsPair | None:
    """Fetch both teams' season stats, returning None when neither has data."""
    away, home = await asyncio.gather(
        fetch_team_season_stat_line(client, away_team_id, season),
        fetch_team_season_stat_line(client, home_team_id, season),
    )
    if not away and not home:
        return None
    return MlbSeasonTeamStatsPair(
        away=MlbSeasonTeamStatLine(**away),
        home=MlbSeasonTeamStatLine(**home),
    )
