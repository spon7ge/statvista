from pathlib import Path

from src.scrapers.mlb_rotowire_lineups import parse_mlb_lineups_html

FIXTURE = Path(__file__).parent / "fixtures" / "rotowire_mlb_lineups_laa_bal.html"


def test_parse_mlb_lineups_laa_bal():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    assert len(games) == 1
    g = games[0]
    assert g["away_abbrev"] == "LAA"
    assert g["home_abbrev"] == "BAL"
    assert g["away"]["pitcher"]["name"]
    assert g["away"]["pitcher"]["hand"] in ("L", "R", "S")
    assert len(g["away"]["batters"]) == 9
    assert g["away"]["batters"][0]["order"] == 1
    assert g["away"]["batters"][0]["position"]
    assert len(g["home"]["batters"]) == 9


def test_parse_pitcher_record_and_era():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    p = games[0]["away"]["pitcher"]
    assert p["record"]  # e.g. "3-3"
    assert p["era"]  # e.g. "7.98"


def test_parse_batting_order_is_sequential_and_home_pitcher():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    g = games[0]
    assert [b["order"] for b in g["away"]["batters"]] == list(range(1, 10))
    assert [b["order"] for b in g["home"]["batters"]] == list(range(1, 10))
    home_pitcher = g["home"]["pitcher"]
    assert home_pitcher["name"] == "Cade Povich"
    assert home_pitcher["hand"] == "L"
    assert home_pitcher["record"] == "1-1"
    assert home_pitcher["era"] == "5.12"


def test_parse_batter_names_and_hands():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    away_batters = games[0]["away"]["batters"]
    assert away_batters[0]["name"] == "Zach Neto"
    assert away_batters[0]["position"] == "SS"
    assert away_batters[0]["hand"] == "R"
    assert away_batters[-1]["name"] == "Wade Meckler"
    assert away_batters[-1]["hand"] == "L"


def test_parse_status_is_expected_lineup():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    assert games[0]["status"] == "expected"


def test_parse_missing_pitcher_stats_returns_none():
    html = FIXTURE.read_text().replace("3-3\xa07.98 ERA", "")
    games = parse_mlb_lineups_html(html)
    p = games[0]["away"]["pitcher"]
    assert p["record"] is None
    assert p["era"] is None
    assert p["name"]
