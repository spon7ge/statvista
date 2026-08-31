"""Exact-line two-way consensus pricer for MLB Legs (no I/O)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Union

from app.domains.betting.legs_payouts import (
    base_break_even,
    base_required_margin_pts,
    leg_break_even,
)

EPS = 1e-6
WEIGHTS = {
    "pinnacle": 3.0, "novig": 2.5, "prophetx": 2.5,
    "draftkings": 2.0, "fanduel": 2.0, "betmgm": 1.0, "caesars": 1.0,
}
SHARP = frozenset({"pinnacle", "novig", "prophetx"})
EXCHANGES = frozenset({"novig", "prophetx"})
SHARP_MAX_AGE = 45.0
SUPPORT_MAX_AGE = 120.0
HOLD_MAX = 0.12
HOLD_MULT_MAX = 0.05
DISAGREE_PTS = 4.0
DISAGREE_ADDER = 1.5


@dataclass(frozen=True)
class BookQuote:
    book: str
    line: float
    over: int
    under: int
    stake_over: float | None
    stake_under: float | None
    age_minutes: float


@dataclass(frozen=True)
class PlayResult:
    side: Literal["over", "under"]
    fair_prob: float
    break_even: float
    required_margin_pts: float
    margin_pts: float
    book_disagreement_pts: float
    sharp_anchor: Literal["pinnacle", "exchange_only"]
    books_used: list[str]
    books_excluded: list[str]
    payout_multiplier: float | None


@dataclass(frozen=True)
class RejectResult:
    reason: Literal[
        "insufficient_coverage",
        "insufficient_sharp",
        "below_threshold",
        "unpriceable_payout",
    ]


PriceResult = Union[PlayResult, RejectResult]


def american_to_prob(american: int) -> float:
    if american > 0:
        p = 100.0 / (american + 100.0)
    else:
        a = abs(american)
        p = a / (a + 100.0)
    return min(1.0 - EPS, max(EPS, p))


def power_k(p_over: float, p_under: float) -> float | None:
    def f(k: float) -> float:
        return p_over**k + p_under**k - 1.0
    if f(1.0) < 0 or f(10.0) > 0:
        return None
    lo, hi = 1.0, 10.0
    for _ in range(80):
        mid = (lo + hi) / 2.0
        if f(mid) > 0:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-9:
            return (lo + hi) / 2.0
    return (lo + hi) / 2.0


def devig_over(p_over: float, p_under: float) -> float | None:
    hold = p_over + p_under - 1.0
    if hold <= HOLD_MULT_MAX:
        return p_over / (p_over + p_under)
    k = power_k(p_over, p_under)
    if k is None:
        return None
    return p_over**k


def _clip(p: float) -> float:
    return min(1.0 - EPS, max(EPS, p))


def _logit(p: float) -> float:
    p = _clip(p)
    return math.log(p / (1.0 - p))


def _max_age(book: str) -> float:
    return SHARP_MAX_AGE if book in SHARP else SUPPORT_MAX_AGE


def _try_fair_over(quote: BookQuote, dfs_line: float) -> float | None:
    if quote.line != dfs_line:
        return None
    if quote.book not in WEIGHTS:
        return None
    if quote.age_minutes > _max_age(quote.book):
        return None
    if quote.book in EXCHANGES:
        so, su = quote.stake_over, quote.stake_under
        if so is None or su is None or so <= 0 or su <= 0:
            return None
    p_over = american_to_prob(quote.over)
    p_under = american_to_prob(quote.under)
    if p_over + p_under - 1.0 > HOLD_MAX:
        return None
    return devig_over(p_over, p_under)


def price_line(
    *,
    quotes: list[BookQuote],
    dfs_line: float,
    app: str,
    format: str,
    legs: int,
    payout_multiplier: float | None,
    offered_side: Literal["over", "under"] | None = None,
) -> PriceResult:
    included: list[tuple[BookQuote, float, float]] = []
    excluded: list[str] = []
    for quote in quotes:
        fair = _try_fair_over(quote, dfs_line)
        if fair is None:
            excluded.append(quote.book)
            continue
        included.append((quote, fair, WEIGHTS[quote.book]))

    used_books = [q.book for q, _, _ in included]
    used_set = set(used_books)
    has_pinnacle = "pinnacle" in used_set
    has_exchange = bool(used_set & EXCHANGES)
    if not has_pinnacle and not has_exchange:
        return RejectResult(reason="insufficient_sharp")

    n = len(included)
    n_heavy = sum(1 for _, _, w in included if w >= 2.0)
    # (2) ≥2 books besides the sharp/exchange anchor (3) total ≥3 (4) ≥2 weight≥2.0
    if n - 1 < 2 or n < 3 or n_heavy < 2:
        return RejectResult(reason="insufficient_coverage")

    weight_sum = sum(w for _, _, w in included)
    fair_logit = sum(w * _logit(p) for _, p, w in included) / weight_sum
    p_over = 1.0 / (1.0 + math.exp(-fair_logit))
    p_under = 1.0 - p_over

    if offered_side == "over":
        side: Literal["over", "under"] = "over"
        fair_prob = p_over
    elif offered_side == "under":
        side = "under"
        fair_prob = p_under
    elif p_over > 0.5:
        side = "over"
        fair_prob = p_over
    elif p_under > 0.5:
        side = "under"
        fair_prob = p_under
    else:
        return RejectResult(reason="below_threshold")

    if offered_side is None and fair_prob < 0.35:
        raise RuntimeError("gated fair_prob < 0.35 is unreachable under favorite-only")

    p_be = leg_break_even(base_break_even(app, format, legs), payout_multiplier)
    if p_be >= 1.0:
        return RejectResult(reason="unpriceable_payout")

    heavy_ps = [p for _, p, w in included if w >= 2.0]
    book_disagreement_pts = (max(heavy_ps) - min(heavy_ps)) * 100.0
    required = base_required_margin_pts(app, format, legs)
    if book_disagreement_pts > DISAGREE_PTS:
        required = required + DISAGREE_ADDER
    margin_pts = (fair_prob - p_be) * 100.0
    if margin_pts < required:
        return RejectResult(reason="below_threshold")

    if n_heavy < 2:
        raise RuntimeError("PLAY requires ≥2 included books with weight ≥ 2.0")

    return PlayResult(
        side=side,
        fair_prob=fair_prob,
        break_even=p_be,
        required_margin_pts=required,
        margin_pts=margin_pts,
        book_disagreement_pts=book_disagreement_pts,
        sharp_anchor="pinnacle" if has_pinnacle else "exchange_only",
        books_used=sorted(used_books),
        books_excluded=sorted(excluded),
        payout_multiplier=payout_multiplier,
    )
