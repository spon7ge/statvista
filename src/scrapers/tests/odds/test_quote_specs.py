from src.odds.quote_specs import QUOTE_SPECS, get_quote_spec


def test_prizepicks_identity_excludes_line_and_scraped_at():
    spec = get_quote_spec("wnba_prizepicks")
    assert spec.identity_cols == ("league", "player_name", "stat_type", "odds_type")
    assert "line_score" in spec.compare_cols
    assert "scraped_at" not in spec.identity_cols
    assert "scraped_at" not in spec.compare_cols


def test_underdog_compares_line_and_prices():
    spec = get_quote_spec("mlb_underdogs")
    assert spec.identity_cols == ("league", "player_name", "stat_name", "side")
    assert spec.compare_cols == ("line_score", "american_price", "payout_multiplier")


def test_parlay_unified_includes_sportsbook():
    spec = get_quote_spec("wnba_parlay_api_odds")
    assert "sportsbook" in spec.identity_cols
    assert spec.compare_cols == ("line_score", "american_price")


def test_mlb_parlay_api_odds_quote_spec_registered():
    spec = get_quote_spec("mlb_parlay_api_odds")
    assert spec is not None
    assert spec == get_quote_spec("wnba_parlay_api_odds")


def test_pinnacle_team_keeps_period_and_is_alternate():
    spec = get_quote_spec("mlb_pinnacle_team")
    assert spec.identity_cols == (
        "league",
        "away_team",
        "home_team",
        "market_type",
        "period",
        "is_alternate",
        "side",
    )
    assert "points" in spec.compare_cols
    assert "american_price" in spec.compare_cols


def test_novig_props_include_event_id():
    spec = get_quote_spec("mlb_novig")
    assert spec.identity_cols == (
        "league",
        "event_id",
        "player_name",
        "stat_name",
        "side",
    )
    assert "stake" in spec.compare_cols


def test_unknown_table_raises():
    import pytest

    with pytest.raises(KeyError):
        get_quote_spec("not_a_real_table")


def test_registry_covers_loader_tables():
    required = {
        "wnba_prizepicks",
        "mlb_prizepicks",
        "wnba_underdogs",
        "mlb_underdogs",
        "wnba_pinnacle",
        "mlb_pinnacle",
        "wnba_pinnacle_team",
        "mlb_pinnacle_team",
        "wnba_fanduel",
        "wnba_draftkings",
        "wnba_parlay_api_odds",
        "mlb_parlay_api_odds",
        "mlb_prophetx",
        "mlb_prophetx_team",
        "wnba_prophetx_team",
        "mlb_novig",
        "mlb_novig_team",
        "wnba_novig",
        "wnba_novig_team",
    }
    assert required <= set(QUOTE_SPECS)
