"""Assemble Away/Home team-preview payload for a WNBA game."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

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
