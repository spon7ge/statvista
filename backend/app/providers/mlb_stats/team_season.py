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
LEAGUE_GROUP_TTL_SECONDS = 900.0

HITTING_RANK_KEYS = (
    ("hr", "homeRuns", False),
    ("r", "runs", False),
    ("h", "hits", False),
    ("avg", "avg", False),
    ("obp", "obp", False),
    ("slg", "slg", False),
)
PITCHING_RANK_KEYS = (
    ("era", "era", True),
    ("so", "strikeOuts", False),
    ("bb", "baseOnBalls", True),
)

_TeamSeasonStatLine = dict[str, int | str | None]
_team_season_cache: dict[str, tuple[float, _TeamSeasonStatLine]] = {}
_league_group_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def clear_team_season_cache() -> None:
    """Clear cached Stats API responses for test isolation."""
    _team_season_cache.clear()
    _league_group_cache.clear()


def competition_rank(
    values: list[tuple[int, float]],
    *,
    lower_is_better: bool,
) -> dict[int, int]:
    """Assign competition ranks, leaving gaps after ties."""
    ordered = sorted(values, key=lambda item: item[1], reverse=not lower_is_better)
    ranks: dict[int, int] = {}
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


def _numeric_stat(raw: Any) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def ops_from_hitting_stat(stat: dict[str, Any]) -> float | None:
    """Board OPS rank: OBP + SLG (higher offense = tougher vs pitchers)."""
    obp = _numeric_stat(stat.get("obp"))
    slg = _numeric_stat(stat.get("slg"))
    if obp is None or slg is None:
        return None
    return obp + slg


def pa_per_game_from_hitting_stat(stat: dict[str, Any]) -> float | None:
    """Board pace rank: plate appearances per game (higher = faster)."""
    plate_appearances = _numeric_stat(stat.get("plateAppearances"))
    games_played = _numeric_stat(stat.get("gamesPlayed"))
    if plate_appearances is None or games_played is None or games_played == 0:
        return None
    return plate_appearances / games_played


def era_from_pitching_stat(stat: dict[str, Any]) -> float | None:
    return _numeric_stat(stat.get("era"))


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


async def fetch_league_group_splits(
    client: httpx.AsyncClient,
    *,
    group: str,
    season: int,
) -> list[dict]:
    """Fetch and cache league-wide team splits for one stat group."""
    cache_key = f"{group}|{season}"
    cached = _league_group_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < LEAGUE_GROUP_TTL_SECONDS:
        return cached[1]

    response = await client.get(
        f"{STATS_BASE}/teams/stats",
        params={
            "stats": "season",
            "group": group,
            "season": season,
            "sportId": 1,
        },
    )
    response.raise_for_status()
    stats = response.json().get("stats") or []
    splits = (stats[0].get("splits") or []) if stats else []
    _league_group_cache[cache_key] = (time.monotonic(), splits)
    return splits


def build_season_pair_from_league_splits(
    hitting_splits: list[dict],
    pitching_splits: list[dict],
    *,
    away_team_id: int,
    home_team_id: int,
) -> MlbSeasonTeamStatsPair | None:
    """Build both teams' values and league competition ranks."""

    def index_splits(splits: list[dict]) -> dict[int, dict[str, Any]]:
        indexed: dict[int, dict[str, Any]] = {}
        for split in splits:
            team_id = (split.get("team") or {}).get("id")
            stat = split.get("stat") or {}
            if isinstance(team_id, int) and isinstance(stat, dict):
                indexed[team_id] = stat
        return indexed

    hitting_by_team = index_splits(hitting_splits)
    pitching_by_team = index_splits(pitching_splits)

    def value_line(team_id: int) -> dict[str, int | str | None]:
        return {
            key: value
            for parsed_group in (
                parse_hitting_split(hitting_by_team.get(team_id, {})),
                parse_pitching_split(pitching_by_team.get(team_id, {})),
            )
            for key, value in parsed_group.items()
            if value is not None
        }

    away_values = value_line(away_team_id)
    home_values = value_line(home_team_id)
    if not away_values and not home_values:
        return None

    away = MlbSeasonTeamStatLine(**away_values)
    home = MlbSeasonTeamStatLine(**home_values)
    for splits_by_team, rank_keys in (
        (hitting_by_team, HITTING_RANK_KEYS),
        (pitching_by_team, PITCHING_RANK_KEYS),
    ):
        for field_name, upstream_name, lower_is_better in rank_keys:
            values = [
                (team_id, numeric)
                for team_id, stat in splits_by_team.items()
                if (numeric := _numeric_stat(stat.get(upstream_name))) is not None
            ]
            ranks = competition_rank(values, lower_is_better=lower_is_better)
            away_rank = ranks.get(away_team_id)
            home_rank = ranks.get(home_team_id)
            if away_rank is not None:
                setattr(away, f"{field_name}_rank", away_rank)
            if home_rank is not None:
                setattr(home, f"{field_name}_rank", home_rank)

    return MlbSeasonTeamStatsPair(away=away, home=home)


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
    """Prefer ranked league stats, falling back to per-team values."""
    try:
        hitting, pitching = await asyncio.gather(
            fetch_league_group_splits(client, group="hitting", season=season),
            fetch_league_group_splits(client, group="pitching", season=season),
        )
        league_pair = build_season_pair_from_league_splits(
            hitting,
            pitching,
            away_team_id=away_team_id,
            home_team_id=home_team_id,
        )
        if league_pair is not None:
            return league_pair
    except Exception as exc:
        logger.warning("league team stats path failed: %s", exc)

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
