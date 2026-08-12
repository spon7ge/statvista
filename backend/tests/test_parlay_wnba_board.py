"""Unit tests for Parlay WNBA board normalizer (PP + DK + FD)."""

from __future__ import annotations

from app.providers.parlay.wnba_board import normalize_parlay_wnba_board


def test_normalize_splits_pp_and_dk_fd():
    # Keys match live WNBA Parlay rows (see parlay_props / fixtures), not the
    # brief's sportsbook/over_odds sketch.
    rows = [
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "bookmaker": "prizepicks",
            "line": 19.5,
            "over_price": None,
            "under_price": None,
            "commence_time": "2026-08-11T23:00:00Z",
        },
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "bookmaker": "draftkings",
            "line": 19.5,
            "over_price": -120,
            "under_price": 100,
        },
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "bookmaker": "caesars",
            "line": 19.5,
            "over_price": -110,
            "under_price": -110,
        },
    ]
    out = normalize_parlay_wnba_board(rows)
    assert len(out.prizepicks_board) == 1
    assert out.prizepicks_board[0]["odds_type"] == "standard"
    assert out.prizepicks_board[0]["stat_type"] == "points"
    assert out.prizepicks_board[0]["commence_time"] == "2026-08-11T23:00:00Z"
    dk_key = ("caitlin clark", "points", "over", 19.5)
    assert dk_key in out.book_indexes["draftkings"]
    assert "caesars" not in out.book_indexes
