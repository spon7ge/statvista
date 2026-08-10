"""Unit tests for Parlay MLB props normalizer (no live network)."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.domains.mlb.prop_fair import american_to_fair_pct
from app.domains.mlb.prop_stat_keys import canonical_stat_key_from_pp_mlb
from app.providers.parlay.mlb_props import (
    ParlayMlbNormalized,
    fetch_mlb_parlay_props_normalized,
    normalize_parlay_mlb_props,
)

_FIXTURE = (
    Path(__file__).resolve().parent / "fixtures" / "parlay_mlb_props_minimal.json"
)


@pytest.fixture(autouse=True)
def _clear_parlay_mlb_cache(monkeypatch):
    from app.providers.parlay import mlb_props as mod

    monkeypatch.setattr(mod, "_cache", {"expires_at": 0.0, "value": None})


def _fixture_rows() -> list[dict]:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def test_normalize_builds_pp_board_and_dk_fd_indexes():
    out = normalize_parlay_mlb_props(_fixture_rows())
    assert any(r["player_name"] == "Shohei Ohtani" for r in out.prizepicks_board)
    assert "draftkings" in out.book_indexes
    assert "fanduel" in out.book_indexes
    assert "novig" not in out.book_indexes
    assert "prizepicks" not in out.book_indexes


def test_normalize_builds_prizepicks_board_rows():
    out = normalize_parlay_mlb_props(_fixture_rows())
    row = next(r for r in out.prizepicks_board if r["player_name"] == "Shohei Ohtani")
    assert row["odds_type"] == "standard"
    assert row["line_score"] == 1.5
    assert row["stat_type"] == "Hits"
    assert canonical_stat_key_from_pp_mlb(row["stat_type"]) == "hits"
    assert row["scraped_at"] == "2026-08-09T18:00:00Z"


def test_normalize_indexes_dk_fd_side_quotes():
    out = normalize_parlay_mlb_props(_fixture_rows())
    key = ("shohei ohtani", "hits", "under", 1.5)
    assert out.book_indexes["draftkings"][key]["american"] == -104
    assert out.book_indexes["draftkings"][key]["fair_pct"] == american_to_fair_pct(-104)
    assert out.book_indexes["fanduel"][key]["american"] == -108
    assert out.book_indexes["draftkings"][key]["changed_at"] == "2026-08-09T18:01:00Z"


def test_normalize_picks_main_line_over_alt():
    out = normalize_parlay_mlb_props(_fixture_rows())
    alt_key = ("shohei ohtani", "hits", "over", 2.5)
    assert alt_key not in out.book_indexes["draftkings"]


def test_skips_unknown_markets():
    out = normalize_parlay_mlb_props(_fixture_rows())
    assert all(
        r.get("stat_type") != "To Hit A Home Run" for r in out.prizepicks_board
    )
    for index in out.book_indexes.values():
        for (_player, stat, _side, _line) in index:
            assert stat != "player_to_hit_a_home_run"


def test_normalize_empty_input():
    out = normalize_parlay_mlb_props([])
    assert out == ParlayMlbNormalized(
        prizepicks_board=[], book_indexes={}, as_of=None, unavailable=False
    )


@pytest.mark.asyncio
async def test_fetch_soft_fails_when_key_missing(monkeypatch):
    monkeypatch.setattr("app.providers.parlay.client.PARLAY_API_KEY", None)
    out = await fetch_mlb_parlay_props_normalized()
    assert out.prizepicks_board == []
    assert out.book_indexes == {}
    assert out.as_of is None
    assert out.unavailable is True


@pytest.mark.asyncio
async def test_fetch_empty_list_is_available_empty():
    with patch(
        "app.providers.parlay.mlb_props.parlay_get",
        new=AsyncMock(return_value=[]),
    ):
        out = await fetch_mlb_parlay_props_normalized()

    assert out.prizepicks_board == []
    assert out.book_indexes == {}
    assert out.unavailable is False


@pytest.mark.asyncio
async def test_fetch_calls_normalize_after_client():
    mock_get = AsyncMock(return_value=_fixture_rows())
    with patch("app.providers.parlay.mlb_props.parlay_get", new=mock_get):
        out = await fetch_mlb_parlay_props_normalized()

    assert out.unavailable is False
    assert "draftkings" in out.book_indexes
    assert any(r["player_name"] == "Shohei Ohtani" for r in out.prizepicks_board)
    assert mock_get.await_args.kwargs["timeout"] == 45.0


@pytest.mark.asyncio
async def test_fetch_caches_successful_normalize():
    mock_get = AsyncMock(return_value=_fixture_rows())
    with patch("app.providers.parlay.mlb_props.parlay_get", new=mock_get):
        first = await fetch_mlb_parlay_props_normalized()
        second = await fetch_mlb_parlay_props_normalized()

    assert first is second
    assert mock_get.await_count == 1
