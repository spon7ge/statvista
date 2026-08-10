"""MLB Stats API helpers for team player season batting/pitching rows."""

from __future__ import annotations

import logging
import time
from typing import Any, TypeVar

import httpx

from app.domains.mlb.schemas_team_preview import (
    MlbTeamBatterSeasonRow,
    MlbTeamPitcherSeasonRow,
)
from app.providers.mlb_stats.roster import ActiveRosterEntry

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
TEAM_PLAYER_SEASON_TTL_SECONDS = 900.0

_RowT = TypeVar("_RowT", MlbTeamBatterSeasonRow, MlbTeamPitcherSeasonRow)

_team_player_season_cache: dict[
    str, tuple[float, list[MlbTeamBatterSeasonRow] | list[MlbTeamPitcherSeasonRow]]
] = {}


def clear_team_player_season_cache() -> None:
    """Clear cached Stats API player-season responses for test isolation."""
    _team_player_season_cache.clear()


def ip_to_float(ip: str | None) -> float | None:
    """Convert innings pitched display (e.g. ``130.1``) to outs-based float."""
    if not ip:
        return None
    try:
        if "." in ip:
            whole, frac = ip.split(".", 1)
            return int(whole) + (int(frac) / 3.0 if frac else 0.0)
        return float(ip)
    except ValueError:
        return None


def _coerce_int(raw: Any) -> int | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _display_str(raw: Any) -> str | None:
    if raw is None:
        return None
    return str(raw)


def _player_display_name(person: dict[str, Any]) -> str:
    boxscore = person.get("boxscoreName")
    if isinstance(boxscore, str) and boxscore.strip():
        return boxscore
    full = person.get("fullName")
    if isinstance(full, str) and full.strip():
        return full
    return ""


def parse_batter_season_row(
    player_id: str,
    person: dict[str, Any],
    stat: dict[str, Any],
) -> MlbTeamBatterSeasonRow:
    """Map a Stats API hitting split to a batting season roster row."""
    return MlbTeamBatterSeasonRow(
        player_id=str(player_id),
        name=_player_display_name(person),
        g=_coerce_int(stat.get("gamesPlayed")),
        avg=_display_str(stat.get("avg")),
        obp=_display_str(stat.get("obp")),
        slg=_display_str(stat.get("slg")),
        ops=_display_str(stat.get("ops")),
        ab=_coerce_int(stat.get("atBats")),
        r=_coerce_int(stat.get("runs")),
        h=_coerce_int(stat.get("hits")),
        hr=_coerce_int(stat.get("homeRuns")),
        rbi=_coerce_int(stat.get("rbi")),
        bb=_coerce_int(stat.get("baseOnBalls")),
        so=_coerce_int(stat.get("strikeOuts")),
        sb=_coerce_int(stat.get("stolenBases")),
    )


def parse_pitcher_season_row(
    player_id: str,
    person: dict[str, Any],
    stat: dict[str, Any],
) -> MlbTeamPitcherSeasonRow:
    """Map a Stats API pitching split to a pitching season roster row."""
    return MlbTeamPitcherSeasonRow(
        player_id=str(player_id),
        name=_player_display_name(person),
        g=_coerce_int(stat.get("gamesPlayed")),
        gs=_coerce_int(stat.get("gamesStarted")),
        w=_coerce_int(stat.get("wins")),
        l=_coerce_int(stat.get("losses")),
        sv=_coerce_int(stat.get("saves")),
        ip=_display_str(stat.get("inningsPitched")),
        h=_coerce_int(stat.get("hits")),
        er=_coerce_int(stat.get("earnedRuns")),
        bb=_coerce_int(stat.get("baseOnBalls")),
        so=_coerce_int(stat.get("strikeOuts")),
        era=_display_str(stat.get("era")),
        whip=_display_str(stat.get("whip")),
    )


def _ops_sort_key(ops: str | None) -> float:
    if ops is None:
        return float("-inf")
    try:
        return float(ops)
    except ValueError:
        return float("-inf")


def sort_batter_rows(rows: list[MlbTeamBatterSeasonRow]) -> list[MlbTeamBatterSeasonRow]:
    """Sort batters by OPS descending; null/unparseable OPS last."""
    return sorted(rows, key=lambda row: _ops_sort_key(row.ops), reverse=True)


def sort_pitcher_rows(
    rows: list[MlbTeamPitcherSeasonRow],
) -> list[MlbTeamPitcherSeasonRow]:
    """Sort pitchers by innings pitched descending; null IP last."""
    return sorted(
        rows,
        key=lambda row: (
            ip_to_float(row.ip) is None,
            -(ip_to_float(row.ip) or 0.0),
        ),
    )


def filter_rows_to_roster(rows: list[_RowT], roster_ids: set[str]) -> list[_RowT]:
    """Keep rows whose player_id is in ``roster_ids``; empty set leaves rows unchanged."""
    if not roster_ids:
        return rows
    return [row for row in rows if row.player_id in roster_ids]


def _empty_batter_row(player_id: str, name: str) -> MlbTeamBatterSeasonRow:
    return MlbTeamBatterSeasonRow(
        player_id=player_id,
        name=name,
        g=None,
        avg=None,
        obp=None,
        slg=None,
        ops=None,
        ab=None,
        r=None,
        h=None,
        hr=None,
        rbi=None,
        bb=None,
        so=None,
        sb=None,
    )


def _empty_pitcher_row(player_id: str, name: str) -> MlbTeamPitcherSeasonRow:
    return MlbTeamPitcherSeasonRow(
        player_id=player_id,
        name=name,
        g=None,
        gs=None,
        w=None,
        l=None,
        sv=None,
        ip=None,
        h=None,
        er=None,
        bb=None,
        so=None,
        era=None,
        whip=None,
    )


def merge_batter_rows_for_roster(
    entries: list[ActiveRosterEntry],
    season_rows: list[MlbTeamBatterSeasonRow],
) -> list[MlbTeamBatterSeasonRow]:
    """One batting row per non-pitcher on the active roster (season stats when present).

    Empty ``entries`` falls back to ``season_rows`` (roster soft-fail).
    """
    if not entries:
        return sort_batter_rows(list(season_rows))
    by_id = {row.player_id: row for row in season_rows}
    merged: list[MlbTeamBatterSeasonRow] = []
    for entry in entries:
        if entry.position_type == "Pitcher":
            continue
        season = by_id.get(entry.player_id)
        if season is not None:
            if not season.name and entry.name:
                merged.append(season.model_copy(update={"name": entry.name}))
            else:
                merged.append(season)
        else:
            merged.append(_empty_batter_row(entry.player_id, entry.name))
    return sort_batter_rows(merged)


def merge_pitcher_rows_for_roster(
    entries: list[ActiveRosterEntry],
    season_rows: list[MlbTeamPitcherSeasonRow],
) -> list[MlbTeamPitcherSeasonRow]:
    """One pitching row per pitcher on the active roster (season stats when present).

    Empty ``entries`` falls back to ``season_rows`` (roster soft-fail).
    """
    if not entries:
        return sort_pitcher_rows(list(season_rows))
    by_id = {row.player_id: row for row in season_rows}
    merged: list[MlbTeamPitcherSeasonRow] = []
    for entry in entries:
        if entry.position_type != "Pitcher":
            continue
        season = by_id.get(entry.player_id)
        if season is not None:
            if not season.name and entry.name:
                merged.append(season.model_copy(update={"name": entry.name}))
            else:
                merged.append(season)
        else:
            merged.append(_empty_pitcher_row(entry.player_id, entry.name))
    return sort_pitcher_rows(merged)


def _parse_splits(
    payload: dict[str, Any],
    *,
    group: str,
) -> list[MlbTeamBatterSeasonRow] | list[MlbTeamPitcherSeasonRow]:
    stats = payload.get("stats") or []
    splits = (stats[0].get("splits") or []) if stats else []
    if group == "hitting":
        batters: list[MlbTeamBatterSeasonRow] = []
        for split in splits:
            player = split.get("player") or {}
            player_id = player.get("id")
            if player_id is None:
                continue
            batters.append(
                parse_batter_season_row(
                    str(player_id),
                    player,
                    split.get("stat") or {},
                )
            )
        return sort_batter_rows(batters)

    pitchers: list[MlbTeamPitcherSeasonRow] = []
    for split in splits:
        player = split.get("player") or {}
        player_id = player.get("id")
        if player_id is None:
            continue
        pitchers.append(
            parse_pitcher_season_row(
                str(player_id),
                player,
                split.get("stat") or {},
            )
        )
    return sort_pitcher_rows(pitchers)


async def _fetch_group_rows(
    client: httpx.AsyncClient,
    team_id: int,
    season: int,
    group: str,
) -> list[MlbTeamBatterSeasonRow] | list[MlbTeamPitcherSeasonRow]:
    cache_key = f"{team_id}|{season}|{group}"
    cached = _team_player_season_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < TEAM_PLAYER_SEASON_TTL_SECONDS:
        return cached[1]

    try:
        # Omit limit so the API returns every team split; we filter to the active
        # roster afterward and a default cap would drop bench/IL players.
        response = await client.get(
            f"{STATS_BASE}/stats",
            params={
                "stats": "season",
                "group": group,
                "season": season,
                "sportIds": 1,
                "teamId": team_id,
            },
        )
        response.raise_for_status()
        rows = _parse_splits(response.json(), group=group)
    except Exception as exc:
        logger.warning(
            "team player season %s failed for team=%s season=%s: %s",
            group,
            team_id,
            season,
            exc,
        )
        return []

    if rows:
        _team_player_season_cache[cache_key] = (time.monotonic(), rows)
    return rows


async def fetch_team_batter_season_rows(
    client: httpx.AsyncClient,
    team_id: int,
    season: int,
) -> list[MlbTeamBatterSeasonRow]:
    """Fetch, parse, and sort team season batting rows (cached)."""
    rows = await _fetch_group_rows(client, team_id, season, "hitting")
    return [row for row in rows if isinstance(row, MlbTeamBatterSeasonRow)]


async def fetch_team_pitcher_season_rows(
    client: httpx.AsyncClient,
    team_id: int,
    season: int,
) -> list[MlbTeamPitcherSeasonRow]:
    """Fetch, parse, and sort team season pitching rows (cached)."""
    rows = await _fetch_group_rows(client, team_id, season, "pitching")
    return [row for row in rows if isinstance(row, MlbTeamPitcherSeasonRow)]
