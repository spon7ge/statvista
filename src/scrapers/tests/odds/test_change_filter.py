import pandas as pd

from src.odds import change_filter
from src.odds.change_filter import (
    apply_change_filter,
    fetch_latest_quotes,
    filter_unchanged_quotes,
    values_equal,
)
from src.odds.quote_specs import get_quote_spec


def _pp_row(**kwargs):
    base = {
        "league": "wnba",
        "player_name": "A'ja Wilson",
        "stat_type": "Points",
        "odds_type": "standard",
        "line_score": 22.5,
        "scraped_at": "2026-08-10T12:00:00+00:00",
    }
    base.update(kwargs)
    return base


def test_keeps_new_quote_when_latest_empty():
    df = pd.DataFrame([_pp_row()])
    kept, skipped = filter_unchanged_quotes(
        df, latest=pd.DataFrame(), spec=get_quote_spec("wnba_prizepicks")
    )
    assert len(kept) == 1
    assert skipped == 0


def test_skips_identical_line():
    df = pd.DataFrame([_pp_row(scraped_at="2026-08-10T13:00:00+00:00")])
    latest = pd.DataFrame([_pp_row(scraped_at="2026-08-10T12:00:00+00:00")])
    kept, skipped = filter_unchanged_quotes(
        df, latest=latest, spec=get_quote_spec("wnba_prizepicks")
    )
    assert kept.empty
    assert skipped == 1


def test_keeps_line_change():
    df = pd.DataFrame([_pp_row(line_score=23.5)])
    latest = pd.DataFrame([_pp_row(line_score=22.5)])
    kept, skipped = filter_unchanged_quotes(
        df, latest=latest, spec=get_quote_spec("wnba_prizepicks")
    )
    assert len(kept) == 1
    assert skipped == 0


def test_keeps_price_only_change_underdog():
    spec = get_quote_spec("mlb_underdogs")
    row = {
        "league": "mlb",
        "player_name": "Judge",
        "stat_name": "home_runs",
        "side": "over",
        "line_score": 0.5,
        "american_price": -120,
        "payout_multiplier": 0.94,
    }
    df = pd.DataFrame([{**row, "american_price": -115}])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert len(kept) == 1
    assert skipped == 0


def test_null_prices_equal():
    spec = get_quote_spec("mlb_underdogs")
    row = {
        "league": "mlb",
        "player_name": "Judge",
        "stat_name": "home_runs",
        "side": "over",
        "line_score": 0.5,
        "american_price": None,
        "payout_multiplier": None,
    }
    df = pd.DataFrame([row])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert kept.empty
    assert skipped == 1


def test_values_equal_both_null_or_nan():
    assert values_equal(None, None)
    assert values_equal(float("nan"), float("nan"))
    assert values_equal(None, float("nan"))


def test_values_equal_one_null_one_not():
    assert not values_equal(None, 1.0)
    assert not values_equal(float("nan"), -110)
    assert not values_equal(-120, None)


def test_values_equal_float_isclose():
    assert values_equal(1.0, 1.0 + 1e-10)
    assert not values_equal(1.0, 1.1)
    assert values_equal(22.5, 22.5000000000001)


def test_values_equal_bool_uses_strict_equality_not_isclose():
    assert values_equal(True, True)
    assert not values_equal(True, False)
    # bool branch avoids isclose; Python bool/int equality still applies.
    assert values_equal(True, 1)
    assert not values_equal(True, 2)


def _pinnacle_team_row(**kwargs):
    base = {
        "league": "mlb",
        "away_team": "BAL",
        "home_team": "MIN",
        "market_type": "moneyline",
        "period": 0,
        "is_alternate": False,
        "side": "home",
        "points": None,
        "american_price": -110,
        "decimal_price": 1.91,
    }
    base.update(kwargs)
    return base


def test_pinnacle_team_skips_identical_points_and_prices():
    spec = get_quote_spec("mlb_pinnacle_team")
    row = _pinnacle_team_row(
        market_type="spread",
        points=-1.5,
        american_price=-105,
        decimal_price=1.95,
    )
    df = pd.DataFrame([row])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert kept.empty
    assert skipped == 1


def test_pinnacle_team_keeps_points_change():
    spec = get_quote_spec("mlb_pinnacle_team")
    row = _pinnacle_team_row(
        market_type="total",
        points=8.5,
        american_price=-115,
        decimal_price=1.87,
    )
    df = pd.DataFrame([{**row, "points": 9.0}])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert len(kept) == 1
    assert skipped == 0


def test_apply_change_filter_skips_when_env_set(monkeypatch):
    def raise_if_called(*args, **kwargs):
        raise AssertionError("fetch_latest_quotes should not be called")

    monkeypatch.setenv("ODDS_SKIP_CHANGE_FILTER", "1")
    monkeypatch.setattr(change_filter, "fetch_latest_quotes", raise_if_called)

    df = pd.DataFrame([_pp_row()])
    result = apply_change_filter("wnba_prizepicks", df, league="wnba")
    pd.testing.assert_frame_equal(result, df)
    assert result is df


def test_fetch_latest_quotes_sql_uses_distinct_on_and_scraped_at_desc(monkeypatch):
    captured_sql: list[str] = []

    def fake_read_sql(sql, conn, params=None):
        captured_sql.append(str(sql))
        return pd.DataFrame()

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    class FakeEngine:
        def connect(self):
            return FakeConn()

    monkeypatch.setattr("src.utils.db.get_engine", lambda: FakeEngine())
    monkeypatch.setattr(change_filter.pd, "read_sql", fake_read_sql)

    spec = get_quote_spec("wnba_prizepicks")
    fetch_latest_quotes("wnba_prizepicks", league="wnba", spec=spec)

    assert len(captured_sql) == 1
    sql_text = captured_sql[0]
    assert "DISTINCT ON" in sql_text
    assert '"scraped_at" DESC' in sql_text


def test_skips_identical_underdog_line_and_prices():
    spec = get_quote_spec("mlb_underdogs")
    row = {
        "league": "mlb",
        "player_name": "Judge",
        "stat_name": "home_runs",
        "side": "over",
        "line_score": 0.5,
        "american_price": -120,
        "payout_multiplier": 0.94,
    }
    df = pd.DataFrame([row])
    latest = pd.DataFrame([row])
    kept, skipped = filter_unchanged_quotes(df, latest=latest, spec=spec)
    assert kept.empty
    assert skipped == 1
