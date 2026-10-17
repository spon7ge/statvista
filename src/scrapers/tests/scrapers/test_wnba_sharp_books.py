"""WNBA DraftKings and FanDuel scrapers target WNBA, not the NBA copy."""

from __future__ import annotations

from src.scrapers.wnba.wnba_draftking import (
    _DEFAULT_CONFIG as DK_CONFIG,
    sport_to_league as dk_sport_to_league,
)
from src.scrapers.wnba.wnba_fanduel import (
    _DEFAULT_CONFIG as FD_CONFIG,
    sport_to_league as fd_sport_to_league,
)


def test_wnba_draftkings_targets_wnba_event_group():
    assert DK_CONFIG["sport_allowlist"] == ["WNBA"]
    assert DK_CONFIG["dk_event_group"] == "94682"
    assert str(DK_CONFIG["dk_league_page"]).endswith("/94682")
    assert dk_sport_to_league("WNBA") == "wnba"
    assert dk_sport_to_league("NBA") is None


def test_wnba_fanduel_targets_wnba_page():
    assert FD_CONFIG["sport_allowlist"] == ["WNBA"]
    assert FD_CONFIG["fd_page_id"] == "wnba"
    assert FD_CONFIG["fd_competition_names"] == ["WNBA"]
    assert "player-points" in FD_CONFIG["fd_event_tabs"]
    assert fd_sport_to_league("WNBA") == "wnba"
    assert fd_sport_to_league("NBA") is None
