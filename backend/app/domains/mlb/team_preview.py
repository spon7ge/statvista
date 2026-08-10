"""Assemble Away/Home team-preview payload for an MLB game."""

from __future__ import annotations

import logging
from typing import Literal

import httpx

from app.domains.mlb.game_detail import (
    STATS_TIMEOUT_SECONDS,
    get_mlb_game_detail,
    is_valid_mlb_game_pk,
)
from app.domains.mlb.schemas_game_detail import MlbGameDetailTeam
from app.domains.mlb.schemas_team_preview import (
    MlbTeamBatterSeasonRow,
    MlbTeamLeaderCard,
    MlbTeamPitcherSeasonRow,
    MlbTeamPreviewResponse,
    MlbTeamPreviewTeam,
)
from app.providers.mlb_stats.roster import fetch_active_roster_player_ids
from app.providers.mlb_stats.team_leaders import (
    BATTING_LEADER_KEYS,
    PITCHING_LEADER_KEYS,
    fetch_team_leaders,
)
from app.providers.mlb_stats.team_player_season import (
    fetch_team_batter_season_rows,
    fetch_team_pitcher_season_rows,
    filter_rows_to_roster,
)

logger = logging.getLogger(__name__)


def _preview_team(team: MlbGameDetailTeam) -> MlbTeamPreviewTeam:
    return MlbTeamPreviewTeam(
        id=team.id,
        abbrev=team.abbrev,
        name=team.name,
        logo_url=team.logo_url,
    )


async def get_mlb_team_preview(
    game_pk: str,
    side: Literal["away", "home"],
) -> MlbTeamPreviewResponse:
    if not is_valid_mlb_game_pk(game_pk):
        raise LookupError("Game not found")

    detail = await get_mlb_game_detail(game_pk)
    team = detail.away if side == "away" else detail.home
    preview_team = _preview_team(team)

    season = int((detail.game_date or "")[:4]) if detail.game_date else None
    if season is None:
        return MlbTeamPreviewResponse(
            side=side,
            team=preview_team,
            batting_leaders=[],
            pitching_leaders=[],
            batting_roster=[],
            pitching_roster=[],
        )

    team_id = int(team.id)
    batting_leaders: list[MlbTeamLeaderCard] = []
    pitching_leaders: list[MlbTeamLeaderCard] = []
    batting_roster: list[MlbTeamBatterSeasonRow] = []
    pitching_roster: list[MlbTeamPitcherSeasonRow] = []

    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        try:
            batting_leaders = await fetch_team_leaders(
                client,
                team_id=team_id,
                season=season,
                keys=BATTING_LEADER_KEYS,
            )
        except Exception as exc:
            logger.warning("team batting leaders failed: %s", exc)

        try:
            pitching_leaders = await fetch_team_leaders(
                client,
                team_id=team_id,
                season=season,
                keys=PITCHING_LEADER_KEYS,
            )
        except Exception as exc:
            logger.warning("team pitching leaders failed: %s", exc)

        roster_ids = await fetch_active_roster_player_ids(client, team_id, season)

        try:
            batting_roster = filter_rows_to_roster(
                await fetch_team_batter_season_rows(client, team_id, season),
                roster_ids,
            )
        except Exception as exc:
            logger.warning("team batting roster failed: %s", exc)

        try:
            pitching_roster = filter_rows_to_roster(
                await fetch_team_pitcher_season_rows(client, team_id, season),
                roster_ids,
            )
        except Exception as exc:
            logger.warning("team pitching roster failed: %s", exc)

    return MlbTeamPreviewResponse(
        side=side,
        team=preview_team,
        batting_leaders=batting_leaders,
        pitching_leaders=pitching_leaders,
        batting_roster=batting_roster,
        pitching_roster=pitching_roster,
    )
