from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.mlb.schemas_futures import MlbFuturesResponse
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


def test_resolve_team_rejects_non_espn_ref_host():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(
            200,
            json={
                "id": "10",
                "abbreviation": "EVL",
                "displayName": "Evil Team",
                "logos": [{"href": "https://evil.example.com/logo.png"}],
            },
        )

    transport = httpx.MockTransport(handler)

    async def run():
        async with httpx.AsyncClient(transport=transport) as client:
            return await svc.resolve_team(
                "https://evil.example.com/v2/sports/baseball/leagues/mlb/teams/10",
                client,
            )

    assert asyncio.run(run()) is None
    assert calls == []


def test_get_mlb_futures_uses_cache(monkeypatch):
    payload = json.loads(FUTURES_FIXTURE.read_text())
    calls = {"n": 0}

    async def fake_resolve(ref_or_id: str, client: httpx.AsyncClient) -> dict | None:
        return await _fake_resolve(ref_or_id, client)

    monkeypatch.setattr(svc, "resolve_team", fake_resolve)

    async def fake_fetch(season: int):
        calls["n"] += 1
        return payload

    with patch.object(svc, "fetch_espn_futures", side_effect=fake_fetch):
        asyncio.run(svc.get_mlb_futures())
        asyncio.run(svc.get_mlb_futures())
    assert calls["n"] == 1


def test_get_mlb_futures_stale_while_error(monkeypatch):
    payload = json.loads(FUTURES_FIXTURE.read_text())

    async def fake_resolve(ref_or_id: str, client: httpx.AsyncClient) -> dict | None:
        return await _fake_resolve(ref_or_id, client)

    monkeypatch.setattr(svc, "resolve_team", fake_resolve)

    async def ok(season: int):
        return payload

    async def boom(season: int):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_espn_futures", side_effect=ok):
        asyncio.run(svc.get_mlb_futures())

    svc._cache["expires_at"] = 0

    with patch.object(svc, "fetch_espn_futures", side_effect=boom):
        result = asyncio.run(svc.get_mlb_futures())
    assert isinstance(result, MlbFuturesResponse)
    assert result.markets[0].display_name == "World Series Winner"


@pytest.fixture(autouse=True)
def clear_futures_cache():
    svc._cache.clear()
    svc._team_cache.clear()
    yield
    svc._cache.clear()
    svc._team_cache.clear()


def test_mlb_futures_route_ok(monkeypatch):
    payload = json.loads(FUTURES_FIXTURE.read_text())

    async def fake_resolve(ref_or_id: str, client: httpx.AsyncClient) -> dict | None:
        return await _fake_resolve(ref_or_id, client)

    monkeypatch.setattr(svc, "resolve_team", fake_resolve)

    async def fake_fetch(season: int):
        return payload

    with patch.object(svc, "fetch_espn_futures", side_effect=fake_fetch):
        client = TestClient(app)
        res = client.get("/api/mlb/futures")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-store"
    assert res.json()["markets"][0]["display_name"] == "World Series Winner"


def test_mlb_futures_route_502_no_store_when_cold():
    async def boom(season: int):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_espn_futures", side_effect=boom):
        client = TestClient(app)
        res = client.get("/api/mlb/futures")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"
