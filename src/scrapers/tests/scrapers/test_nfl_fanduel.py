"""NFL FanDuel page, tabs, and stat names. No live network."""

from __future__ import annotations

from src.scrapers.nfl import nfl_fanduel as fd


def test_targets_nfl_page() -> None:
    assert fd._DEFAULT_CONFIG["sport_allowlist"] == ["NFL"]
    assert fd._DEFAULT_CONFIG["fd_page_id"] == "nfl"
    assert fd._DEFAULT_CONFIG["fd_competition_names"] == ["NFL"]
    tabs = fd._DEFAULT_CONFIG["fd_event_tabs"]
    assert "passing-props" in tabs
    assert "rushing-props" in tabs
    assert "receiving-props" in tabs
    assert "player-points" not in tabs


def test_sport_to_league_maps_nfl_only() -> None:
    assert fd.sport_to_league("NFL") == "nfl"
    assert fd.sport_to_league(" nfl ") == "nfl"
    assert fd.sport_to_league("NBA") is None
    assert fd.sport_to_league("MLB") is None


def test_match_stat_uses_nfl_names() -> None:
    assert fd.match_stat("Passing Yards") == "passing_yards"
    assert fd.match_stat("Rushing + Receiving Yards") == "rushing_receiving_yards"
    assert fd.match_stat("Rushing Yards") == "rushing_yards"
    assert fd.match_stat("Receiving Yards") == "receiving_yards"
    assert fd.match_stat("Receptions") == "receptions"
    assert fd.match_stat("Passing Touchdowns") == "passing_touchdowns"
    assert fd.match_stat("Anytime Touchdown Scorer") == "touchdowns"
    assert fd.match_stat("Pass Completions") == "passing_completions"
    assert fd.match_stat("Interceptions Thrown") == "interceptions"


def test_game_markets_are_not_player_props() -> None:
    assert fd.is_game_market("Moneyline")
    assert fd.is_game_market("Point Spread")
    assert fd.is_game_market("Total Points")
    assert fd.is_game_market("First Touchdown Scorer")
    assert not fd.is_game_market("Patrick Mahomes - Passing Yards")
    assert not fd.is_game_market("Justin Tucker - Kicking Points")
