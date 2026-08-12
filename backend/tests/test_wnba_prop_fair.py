from datetime import datetime, timedelta, timezone

import pytest

from app.domains.wnba.prop_fair import american_to_fair_pct, compute_fair, recency_chip
from app.domains.wnba.prop_formats import breakeven_pct


def test_american_to_fair_pct_favorite():
    assert american_to_fair_pct(-140) == 58.3


def test_breakeven_power_4():
    assert abs(breakeven_pct("prizepicks", "power", 4) - 56.234) < 0.01


def test_breakeven_rejects_bad_app_format_legs():
    with pytest.raises(ValueError):
        breakeven_pct("prizepicks", "standard", 4)


def test_tier1_equal_avg_two_sources():
    r = compute_fair({
        "prophetx": 60.0, "novig": 50.0,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "sharp_consensus"
    assert r.fair_pct == 55.0


def test_tier1_single_prophetx():
    r = compute_fair({
        "prophetx": 54.0, "novig": None,
        "draftkings": 53.5, "fanduel": None,
    })
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 54.0
    assert "dk_fd_agrees" in r.confidence_chips


def test_no_sharp_read():
    r = compute_fair({
        "prophetx": None, "novig": None,
        "draftkings": None, "fanduel": None, "pinnacle": 51.0,
    })
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None


def test_recency_fresh_sharp():
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=5),
        dfs_changed_at=now - timedelta(minutes=12),
        now=now,
    )
    assert chip == "fresh_sharp"
