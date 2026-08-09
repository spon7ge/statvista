"""Fetch, normalize, and cache MLB Play Player of the Game winners.

Upstream (Task 2): static Genius JSON under
``https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json``.

1. ``GET fan/contests.json`` — match ``gameFeedId`` + ``status==resulted`` + ``winnerId``
2. ``GET fan/{contest.id}.json`` — player where ``playerId == winnerId``
3. Optional ``GET squads.json`` — ``abbreviation`` for ``squadId``
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import httpx

from app.domains.mlb.schemas_game_detail import (
    MlbPlayerOfTheGame,
    MlbPlayerOfTheGameStat,
)

logger = logging.getLogger(__name__)

JSON_BASE = (
    "https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json"
)
HEADSHOT = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:67:current.png/w_213,q_auto:best/"
    "v1/people/{id}/headshot/67/current"
)
DEFAULT_CACHE_DIR = Path("data/cache/mlb_player_of_the_game")
_UA_HEADERS = {"User-Agent": "Mozilla/5.0"}


def _cache_dir() -> Path:
    return Path(os.environ.get("MLB_POTG_CACHE_DIR", DEFAULT_CACHE_DIR))


def _cache_path(game_pk: str) -> Path:
    return _cache_dir() / f"{game_pk}.json"


def read_potg_cache(game_pk: str) -> MlbPlayerOfTheGame | None:
    path = _cache_path(game_pk)
    if not path.is_file():
        return None
    try:
        return MlbPlayerOfTheGame.model_validate_json(path.read_text())
    except Exception as exc:
        logger.warning("POTG cache read failed for %s: %s", game_pk, exc)
        return None


def write_potg_cache(game_pk: str, potg: MlbPlayerOfTheGame) -> None:
    path = _cache_path(game_pk)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(potg.model_dump_json())
    except Exception as exc:
        logger.warning("POTG cache write failed for %s: %s", game_pk, exc)


def _headshot_url(player_id: str) -> str | None:
    try:
        int(player_id)
    except ValueError:
        return None
    return HEADSHOT.format(id=player_id)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _stat_summary(block: dict[str, Any]) -> str | None:
    for key in ("summary", "summaryFeed"):
        value = block.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def normalize_player_of_the_game(
    raw: dict[str, Any],
    *,
    game_pk: str,
    team_abbrev: str | None = None,
) -> MlbPlayerOfTheGame | None:
    """Map upstream winner player JSON → schema (fixture shape)."""
    del game_pk  # reserved for callers / future cache metadata
    player = raw if isinstance(raw, dict) else {}
    player_id = str(player.get("feedId") or "").strip()
    full_name = str(player.get("name") or "").strip()
    if not player_id or not full_name:
        return None
    last_name = str(player.get("lastName") or full_name.split()[-1]).strip()
    abbrev = team_abbrev
    if abbrev is None:
        raw_abbrev = player.get("teamAbbrev") or player.get("abbreviation")
        abbrev = str(raw_abbrev).strip() if raw_abbrev else None

    stats_block = _as_dict(player.get("stats"))
    hitting = _as_dict(stats_block.get("hitting"))
    pitching = _as_dict(stats_block.get("pitching"))
    # Prefer hitting showcase text; fall back to pitching for pitcher winners.
    summary = _stat_summary(hitting) or _stat_summary(pitching)
    stats: list[MlbPlayerOfTheGameStat] = (
        [MlbPlayerOfTheGameStat(label=None, value=summary)] if summary else []
    )

    return MlbPlayerOfTheGame(
        player_id=player_id,
        full_name=full_name,
        last_name=last_name,
        team_abbrev=abbrev or None,
        headshot_url=_headshot_url(player_id),
        stats=stats,
    )


def _find_resulted_contest(
    contests: list[Any], game_pk: str
) -> dict[str, Any] | None:
    for row in contests:
        if not isinstance(row, dict):
            continue
        if str(row.get("gameFeedId")) != str(game_pk):
            continue
        if row.get("status") != "resulted":
            continue
        if row.get("winnerId") in (None, ""):
            continue
        return row
    return None


def _find_winner_player(
    contest_payload: dict[str, Any], winner_id: Any
) -> dict[str, Any] | None:
    for player in _as_list(contest_payload.get("players")):
        if not isinstance(player, dict):
            continue
        if player.get("playerId") == winner_id:
            return player
        # Tolerate string/int mismatch from JSON
        if str(player.get("playerId")) == str(winner_id):
            return player
    return None


async def _squad_abbrev(
    client: httpx.AsyncClient, squad_id: Any
) -> str | None:
    if squad_id is None:
        return None
    try:
        resp = await client.get(f"{JSON_BASE}/squads.json", headers=_UA_HEADERS)
        resp.raise_for_status()
        for squad in _as_list(resp.json()):
            if not isinstance(squad, dict):
                continue
            if squad.get("id") == squad_id or str(squad.get("id")) == str(
                squad_id
            ):
                abbrev = squad.get("abbreviation")
                return str(abbrev).strip() if abbrev else None
        return None
    except Exception as exc:
        # Winner is already known; missing abbrev should not fail POTG.
        logger.warning("POTG squads.json lookup failed: %s", exc)
        return None


async def fetch_player_of_the_game(
    client: httpx.AsyncClient,
    *,
    game_pk: str,
) -> MlbPlayerOfTheGame | None:
    cached = read_potg_cache(game_pk)
    if cached is not None:
        return cached
    try:
        contests_resp = await client.get(
            f"{JSON_BASE}/fan/contests.json", headers=_UA_HEADERS
        )
        contests_resp.raise_for_status()
        contest = _find_resulted_contest(_as_list(contests_resp.json()), game_pk)
        if contest is None:
            return None

        contest_id = contest["id"]
        detail_resp = await client.get(
            f"{JSON_BASE}/fan/{contest_id}.json", headers=_UA_HEADERS
        )
        detail_resp.raise_for_status()
        winner = _find_winner_player(
            _as_dict(detail_resp.json()), contest.get("winnerId")
        )
        if winner is None:
            return None

        team_abbrev = await _squad_abbrev(client, winner.get("squadId"))
        potg = normalize_player_of_the_game(
            winner, game_pk=game_pk, team_abbrev=team_abbrev
        )
        if potg is None:
            return None
        write_potg_cache(game_pk, potg)
        return potg
    except Exception as exc:
        logger.warning("POTG fetch failed for %s: %s", game_pk, exc)
        return None
