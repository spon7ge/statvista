"""Unit tests for Parlay WNBA board normalizer (PP board + cmp books)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.providers.parlay.wnba_board import (
    fetch_wnba_parlay_board_normalized,
    normalize_parlay_wnba_board,
)


@pytest.fixture(autouse=True)
def _clear_parlay_wnba_cache(monkeypatch):
    from app.providers.parlay import wnba_board as mod

    monkeypatch.setattr(mod, "_cache", {"expires_at": 0.0, "value": None})


def _sample_rows() -> list[dict]:
    return [
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
            "bookmaker": "prizepicks",
            "line": 19.5,
            "over_price": None,
            "under_price": None,
        },
    ]


@pytest.mark.asyncio
async def test_fetch_wnba_parlay_persists_snapshot(monkeypatch):
    called: dict[str, object] = {}

    def fake_persist(rows, *, league="wnba", scraped_at=None):
        called["league"] = league
        called["n"] = len(rows)
        return {"draftkings": 1}

    monkeypatch.setattr(
        "src.odds.load_snapshots.maybe_persist_parlay_props", fake_persist
    )
    with patch(
        "app.providers.parlay.wnba_board.parlay_get",
        new=AsyncMock(return_value=_sample_rows()),
    ):
        out = await fetch_wnba_parlay_board_normalized()

    assert called.get("league") == "wnba"
    assert called.get("n", 0) > 0
    assert out.unavailable is False


@pytest.mark.asyncio
async def test_fetch_wnba_parlay_skips_persist_on_fetch_failure(monkeypatch):
    called: dict[str, object] = {"n": 0}

    def fake_persist(rows, *, league="wnba", scraped_at=None):
        called["n"] = len(rows)
        return {}

    monkeypatch.setattr(
        "src.odds.load_snapshots.maybe_persist_parlay_props", fake_persist
    )
    with patch(
        "app.providers.parlay.wnba_board.parlay_get",
        new=AsyncMock(side_effect=RuntimeError("network down")),
    ):
        out = await fetch_wnba_parlay_board_normalized()

    assert called.get("n", 0) == 0
    assert out.unavailable is True


@pytest.mark.asyncio
async def test_fetch_wnba_parlay_persist_failure_still_returns(monkeypatch):
    def boom(*_a, **_k):
        raise RuntimeError("db down")

    monkeypatch.setattr(
        "src.odds.load_snapshots.maybe_persist_parlay_props", boom
    )
    with patch(
        "app.providers.parlay.wnba_board.parlay_get",
        new=AsyncMock(return_value=_sample_rows()),
    ):
        out = await fetch_wnba_parlay_board_normalized()

    assert out.unavailable is False
    assert "draftkings" in out.book_indexes


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
