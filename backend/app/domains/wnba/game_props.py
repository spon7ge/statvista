from __future__ import annotations

from app.domains.betting.prop_stat_keys import (
    GAME_PROP_CATEGORY_ORDER,
    display_stat_label,
)
from app.domains.wnba.schemas_game_props import (
    WnbaGamePropBestQuote,
    WnbaGamePropCategory,
    WnbaGamePropPlayer,
)

BOOK_PRIORITY: tuple[str, ...] = (
    "novig",
    "draftkings",
    "fanduel",
    "pinnacle",
    "betmgm",
    "caesars",
    "betrivers",
    "bet365",
)

_PRIORITY_RANK = {book: i for i, book in enumerate(BOOK_PRIORITY)}


def _line_key(line: float) -> float:
    return round(float(line), 2)


def pick_best_quote(candidates: list[tuple[str, int]]) -> WnbaGamePropBestQuote | None:
    if not candidates:
        return None
    best_book, best_american = max(
        candidates,
        key=lambda item: (item[1], -_PRIORITY_RANK.get(item[0], 999)),
    )
    return WnbaGamePropBestQuote(american=best_american, book=best_book)


def group_game_prop_categories(
    players_by_stat: dict[str, list[WnbaGamePropPlayer]],
) -> list[WnbaGamePropCategory]:
    ordered: list[WnbaGamePropCategory] = []
    seen: set[str] = set()
    for stat in GAME_PROP_CATEGORY_ORDER:
        players = players_by_stat.get(stat)
        if not players:
            continue
        ordered.append(
            WnbaGamePropCategory(
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
            WnbaGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
    return ordered
