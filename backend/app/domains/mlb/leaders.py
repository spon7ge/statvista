from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

import httpx

from app.domains.mlb.schemas_leaders import (
    MlbLeaderCategory,
    MlbLeaderRow,
    MlbLeadersResponse,
)
from app.domains.mlb.team_names import canonical_mlb_abbrev

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")
# /stats/leaders has no gamesPlayed; season /stats splits include GP + ranked values.
STATS_URL = "https://statsapi.mlb.com/api/v1/stats"
TEAMS_URL = "https://statsapi.mlb.com/api/v1/teams"
STATS_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 10 * 60

_cache: dict[str, Any] = {}
_refresh_lock: asyncio.Lock | None = None
_refresh_lock_loop: asyncio.AbstractEventLoop | None = None

# key, label, display_stat, sort_stat, group, order
CATEGORY_SPECS: list[tuple[str, str, str, str, str, Literal["asc", "desc"]]] = [
    ("avg", "Batting Average", "AVG", "avg", "hitting", "desc"),
    ("hr", "Home Runs", "HR", "homeRuns", "hitting", "desc"),
    ("rbi", "RBI", "RBI", "rbi", "hitting", "desc"),
    ("sb", "Stolen Bases", "SB", "stolenBases", "hitting", "desc"),
    ("ops", "OPS", "OPS", "ops", "hitting", "desc"),
    ("hits", "Hits", "H", "hits", "hitting", "desc"),
    ("era", "ERA", "ERA", "era", "pitching", "asc"),
    ("whip", "WHIP", "WHIP", "whip", "pitching", "asc"),
    ("so", "Strikeouts", "SO", "strikeOuts", "pitching", "desc"),
    ("w", "Wins", "W", "wins", "pitching", "desc"),
    ("sv", "Saves", "SV", "saves", "pitching", "desc"),
    ("ip", "Innings Pitched", "IP", "inningsPitched", "pitching", "desc"),
]
# Rate boards use MLB qualification (same idea as /stats/leaders).
_QUALIFIED_SORT_STATS = frozenset({"avg", "ops", "era", "whip"})
TOP_N = 10


def current_mlb_season_year() -> int:
    return datetime.now(ET).year


def stats_request_params(
    sort_stat: str,
    group: str,
    order: Literal["asc", "desc"],
    season: int,
) -> dict[str, str | int]:
    params: dict[str, str | int] = {
        "stats": "season",
        "group": group,
        "season": season,
        "sportIds": 1,
        "limit": TOP_N,
        "order": order,
        "sortStat": sort_stat,
    }
    if sort_stat in _QUALIFIED_SORT_STATS:
        params["playerPool"] = "qualified"
    return params


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
        abbrev = canonical_mlb_abbrev(team.get("abbreviation"))
        if tid is not None and abbrev:
            out[int(tid)] = abbrev
    return out


async def fetch_category_payload(
    client: httpx.AsyncClient,
    sort_stat: str,
    group: str,
    order: Literal["asc", "desc"],
    season: int,
) -> dict:
    res = await client.get(
        STATS_URL,
        params=stats_request_params(sort_stat, group, order, season),
    )
    res.raise_for_status()
    return res.json()


def _format_stat_value(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, str):
        value = raw.strip()
        return value or None
    if isinstance(raw, int):
        return str(raw)
    if isinstance(raw, float):
        text = f"{raw}"
        if "." in text:
            text = text.rstrip("0").rstrip(".")
        return text or None
    value = str(raw).strip()
    return value or None


def normalize_category_payload(
    payload: dict,
    *,
    key: str,
    label: str,
    stat: str,
    sort_stat: str,
    team_id_to_abbrev: dict[int, str],
) -> MlbLeaderCategory:
    blocks = payload.get("stats") or []
    raw_splits = (blocks[0] or {}).get("splits") or [] if blocks else []
    leaders: list[MlbLeaderRow] = []
    for entry in raw_splits:
        if len(leaders) >= TOP_N:
            break
        player = entry.get("player") or {}
        team = entry.get("team") or {}
        row_stat = entry.get("stat") or {}
        pid = player.get("id")
        name = str(player.get("fullName") or "").strip()
        value = _format_stat_value(row_stat.get(sort_stat))
        try:
            rank = int(entry.get("rank"))
        except (TypeError, ValueError):
            continue
        if pid is None or not name or value is None:
            continue
        tid = team.get("id")
        abbrev = team_id_to_abbrev.get(int(tid), "???") if tid is not None else "???"
        gp: int | None
        try:
            gp = int(row_stat["gamesPlayed"])
        except (KeyError, TypeError, ValueError):
            gp = None
        leaders.append(
            MlbLeaderRow(
                rank=rank,
                player_id=str(pid),
                name=name,
                team_abbrev=abbrev,
                gp=gp,
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
                        fetch_category_payload(
                            client, sort_stat, group, order, season
                        )
                        for (
                            _key,
                            _label,
                            _stat,
                            sort_stat,
                            group,
                            order,
                        ) in CATEGORY_SPECS
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
                    sort_stat=sort_stat,
                    team_id_to_abbrev=team_id_to_abbrev,
                )
                for (
                    key,
                    label,
                    stat,
                    sort_stat,
                    _group,
                    _order,
                ), payload in zip(CATEGORY_SPECS, payloads, strict=True)
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
