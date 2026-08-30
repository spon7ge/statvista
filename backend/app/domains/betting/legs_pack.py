from __future__ import annotations

from dataclasses import dataclass

from app.domains.betting.schemas_legs import LegsPlay


@dataclass(frozen=True)
class PackablePlay:
    player_key: str
    play: LegsPlay


@dataclass(frozen=True)
class PackedEntry:
    rank: int
    legs: list[LegsPlay]


def pack_entries(
    plays: list[PackablePlay],
    *,
    n: int,
    format: str,
) -> tuple[list[PackedEntry], int]:
    if n < 1:
        raise ValueError("n must be >= 1")
    used: set[str] = set()
    entries: list[PackedEntry] = []
    flex = format == "flex"
    while True:
        card: list[PackablePlay] = []
        game_counts: dict[str, int] = {}
        on_card: set[str] = set()
        for item in plays:
            if item.player_key in used or item.player_key in on_card:
                continue
            gid = item.play.game_id
            if flex and gid is not None and game_counts.get(gid, 0) >= 2:
                continue
            card.append(item)
            on_card.add(item.player_key)
            if gid is not None:
                game_counts[gid] = game_counts.get(gid, 0) + 1
            if len(card) == n:
                break
        if len(card) < n:
            packed = n * len(entries)
            return entries, len(plays) - packed
        used.update(item.player_key for item in card)
        ranked = [
            item.play.model_copy(update={"rank": i})
            for i, item in enumerate(card, start=1)
        ]
        entries.append(PackedEntry(rank=len(entries) + 1, legs=ranked))
