from __future__ import annotations

from datetime import date
from typing import Any

import httpx

DASH_URL = "https://stats.nba.com/stats/leaguedashplayerstats"
GAMELOG_URL = "https://stats.nba.com/stats/playergamelog"
ALLPLAYERS_URL = "https://stats.nba.com/stats/commonallplayers"
STATS_TIMEOUT_SECONDS = 10.0

_STATS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Accept": "application/json, text/plain, */*",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}


def _today() -> date:
    return date.today()


def current_nba_season(today: date | None = None) -> str:
    d = today or _today()
    start = d.year if d.month >= 10 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def rows_as_dicts(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sets = payload.get("resultSets") or []
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


async def fetch_commonallplayers(season: str) -> dict:
    params = {
        "LeagueID": "00",
        "Season": season,
        "IsOnlyCurrentSeason": "1",
    }
    async with httpx.AsyncClient(
        timeout=STATS_TIMEOUT_SECONDS, headers=_STATS_HEADERS
    ) as client:
        res = await client.get(ALLPLAYERS_URL, params=params)
        res.raise_for_status()
        return res.json()


async def fetch_leaguedashplayerstats(season: str) -> dict:
    params = {
        "LastNGames": "0",
        "LeagueID": "00",
        "MeasureType": "Base",
        "Month": "0",
        "OpponentTeamID": "0",
        "PaceAdjust": "N",
        "PerMode": "PerGame",
        "Period": "0",
        "PlusMinus": "N",
        "Rank": "N",
        "Season": season,
        "SeasonType": "Regular Season",
        "TeamID": "0",
    }
    async with httpx.AsyncClient(
        timeout=STATS_TIMEOUT_SECONDS, headers=_STATS_HEADERS
    ) as client:
        res = await client.get(DASH_URL, params=params)
        res.raise_for_status()
        return res.json()


async def fetch_playergamelog(player_id: str, season: str) -> dict:
    params = {
        "PlayerID": player_id,
        "Season": season,
        "SeasonType": "Regular Season",
        "LeagueID": "00",
    }
    async with httpx.AsyncClient(
        timeout=STATS_TIMEOUT_SECONDS, headers=_STATS_HEADERS
    ) as client:
        res = await client.get(GAMELOG_URL, params=params)
        res.raise_for_status()
        return res.json()
