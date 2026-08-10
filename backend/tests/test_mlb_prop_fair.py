from datetime import datetime, timedelta, timezone

import pytest

from app.domains.mlb.prop_fair import (
    american_to_fair_pct,
    compute_fair,
    recency_chip,
)
from app.domains.mlb.prop_formats import breakeven_pct


def test_american_to_fair_pct_favorite():
    assert american_to_fair_pct(-140) == 58.3  # 140/240


def test_breakeven_power_4():
    # 10x ^ (-1/4) ≈ 56.234...
    assert abs(breakeven_pct("prizepicks", "power", 4) - 56.234) < 0.01


def test_breakeven_rejects_bad_app_format_legs():
    with pytest.raises(ValueError):
        breakeven_pct("prizepicks", "standard", 4)
    with pytest.raises(ValueError):
        breakeven_pct("underdog", "power", 4)
    with pytest.raises(ValueError):
        breakeven_pct("draftkings", "power", 4)
    with pytest.raises(ValueError):
        breakeven_pct("prizepicks", "power", 7)


def test_tier1_equal_avg_px_novig_no_kalshi():
    r = compute_fair({"prophetx": 60.0, "novig": 54.0, "kalshi": 57.0})
    assert r.fair_pct == 57.0  # (60+54)/2 — kalshi ignored
    assert r.source_tier == "sharp_consensus"


def test_tier1_equal_avg_two_sources():
    r = compute_fair({
        "prophetx": 60.0, "novig": 50.0, "kalshi": None,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "sharp_consensus"
    assert r.fair_pct == 55.0


def test_tier1_single_prophetx():
    r = compute_fair({
        "prophetx": 54.0, "novig": None, "kalshi": None,
        "draftkings": 53.5, "fanduel": None,
    })
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 54.0
    assert "prophetx_only" in r.sample_chips


def test_kalshi_not_tier1():
    r = compute_fair({
        "prophetx": None, "novig": None, "kalshi": 52.0,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None


def test_single_source_dk_agree_chip_does_not_move_fair():
    r = compute_fair({"prophetx": 54.0, "novig": None, "draftkings": 53.5, "fanduel": None})
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 54.0
    assert "dk_fd_agrees" in r.confidence_chips
    assert "prophetx_only" in r.sample_chips


def test_mid_tier_when_no_exchanges():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": 55.0, "fanduel": 54.0})
    assert r.source_tier == "mid_tier_fallback"
    assert abs(r.fair_pct - (0.55 * 55.0 + 0.45 * 54.0)) < 0.05


def test_mid_tier_disagreement_uses_draftkings():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": 58.0, "fanduel": 50.0})
    assert r.source_tier == "mid_tier_fallback"
    assert r.fair_pct == 58.0


def test_mid_tier_draftkings_only():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": 55.0, "fanduel": None})
    assert r.source_tier == "mid_tier_fallback"
    assert r.fair_pct == 55.0


def test_mid_tier_fanduel_only():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": None, "fanduel": 54.0})
    assert r.source_tier == "mid_tier_fallback"
    assert r.fair_pct == 54.0


def test_no_sharp_read():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": None, "fanduel": None})
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None
    assert "No Tier 1/2/3 books available." in r.fair_explain


def test_soft_consensus_requires_two_books():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": None, "fanduel": None, "pinnacle": 55.0})
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None


def test_soft_consensus_two_soft_books_when_configured(monkeypatch):
    import app.domains.mlb.prop_fair as pf

    monkeypatch.setattr(pf, "SOFT_FAIR_BOOKS", ("pinnacle", "betmgm"))
    r = compute_fair({"pinnacle": 55.0, "betmgm": 53.0})
    assert r.source_tier == "soft_consensus"
    assert r.fair_pct == 54.0


def test_soft_ignores_removed_books():
    r = compute_fair({
        "prophetx": None, "novig": None, "kalshi": None,
        "draftkings": None, "fanduel": None,
        "caesars": 99.0,  # must not count even if passed
    })
    assert r.source_tier == "no_sharp_read"


def test_tier1_still_beats_soft_books():
    r = compute_fair(
        {
            "prophetx": 58.0,
            "novig": None,
            "draftkings": None,
            "fanduel": None,
            "pinnacle": 40.0,
            "caesars": 41.0,
        }
    )
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 58.0


def test_tier2_still_beats_soft_books():
    r = compute_fair(
        {
            "prophetx": None,
            "novig": None,
            "draftkings": 55.0,
            "fanduel": None,
            "pinnacle": 40.0,
        }
    )
    assert r.source_tier == "mid_tier_fallback"
    assert r.fair_pct == 55.0


def test_recency_fresh_vs_stale():
    now = datetime(2026, 8, 5, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=4),
        dfs_changed_at=now - timedelta(minutes=41),
        now=now,
    )
    assert chip == "fresh_sharp_vs_stale_dfs"


def test_recency_fresh_sharp():
    now = datetime(2026, 8, 5, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=5),
        dfs_changed_at=now - timedelta(minutes=10),
        now=now,
    )
    assert chip == "fresh_sharp"


def test_recency_stale_sharp():
    now = datetime(2026, 8, 5, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=90),
        dfs_changed_at=now - timedelta(minutes=10),
        now=now,
    )
    assert chip == "stale_sharp"


def test_recency_none_in_middle_window():
    now = datetime(2026, 8, 5, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=30),
        dfs_changed_at=now - timedelta(minutes=10),
        now=now,
    )
    assert chip is None
