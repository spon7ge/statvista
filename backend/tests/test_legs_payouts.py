import pytest
from app.domains.betting.legs_payouts import (
    base_break_even,
    base_required_margin_pts,
    flex3_ev,
    leg_break_even,
    validate_legs_query,
)


def test_pp_power_peak_is_n3():
    be = {n: base_break_even("prizepicks", "power", n) for n in range(2, 7)}
    assert be[3] == max(be.values())
    assert abs(be[2] - 3 ** (-1 / 2)) < 1e-12
    assert abs(be[6] - 37.5 ** (-1 / 6)) < 1e-12


def test_ud_peak_n2_and_4_harder_than_3():
    be = {n: base_break_even("underdog", "standard", n) for n in range(2, 7)}
    assert be[2] == max(be.values())
    assert be[4] > be[3]
    assert abs(be[6] - 40 ** (-1 / 6)) < 1e-12


def test_flex6_constant():
    assert base_break_even("prizepicks", "flex", 6) == pytest.approx(0.542)


def test_flex3_ev_at_056_is_loss():
    assert flex3_ev(0.560) == pytest.approx(0.913, abs=0.002)


def test_validate_rejects_flex3_and_boosted():
    with pytest.raises(ValueError):
        validate_legs_query("prizepicks", "flex", 3)
    with pytest.raises(ValueError):
        validate_legs_query("underdog", "boosted", 4)
    validate_legs_query("prizepicks", "power", 4)
    validate_legs_query("prizepicks", "flex", 6)
    validate_legs_query("underdog", "standard", 4)


def test_clamp_boost_keeps_base_discount_raises():
    base = 10 ** (-1 / 4)
    assert leg_break_even(base, 1.15) == pytest.approx(base)
    assert leg_break_even(base, 0.90) == pytest.approx(base / 0.90)
    assert abs(leg_break_even(base, 0.90) - (10 * 0.9**4) ** (-1 / 4)) < 1e-4
    assert leg_break_even(base, None) == pytest.approx(base)


def test_margin_bases():
    assert base_required_margin_pts("prizepicks", "power", 4) == 4.0
    assert base_required_margin_pts("prizepicks", "flex", 6) == 3.0
    assert base_required_margin_pts("underdog", "standard", 5) == 4.0
