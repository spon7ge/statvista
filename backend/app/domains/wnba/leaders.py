from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from app.core.outbound_cache import get_json
from app.domains.wnba.schemas_leaders import (
    LeaderCategoryKey,
    WnbaLeaderCategory,
    WnbaLeaderRow,
    WnbaLeadersResponse,
)

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")
# leaguedashplayerstats often hangs/403s; leagueleaders returns the same
# per-game columns quickly and is stable from home networks.
STATS_URL = "https://stats.wnba.com/stats/leagueleaders"
STATS_TIMEOUT_SECONDS = 15.0
CACHE_TTL_SECONDS = 10 * 60
LEADERS_OUTBOUND_TTL_SECONDS = 600.0

_HEADER_ALIASES = {
    "PLAYER": "PLAYER_NAME",
    "TEAM": "TEAM_ABBREVIATION",
}

_cache: dict = {}  # response, expires_at, season
_refresh_lock: asyncio.Lock | None = None
_refresh_lock_loop: asyncio.AbstractEventLoop | None = None

_CATEGORY_SPECS: list[tuple[LeaderCategoryKey, str, str, str]] = [
    # key, label, display_stat, upstream_header
    ("points", "Points", "PTS", "PTS"),
    ("rebounds", "Rebounds", "REB", "REB"),
    ("assists", "Assists", "AST", "AST"),
    ("steals", "Steals", "STL", "STL"),
    ("blocks", "Blocks", "BLK", "BLK"),
    ("three_pointers", "3-Pointers", "3PM", "FG3M"),
]

TOP_N = 10


def coerce_stats_leaders_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize leagueleaders (resultSet) into leaguedash-shaped resultSets."""
    if payload.get("resultSets"):
        return payload
    block = payload.get("resultSet")
    if not isinstance(block, dict):
        return payload
    headers = [
        _HEADER_ALIASES.get(str(h), str(h)) for h in (block.get("headers") or [])
    ]
    return {
        "resultSets": [
            {
                "headers": headers,
                "rowSet": block.get("rowSet") or [],
            }
        ]
    }


def _rows_as_dicts(payload: dict[str, Any]) -> list[dict[str, Any]]:
    coerced = coerce_stats_leaders_payload(payload)
    sets = coerced.get("resultSets") or []
    if not sets:
        return []
    block = sets[0] or {}
    headers = [str(h) for h in (block.get("headers") or [])]
    if not headers:
        return []
    out: list[dict[str, Any]] = []
    for raw in block.get("rowSet") or []:
        if not isinstance(raw, (list, tuple)):
            continue
        out.append({headers[i]: raw[i] for i in range(min(len(headers), len(raw)))})
    return out


def _format_value(raw: Any) -> str | None:
    try:
        num = float(raw)
    except (TypeError, ValueError):
        return None
    return f"{num:.1f}"


def _leader_row(rank: int, player: dict[str, Any], value: str) -> WnbaLeaderRow | None:
    player_id = player.get("PLAYER_ID")
    name = str(player.get("PLAYER_NAME") or "").strip()
    abbrev = str(player.get("TEAM_ABBREVIATION") or "").strip().upper()
    gp_raw = player.get("GP")
    try:
        gp = int(gp_raw)
    except (TypeError, ValueError):
        return None
    if player_id is None or not name or not abbrev:
        return None
    return WnbaLeaderRow(
        rank=rank,
        player_id=str(player_id),
        name=name,
        team_abbrev=abbrev,
        gp=gp,
        value=value,
    )


def normalize_leaguedashplayerstats(
    payload: dict[str, Any], *, season: int
) -> WnbaLeadersResponse:
    players = _rows_as_dicts(payload)
    categories: list[WnbaLeaderCategory] = []
    for key, label, stat, header in _CATEGORY_SPECS:
        scored: list[tuple[float, dict[str, Any], str]] = []
        for player in players:
            formatted = _format_value(player.get(header))
            if formatted is None:
                continue
            scored.append((float(formatted), player, formatted))
        scored.sort(key=lambda item: item[0], reverse=True)
        leaders: list[WnbaLeaderRow] = []
        for _num, player, formatted in scored:
            row = _leader_row(len(leaders) + 1, player, formatted)
            if row is None:
                continue
            leaders.append(row)
            if len(leaders) >= TOP_N:
                break
        categories.append(
            WnbaLeaderCategory(
                key=key,
                label=label,
                stat=stat,
                leaders=leaders,
            )
        )
    return WnbaLeadersResponse(season=season, pace="per_game", categories=categories)


def current_wnba_season_year() -> int:
    return datetime.now(ET).year


def _get_refresh_lock() -> asyncio.Lock:
    global _refresh_lock, _refresh_lock_loop
    loop = asyncio.get_running_loop()
    if _refresh_lock is None or _refresh_lock_loop is not loop:
        _refresh_lock = asyncio.Lock()
        _refresh_lock_loop = loop
    return _refresh_lock


async def fetch_leaguedashplayerstats(season: int) -> dict:
    params = {
        "LeagueID": "10",
        "PerMode": "PerGame",
        "Scope": "S",
        "Season": str(season),
        "SeasonType": "Regular Season",
        "StatCategory": "PTS",
    }
    url = f"{STATS_URL}?{urlencode(params)}"
    payload = await get_json(
        f"stats:wnba:leagueleaders:{season}",
        url,
        ttl_seconds=LEADERS_OUTBOUND_TTL_SECONDS,
        timeout_seconds=STATS_TIMEOUT_SECONDS,
        headers={
            "Referer": "https://www.wnba.com/stats/players/",
            "Origin": "https://www.wnba.com",
            "x-nba-stats-origin": "stats",
            "x-nba-stats-token": "true",
        },
    )
    return payload if isinstance(payload, dict) else {}


def _fresh_cached() -> WnbaLeadersResponse | None:
    cached = _cache.get("response")
    if cached is None:
        return None
    if _cache.get("season") != current_wnba_season_year():
        return None
    if time.time() >= float(_cache.get("expires_at") or 0):
        return None
    return cached


async def get_wnba_leaders() -> WnbaLeadersResponse:
    fresh = _fresh_cached()
    if fresh is not None:
        return fresh

    lock = _get_refresh_lock()
    async with lock:
        fresh = _fresh_cached()
        if fresh is not None:
            return fresh
        season = current_wnba_season_year()
        try:
            payload = await fetch_leaguedashplayerstats(season)
            response = normalize_leaguedashplayerstats(payload, season=season)
        except Exception:
            stale = _cache.get("response")
            if stale is not None and _cache.get("season") == season:
                logger.warning("WNBA leaders refresh failed; serving stale cache")
                return stale
            raise
        _cache["response"] = response
        _cache["expires_at"] = time.time() + CACHE_TTL_SECONDS
        _cache["season"] = season
        return response
