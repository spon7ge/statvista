"""MLB Stats API active roster helpers."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
ROSTER_TTL_SECONDS = 600.0
_roster_cache: dict[str, tuple[float, tuple["ActiveRosterEntry", ...]]] = {}


@dataclass(frozen=True)
class ActiveRosterEntry:
    """One player on a team's active roster."""

    player_id: str
    name: str
    position_type: str  # Pitcher | Infielder | Outfielder | Catcher | Hitter | …


def clear_roster_cache() -> None:
    _roster_cache.clear()


def _entry_display_name(person: dict) -> str:
    boxscore = person.get("boxscoreName")
    if isinstance(boxscore, str) and boxscore.strip():
        return boxscore.strip()
    full = person.get("fullName")
    if isinstance(full, str) and full.strip():
        return full.strip()
    return ""


async def fetch_active_roster_entries(
    client: httpx.AsyncClient, team_id: int, season: int
) -> list[ActiveRosterEntry]:
    """Fetch the active roster with ids, display names, and position types."""
    cache_key = f"{team_id}|{season}"
    cached = _roster_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < ROSTER_TTL_SECONDS:
        return list(cached[1])
    try:
        response = await client.get(
            f"{STATS_BASE}/teams/{team_id}/roster",
            params={"rosterType": "active", "season": season},
        )
        response.raise_for_status()
        entries: list[ActiveRosterEntry] = []
        for entry in response.json().get("roster") or []:
            person = entry.get("person") or {}
            pid = person.get("id")
            if pid is None:
                continue
            position = entry.get("position") or {}
            entries.append(
                ActiveRosterEntry(
                    player_id=str(pid),
                    name=_entry_display_name(person),
                    position_type=str(position.get("type") or ""),
                )
            )
        _roster_cache[cache_key] = (time.monotonic(), tuple(entries))
        return list(entries)
    except Exception as exc:
        logger.warning("active roster failed team=%s season=%s: %s", team_id, season, exc)
        return []


async def fetch_active_roster_player_ids(
    client: httpx.AsyncClient, team_id: int, season: int
) -> set[str]:
    entries = await fetch_active_roster_entries(client, team_id, season)
    return {entry.player_id for entry in entries}
