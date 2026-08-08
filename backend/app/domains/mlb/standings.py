from __future__ import annotations

from typing import Any

from app.domains.mlb.schemas_standings import (
    LeagueKey,
    MlbStandingsDivision,
    MlbStandingsLeague,
    MlbStandingsResponse,
    MlbStandingsRow,
)
from app.domains.mlb.team_names import canonical_mlb_abbrev

_LEAGUE_META: dict[int, tuple[LeagueKey, str]] = {
    103: ("al", "American League"),
    104: ("nl", "National League"),
}

# division_id -> (division_key, label, league_key)
_DIVISION_META: dict[int, tuple[str, str, LeagueKey]] = {
    201: ("al_east", "AL East", "al"),
    202: ("al_central", "AL Central", "al"),
    200: ("al_west", "AL West", "al"),
    204: ("nl_east", "NL East", "nl"),
    205: ("nl_central", "NL Central", "nl"),
    203: ("nl_west", "NL West", "nl"),
}

_DIVISION_ORDER = (
    "al_east",
    "al_central",
    "al_west",
    "nl_east",
    "nl_central",
    "nl_west",
)

_DIVISION_LEAGUE: dict[str, LeagueKey] = {
    div_key: league_key for div_key, _, league_key in _DIVISION_META.values()
}


def _parse_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _last_ten(record: dict[str, Any]) -> str | None:
    records = record.get("records") or {}
    if not isinstance(records, dict):
        return None
    for split in records.get("splitRecords") or []:
        if not isinstance(split, dict):
            continue
        if split.get("type") != "lastTen":
            continue
        wins = _parse_int(split.get("wins"))
        losses = _parse_int(split.get("losses"))
        if wins is None or losses is None:
            return None
        return f"{wins}-{losses}"
    return None


def _streak_code(record: dict[str, Any]) -> str | None:
    streak = record.get("streak")
    if not isinstance(streak, dict):
        return None
    code = str(streak.get("streakCode") or "").strip()
    return code or None


def _row_from_team_record(
    record: dict[str, Any],
    team_id_to_abbrev: dict[int, str],
) -> MlbStandingsRow | None:
    team = record.get("team") or {}
    if not isinstance(team, dict):
        return None

    team_id = _parse_int(team.get("id"))
    if team_id is None:
        return None

    raw_abbrev = team_id_to_abbrev.get(team_id)
    abbrev = canonical_mlb_abbrev(raw_abbrev)
    if not abbrev:
        return None

    name = str(team.get("name") or "").strip()
    if not name:
        return None

    rank = _parse_int(record.get("divisionRank"))
    wins = _parse_int(record.get("wins"))
    losses = _parse_int(record.get("losses"))
    if rank is None or wins is None or losses is None:
        return None

    pct = str(record.get("winningPercentage") or "").strip()
    if not pct:
        return None

    gb_raw = record.get("gamesBack")
    if gb_raw is None:
        return None
    gb = str(gb_raw).strip()

    l10 = _last_ten(record)
    if not l10:
        return None

    streak = _streak_code(record)
    if not streak:
        return None

    return MlbStandingsRow(
        rank=rank,
        team_id=str(team_id),
        abbrev=abbrev,
        name=name,
        logo_url=None,
        wins=wins,
        losses=losses,
        wl=f"{wins}-{losses}",
        pct=pct,
        gb=gb,
        l10=l10,
        streak=streak,
    )


def _season_from_payload(
    payload: dict[str, Any],
    *,
    season: int | None,
) -> int:
    for block in payload.get("records") or []:
        if not isinstance(block, dict):
            continue
        for record in block.get("teamRecords") or []:
            if not isinstance(record, dict):
                continue
            parsed = _parse_int(record.get("season"))
            if parsed is not None:
                return parsed
    if season is not None:
        return season
    raise ValueError("MLB standings payload missing season")


def normalize_mlb_standings(
    payload: dict[str, Any],
    team_id_to_abbrev: dict[int, str],
    *,
    season: int | None = None,
) -> MlbStandingsResponse:
    resolved_season = _season_from_payload(payload, season=season)

    divisions_by_key: dict[str, MlbStandingsDivision] = {}

    for block in payload.get("records") or []:
        if not isinstance(block, dict):
            continue

        league_obj = block.get("league") or {}
        division_obj = block.get("division") or {}
        if not isinstance(league_obj, dict) or not isinstance(division_obj, dict):
            continue

        league_id = _parse_int(league_obj.get("id"))
        division_id = _parse_int(division_obj.get("id"))
        if league_id is None or division_id is None:
            continue

        if league_id not in _LEAGUE_META or division_id not in _DIVISION_META:
            continue

        div_key, div_label, div_league_key = _DIVISION_META[division_id]
        league_key, _ = _LEAGUE_META[league_id]
        if div_league_key != league_key:
            continue

        teams: list[MlbStandingsRow] = []
        for record in block.get("teamRecords") or []:
            if not isinstance(record, dict):
                continue
            row = _row_from_team_record(record, team_id_to_abbrev)
            if row is not None:
                teams.append(row)

        divisions_by_key[div_key] = MlbStandingsDivision(
            key=div_key,
            label=div_label,
            teams=teams,
        )

    leagues: list[MlbStandingsLeague] = []
    for league_key, league_label in (("al", "American League"), ("nl", "National League")):
        divisions = [
            divisions_by_key[key]
            for key in _DIVISION_ORDER
            if key in divisions_by_key and _DIVISION_LEAGUE[key] == league_key
        ]
        if divisions:
            leagues.append(
                MlbStandingsLeague(
                    key=league_key,
                    label=league_label,
                    divisions=divisions,
                )
            )

    return MlbStandingsResponse(season=resolved_season, leagues=leagues)
