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
from app.domains.mlb.schemas_game_detail import MlbGameLeaderCard, MlbGameLeaders
from app.domains.mlb.schemas_leaders import MlbLeaderCategory
from app.providers.espn.mlb_roster import get_mlb_player_index
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.mlb_stats.roster import fetch_active_roster_player_ids

logger = logging.getLogger(__name__)

GameLeaderKey = Literal["hr", "avg", "ops"]

GAME_LEADER_KEYS: tuple[GameLeaderKey, ...] = ("hr", "avg", "ops")
GAME_BOARD_LIMIT = 100
_LABEL: dict[GameLeaderKey, str] = {"hr": "HR", "avg": "AVG", "ops": "OPS"}


def last_name_from_full(full_name: str) -> str:
    parts = full_name.strip().split()
    return parts[-1] if parts else full_name


def select_game_leader_specs() -> list[tuple[str, str, str, str, str, Literal["asc", "desc"]]]:
    by_key = {spec[0]: spec for spec in CATEGORY_SPECS}
    return [by_key[key] for key in GAME_LEADER_KEYS]


def pick_game_leader_from_board(
    category: MlbLeaderCategory,
    *,
    away_ids: set[str],
    home_ids: set[str],
    away_abbrev: str,
    home_abbrev: str,
    headshot_by_norm: dict[str, str | None],
) -> MlbGameLeaderCard | None:
    key = cast(GameLeaderKey, category.key)
    for row in category.leaders:
        if row.player_id in away_ids:
            side: Literal["away", "home"] = "away"
            abbrev = away_abbrev
        elif row.player_id in home_ids:
            side = "home"
            abbrev = home_abbrev
        else:
            continue
        return MlbGameLeaderCard(
            key=key,
            label=_LABEL[key],
            rank=row.rank,
            value=row.value,
            player_id=row.player_id,
            last_name=last_name_from_full(row.name),
            team_abbrev=abbrev,
            side=side,
            headshot_url=headshot_by_norm.get(norm_player_name(row.name)),
        )
    return None


async def fetch_game_leaders(
    client: httpx.AsyncClient,
    *,
    away_team_id: int,
    home_team_id: int,
    away_abbrev: str,
    home_abbrev: str,
    season: int,
) -> MlbGameLeaders | None:
    specs = select_game_leader_specs()
    away_ids, home_ids = await asyncio.gather(
        fetch_active_roster_player_ids(client, away_team_id, season),
        fetch_active_roster_player_ids(client, home_team_id, season),
    )
    if not away_ids and not home_ids:
        return None

    team_map_result, *payload_results = await asyncio.gather(
        fetch_team_abbrev_map(client, season),
        *(
            fetch_category_payload(
                client, sort_stat, group, order, season, limit=GAME_BOARD_LIMIT
            )
            for (_k, _lab, _st, sort_stat, group, order) in specs
        ),
        return_exceptions=True,
    )
    if isinstance(team_map_result, BaseException):
        if isinstance(team_map_result, asyncio.CancelledError):
            raise team_map_result
        logger.warning("game leaders team abbrev map failed: %s", team_map_result)
        team_map: dict[int, str] = {}
    else:
        team_map = team_map_result

    player_index = await get_mlb_player_index()
    headshot_by_norm = {
        name: entry.get("headshot_url") for name, entry in player_index.items()
    }

    cards_by_key: dict[GameLeaderKey, MlbGameLeaderCard] = {}
    for spec, payload_result in zip(specs, payload_results, strict=True):
        key, label, stat, sort_stat, _group, _order = spec
        category_key = cast(GameLeaderKey, key)
        if isinstance(payload_result, BaseException):
            if isinstance(payload_result, asyncio.CancelledError):
                raise payload_result
            logger.warning(
                "game leaders category %s fetch failed: %s", key, payload_result
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
                limit=GAME_BOARD_LIMIT,
            )
            card = pick_game_leader_from_board(
                board,
                away_ids=away_ids,
                home_ids=home_ids,
                away_abbrev=away_abbrev,
                home_abbrev=home_abbrev,
                headshot_by_norm=headshot_by_norm,
            )
            if card is not None:
                cards_by_key[category_key] = card
        except Exception as exc:
            logger.warning("game leaders category %s failed: %s", key, exc)

    cards = [cards_by_key[k] for k in GAME_LEADER_KEYS if k in cards_by_key]
    if not cards:
        return None
    return MlbGameLeaders(leaders=cards)
