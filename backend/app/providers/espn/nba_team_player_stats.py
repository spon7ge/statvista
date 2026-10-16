"""ESPN NBA roster identity + season player averages for team-preview."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.domains.nba.game_leaders import last_name_from_full
from app.domains.nba.schemas_team_preview import (
    NbaTeamLeaderCard,
    NbaTeamRosterRow,
    TeamLeaderKey,
)
from app.providers.espn.nba_roster import ESPN_ROSTER_URL, ESPN_TIMEOUT_SECONDS

ESPN_BYATHLETE_URL = (
    "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba"
    "/seasons/{season}/types/2/statistics/0/byathlete"
)
_ESPN_HEADERS = {"User-Agent": "Mozilla/5.0"}
_ATHLETE_ID_RE = re.compile(r"/athletes/(\d+)")

_LEADER_KEYS: tuple[TeamLeaderKey, ...] = ("ppg", "rpg", "apg", "bpg", "spg")
_LABEL: dict[TeamLeaderKey, str] = {
    "ppg": "PPG",
    "rpg": "RPG",
    "apg": "APG",
    "bpg": "BPG",
    "spg": "SPG",
}
_VALUE_ATTR: dict[TeamLeaderKey, str] = {
    "ppg": "pts_value",
    "rpg": "reb_value",
    "apg": "ast_value",
    "bpg": "blk_value",
    "spg": "stl_value",
}
_RANK_ATTR: dict[TeamLeaderKey, str] = {
    "ppg": "pts_rank",
    "rpg": "reb_rank",
    "apg": "ast_rank",
    "bpg": "blk_rank",
    "spg": "stl_rank",
}
_DISPLAY_ATTR: dict[TeamLeaderKey, str] = {
    "ppg": "pts",
    "rpg": "reb",
    "apg": "ast",
    "bpg": "blk",
    "spg": "stl",
}


@dataclass(frozen=True)
class RosterAthlete:
    player_id: str
    name: str
    jersey: str | None
    position: str | None
    headshot_url: str | None
    last_name: str


@dataclass(frozen=True)
class PlayerSeasonStats:
    gp: int | None = None
    min: str | None = None
    pts: str | None = None
    reb: str | None = None
    ast: str | None = None
    stl: str | None = None
    blk: str | None = None
    to: str | None = None
    fg_pct: str | None = None
    fg3_pct: str | None = None
    ft_pct: str | None = None
    pts_value: float | None = None
    reb_value: float | None = None
    ast_value: float | None = None
    stl_value: float | None = None
    blk_value: float | None = None
    pts_rank: int | None = None
    reb_rank: int | None = None
    ast_rank: int | None = None
    stl_rank: int | None = None
    blk_rank: int | None = None
    sh_eff: str | None = None
    sc_eff: str | None = None
    ppep: str | None = None
    rtg: str | None = None
    plus_minus: str | None = None


def _text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _headshot_url(athlete: dict[str, Any]) -> str | None:
    headshot = athlete.get("headshot")
    if isinstance(headshot, dict):
        return _text(headshot.get("href"))
    return _text(headshot) if isinstance(headshot, str) else None


def _position(athlete: dict[str, Any]) -> str | None:
    position = athlete.get("position")
    return _text(position.get("abbreviation")) if isinstance(position, dict) else None


def parse_roster_athletes(payload: dict[str, Any]) -> list[RosterAthlete]:
    """Parse ESPN site/v2 or common/v3 roster payloads into identity rows."""
    raw_athletes: list[dict[str, Any]] = []
    athletes = payload.get("athletes")
    if isinstance(athletes, list):
        raw_athletes.extend(a for a in athletes if isinstance(a, dict))
    for group in payload.get("positionGroups") or []:
        if not isinstance(group, dict):
            continue
        raw_athletes.extend(
            athlete
            for athlete in group.get("athletes") or []
            if isinstance(athlete, dict)
        )

    parsed: list[RosterAthlete] = []
    seen: set[str] = set()
    for athlete in raw_athletes:
        player_id = _text(athlete.get("id"))
        name = _text(athlete.get("displayName") or athlete.get("fullName"))
        if not player_id or not name or player_id in seen:
            continue
        seen.add(player_id)
        parsed.append(
            RosterAthlete(
                player_id=player_id,
                name=name,
                jersey=_text(athlete.get("jersey")),
                position=_position(athlete),
                headshot_url=_headshot_url(athlete),
                last_name=_text(athlete.get("lastName"))
                or last_name_from_full(name),
            )
        )
    return parsed


def _as_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _as_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed else None


def _display(stat: dict[str, Any] | None) -> str | None:
    return _text(stat.get("displayValue")) if stat else None


def _flatten_item_stats(item: dict[str, Any]) -> dict[str, dict[str, Any]]:
    splits = item.get("splits")
    categories = splits.get("categories") if isinstance(splits, dict) else None
    if not isinstance(categories, list):
        return {}
    flattened: dict[str, dict[str, Any]] = {}
    for category in categories:
        if not isinstance(category, dict):
            continue
        for stat in category.get("stats") or []:
            if not isinstance(stat, dict):
                continue
            name = _text(stat.get("name"))
            if name and name not in flattened:
                flattened[name] = stat
    return flattened


def _stats_from_flat(stats: dict[str, dict[str, Any]]) -> PlayerSeasonStats:
    three_point = stats.get("threePointPct") or stats.get("threePointFieldGoalPct")

    def value(name: str) -> float | None:
        return _as_float((stats.get(name) or {}).get("value"))

    def rank(name: str) -> int | None:
        return _as_int((stats.get(name) or {}).get("rank"))

    return PlayerSeasonStats(
        gp=_as_int((stats.get("gamesPlayed") or {}).get("value")),
        min=_display(stats.get("avgMinutes")),
        pts=_display(stats.get("avgPoints")),
        reb=_display(stats.get("avgRebounds")),
        ast=_display(stats.get("avgAssists")),
        stl=_display(stats.get("avgSteals")),
        blk=_display(stats.get("avgBlocks")),
        to=_display(stats.get("avgTurnovers")),
        fg_pct=_display(stats.get("fieldGoalPct")),
        fg3_pct=_display(three_point),
        ft_pct=_display(stats.get("freeThrowPct")),
        pts_value=value("avgPoints"),
        reb_value=value("avgRebounds"),
        ast_value=value("avgAssists"),
        stl_value=value("avgSteals"),
        blk_value=value("avgBlocks"),
        pts_rank=rank("avgPoints"),
        reb_rank=rank("avgRebounds"),
        ast_rank=rank("avgAssists"),
        stl_rank=rank("avgSteals"),
        blk_rank=rank("avgBlocks"),
        sh_eff=_display(stats.get("shootingEfficiency")),
        sc_eff=_display(stats.get("scoringEfficiency")),
        ppep=_display(stats.get("pointsPerEstimatedPossessions")),
        rtg=_display(stats.get("NBARating")),
        plus_minus=_display(stats.get("plusMinus")),
    )


def parse_byathlete_stat_map(
    payload: dict[str, Any],
) -> dict[str, PlayerSeasonStats]:
    """Map athlete id to season averages from a core byathlete payload."""
    parsed: dict[str, PlayerSeasonStats] = {}
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        athlete = item.get("athlete")
        if not isinstance(athlete, dict):
            continue
        ref = _text(athlete.get("$ref")) or ""
        match = _ATHLETE_ID_RE.search(ref)
        player_id = match.group(1) if match else _text(athlete.get("id"))
        if player_id:
            parsed[player_id] = _stats_from_flat(_flatten_item_stats(item))
    return parsed


def merge_roster_rows(
    athletes: list[RosterAthlete],
    stats_by_id: dict[str, PlayerSeasonStats],
) -> list[NbaTeamRosterRow]:
    """Join roster identity with season averages; sort by PPG desc."""
    rows = []
    for athlete in athletes:
        stats = stats_by_id.get(athlete.player_id) or PlayerSeasonStats()
        rows.append(
            NbaTeamRosterRow(
                player_id=athlete.player_id,
                name=athlete.name,
                jersey=athlete.jersey,
                position=athlete.position,
                gp=stats.gp,
                min=stats.min,
                pts=stats.pts,
                reb=stats.reb,
                ast=stats.ast,
                stl=stats.stl,
                blk=stats.blk,
                to=stats.to,
                fg_pct=stats.fg_pct,
                fg3_pct=stats.fg3_pct,
                ft_pct=stats.ft_pct,
                sh_eff=stats.sh_eff,
                sc_eff=stats.sc_eff,
                ppep=stats.ppep,
                rtg=stats.rtg,
                plus_minus=stats.plus_minus,
                headshot_url=athlete.headshot_url,
            )
        )
    rows.sort(
        key=lambda row: (
            stats_by_id.get(row.player_id) is None
            or stats_by_id[row.player_id].pts_value is None,
            -(stats_by_id[row.player_id].pts_value or 0)
            if row.player_id in stats_by_id
            else 0,
        )
    )
    return rows


def build_team_leaders(
    rows: list[NbaTeamRosterRow],
    stats_by_id: dict[str, PlayerSeasonStats],
) -> list[NbaTeamLeaderCard]:
    """Pick team PPG / RPG / APG / BPG / SPG leaders from roster rows."""
    by_id = {row.player_id: row for row in rows}
    leaders: list[NbaTeamLeaderCard] = []
    for key in _LEADER_KEYS:
        eligible = [
            (player_id, stats)
            for player_id, stats in stats_by_id.items()
            if player_id in by_id and getattr(stats, _VALUE_ATTR[key]) is not None
        ]
        if not eligible:
            continue
        player_id, stats = max(
            eligible, key=lambda item: getattr(item[1], _VALUE_ATTR[key])
        )
        display = getattr(stats, _DISPLAY_ATTR[key])
        if not display:
            continue
        row = by_id[player_id]
        leaders.append(
            NbaTeamLeaderCard(
                key=key,
                label=_LABEL[key],
                rank=getattr(stats, _RANK_ATTR[key]),
                value=display,
                player_id=player_id,
                last_name=last_name_from_full(row.name),
                headshot_url=row.headshot_url,
            )
        )
    return leaders


async def fetch_team_roster_athletes(team_id: str) -> list[RosterAthlete]:
    url = ESPN_ROSTER_URL.format(team_id=team_id)
    async with httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS) as client:
        response = await client.get(url, headers=_ESPN_HEADERS)
        response.raise_for_status()
        return parse_roster_athletes(response.json())


async def fetch_league_player_stat_map(
    season: int,
) -> dict[str, PlayerSeasonStats]:
    url = ESPN_BYATHLETE_URL.format(season=season)
    async with httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS) as client:
        stats_by_id: dict[str, PlayerSeasonStats] = {}
        page = 1
        page_count = 1
        while page <= page_count:
            response = await client.get(
                url,
                params={
                    "lang": "en",
                    "region": "us",
                    "limit": 300,
                    "page": page,
                },
                headers=_ESPN_HEADERS,
            )
            response.raise_for_status()
            payload = response.json()
            stats_by_id.update(parse_byathlete_stat_map(payload))
            page_count = max(1, _as_int(payload.get("pageCount")) or 1)
            page += 1
        return stats_by_id
