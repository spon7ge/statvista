"""Unit tests for Parlay WNBA board normalizer (PP board + cmp books)."""

from __future__ import annotations

from app.providers.parlay.wnba_board import normalize_parlay_wnba_board


def test_normalize_splits_pp_and_cmp_books():
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
    over_key = ("caitlin clark", "points", "over", 19.5)
    under_key = ("caitlin clark", "points", "under", 19.5)
    assert over_key in out.book_indexes["draftkings"]
    assert out.book_indexes["draftkings"][over_key]["american"] == -120
    assert "caesars" in out.book_indexes
    assert out.book_indexes["caesars"][over_key]["american"] == -110
    assert out.book_indexes["caesars"][under_key]["american"] == -110


def test_pp_line_only_alt_not_seeded_when_priced_main_exists():
    """Priced PP main wins; line-only alt must not bypass main-line selection."""
    rows = [
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "bookmaker": "prizepicks",
            "line": 19.5,
            "over_price": -110,
            "under_price": -110,
        },
        {
            "player": "Caitlin Clark",
            "market": "Points",
            "market_key": "player_points",
            "bookmaker": "prizepicks",
            "line": 22.5,
            "over_price": None,
            "under_price": None,
        },
    ]
    out = normalize_parlay_wnba_board(rows)
    lines = [row["line_score"] for row in out.prizepicks_board]
    assert 19.5 in lines
    assert 22.5 not in lines
