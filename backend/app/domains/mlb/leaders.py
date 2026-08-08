from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.domains.mlb.schemas_leaders import (
    MlbLeaderCategory,
    MlbLeaderRow,
    MlbLeadersResponse,
)

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")
LEADERS_URL = "https://statsapi.mlb.com/api/v1/stats/leaders"
TEAMS_URL = "https://statsapi.mlb.com/api/v1/teams"
STATS_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 10 * 60

_cache: dict[str, Any] = {}
_refresh_lock: asyncio.Lock | None = None
_refresh_lock_loop: asyncio.AbstractEventLoop | None = None

CATEGORY_SPECS: list[tuple[str, str, str, str, str]] = [
    ("avg", "Batting Average", "AVG", "battingAverage", "hitting"),
    ("hr", "Home Runs", "HR", "homeRuns", "hitting"),
    ("rbi", "RBI", "RBI", "runsBattedIn", "hitting"),
    ("sb", "Stolen Bases", "SB", "stolenBases", "hitting"),
    ("ops", "OPS", "OPS", "onBasePlusSlugging", "hitting"),
    ("hits", "Hits", "H", "hits", "hitting"),
    ("era", "ERA", "ERA", "earnedRunAverage", "pitching"),
    ("whip", "WHIP", "WHIP", "walksAndHitsPerInningPitched", "pitching"),
    ("so", "Strikeouts", "SO", "strikeouts", "pitching"),
    ("w", "Wins", "W", "wins", "pitching"),
    ("sv", "Saves", "SV", "saves", "pitching"),
    ("ip", "Innings Pitched", "IP", "inningsPitched", "pitching"),
]
TOP_N = 10


def current_mlb_season_year() -> int:
    return datetime.now(ET).year


def leaders_request_params(
    leader_category: str, stat_group: str, season: int
) -> dict[str, str | int]:
    return {
        "leaderCategories": leader_category,
        "statGroup": stat_group,
        "season": season,
        "sportId": 1,
        "limit": TOP_N,
    }


def _get_refresh_lock() -> asyncio.Lock:
    global _refresh_lock, _refresh_lock_loop
    loop = asyncio.get_running_loop()
    if _refresh_lock is None or _refresh_lock_loop is not loop:
        _refresh_lock = asyncio.Lock()
        _refresh_lock_loop = loop
    return _refresh_lock


async def fetch_team_abbrev_map(
    client: httpx.AsyncClient, season: int
) -> dict[int, str]:
    res = await client.get(TEAMS_URL, params={"sportId": 1, "season": season})
    res.raise_for_status()
    out: dict[int, str] = {}
    for team in res.json().get("teams") or []:
        tid = team.get("id")
        abbrev = str(team.get("abbreviation") or "").strip().upper()
        if tid is not None and abbrev:
            out[int(tid)] = abbrev
    return out


async def fetch_category_payload(
    client: httpx.AsyncClient,
    leader_category: str,
    stat_group: str,
    season: int,
) -> dict:
    res = await client.get(
        LEADERS_URL,
        params=leaders_request_params(leader_category, stat_group, season),
    )
    res.raise_for_status()
    return res.json()


def normalize_category_payload(
    payload: dict,
    *,
    key: str,
    label: str,
    stat: str,
    team_id_to_abbrev: dict[int, str],
) -> MlbLeaderCategory:
    blocks = payload.get("leagueLeaders") or []
    raw_leaders = (blocks[0] or {}).get("leaders") or [] if blocks else []
    leaders: list[MlbLeaderRow] = []
    for entry in raw_leaders:
        if len(leaders) >= TOP_N:
            break
        person = entry.get("person") or {}
        team = entry.get("team") or {}
        pid = person.get("id")
        name = str(person.get("fullName") or "").strip()
        value = str(entry.get("value") or "").strip()
        try:
            rank = int(entry.get("rank"))
        except (TypeError, ValueError):
            continue
        if pid is None or not name or not value:
            continue
        tid = team.get("id")
        abbrev = team_id_to_abbrev.get(int(tid), "???") if tid is not None else "???"
        leaders.append(
            MlbLeaderRow(
                rank=rank,
                player_id=str(pid),
                name=name,
                team_abbrev=abbrev,
                gp=None,
                value=value,
            )
        )
    return MlbLeaderCategory(key=key, label=label, stat=stat, leaders=leaders)


def assemble_mlb_leaders(
    categories: list[MlbLeaderCategory], *, season: int
) -> MlbLeadersResponse:
    return MlbLeadersResponse(season=season, pace="season", categories=categories)


def _fresh_cached() -> MlbLeadersResponse | None:
    cached = _cache.get("response")
    if cached is None:
        return None
    if _cache.get("season") != current_mlb_season_year():
        return None
    if time.time() >= float(_cache.get("expires_at") or 0):
        return None
    return cached


async def get_mlb_leaders() -> MlbLeadersResponse:
    fresh = _fresh_cached()
    if fresh is not None:
        return fresh

    lock = _get_refresh_lock()
    async with lock:
        fresh = _fresh_cached()
        if fresh is not None:
            return fresh

        season = current_mlb_season_year()
        try:
            async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
                results = await asyncio.gather(
                    *(
                        fetch_category_payload(client, category, stat_group, season)
                        for _key, _label, _stat, category, stat_group in CATEGORY_SPECS
                    ),
                    fetch_team_abbrev_map(client, season),
                )
            *payloads, team_id_to_abbrev = results
            categories = [
                normalize_category_payload(
                    payload,
                    key=key,
                    label=label,
                    stat=stat,
                    team_id_to_abbrev=team_id_to_abbrev,
                )
                for (key, label, stat, _category, _stat_group), payload in zip(
                    CATEGORY_SPECS, payloads, strict=True
                )
            ]
            response = assemble_mlb_leaders(categories, season=season)
        except Exception:
            stale = _cache.get("response")
            if stale is not None and _cache.get("season") == season:
                logger.warning("MLB leaders refresh failed; serving stale cache")
                return stale
            raise

        _cache["response"] = response
        _cache["expires_at"] = time.time() + CACHE_TTL_SECONDS
        _cache["season"] = season
        return response
