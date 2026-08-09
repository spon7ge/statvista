from __future__ import annotations

from typing import Any

from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label
from app.domains.mlb.schemas_game_props import (
    MlbGamePropBestQuote,
    MlbGamePropCategory,
    MlbGamePropPlayer,
)

SideIndex = dict[tuple[str, str, str, float], dict[str, Any]]

BOOK_PRIORITY: tuple[str, ...] = (
    "prophetx",
    "novig",
    "kalshi",
    "draftkings",
    "fanduel",
    "pinnacle",
    "betmgm",
    "betonline",
)

_PRIORITY_RANK = {book: i for i, book in enumerate(BOOK_PRIORITY)}


def _line_key(line: float) -> float:
    return round(float(line), 2)


def pick_best_quote(candidates: list[tuple[str, int]]) -> MlbGamePropBestQuote | None:
    """Pick highest American odds; ties break by BOOK_PRIORITY order."""
    if not candidates:
        return None
    best_book, best_american = max(
        candidates,
        key=lambda item: (item[1], -_PRIORITY_RANK.get(item[0], 999)),
    )
    return MlbGamePropBestQuote(american=best_american, book=best_book)


def best_side_quote(
    indexes: dict[str, SideIndex],
    *,
    norm_player: str,
    stat_key: str,
    side: str,
    line: float,
) -> MlbGamePropBestQuote | None:
    side_key = (norm_player, stat_key, side, _line_key(line))
    candidates: list[tuple[str, int]] = []
    for book in BOOK_PRIORITY:
        hit = indexes.get(book, {}).get(side_key)
        if not hit:
            continue
        american = hit.get("american")
        if american is None:
            continue
        try:
            candidates.append((book, int(american)))
        except (TypeError, ValueError):
            continue
    return pick_best_quote(candidates)


def group_game_prop_categories(
    players_by_stat: dict[str, list[MlbGamePropPlayer]],
) -> list[MlbGamePropCategory]:
    ordered: list[MlbGamePropCategory] = []
    seen: set[str] = set()
    for stat in GAME_PROP_CATEGORY_ORDER:
        players = players_by_stat.get(stat)
        if not players:
            continue
        ordered.append(
            MlbGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
        seen.add(stat)
    for stat, players in sorted(players_by_stat.items()):
        if stat in seen or not players:
            continue
        ordered.append(
            MlbGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
    return ordered
