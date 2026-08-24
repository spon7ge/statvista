"""Opponent ERA / OPS / pace ranks for MLB prop-board matchup pills."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.providers.mlb_stats.team_season import (
    competition_rank,
    era_from_pitching_stat,
    ops_from_hitting_stat,
    pa_per_game_from_hitting_stat,
)

# Canonical keys from ``prop_stat_keys`` — batter vs pitcher pick the
# opponent's staff ERA vs offense OPS (1 = toughest).
BATTER_STATS = frozenset({
    "hits", "hits_runs_rbis", "home_runs", "rbis", "runs", "singles",
    "doubles", "triples", "stolen_bases", "total_bases", "walks",
    "batter_strikeouts", "plate_appearances",
})
PITCHER_STATS = frozenset({
    "pitcher_strikeouts", "hits_allowed", "walks_allowed",
    "earned_runs_allowed", "runs_allowed", "pitching_outs", "pitches_thrown",
})


def is_pitcher_stat(stat: str) -> bool:
    return stat in PITCHER_STATS


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


@dataclass(frozen=True)
class TeamRankRow:
    abbrev: str
    era_rank: int | None
    ops_rank: int | None
    pace_rank: int | None


def def_and_pace_ranks(
    stat: str,
    opponent_abbrev: str | None,
    ranks: dict[str, TeamRankRow],
) -> tuple[int | None, str | None, int | None, str | None]:
    if not opponent_abbrev:
        return None, None, None, None
    row = ranks.get(opponent_abbrev)
    if row is None:
        return None, None, None, None
    def_rank = row.ops_rank if is_pitcher_stat(stat) else row.era_rank
    def_label = f"{_ordinal(def_rank)} {row.abbrev}" if def_rank is not None else None
    pace_label = (
        f"{_ordinal(row.pace_rank)} {row.abbrev}" if row.pace_rank is not None else None
    )
    return def_rank, def_label, row.pace_rank, pace_label


def _row_abbrev(row: dict[str, Any]) -> str | None:
    abbrev = row.get("abbrev")
    if isinstance(abbrev, str) and abbrev:
        return abbrev
    team = row.get("team") or {}
    if isinstance(team, dict):
        team_abbrev = team.get("abbreviation")
        if isinstance(team_abbrev, str) and team_abbrev:
            return team_abbrev
    return None


def _row_stat(row: dict[str, Any]) -> dict[str, Any]:
    stat = row.get("stat")
    return stat if isinstance(stat, dict) else row


def _index_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        abbrev = _row_abbrev(row)
        if abbrev is None:
            continue
        indexed[abbrev] = _row_stat(row)
    return indexed


def _ranks_by_abbrev(
    values: dict[str, float],
    *,
    lower_is_better: bool,
) -> dict[str, int]:
    ordered = list(values.items())
    by_index = competition_rank(
        [(index, value) for index, (_, value) in enumerate(ordered)],
        lower_is_better=lower_is_better,
    )
    return {ordered[index][0]: rank for index, rank in by_index.items()}


def build_team_rank_index(
    hitting_rows: list[dict[str, Any]],
    pitching_rows: list[dict[str, Any]],
) -> dict[str, TeamRankRow]:
    """League ERA / OPS / PA-per-game ranks keyed by team abbreviation."""
    hitting_by = _index_rows(hitting_rows)
    pitching_by = _index_rows(pitching_rows)
    abbrevs = set(hitting_by) | set(pitching_by)

    era_values: dict[str, float] = {}
    ops_values: dict[str, float] = {}
    pace_values: dict[str, float] = {}
    for abbrev in abbrevs:
        era = era_from_pitching_stat(pitching_by.get(abbrev, {}))
        if era is not None:
            era_values[abbrev] = era
        ops = ops_from_hitting_stat(hitting_by.get(abbrev, {}))
        if ops is not None:
            ops_values[abbrev] = ops
        pace = pa_per_game_from_hitting_stat(hitting_by.get(abbrev, {}))
        if pace is not None:
            pace_values[abbrev] = pace

    era_ranks = _ranks_by_abbrev(era_values, lower_is_better=True)
    ops_ranks = _ranks_by_abbrev(ops_values, lower_is_better=False)
    pace_ranks = _ranks_by_abbrev(pace_values, lower_is_better=False)
    return {
        abbrev: TeamRankRow(
            abbrev=abbrev,
            era_rank=era_ranks.get(abbrev),
            ops_rank=ops_ranks.get(abbrev),
            pace_rank=pace_ranks.get(abbrev),
        )
        for abbrev in abbrevs
    }
