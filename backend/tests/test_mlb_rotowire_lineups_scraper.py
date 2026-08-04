from pathlib import Path
from unittest.mock import MagicMock, patch

from src.scrapers.mlb_rotowire_lineups import (
    MLB_LINEUPS_URL,
    fetch_mlb_lineups_html,
    parse_mlb_lineups_html,
)

FIXTURE = Path(__file__).parent / "fixtures" / "rotowire_mlb_lineups_laa_bal.html"

_SIBLING_HIGHLIGHT_HTML = """
<html><body>
<div class="lineup is-mlb">
<div class="lineup__team is-visit"><div class="lineup__abbr">LAA</div></div>
<div class="lineup__team is-home"><div class="lineup__abbr">BAL</div></div>
<div class="lineup__main">
<li class="lineup__player-highlight mb-0">
<div class="lineup__player-highlight-name">
<a href="#">G. Rodriguez</a><span class="lineup__throws">R</span>
</div>
<div class="lineup__player-highlight-stats">3-3 7.98 ERA</div>
</li>
<ul class="lineup__list is-visit">
<li class="lineup__player"><div class="lineup__pos">SS</div><a>Zach Neto</a><span class="lineup__bats">R</span></li>
</ul>
<li class="lineup__player-highlight mb-0">
<div class="lineup__player-highlight-name">
<a href="#">Cade Povich</a><span class="lineup__throws">L</span>
</div>
<div class="lineup__player-highlight-stats">1-1 5.12 ERA</div>
</li>
<ul class="lineup__list is-home">
<li class="lineup__player"><div class="lineup__pos">DH</div><a>Coby Mayo</a><span class="lineup__bats">R</span></li>
</ul>
</div>
</div>
</body></html>
"""


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


def test_parse_pitcher_highlights_by_dom_order_when_not_in_ul():
    games = parse_mlb_lineups_html(_SIBLING_HIGHLIGHT_HTML)
    assert len(games) == 1
    g = games[0]
    assert g["away_abbrev"] == "LAA"
    assert g["home_abbrev"] == "BAL"
    assert g["away"]["pitcher"]["name"] == "G. Rodriguez"
    assert g["away"]["pitcher"]["hand"] == "R"
    assert g["away"]["pitcher"]["record"] == "3-3"
    assert g["away"]["pitcher"]["era"] == "7.98"
    assert g["home"]["pitcher"]["name"] == "Cade Povich"
    assert g["home"]["pitcher"]["hand"] == "L"
    assert g["home"]["pitcher"]["record"] == "1-1"
    assert g["home"]["pitcher"]["era"] == "5.12"


@patch("src.scrapers.mlb_rotowire_lineups.requests.get")
def test_fetch_mlb_lineups_html_today_has_no_date_param(mock_get):
    mock_response = MagicMock()
    mock_response.text = "<html></html>"
    mock_response.raise_for_status = MagicMock()
    mock_get.return_value = mock_response

    fetch_mlb_lineups_html()

    mock_get.assert_called_once()
    call_kwargs = mock_get.call_args.kwargs
    assert mock_get.call_args.args[0] == MLB_LINEUPS_URL
    assert call_kwargs["params"] is None


@patch("src.scrapers.mlb_rotowire_lineups.requests.get")
def test_fetch_mlb_lineups_html_tomorrow_passes_date_param(mock_get):
    mock_response = MagicMock()
    mock_response.text = "<html></html>"
    mock_response.raise_for_status = MagicMock()
    mock_get.return_value = mock_response

    fetch_mlb_lineups_html(date_token="tomorrow")

    mock_get.assert_called_once()
    call_kwargs = mock_get.call_args.kwargs
    assert mock_get.call_args.args[0] == MLB_LINEUPS_URL
    assert call_kwargs["params"] == {"date": "tomorrow"}
