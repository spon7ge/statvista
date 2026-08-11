"""ESPN WNBA roster identity + season player averages for team-preview."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.domains.wnba.game_leaders import last_name_from_full
from app.domains.wnba.schemas_team_preview import (
    TeamLeaderKey,
    WnbaTeamLeaderCard,
    WnbaTeamRosterRow,
)
from app.providers.espn.wnba_roster import ESPN_ROSTER_URL, ESPN_TIMEOUT_SECONDS

ESPN_BYATHLETE_URL = (
    "https://sports.core.api.espn.com/v2/sports/basketball/leagues/wnba"
    "/seasons/{season}/types/2/statistics/0/byathlete"
)
_ESPN_HEADERS = {"User-Agent": "Mozilla/5.0"}

_LEADER_KEYS: tuple[TeamLeaderKey, ...] = (
    "ppg",
    "rpg",
    "apg",
    "fg_pct",
    "fg3_pct",
)
_LABEL: dict[TeamLeaderKey, str] = {
    "ppg": "PPG",
    "rpg": "RPG",
    "apg": "APG",
    "fg_pct": "FG%",
    "fg3_pct": "3FG%",
}
_VALUE_ATTR: dict[TeamLeaderKey, str] = {
    "ppg": "pts_value",
    "rpg": "reb_value",
    "apg": "ast_value",
    "fg_pct": "fg_pct_value",
    "fg3_pct": "fg3_pct_value",
}
_RANK_ATTR: dict[TeamLeaderKey, str] = {
    "ppg": "pts_rank",
    "rpg": "reb_rank",
    "apg": "ast_rank",
    "fg_pct": "fg_pct_rank",
    "fg3_pct": "fg3_pct_rank",
}
_DISPLAY_ATTR: dict[TeamLeaderKey, str] = {
    "ppg": "pts",
    "rpg": "reb",
    "apg": "ast",
    "fg_pct": "fg_pct",
    "fg3_pct": "fg3_pct",
}
# Avoid tiny-sample shooters topping FG% / 3FG% (e.g. 5–9 MPG).
_SHOOTING_LEADER_KEYS: frozenset[TeamLeaderKey] = frozenset({"fg_pct", "fg3_pct"})
_MIN_MPG_FOR_SHOOTING_LEADERS = 15.0
_ATHLETE_ID_RE = re.compile(r"/athletes/(\d+)")


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
    min_value: float | None = None
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
    fg_pct_value: float | None = None
    fg3_pct_value: float | None = None
    pts_rank: int | None = None
    reb_rank: int | None = None
    ast_rank: int | None = None
    fg_pct_rank: int | None = None
    fg3_pct_rank: int | None = None


def _headshot_url(athlete: dict[str, Any]) -> str | None:
    headshot = athlete.get("headshot")
    if isinstance(headshot, dict):
        href = str(headshot.get("href") or "").strip()
        return href or None
    if isinstance(headshot, str):
        return headshot.strip() or None
    return None


def _jersey(athlete: dict[str, Any]) -> str | None:
    raw = athlete.get("jersey")
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def _position(athlete: dict[str, Any]) -> str | None:
    block = athlete.get("position") or {}
    if not isinstance(block, dict):
        return None
    abbrev = str(block.get("abbreviation") or "").strip()
    return abbrev or None


def parse_roster_athletes(payload: dict[str, Any]) -> list[RosterAthlete]:
    """Parse ESPN site/v2 or common/v3 roster payloads into identity rows."""
    athletes: list[dict[str, Any]] = []
    raw = payload.get("athletes")
    if isinstance(raw, list):
        athletes.extend(a for a in raw if isinstance(a, dict))
    for group in payload.get("positionGroups") or []:
        if not isinstance(group, dict):
            continue
        for athlete in group.get("athletes") or []:
            if isinstance(athlete, dict):
                athletes.append(athlete)

    out: list[RosterAthlete] = []
    seen: set[str] = set()
    for athlete in athletes:
        player_id = str(athlete.get("id") or "").strip()
        name = str(athlete.get("displayName") or athlete.get("fullName") or "").strip()
        if not player_id or not name or player_id in seen:
            continue
        seen.add(player_id)
        last = str(athlete.get("lastName") or "").strip() or last_name_from_full(name)
        out.append(
            RosterAthlete(
                player_id=player_id,
                name=name,
                jersey=_jersey(athlete),
                position=_position(athlete),
                headshot_url=_headshot_url(athlete),
                last_name=last,
            )
        )
    return out


def _athlete_id_from_ref(ref: str) -> str | None:
    match = _ATHLETE_ID_RE.search(ref)
    return match.group(1) if match else None


def _as_int(raw: Any) -> int | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return None


def _as_float(raw: Any) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def _display(stat: dict[str, Any] | None) -> str | None:
    if not stat:
        return None
    text = str(stat.get("displayValue") or "").strip()
    return text or None


def _flatten_item_stats(item: dict[str, Any]) -> dict[str, dict[str, Any]]:
    splits = item.get("splits") or {}
    categories = splits.get("categories") if isinstance(splits, dict) else None
    if not isinstance(categories, list):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for category in categories:
        if not isinstance(category, dict):
            continue
        for stat in category.get("stats") or []:
            if not isinstance(stat, dict):
                continue
            name = str(stat.get("name") or "").strip()
            if name and name not in out:
                out[name] = stat
    return out


def _stats_from_flat(flat: dict[str, dict[str, Any]]) -> PlayerSeasonStats:
    fg3 = flat.get("threePointPct") or flat.get("threePointFieldGoalPct")
    return PlayerSeasonStats(
        gp=_as_int((flat.get("gamesPlayed") or {}).get("value")),
        min=_display(flat.get("avgMinutes")),
        min_value=_as_float((flat.get("avgMinutes") or {}).get("value")),
        pts=_display(flat.get("avgPoints")),
        reb=_display(flat.get("avgRebounds")),
        ast=_display(flat.get("avgAssists")),
        stl=_display(flat.get("avgSteals")),
        blk=_display(flat.get("avgBlocks")),
        to=_display(flat.get("avgTurnovers")),
        fg_pct=_display(flat.get("fieldGoalPct")),
        fg3_pct=_display(fg3),
        ft_pct=_display(flat.get("freeThrowPct")),
        pts_value=_as_float((flat.get("avgPoints") or {}).get("value")),
        reb_value=_as_float((flat.get("avgRebounds") or {}).get("value")),
        ast_value=_as_float((flat.get("avgAssists") or {}).get("value")),
        fg_pct_value=_as_float((flat.get("fieldGoalPct") or {}).get("value")),
        fg3_pct_value=_as_float((fg3 or {}).get("value")),
        pts_rank=_as_int((flat.get("avgPoints") or {}).get("rank")),
        reb_rank=_as_int((flat.get("avgRebounds") or {}).get("rank")),
        ast_rank=_as_int((flat.get("avgAssists") or {}).get("rank")),
        fg_pct_rank=_as_int((flat.get("fieldGoalPct") or {}).get("rank")),
        fg3_pct_rank=_as_int((fg3 or {}).get("rank")),
    )


def parse_byathlete_stat_map(payload: dict[str, Any]) -> dict[str, PlayerSeasonStats]:
    """Map athlete id → season averages from a core byathlete payload."""
    out: dict[str, PlayerSeasonStats] = {}
    for item in payload.get("items") or []:
        if not isinstance(item, dict):
            continue
        athlete = item.get("athlete") or {}
        ref = ""
        if isinstance(athlete, dict):
            ref = str(athlete.get("$ref") or athlete.get("id") or "").strip()
        player_id = _athlete_id_from_ref(ref) or (
            str(athlete.get("id")).strip() if isinstance(athlete, dict) else ""
        )
        if not player_id:
            continue
        out[player_id] = _stats_from_flat(_flatten_item_stats(item))
    return out


def merge_roster_rows(
    athletes: list[RosterAthlete],
    stats_by_id: dict[str, PlayerSeasonStats],
) -> list[WnbaTeamRosterRow]:
    """Join roster identity with season averages; sort by PPG desc (nulls last)."""
    rows: list[WnbaTeamRosterRow] = []
    for athlete in athletes:
        stats = stats_by_id.get(athlete.player_id) or PlayerSeasonStats()
        rows.append(
            WnbaTeamRosterRow(
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
                headshot_url=athlete.headshot_url,
            )
        )

    def sort_key(row: WnbaTeamRosterRow) -> tuple[int, float]:
        stats = stats_by_id.get(row.player_id)
        value = stats.pts_value if stats else None
        if value is None:
            return (1, 0.0)
        return (0, -value)

    rows.sort(key=sort_key)
    return rows


def build_team_leaders(
    rows: list[WnbaTeamRosterRow],
    stats_by_id: dict[str, PlayerSeasonStats],
) -> list[WnbaTeamLeaderCard]:
    """Pick team PPG / RPG / APG / FG% / 3FG% leaders from joined roster rows.

    FG% / 3FG% require avg minutes >= `_MIN_MPG_FOR_SHOOTING_LEADERS`.
    """
    by_id = {row.player_id: row for row in rows}
    cards: list[WnbaTeamLeaderCard] = []
    for key in _LEADER_KEYS:
        value_attr = _VALUE_ATTR[key]
        rank_attr = _RANK_ATTR[key]
        display_attr = _DISPLAY_ATTR[key]
        best_id: str | None = None
        best_value: float | None = None
        for player_id, stats in stats_by_id.items():
            if player_id not in by_id:
                continue
            if key in _SHOOTING_LEADER_KEYS:
                mpg = stats.min_value
                if mpg is None or mpg < _MIN_MPG_FOR_SHOOTING_LEADERS:
                    continue
            value = getattr(stats, value_attr)
            if value is None:
                continue
            if best_value is None or value > best_value:
                best_value = value
                best_id = player_id
        if best_id is None:
            continue
        row = by_id[best_id]
        stats = stats_by_id[best_id]
        display = getattr(stats, display_attr) or getattr(row, display_attr, None)
        if not display:
            continue
        cards.append(
            WnbaTeamLeaderCard(
                key=key,
                label=_LABEL[key],
                rank=getattr(stats, rank_attr),
                value=str(display),
                player_id=best_id,
                last_name=last_name_from_full(row.name),
                headshot_url=row.headshot_url,
            )
        )
    return cards


async def fetch_team_roster_athletes(team_id: str) -> list[RosterAthlete]:
    url = ESPN_ROSTER_URL.format(team_id=team_id)
    async with httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS) as client:
        response = await client.get(url, headers=_ESPN_HEADERS)
        response.raise_for_status()
        return parse_roster_athletes(response.json())


async def fetch_league_player_stat_map(season: int) -> dict[str, PlayerSeasonStats]:
    url = ESPN_BYATHLETE_URL.format(season=season)
    async with httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS) as client:
        response = await client.get(
            url,
            params={"lang": "en", "region": "us", "limit": 300},
            headers=_ESPN_HEADERS,
        )
        response.raise_for_status()
        return parse_byathlete_stat_map(response.json())
