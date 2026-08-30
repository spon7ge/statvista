import app.domains.betting.legs_pricer as legs_pricer
import pytest
from app.domains.betting.legs_payouts import base_break_even
from app.domains.betting.legs_pricer import (
    BookQuote,
    PlayResult,
    RejectResult,
    american_to_prob,
    power_k,
    price_line,
)

# Strong favorite over: hold ~0.037 (multiplicative), fair over ~0.643.
_FAV_OVER, _FAV_UNDER = -200, 170
# Stronger favorite so a 0.90 discount still clears the 4pt gate.
_STRONG_OVER, _STRONG_UNDER = -250, 200


def _q(book, over, under, *, age=10.0, so=100.0, su=100.0, line=6.5):
    return BookQuote(
        book=book, line=line, over=over, under=under,
        stake_over=so, stake_under=su, age_minutes=age,
    )


def _price(quotes, **kwargs):
    params = dict(
        quotes=quotes,
        dfs_line=6.5,
        app="prizepicks",
        format="power",
        legs=4,
        payout_multiplier=None,
    )
    params.update(kwargs)
    return price_line(**params)


def _fav_trio():
    return [
        _q("pinnacle", _FAV_OVER, _FAV_UNDER),
        _q("draftkings", _FAV_OVER, _FAV_UNDER),
        _q("betmgm", _FAV_OVER, _FAV_UNDER),
    ]


def test_hold_004_uses_multiplicative_not_power():
    # Asymmetric juice so multiplicative and power disagree (symmetric -108/-108
    # yields 0.5 either way).
    p_over = american_to_prob(-200)
    p_under = american_to_prob(170)
    hold = p_over + p_under - 1.0
    assert 0.03 < hold < 0.05
    assert hold != pytest.approx(0.05)
    fair = legs_pricer.devig_over(p_over, p_under)
    assert fair == pytest.approx(p_over / (p_over + p_under))
    k = power_k(p_over, p_under)
    assert k is not None
    assert fair != pytest.approx(p_over**k)


def test_hold_006_uses_power_not_multiplicative():
    p_over = american_to_prob(-160)
    p_under = american_to_prob(125)
    hold = p_over + p_under - 1.0
    assert 0.05 < hold < 0.07
    assert hold != pytest.approx(0.05)
    k = power_k(p_over, p_under)
    assert k is not None
    fair = legs_pricer.devig_over(p_over, p_under)
    assert fair == pytest.approx(p_over**k)
    assert fair != pytest.approx(p_over / (p_over + p_under))


def test_power_unsolved_fallback_excludes_book(monkeypatch):
    assert power_k(0.4, 0.4) is None
    assert power_k(1.2, 0.3) is None

    monkeypatch.setattr(legs_pricer, "power_k", lambda *args, **kwargs: None)
    quotes = [
        _q("pinnacle", _FAV_OVER, _FAV_UNDER),
        _q("draftkings", _FAV_OVER, _FAV_UNDER),
        _q("betmgm", _FAV_OVER, _FAV_UNDER),
        _q("fanduel", -160, 125),
    ]
    result = _price(quotes)
    assert isinstance(result, PlayResult)
    assert "fanduel" in result.books_excluded
    assert "fanduel" not in result.books_used
    assert "pinnacle" in result.books_used


def test_pinnacle_mgm_caesars_insufficient_coverage():
    quotes = [
        _q("pinnacle", _FAV_OVER, _FAV_UNDER),
        _q("betmgm", _FAV_OVER, _FAV_UNDER),
        _q("caesars", _FAV_OVER, _FAV_UNDER),
    ]
    result = _price(quotes)
    assert isinstance(result, RejectResult)
    assert result.reason == "insufficient_coverage"


def test_pinnacle_dk_mgm_plays_when_over_is_favorite():
    result = _price(_fav_trio())
    assert isinstance(result, PlayResult)
    assert result.side == "over"
    assert result.fair_prob > 0.5
    assert result.fair_prob >= 0.35
    assert result.sharp_anchor == "pinnacle"
    assert result.margin_pts >= result.required_margin_pts
    heavy = [b for b in result.books_used if legs_pricer.WEIGHTS[b] >= 2.0]
    assert len(heavy) >= 2


def test_exchange_stake_zero_excluded():
    quotes = [
        _q("novig", _FAV_OVER, _FAV_UNDER, so=0.0, su=100.0),
        _q("draftkings", _FAV_OVER, _FAV_UNDER),
        _q("fanduel", _FAV_OVER, _FAV_UNDER),
        _q("betmgm", _FAV_OVER, _FAV_UNDER),
    ]
    result = _price(quotes)
    assert isinstance(result, RejectResult)
    assert result.reason == "insufficient_sharp"


def test_sharp_age_50_excluded_dk_age_50_included():
    quotes = [
        _q("pinnacle", _FAV_OVER, _FAV_UNDER, age=50.0),
        _q("novig", _FAV_OVER, _FAV_UNDER, age=10.0),
        _q("draftkings", _FAV_OVER, _FAV_UNDER, age=50.0),
        _q("betmgm", _FAV_OVER, _FAV_UNDER, age=10.0),
    ]
    result = _price(quotes)
    assert isinstance(result, PlayResult)
    assert "pinnacle" in result.books_excluded
    assert "draftkings" in result.books_used
    assert result.sharp_anchor == "exchange_only"


def test_disagreement_ignores_caesars():
    quotes = [
        _q("pinnacle", _FAV_OVER, _FAV_UNDER),
        _q("draftkings", _FAV_OVER, _FAV_UNDER),
        _q("caesars", -110, -110),
    ]
    result = _price(quotes)
    assert isinstance(result, PlayResult)
    assert result.book_disagreement_pts == pytest.approx(0.0)
    assert result.required_margin_pts == 4.0


def test_heavy_book_disagreement_adds_margin():
    quotes = [
        _q("pinnacle", _FAV_OVER, _FAV_UNDER),
        _q("draftkings", -160, 140),
        _q("betmgm", _FAV_OVER, _FAV_UNDER),
    ]
    result = _price(quotes)
    assert isinstance(result, PlayResult)
    pin = legs_pricer.devig_over(
        american_to_prob(_FAV_OVER), american_to_prob(_FAV_UNDER)
    )
    dk = legs_pricer.devig_over(american_to_prob(-160), american_to_prob(140))
    expected = (max(pin, dk) - min(pin, dk)) * 100.0
    assert expected > 4.0
    assert result.book_disagreement_pts == pytest.approx(expected)
    assert result.required_margin_pts == 5.5


def test_boost_m_115_does_not_lower_break_even():
    quotes = _fav_trio()
    base = _price(
        quotes, app="underdog", format="standard", legs=4, payout_multiplier=1.0
    )
    boosted = _price(
        quotes, app="underdog", format="standard", legs=4, payout_multiplier=1.15
    )
    assert isinstance(base, PlayResult)
    assert isinstance(boosted, PlayResult)
    assert boosted.break_even == pytest.approx(base.break_even)
    assert boosted.payout_multiplier == 1.15
    assert boosted.fair_prob != pytest.approx(1.0 / 1.15)
    assert boosted.break_even != pytest.approx(1.0 / 1.15)


def test_discount_m_090_raises_break_even():
    quotes = [
        _q("pinnacle", _STRONG_OVER, _STRONG_UNDER),
        _q("draftkings", _STRONG_OVER, _STRONG_UNDER),
        _q("betmgm", _STRONG_OVER, _STRONG_UNDER),
    ]
    base = _price(
        quotes, app="underdog", format="standard", legs=4, payout_multiplier=1.0
    )
    discounted = _price(
        quotes, app="underdog", format="standard", legs=4, payout_multiplier=0.90
    )
    assert isinstance(base, PlayResult)
    assert isinstance(discounted, PlayResult)
    assert discounted.break_even == pytest.approx(base.break_even / 0.90)
    table_be = base_break_even("underdog", "standard", 4)
    assert discounted.break_even == pytest.approx(table_be / 0.90)
    assert abs(discounted.break_even - (10 * 0.9**4) ** (-1 / 4)) < 1e-4
    assert discounted.fair_prob != pytest.approx(1.0 / 0.90)
    assert discounted.break_even != pytest.approx(1.0 / 0.90)


def test_p_over_half_is_below_threshold():
    quotes = [
        _q("pinnacle", -110, -110),
        _q("draftkings", -110, -110),
        _q("betmgm", -110, -110),
    ]
    result = _price(quotes)
    assert isinstance(result, RejectResult)
    assert result.reason == "below_threshold"


def test_tiny_m_unpriceable_payout():
    result = _price(_fav_trio(), app="underdog", format="standard", legs=4, payout_multiplier=0.5)
    assert isinstance(result, RejectResult)
    assert result.reason == "unpriceable_payout"


def test_no_sharp_is_insufficient_sharp():
    quotes = [
        _q("draftkings", _FAV_OVER, _FAV_UNDER),
        _q("fanduel", _FAV_OVER, _FAV_UNDER),
        _q("betmgm", _FAV_OVER, _FAV_UNDER),
    ]
    result = _price(quotes)
    assert isinstance(result, RejectResult)
    assert result.reason == "insufficient_sharp"
