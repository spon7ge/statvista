from __future__ import annotations

import asyncio
import logging
import time
import unicodedata
from dataclasses import dataclass
from typing import Any, TypedDict

from app.core.outbound_cache import get_json

logger = logging.getLogger(__name__)

# site.api.espn.com is often Akamai-403; site.web.api serves the same docs.
ESPN_TEAMS_URL = (
    "https://site.web.api.espn.com/apis/site/v2/sports/basketball/wnba/teams"
)
ESPN_ROSTER_URL = (
    "https://site.web.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/{team_id}/roster"
)
ESPN_TIMEOUT_SECONDS = 12.0
ROSTER_OUTBOUND_TTL_SECONDS = 900.0
TEAMS_OUTBOUND_TTL_SECONDS = 3600.0
ROSTER_CACHE_TTL_SECONDS = 600
INDEX_CACHE_TTL_SECONDS = 900
HEADSHOT_TMPL = (
    "https://a.espncdn.com/i/headshots/wnba/players/full/{espn_id}.png"
)
_ESPN_HEADERS = {
    "Referer": "https://www.espn.com/wnba/",
    "Accept-Language": "en-US,en;q=0.9",
}

_roster_cache: dict[str, dict] = {}
_index_cache: dict[str, Any] = {"expires_at": 0.0, "index": {}}


class WnbaRosterPlayer(TypedDict):
    espn_id: str
    position: str | None
    team_abbrev: str | None
    headshot_url: str | None


@dataclass(frozen=True)
class RosterStarter:
    """Lean provider-local starter shape; mapped to the domain schema at the
    WNBA game-detail boundary (``app.domains.wnba.game_detail``)."""

    jersey: str | None
    name: str
    position: str | None
    gtd: bool = False


def clear_roster_cache() -> None:
    _roster_cache.clear()


def clear_wnba_player_index_cache() -> None:
    _index_cache["expires_at"] = 0.0
    _index_cache["index"] = {}


def headshot_url_for(espn_id: str) -> str:
    return HEADSHOT_TMPL.format(espn_id=str(espn_id).strip())


def _as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def team_entries_from_teams_payload(payload: dict) -> list[tuple[str, str]]:
    """Return (team_id, abbrev) pairs from ESPN teams endpoint."""
    out: list[tuple[str, str]] = []
    sports = _as_list(payload.get("sports"))
    leagues = _as_list(sports[0].get("leagues")) if sports else []
    teams = _as_list(leagues[0].get("teams")) if leagues else []
    for wrapper in teams:
        team = _as_dict(_as_dict(wrapper).get("team"))
        team_id = str(team.get("id") or "").strip()
        abbrev = str(team.get("abbreviation") or "").strip().upper() or None
        if team_id and abbrev:
            out.append((team_id, abbrev))
    return out


def league_roster_player_index(
    payload: dict,
    *,
    team_abbrev: str | None,
) -> dict[str, WnbaRosterPlayer]:
    """Index players from an ESPN WNBA roster payload for league-wide lookup."""
    index: dict[str, WnbaRosterPlayer] = {}
    for athlete in payload.get("athletes") or []:
        if not isinstance(athlete, dict):
            continue
        display_name = str(athlete.get("displayName") or "").strip()
        espn_id = str(athlete.get("id") or "").strip()
        if not display_name or not espn_id:
            continue
        key = norm_player_name(display_name)
        if key in index:
            continue
        position_block = athlete.get("position") or {}
        position = None
        if isinstance(position_block, dict):
            position = (
                str(position_block.get("abbreviation") or "").strip() or None
            )
        index[key] = {
            "espn_id": espn_id,
            "position": position,
            "team_abbrev": (team_abbrev or None),
            "headshot_url": headshot_url_for(espn_id),
        }
    return index


def norm_player_name(name: str) -> str:
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.casefold().strip()


def roster_player_index(payload: dict) -> dict[str, dict[str, str | None]]:
    index: dict[str, dict[str, str | None]] = {}
    for athlete in payload.get("athletes") or []:
        if not isinstance(athlete, dict):
            continue
        display_name = str(athlete.get("displayName") or "").strip()
        if not display_name:
            continue
        jersey_raw = athlete.get("jersey")
        jersey = str(jersey_raw).strip() if jersey_raw is not None else None
        jersey = jersey or None
        position_block = athlete.get("position") or {}
        position = None
        if isinstance(position_block, dict):
            position = str(position_block.get("abbreviation") or "").strip() or None
        index[norm_player_name(display_name)] = {
            "jersey": jersey,
            "position": position,
        }
    return index


def enrich_starters(
    starters: list[dict],
    index: dict[str, dict[str, str | None]],
) -> list[RosterStarter]:
    enriched: list[RosterStarter] = []
    for starter in starters:
        name = str(starter.get("name") or "").strip()
        rw_position = str(starter.get("position") or "").strip()
        roster_entry = index.get(norm_player_name(name), {})
        jersey = roster_entry.get("jersey") or None
        position = rw_position or roster_entry.get("position")
        gtd = bool(starter.get("gtd"))
        enriched.append(
            RosterStarter(
                jersey=jersey,
                name=name,
                position=position or None,
                gtd=gtd,
            )
        )
    return enriched


async def fetch_espn_roster(team_id: str) -> dict:
    url = ESPN_ROSTER_URL.format(team_id=team_id)
    payload = await get_json(
        f"espn:wnba:roster:{team_id}",
        url,
        ttl_seconds=ROSTER_OUTBOUND_TTL_SECONDS,
        timeout_seconds=ESPN_TIMEOUT_SECONDS,
        headers=_ESPN_HEADERS,
    )
    return payload if isinstance(payload, dict) else {}


async def get_roster_index(team_id: str) -> dict[str, dict[str, str | None]]:
    now = time.time()
    cached = _roster_cache.get(team_id)
    if cached and float(cached["expires_at"]) > now:
        return cached["index"]  # type: ignore[return-value]
    payload = await fetch_espn_roster(team_id)
    index = roster_player_index(payload)
    _roster_cache[team_id] = {"expires_at": now + ROSTER_CACHE_TTL_SECONDS, "index": index}
    return index


async def build_wnba_player_index() -> dict[str, WnbaRosterPlayer]:
    teams_payload = await get_json(
        "espn:wnba:teams",
        ESPN_TEAMS_URL,
        ttl_seconds=TEAMS_OUTBOUND_TTL_SECONDS,
        timeout_seconds=ESPN_TIMEOUT_SECONDS,
        headers=_ESPN_HEADERS,
    )
    teams = team_entries_from_teams_payload(
        teams_payload if isinstance(teams_payload, dict) else {}
    )
    index: dict[str, WnbaRosterPlayer] = {}

    async def one(team_id: str, abbrev: str) -> None:
        try:
            payload = await get_json(
                f"espn:wnba:roster:{team_id}",
                ESPN_ROSTER_URL.format(team_id=team_id),
                ttl_seconds=ROSTER_OUTBOUND_TTL_SECONDS,
                timeout_seconds=ESPN_TIMEOUT_SECONDS,
                headers=_ESPN_HEADERS,
            )
        except Exception as exc:
            logger.warning("ESPN WNBA roster %s failed: %s", team_id, exc)
            return
        for key, entry in league_roster_player_index(
            payload if isinstance(payload, dict) else {},
            team_abbrev=abbrev,
        ).items():
            if key not in index:
                index[key] = entry

    await asyncio.gather(*(one(tid, abbr) for tid, abbr in teams))
    return index


async def get_wnba_player_index() -> dict[str, WnbaRosterPlayer]:
    now = time.time()
    if float(_index_cache["expires_at"]) > now and _index_cache["index"]:
        return _index_cache["index"]  # type: ignore[return-value]
    try:
        index = await build_wnba_player_index()
    except Exception as exc:
        logger.warning("ESPN WNBA player index unavailable: %s", exc)
        return {}
    _index_cache["index"] = index
    _index_cache["expires_at"] = now + INDEX_CACHE_TTL_SECONDS
    return index
