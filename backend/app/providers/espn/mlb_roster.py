from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, TypedDict

import httpx

from app.providers.espn.wnba_roster import norm_player_name

logger = logging.getLogger(__name__)

ESPN_TEAMS_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams"
)
ESPN_ROSTER_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{team_id}/roster"
)
ESPN_TIMEOUT_SECONDS = 8.0
INDEX_CACHE_TTL_SECONDS = 900
HEADSHOT_TMPL = (
    "https://a.espncdn.com/i/headshots/mlb/players/full/{espn_id}.png"
)

_index_cache: dict[str, Any] = {"expires_at": 0.0, "index": {}}


class MlbRosterPlayer(TypedDict):
    espn_id: str
    position: str | None
    team_abbrev: str | None
    headshot_url: str | None


def clear_mlb_roster_cache() -> None:
    _index_cache["expires_at"] = 0.0
    _index_cache["index"] = {}


def headshot_url_for(espn_id: str) -> str:
    return HEADSHOT_TMPL.format(espn_id=str(espn_id).strip())


def roster_player_index(
    payload: dict,
    *,
    team_abbrev: str | None,
) -> dict[str, MlbRosterPlayer]:
    index: dict[str, MlbRosterPlayer] = {}
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
            position = str(position_block.get("abbreviation") or "").strip() or None
        index[key] = {
            "espn_id": espn_id,
            "position": position,
            "team_abbrev": (team_abbrev or None),
            "headshot_url": headshot_url_for(espn_id),
        }
    return index


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


async def fetch_espn_json(url: str, client: httpx.AsyncClient) -> dict:
    response = await client.get(url)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {}


async def build_mlb_player_index(
    client: httpx.AsyncClient | None = None,
) -> dict[str, MlbRosterPlayer]:
    owns = client is None
    http_client = client or httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS)
    try:
        teams_payload = await fetch_espn_json(ESPN_TEAMS_URL, http_client)
        teams = team_entries_from_teams_payload(teams_payload)
        index: dict[str, MlbRosterPlayer] = {}

        async def one(team_id: str, abbrev: str) -> None:
            try:
                payload = await fetch_espn_json(
                    ESPN_ROSTER_URL.format(team_id=team_id), http_client
                )
            except Exception as exc:
                logger.warning("ESPN MLB roster %s failed: %s", team_id, exc)
                return
            for key, entry in roster_player_index(
                payload, team_abbrev=abbrev
            ).items():
                if key not in index:
                    index[key] = entry

        await asyncio.gather(*(one(tid, abbr) for tid, abbr in teams))
        return index
    finally:
        if owns:
            await http_client.aclose()


async def get_mlb_player_index() -> dict[str, MlbRosterPlayer]:
    now = time.time()
    if float(_index_cache["expires_at"]) > now and _index_cache["index"]:
        return _index_cache["index"]  # type: ignore[return-value]
    try:
        index = await build_mlb_player_index()
    except Exception as exc:
        logger.warning("ESPN MLB player index unavailable: %s", exc)
        return {}
    _index_cache["index"] = index
    _index_cache["expires_at"] = now + INDEX_CACHE_TTL_SECONDS
    return index
