"""Pure fair-probability, confidence, and recency helpers for MLB prop picks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

AGREE_PP = 2.0

SourceTier = Literal[
    "sharp_consensus",
    "sharp_disagreement",
    "sharp_single_source",
    "mid_tier_fallback",
    "no_sharp_read",
]

SideBooks = dict[str, float | None]


@dataclass(frozen=True)
class FairResult:
    fair_pct: float | None
    source_tier: SourceTier
    confidence_chips: list[str]
    sample_chips: list[str]
    fair_explain: str


def american_to_fair_pct(american: int) -> float:
    """Convert American odds to implied fair % on a 0–100 scale (one decimal)."""
    if american > 0:
        p = 100.0 / (american + 100.0)
    else:
        a = abs(american)
        p = a / (a + 100.0)
    return round(p * 100.0, 1)


def _agrees(a: float, b: float) -> bool:
    return abs(a - b) <= AGREE_PP


def _dk_fd_agrees_with(fair_pct: float, side_books: SideBooks) -> bool:
    for key in ("draftkings", "fanduel"):
        val = side_books.get(key)
        if val is not None and _agrees(val, fair_pct):
            return True
    return False


def _tier1(side_books: SideBooks) -> FairResult | None:
    px = side_books.get("prophetx")
    novig = side_books.get("novig")

    if px is not None and novig is not None:
        if _agrees(px, novig):
            fair = round(0.6 * px + 0.4 * novig, 1)
            return FairResult(
                fair_pct=fair,
                source_tier="sharp_consensus",
                confidence_chips=[],
                sample_chips=[],
                fair_explain="PX+Novig agree within 2pp; 60/40 blend.",
            )
        return FairResult(
            fair_pct=px,
            source_tier="sharp_disagreement",
            confidence_chips=[],
            sample_chips=[],
            fair_explain="PX+Novig disagree >2pp; ProphetX only.",
        )

    if px is not None:
        confidence: list[str] = []
        if _dk_fd_agrees_with(px, side_books):
            confidence.append("dk_fd_agrees")
        return FairResult(
            fair_pct=px,
            source_tier="sharp_single_source",
            confidence_chips=confidence,
            sample_chips=["prophetx_only"],
            fair_explain="ProphetX only (single sharp source).",
        )

    if novig is not None:
        confidence = []
        if _dk_fd_agrees_with(novig, side_books):
            confidence.append("dk_fd_agrees")
        return FairResult(
            fair_pct=novig,
            source_tier="sharp_single_source",
            confidence_chips=confidence,
            sample_chips=["novig_only"],
            fair_explain="Novig only (single sharp source).",
        )

    return None


def _tier2(side_books: SideBooks) -> FairResult | None:
    # Single DK or FD is valid Tier 2 fair, analogous to sharp single-source.
    dk = side_books.get("draftkings")
    fd = side_books.get("fanduel")

    if dk is not None and fd is not None:
        if _agrees(dk, fd):
            fair = round(0.55 * dk + 0.45 * fd, 1)
            return FairResult(
                fair_pct=fair,
                source_tier="mid_tier_fallback",
                confidence_chips=[],
                sample_chips=[],
                fair_explain="DK+FD agree within 2pp; 55/45 blend.",
            )
        return FairResult(
            fair_pct=dk,
            source_tier="mid_tier_fallback",
            confidence_chips=[],
            sample_chips=[],
            fair_explain="DK+FD disagree >2pp; DraftKings only.",
        )

    if dk is not None:
        return FairResult(
            fair_pct=dk,
            source_tier="mid_tier_fallback",
            confidence_chips=[],
            sample_chips=[],
            fair_explain="DraftKings only (mid-tier fallback).",
        )

    if fd is not None:
        return FairResult(
            fair_pct=fd,
            source_tier="mid_tier_fallback",
            confidence_chips=[],
            sample_chips=[],
            fair_explain="FanDuel only (mid-tier fallback).",
        )

    return None


def compute_fair(side_books: SideBooks) -> FairResult:
    """Compute fair % and tier chips for one side's exact-line book fair %s."""
    tier1 = _tier1(side_books)
    if tier1 is not None:
        return tier1

    tier2 = _tier2(side_books)
    if tier2 is not None:
        return tier2

    return FairResult(
        fair_pct=None,
        source_tier="no_sharp_read",
        confidence_chips=[],
        sample_chips=[],
        fair_explain="No Tier 1/2 books available.",
    )


def recency_chip(
    *,
    sharp_changed_at: datetime | None,
    dfs_changed_at: datetime | None,
    now: datetime,
) -> str | None:
    """Return at most one recency chip by priority: fresh vs stale → fresh → stale → none."""
    if sharp_changed_at is None:
        return None

    sharp_age_min = (now - sharp_changed_at).total_seconds() / 60.0
    dfs_age_min = (
        None if dfs_changed_at is None else (now - dfs_changed_at).total_seconds() / 60.0
    )

    if (
        sharp_age_min <= 10
        and dfs_age_min is not None
        and dfs_age_min >= 30
        and dfs_changed_at is not None
        and dfs_changed_at < sharp_changed_at
    ):
        return "fresh_sharp_vs_stale_dfs"

    if sharp_age_min <= 10:
        return "fresh_sharp"

    if sharp_age_min >= 60:
        return "stale_sharp"

    return None
