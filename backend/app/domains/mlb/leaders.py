from __future__ import annotations

from app.domains.mlb.schemas_leaders import (
    MlbLeaderCategory,
    MlbLeaderRow,
    MlbLeadersResponse,
)

CATEGORY_SPECS: list[tuple[str, str, str, str, str]] = [
    ("avg", "Batting Average", "AVG", "battingAverage", "hitting"),
    ("hr", "Home Runs", "HR", "homeRuns", "hitting"),
    ("rbi", "RBI", "RBI", "runsBattedIn", "hitting"),
    ("sb", "Stolen Bases", "SB", "stolenBases", "hitting"),
    ("ops", "OPS", "OPS", "onBasePlusSlugging", "hitting"),
    ("hits", "Hits", "H", "hits", "hitting"),
    ("era", "ERA", "ERA", "earnedRunAverage", "pitching"),
    ("whip", "WHIP", "WHIP", "walksAndHitsPerInningPitched", "pitching"),
    ("so", "Strikeouts", "SO", "strikeouts", "pitching"),
    ("w", "Wins", "W", "wins", "pitching"),
    ("sv", "Saves", "SV", "saves", "pitching"),
    ("ip", "Innings Pitched", "IP", "inningsPitched", "pitching"),
]
TOP_N = 10


def normalize_category_payload(
    payload: dict,
    *,
    key: str,
    label: str,
    stat: str,
    team_id_to_abbrev: dict[int, str],
) -> MlbLeaderCategory:
    blocks = payload.get("leagueLeaders") or []
    raw_leaders = (blocks[0] or {}).get("leaders") or [] if blocks else []
    leaders: list[MlbLeaderRow] = []
    for entry in raw_leaders:
        if len(leaders) >= TOP_N:
            break
        person = entry.get("person") or {}
        team = entry.get("team") or {}
        pid = person.get("id")
        name = str(person.get("fullName") or "").strip()
        value = str(entry.get("value") or "").strip()
        try:
            rank = int(entry.get("rank"))
        except (TypeError, ValueError):
            continue
        if pid is None or not name or not value:
            continue
        tid = team.get("id")
        abbrev = team_id_to_abbrev.get(int(tid), "???") if tid is not None else "???"
        leaders.append(
            MlbLeaderRow(
                rank=rank,
                player_id=str(pid),
                name=name,
                team_abbrev=abbrev,
                gp=None,
                value=value,
            )
        )
    return MlbLeaderCategory(key=key, label=label, stat=stat, leaders=leaders)


def assemble_mlb_leaders(
    categories: list[MlbLeaderCategory], *, season: int
) -> MlbLeadersResponse:
    return MlbLeadersResponse(season=season, pace="season", categories=categories)
