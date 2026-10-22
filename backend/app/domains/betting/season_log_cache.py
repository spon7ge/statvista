"""Season-wide NBA/WNBA game logs, refreshed at most once a day.

L5/L10/L15 read the current season's ``player_base``. H2H reads regular-season
games only from ``player_base`` and ``player_base_prev``.
The other three current-season datasets (player advanced, team base, team
advanced) are stored beside them from the same daily pull. Preseason rows
fill L5/L10/L15 only when that player has no regular-season or playoff games
yet, and they are left out of H2H.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

from app.domains.betting.player_match_keys import match_player_key
from app.domains.nba.prop_board_logs import current_nba_season
from app.domains.wnba.leaders import current_wnba_season_year

logger = logging.getLogger(__name__)

CACHE_DIR = Path("data/cache/season_logs")
CACHE_VERSION = 2
TTL_SECONDS = 24 * 60 * 60
_SEASON_TYPES = ("Regular Season", "Playoffs", "Pre Season")
_DATASETS = (
    ("player", "Base", "player_base"),
    ("player", "Advanced", "player_adv"),
    ("team", "Base", "team_base"),
    ("team", "Advanced", "team_adv"),
)

_memory: dict[str, tuple[float, dict[str, list[dict[str, Any]]]]] = {}
_locks: dict[str, asyncio.Lock] = {}


def season_label(league: str) -> str:
    if league == "nba":
        return current_nba_season()
    if league == "wnba":
        return str(current_wnba_season_year())
    raise ValueError(league)


def previous_season_label(league: str) -> str:
    current = season_label(league)
    if league == "nba":
        start = int(current.split("-", 1)[0]) - 1
        return f"{start}-{str(start + 1)[-2:]}"
    if league == "wnba":
        return str(int(current) - 1)
    raise ValueError(league)


def player_base_splits(
    logs: dict[str, list[dict[str, Any]]], player_name: str
) -> list[dict[str, Any]]:
    key = match_player_key(player_name)
    if not key:
        return []
    matched = [
        row
        for row in logs.get("player_base") or []
        if match_player_key(str(row.get("PLAYER_NAME") or "")) == key
    ]
    competitive = [row for row in matched if row.get("SEASON_TYPE") != "Pre Season"]
    return competitive or matched


def h2h_splits(
    logs: dict[str, list[dict[str, Any]]], player_name: str
) -> list[dict[str, Any]]:
    """Regular-season games from this season and the one before."""
    key = match_player_key(player_name)
    if not key:
        return []
    rows: list[dict[str, Any]] = []
    for bucket in ("player_base", "player_base_prev"):
        for row in logs.get(bucket) or []:
            if match_player_key(str(row.get("PLAYER_NAME") or "")) != key:
                continue
            if row.get("SEASON_TYPE") != "Regular Season":
                continue
            rows.append(row)
    return rows


def fetch_logs_frame(
    kind: str,
    measure: str,
    season: str,
    season_type: str,
    league_id: str | None,
) -> list[dict[str, Any]]:
    """One season-wide PlayerGameLogs or TeamGameLogs call."""
    kwargs: dict[str, str] = {
        "season_nullable": season,
        "season_type_nullable": season_type,
        "measure_type_player_game_logs_nullable": measure,
    }
    if league_id is not None:
        kwargs["league_id_nullable"] = league_id
    if kind == "player":
        from nba_api.stats.endpoints import playergamelogs

        endpoint = playergamelogs.PlayerGameLogs
    elif kind == "team":
        from nba_api.stats.endpoints import teamgamelogs

        endpoint = teamgamelogs.TeamGameLogs
    else:
        raise ValueError(kind)
    frame = endpoint(**kwargs).get_data_frames()[0]
    return _frame_records(frame)


async def load_season_logs(league: str) -> dict[str, list[dict[str, Any]]]:
    now = time.time()
    fresh = _fresh(league, now)
    if fresh is not None:
        return fresh
    async with _lock(league):
        fresh = _fresh(league, time.time())
        if fresh is not None:
            return fresh
        cached = _read(league)
        try:
            logs, player_ok = await asyncio.to_thread(_fetch_all, league)
        except Exception as exc:
            logger.warning("season log refresh failed league=%s: %s", league, exc)
            return cached["logs"] if cached else _empty()
        if not player_ok:
            logger.warning("season log player base unavailable league=%s", league)
            return cached["logs"] if cached else _empty()
        _write(league, logs, time.time())
        return logs


def _fetch_all(league: str) -> tuple[dict[str, list[dict[str, Any]]], bool]:
    season = season_label(league)
    league_id = None if league == "nba" else "10"
    logs = _empty()
    player_ok = False
    for season_type in _SEASON_TYPES:
        for kind, measure, key in _DATASETS:
            try:
                rows = fetch_logs_frame(kind, measure, season, season_type, league_id)
            except Exception as exc:
                logger.warning(
                    "season log fetch failed league=%s %s %s %s: %s",
                    league,
                    kind,
                    measure,
                    season_type,
                    exc,
                )
                continue
            stamped = []
            for row in rows or []:
                stamped.append({**row, "SEASON_TYPE": season_type})
            if kind == "player" and measure == "Base" and stamped:
                player_ok = True
            logs[key].extend(stamped)
    previous = previous_season_label(league)
    for season_type in ("Regular Season", "Playoffs"):
        try:
            rows = fetch_logs_frame("player", "Base", previous, season_type, league_id)
        except Exception as exc:
            logger.warning(
                "season log fetch failed league=%s player Base %s %s: %s",
                league,
                previous,
                season_type,
                exc,
            )
            continue
        for row in rows or []:
            logs["player_base_prev"].append({**row, "SEASON_TYPE": season_type})
    return logs, player_ok


def _empty() -> dict[str, list[dict[str, Any]]]:
    logs = {key: [] for _kind, _measure, key in _DATASETS}
    logs["player_base_prev"] = []
    return logs


def read_cached_logs(league: str) -> dict[str, list[dict[str, Any]]]:
    """Return the on-disk season logs without starting a refresh.

    Game preview reads this file in place. A stats.nba.com pull belongs to the
    daily prop-board refresh, not to a page view. A missing file is empty.
    """
    cached = _read(league)
    if cached is None or cached.get("version") != CACHE_VERSION:
        return _empty()
    logs = cached.get("logs")
    if not isinstance(logs, dict):
        return _empty()
    return logs


def _memory_key(league: str) -> str:
    return f"{CACHE_DIR}:{league}"


def _lock(league: str) -> asyncio.Lock:
    lock = _locks.get(league)
    if lock is None:
        lock = asyncio.Lock()
        _locks[league] = lock
    return lock


def _fresh(league: str, now: float) -> dict[str, list[dict[str, Any]]] | None:
    remembered = _memory.get(_memory_key(league))
    if remembered is not None and now - remembered[0] < TTL_SECONDS:
        return remembered[1]
    cached = _read(league)
    if cached is None or cached.get("version") != CACHE_VERSION:
        return None
    if now - float(cached["fetched_at"]) >= TTL_SECONDS:
        return None
    logs = cached["logs"]
    _memory[_memory_key(league)] = (float(cached["fetched_at"]), logs)
    return logs


def _path(league: str) -> Path:
    return CACHE_DIR / f"{league}.json"


def _read(league: str) -> dict[str, Any] | None:
    path = _path(league)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("season log cache read failed %s: %s", path, exc)
        return None
    logs = payload.get("logs")
    if not isinstance(logs, dict) or "fetched_at" not in payload:
        return None
    return payload


def _write(league: str, logs: dict[str, list[dict[str, Any]]], fetched_at: float) -> None:
    path = _path(league)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": CACHE_VERSION, "fetched_at": fetched_at, "logs": logs}
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload))
    temporary.replace(path)
    _memory[_memory_key(league)] = (fetched_at, logs)


def _frame_records(frame: Any) -> list[dict[str, Any]]:
    if frame is None or getattr(frame, "empty", True):
        return []
    return json.loads(frame.to_json(orient="records", date_format="iso"))
