from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal, cast

import httpx

from app.domains.mlb.leaders import (
    CATEGORY_SPECS,
    fetch_category_payload,
    fetch_team_abbrev_map,
    normalize_category_payload,
)
from app.domains.mlb.schemas_game_detail import (
    MlbMatchupLeaderCategory,
    MlbMatchupLeaderEntry,
    MlbMatchupLeaders,
)
from app.domains.mlb.schemas_leaders import MlbLeaderCategory
from app.providers.mlb_stats.roster import fetch_active_roster_player_ids

logger = logging.getLogger(__name__)

MatchupLeaderCategoryKey = Literal["hr", "avg", "ops", "era", "so", "whip"]

MATCHUP_LEADER_CATEGORY_KEYS: tuple[MatchupLeaderCategoryKey, ...] = (
    "hr",
    "avg",
    "ops",
    "era",
    "so",
    "whip",
)
_LABEL_BY_KEY: dict[MatchupLeaderCategoryKey, str] = {
    "hr": "HR",
    "avg": "AVG",
    "ops": "OPS",
    "era": "ERA",
    "so": "SO",
    "whip": "WHIP",
}


def select_matchup_leader_specs() -> list[tuple[str, str, str, str, str, Any]]:
    by_key = {spec[0]: spec for spec in CATEGORY_SPECS}
    return [by_key[key] for key in MATCHUP_LEADER_CATEGORY_KEYS]


def intersect_category_with_rosters(
    category: MlbLeaderCategory,
    *,
    away_ids: set[str],
    home_ids: set[str],
    away_abbrev: str,
    home_abbrev: str,
) -> MlbMatchupLeaderCategory:
    key = cast(MatchupLeaderCategoryKey, category.key)
    leaders: list[MlbMatchupLeaderEntry] = []
    for row in category.leaders:
        if row.player_id in away_ids:
            side: Literal["away", "home"] = "away"
            abbrev = away_abbrev
        elif row.player_id in home_ids:
            side = "home"
            abbrev = home_abbrev
        else:
            continue
        leaders.append(
            MlbMatchupLeaderEntry(
                rank=row.rank,
                player_id=row.player_id,
                name=row.name,
                team_abbrev=abbrev,
                side=side,
                value=row.value,
            )
        )
        if len(leaders) >= 3:
            break
    return MlbMatchupLeaderCategory(
        key=key,
        label=_LABEL_BY_KEY[key],
        leaders=leaders,
    )


async def fetch_matchup_leaders(
    client: httpx.AsyncClient,
    *,
    away_team_id: int,
    home_team_id: int,
    away_abbrev: str,
    home_abbrev: str,
    season: int,
) -> MlbMatchupLeaders | None:
    specs = select_matchup_leader_specs()
    away_ids, home_ids = await asyncio.gather(
        fetch_active_roster_player_ids(client, away_team_id, season),
        fetch_active_roster_player_ids(client, home_team_id, season),
    )
    if not away_ids and not home_ids:
        return None

    team_map, *payloads = await asyncio.gather(
        fetch_team_abbrev_map(client, season),
        *(
            fetch_category_payload(client, sort_stat, group, order, season)
            for (_k, _lab, _st, sort_stat, group, order) in specs
        ),
    )

    categories: list[MlbMatchupLeaderCategory] = []
    for spec, payload in zip(specs, payloads, strict=True):
        key, label, stat, sort_stat, _group, _order = spec
        category_key = cast(MatchupLeaderCategoryKey, key)
        try:
            board = normalize_category_payload(
                payload,
                key=key,
                label=label,
                stat=stat,
                sort_stat=sort_stat,
                team_id_to_abbrev=team_map,
            )
            categories.append(
                intersect_category_with_rosters(
                    board,
                    away_ids=away_ids,
                    home_ids=home_ids,
                    away_abbrev=away_abbrev,
                    home_abbrev=home_abbrev,
                )
            )
        except Exception as exc:
            logger.warning("matchup leaders category %s failed: %s", key, exc)
            categories.append(
                MlbMatchupLeaderCategory(
                    key=category_key,
                    label=_LABEL_BY_KEY[category_key],
                    leaders=[],
                )
            )
    return MlbMatchupLeaders(categories=categories)
