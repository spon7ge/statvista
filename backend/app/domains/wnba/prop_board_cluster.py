from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.domains.wnba.prop_fair import american_to_fair_pct

Side = Literal["over", "under"]

BOOK_CHIP_ORDER = (
    "prophetx",
    "novig",
    "pinnacle",
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "bet365",
    "kalshi",
    "fliff",
    "prizepicks",
    "underdog",
)
DFS_CHIP_ORDER = ("prizepicks", "underdog")
SPORTSBOOK_CHIP_ORDER = tuple(
    book for book in BOOK_CHIP_ORDER if book not in DFS_CHIP_ORDER
)


def round_line(line: float) -> float:
    return round(float(line), 1)


@dataclass(frozen=True)
class BoardQuote:
    player_name: str
    player_key: str
    stat: str
    line: float
    book: str
    over_american: int | None
    under_american: int | None
    url: str | None = None


@dataclass(frozen=True)
class Cluster:
    player_name: str
    player_key: str
    stat: str
    line: float
    quotes: tuple[BoardQuote, ...]


def cluster_quotes(quotes: list[BoardQuote]) -> list[Cluster]:
    buckets: dict[tuple[str, str, float], list[BoardQuote]] = {}
    names: dict[tuple[str, str, float], str] = {}
    for q in quotes:
        line = round_line(q.line)
        key = (q.player_key, q.stat, line)
        buckets.setdefault(key, []).append(q)
        names.setdefault(key, q.player_name)
    clusters: list[Cluster] = []
    for (player_key, stat, line), qs in buckets.items():
        clusters.append(
            Cluster(
                player_name=names[(player_key, stat, line)],
                player_key=player_key,
                stat=stat,
                line=line,
                quotes=tuple(qs),
            )
        )
    return clusters


def devig_pct_for_side(
    over_american: int | None,
    under_american: int | None,
    side: Side,
) -> int | None:
    """Multiplicative de-vig of a two-way American market, as a 0–100 int."""
    if over_american is None or under_american is None:
        return None
    p_over = american_to_fair_pct(over_american) / 100.0
    p_under = american_to_fair_pct(under_american) / 100.0
    total = p_over + p_under
    if total <= 0:
        return None
    fair = p_over / total if side == "over" else p_under / total
    return int(round(fair * 100))


def consensus_ip_pct(americans: list[int | None]) -> int | None:
    """Average raw implied % of offered Americans (no de-vig)."""
    vals = [
        american_to_fair_pct(american)
        for american in americans
        if american is not None
    ]
    if not vals:
        return None
    return int(round(sum(vals) / len(vals)))


def ip_pct_for_side(cluster: Cluster, side: Side) -> int | None:
    americans: list[int | None] = []
    for quote in cluster.quotes:
        if quote.book in DFS_CHIP_ORDER:
            continue
        american = quote.over_american if side == "over" else quote.under_american
        americans.append(american)
    return consensus_ip_pct(americans)
