"""MLB Stats API active roster helpers."""

from __future__ import annotations

import logging
import time

import httpx

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
ROSTER_TTL_SECONDS = 600.0
_roster_cache: dict[str, tuple[float, set[str]]] = {}


def clear_roster_cache() -> None:
    _roster_cache.clear()


async def fetch_active_roster_player_ids(
    client: httpx.AsyncClient, team_id: int, season: int
) -> set[str]:
    cache_key = f"{team_id}|{season}"
    cached = _roster_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < ROSTER_TTL_SECONDS:
        return set(cached[1])
    try:
        response = await client.get(
            f"{STATS_BASE}/teams/{team_id}/roster",
            params={"rosterType": "active", "season": season},
        )
        response.raise_for_status()
        ids: set[str] = set()
        for entry in response.json().get("roster") or []:
            person = entry.get("person") or {}
            pid = person.get("id")
            if pid is not None:
                ids.add(str(pid))
        _roster_cache[cache_key] = (time.monotonic(), ids)
        return set(ids)
    except Exception as exc:
        logger.warning("active roster failed team=%s season=%s: %s", team_id, season, exc)
        return set()
