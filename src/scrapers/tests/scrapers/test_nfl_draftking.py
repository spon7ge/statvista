"""NFL DraftKings event group and stat names. No live network."""

from __future__ import annotations

from src.scrapers.nfl import nfl_draftking as dk


def test_targets_nfl_event_group() -> None:
    assert dk._DEFAULT_CONFIG["sport_allowlist"] == ["NFL"]
    assert dk._DEFAULT_CONFIG["dk_event_group"] == "88808"
    assert dk._DEFAULT_CONFIG["dk_league_page"].endswith("/football/nfl")
    allow = dk._DEFAULT_CONFIG["dk_category_allowlist"]
    assert "pass" in allow
    assert "rush" in allow
    assert "receiv" in allow
    assert "point" not in allow
    assert "rebound" not in allow


def test_sport_to_league_maps_nfl_only() -> None:
    assert dk.sport_to_league("NFL") == "nfl"
    assert dk.sport_to_league(" nfl ") == "nfl"
    assert dk.sport_to_league("NBA") is None
    assert dk.sport_to_league("MLB") is None


def test_match_stat_uses_nfl_names() -> None:
    assert dk.match_stat("Passing Yards") == "passing_yards"
    assert dk.match_stat("Pass Yds") == "passing_yards"
    assert dk.match_stat("Rush Yds") == "rushing_yards"
    assert dk.match_stat("Rec Yds") == "receiving_yards"
    assert dk.match_stat("Pass TDs") == "passing_touchdowns"
    assert dk.match_stat("Rushing + Receiving Yards") == "rushing_receiving_yards"
    assert dk.match_stat("Rushing Yards") == "rushing_yards"
    assert dk.match_stat("Receiving Yards") == "receiving_yards"
    assert dk.match_stat("Receptions") == "receptions"
    assert dk.match_stat("Passing Touchdowns") == "passing_touchdowns"
    assert dk.match_stat("Anytime Touchdown Scorer") == "touchdowns"
    assert dk.match_stat("Pass Completions") == "passing_completions"
    assert dk.match_stat("Interceptions Thrown") == "interceptions"


def test_game_markets_are_not_player_props() -> None:
    assert dk.is_game_market("Moneyline")
    assert dk.is_game_market("Point Spread")
    assert dk.is_game_market("Total Points")
    assert dk.is_game_market("First Touchdown Scorer")
    assert not dk.is_game_market("Patrick Mahomes Passing Yards")
    assert not dk.is_game_market("Justin Tucker Kicking Points")
