from src.odds.quote_specs import QUOTE_SPECS, get_quote_spec


def test_nba_quote_specs_registered():
    assert get_quote_spec("nba_prizepicks") is QUOTE_SPECS["mlb_prizepicks"]
    assert get_quote_spec("nba_underdogs") is QUOTE_SPECS["mlb_underdogs"]
    assert get_quote_spec("nba_pinnacle") is QUOTE_SPECS["mlb_pinnacle"]
    assert get_quote_spec("nba_pinnacle_team") is QUOTE_SPECS["mlb_pinnacle_team"]
    assert get_quote_spec("nba_prophetx") is QUOTE_SPECS["mlb_prophetx"]
    assert get_quote_spec("nba_prophetx_team") is QUOTE_SPECS["mlb_prophetx_team"]
    assert get_quote_spec("nba_novig") is QUOTE_SPECS["mlb_novig"]
    assert get_quote_spec("nba_novig_team") is QUOTE_SPECS["mlb_novig_team"]
    assert get_quote_spec("nba_draftkings") is QUOTE_SPECS["wnba_draftkings"]
    assert get_quote_spec("nba_fanduel") is QUOTE_SPECS["wnba_fanduel"]
