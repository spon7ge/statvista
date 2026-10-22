"""Assemble Away/Home team-preview payload for a WNBA game."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from app.domains.betting.basketball_advanced_stats import load_player_advanced
from app.domains.betting.player_match_keys import match_player_key
from app.domains.wnba.game_detail import get_game_detail, is_valid_espn_event_id
from app.domains.wnba.schemas_game_detail import GameDetailTeam
from app.domains.wnba.schemas_team_preview import (
    WnbaTeamLeaderCard,
    WnbaTeamPreviewResponse,
    WnbaTeamPreviewTeam,
    WnbaTeamRosterRow,
)
from app.providers.espn.wnba_team_player_stats import (
    build_team_leaders,
    fetch_league_player_stat_map,
    fetch_team_roster_athletes,
    merge_roster_rows,
)

logger = logging.getLogger(__name__)


def _preview_team(team: GameDetailTeam) -> WnbaTeamPreviewTeam:
    return WnbaTeamPreviewTeam(
        id=team.id,
        abbrev=team.abbrev,
        name=team.name,
        logo_url=team.logo_url,
    )


def _with_cached_advanced(roster: list[WnbaTeamRosterRow]) -> list[WnbaTeamRosterRow]:
    index = load_player_advanced("wnba")
    if not index:
        return roster
    attached: list[WnbaTeamRosterRow] = []
    for row in roster:
        stats = index.get(match_player_key(row.name))
        attached.append(row.model_copy(update=dict(stats)) if stats else row)
    return attached


def _season_year() -> int:
    return datetime.now(timezone.utc).year


async def get_wnba_team_preview(
    espn_event_id: str,
    side: Literal["away", "home"],
) -> WnbaTeamPreviewResponse:
    if not is_valid_espn_event_id(espn_event_id):
        raise LookupError("Game not found")

    detail = await get_game_detail(espn_event_id)
    team = detail.away if side == "away" else detail.home
    preview_team = _preview_team(team)

    leaders: list[WnbaTeamLeaderCard] = []
    roster: list[WnbaTeamRosterRow] = []

    athletes = []
    try:
        athletes = await fetch_team_roster_athletes(team.id)
    except Exception as exc:
        logger.warning("WNBA team roster failed for %s: %s", team.id, exc)

    stats_by_id = {}
    try:
        stats_by_id = await fetch_league_player_stat_map(_season_year())
    except Exception as exc:
        logger.warning("WNBA league player stats failed: %s", exc)

    if athletes:
        roster = merge_roster_rows(athletes, stats_by_id)
        roster = _with_cached_advanced(roster)
        if stats_by_id:
            try:
                leaders = build_team_leaders(roster, stats_by_id)
            except Exception as exc:
                logger.warning("WNBA team leaders failed for %s: %s", team.id, exc)
                leaders = []

    return WnbaTeamPreviewResponse(
        side=side,
        team=preview_team,
        leaders=leaders,
        roster=roster,
    )
