from __future__ import annotations

import asyncio
import logging
from typing import Literal, cast

import httpx

from app.domains.mlb.leaders import (
    CATEGORY_SPECS,
    fetch_category_payload,
    fetch_team_abbrev_map,
    normalize_category_payload,
)
from app.domains.mlb.schemas_leaders import MlbLeaderCategory
from app.domains.mlb.schemas_team_preview import MlbTeamLeaderCard, TeamLeaderKey
from app.providers.espn.mlb_roster import get_mlb_player_index
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.mlb_stats.game_leaders import last_name_from_full
from app.providers.mlb_stats.roster import fetch_active_roster_player_ids

logger = logging.getLogger(__name__)

BATTING_LEADER_KEYS: tuple[TeamLeaderKey, ...] = ("hr", "avg", "ops")
PITCHING_LEADER_KEYS: tuple[TeamLeaderKey, ...] = ("era", "so", "whip")
TEAM_BOARD_LIMIT = 100
_LABEL: dict[TeamLeaderKey, str] = {
    "hr": "HR",
    "avg": "AVG",
    "ops": "OPS",
    "era": "ERA",
    "so": "SO",
    "whip": "WHIP",
}


def select_team_leader_specs(
    keys: tuple[str, ...],
) -> list[tuple[str, str, str, str, str, Literal["asc", "desc"]]]:
    by_key = {spec[0]: spec for spec in CATEGORY_SPECS}
    return [by_key[key] for key in keys]


def pick_team_leader_from_board(
    category: MlbLeaderCategory,
    *,
    roster_ids: set[str],
    headshot_by_norm: dict[str, str | None],
) -> MlbTeamLeaderCard | None:
    key = cast(TeamLeaderKey, category.key)
    for row in category.leaders:
        if row.player_id not in roster_ids:
            continue
        return MlbTeamLeaderCard(
            key=key,
            label=_LABEL[key],
            rank=row.rank,
            value=row.value,
            player_id=row.player_id,
            last_name=last_name_from_full(row.name),
            headshot_url=headshot_by_norm.get(norm_player_name(row.name)),
        )
    return None


async def fetch_team_leaders(
    client: httpx.AsyncClient,
    *,
    team_id: int,
    season: int,
    keys: tuple[str, ...],
) -> list[MlbTeamLeaderCard]:
    specs = select_team_leader_specs(keys)
    roster_ids = await fetch_active_roster_player_ids(client, team_id, season)
    if not roster_ids:
        return []

    team_map_result, *payload_results = await asyncio.gather(
        fetch_team_abbrev_map(client, season),
        *(
            fetch_category_payload(
                client, sort_stat, group, order, season, limit=TEAM_BOARD_LIMIT
            )
            for (_k, _lab, _st, sort_stat, group, order) in specs
        ),
        return_exceptions=True,
    )
    if isinstance(team_map_result, BaseException):
        if isinstance(team_map_result, asyncio.CancelledError):
            raise team_map_result
        logger.warning("team leaders team abbrev map failed: %s", team_map_result)
        team_map: dict[int, str] = {}
    else:
        team_map = team_map_result

    player_index = await get_mlb_player_index()
    headshot_by_norm = {
        name: entry.get("headshot_url") for name, entry in player_index.items()
    }

    cards_by_key: dict[str, MlbTeamLeaderCard] = {}
    for spec, payload_result in zip(specs, payload_results, strict=True):
        key, label, stat, sort_stat, _group, _order = spec
        if isinstance(payload_result, BaseException):
            if isinstance(payload_result, asyncio.CancelledError):
                raise payload_result
            logger.warning(
                "team leaders category %s fetch failed: %s", key, payload_result
            )
            continue
        try:
            board = normalize_category_payload(
                payload_result,
                key=key,
                label=label,
                stat=stat,
                sort_stat=sort_stat,
                team_id_to_abbrev=team_map,
                limit=TEAM_BOARD_LIMIT,
            )
            card = pick_team_leader_from_board(
                board,
                roster_ids=roster_ids,
                headshot_by_norm=headshot_by_norm,
            )
            if card is not None:
                cards_by_key[key] = card
        except Exception as exc:
            logger.warning("team leaders category %s failed: %s", key, exc)

    return [cards_by_key[k] for k in keys if k in cards_by_key]
