from __future__ import annotations

import json
import re
from pathlib import Path

import httpx
import pytest

from app.domains.mlb import futures as svc

FIXTURES = Path(__file__).parent / "fixtures"
FUTURES_FIXTURE = FIXTURES / "espn_mlb_futures.json"

TEAMS_BY_ID = {
    "10": {
        "id": "10",
        "abbreviation": "NYY",
        "displayName": "New York Yankees",
        "logos": [{"href": "https://example.com/nyy.png"}],
    },
    "19": {
        "id": "19",
        "abbreviation": "LAD",
        "displayName": "Los Angeles Dodgers",
        "logos": [{"href": "https://example.com/lad.png"}],
    },
}


def _team_id_from_ref(ref: str) -> str | None:
    match = re.search(r"/teams/(\d+)", ref)
    return match.group(1) if match else None


async def _fake_resolve(ref_or_id: str, client: httpx.AsyncClient) -> dict | None:
    team_id = _team_id_from_ref(ref_or_id) or ref_or_id
    raw = TEAMS_BY_ID.get(str(team_id))
    if raw is None:
        return None
    logos = raw.get("logos") or []
    logo_url = logos[0].get("href") if logos else None
    return {
        "id": raw["id"],
        "abbreviation": raw["abbreviation"],
        "displayName": raw["displayName"],
        "logo_url": logo_url,
    }


def test_display_name_prefers_espn_display_name():
    assert (
        svc.display_name_for_market(
            name="MLB  - World Series - Winner",
            display_name="World Series Winner",
        )
        == "World Series Winner"
    )
    assert (
        svc.display_name_for_market(name="MLB - Winning League", display_name=None)
        == "MLB - Winning League"
    )


def test_parse_american_odds():
    assert svc.parse_american_odds("+450") == 450
    assert svc.parse_american_odds("-120") == -120
    assert svc.parse_american_odds("even") is None


def test_pick_provider_prefers_draftkings():
    futures = [
        {"provider": {"name": "ESPN BET", "active": 1}, "books": []},
        {"provider": {"name": "DraftKings", "active": 1}, "books": [{"value": "+100"}]},
    ]
    picked = svc.pick_provider(futures)
    assert picked is not None
    assert picked["provider"]["name"] == "DraftKings"


@pytest.mark.asyncio
async def test_normalize_sorts_favorites_and_uses_display_name(monkeypatch):
    payload = json.loads(FUTURES_FIXTURE.read_text())

    async def fake_resolve(ref_or_id: str, client: httpx.AsyncClient) -> dict | None:
        return await _fake_resolve(ref_or_id, client)

    monkeypatch.setattr(svc, "resolve_team", fake_resolve)
    monkeypatch.setattr(svc, "resolve_book_team", svc.resolve_book_team)

    async with httpx.AsyncClient() as client:
        result = await svc.normalize_futures_payload(payload, 2026, client)

    assert result.season == 2026
    assert result.error is None
    assert len(result.markets) == 4

    world_series = next(m for m in result.markets if m.id == "2761")
    assert world_series.name == "MLB  - World Series - Winner"
    assert world_series.display_name == "World Series Winner"
    assert world_series.provider == "DraftKings"
    assert len(world_series.entries) == 3

    odds = [entry.odds_american for entry in world_series.entries]
    assert odds == ["+450", "+600", "+800"]

    favorite = world_series.entries[0]
    assert favorite.team_id == "10"
    assert favorite.abbrev == "NYY"
    assert favorite.name == "New York Yankees"
    assert favorite.logo_url == "https://example.com/nyy.png"
    assert favorite.odds_american == "+450"
