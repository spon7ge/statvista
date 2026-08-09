"""Unit tests for Odds API MLB props normalizer (no live network)."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.domains.mlb.prop_fair import american_to_fair_pct
from app.domains.mlb.prop_stat_keys import canonical_stat_key_from_pp_mlb
from app.providers.odds_api.mlb_props import (
    OddsApiMlbNormalized,
    fetch_mlb_props_normalized,
    normalize_event_odds,
)

_FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "odds_api_mlb_event_odds_minimal.json"
)


def _fixture_events() -> list[dict]:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def test_normalize_maps_betonlineag_to_betonline():
    out = normalize_event_odds(_fixture_events())
    assert "betonline" in out.book_indexes
    assert "betonlineag" not in out.book_indexes
    key = ("shohei ohtani", "hits", "over", 1.5)
    quote = out.book_indexes["betonline"][key]
    assert quote["american"] == -115
    assert quote["fair_pct"] == american_to_fair_pct(-115)
    assert quote["changed_at"] == "2026-08-09T18:02:00Z"


def test_normalize_builds_prizepicks_board_rows():
    out = normalize_event_odds(_fixture_events())
    assert any(r["player_name"] == "Shohei Ohtani" for r in out.prizepicks_board)
    row = next(r for r in out.prizepicks_board if r["player_name"] == "Shohei Ohtani")
    assert row["odds_type"] == "standard"
    assert row["line_score"] == 1.5
    assert row["stat_type"] == "Hits"
    assert canonical_stat_key_from_pp_mlb(row["stat_type"]) == "hits"
    assert row["scraped_at"] == "2026-08-09T18:00:00Z"
    # PrizePicks is board-only — never a books.* index.
    assert "prizepicks" not in out.book_indexes


def test_normalize_indexes_novig_side_quotes():
    out = normalize_event_odds(_fixture_events())
    key = ("shohei ohtani", "hits", "under", 1.5)
    assert out.book_indexes["novig"][key]["american"] == -104


def test_skips_unknown_markets():
    out = normalize_event_odds(_fixture_events())
    # Unknown market on prizepicks must not become a board row.
    assert all(
        r.get("stat_type") != "player_to_hit_a_home_run" for r in out.prizepicks_board
    )
    for index in out.book_indexes.values():
        for (_player, stat, _side, _line) in index:
            assert stat != "player_to_hit_a_home_run"


def test_normalize_empty_input():
    out = normalize_event_odds([])
    assert out == OddsApiMlbNormalized(
        prizepicks_board=[], book_indexes={}, as_of=None
    )


@pytest.mark.asyncio
async def test_fetch_soft_fails_when_key_missing(monkeypatch):
    monkeypatch.setattr("app.providers.odds_api.client.THE_ODDS_API_KEY", None)
    out = await fetch_mlb_props_normalized()
    assert out.prizepicks_board == []
    assert out.book_indexes == {}
    assert out.as_of is None


@pytest.mark.asyncio
async def test_fetch_calls_normalize_after_client():
    events = [{"id": "evt1"}]
    odds_payload = _fixture_events()[0]

    async def fake_get(path: str, *, params=None, timeout=12.0):
        if path.endswith("/events") and "/odds" not in path:
            return events
        if path.endswith("/events/evt1/odds"):
            return odds_payload
        raise AssertionError(f"unexpected path {path}")

    with patch(
        "app.providers.odds_api.mlb_props.odds_api_get",
        new=AsyncMock(side_effect=fake_get),
    ):
        out = await fetch_mlb_props_normalized()

    assert "betonline" in out.book_indexes
    assert any(r["player_name"] == "Shohei Ohtani" for r in out.prizepicks_board)
