from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import routes
from app.domains.mlb import standings as svc
from app.domains.mlb.schemas_standings import MlbStandingsResponse
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {139: "TB", 142: "MIN", 117: "HOU", 143: "PHI", 158: "MIL", 119: "LAD"}


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


def test_standings_returns_no_store(monkeypatch):
    async def fake() -> MlbStandingsResponse:
        return MlbStandingsResponse(season=2026, leagues=[])

    monkeypatch.setattr(routes, "get_mlb_standings", fake, raising=False)
    res = TestClient(app).get("/api/mlb/standings")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json() == {"season": 2026, "leagues": []}


def test_standings_returns_502_when_unavailable(monkeypatch):
    monkeypatch.setattr(
        routes,
        "get_mlb_standings",
        AsyncMock(side_effect=RuntimeError("upstream down")),
        raising=False,
    )
    res = TestClient(app).get("/api/mlb/standings")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["detail"] == "MLB standings are temporarily unavailable"


def test_standings_stale_while_error():
    payload = json.loads((FIXTURES / "mlb_standings_full_sample.json").read_text())

    async def ok_standings():
        return payload

    async def ok_teams(client, season):
        return TEAM_MAP

    async def boom_standings():
        raise RuntimeError("upstream down")

    async def boom_teams(client, season):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_mlb_standings_payload", side_effect=ok_standings), patch.object(
        svc, "fetch_team_abbrev_map", side_effect=ok_teams
    ):
        client = TestClient(app)
        assert client.get("/api/mlb/standings").status_code == 200

    svc._cache["expires_at"] = 0

    with patch.object(
        svc, "fetch_mlb_standings_payload", side_effect=boom_standings
    ), patch.object(svc, "fetch_team_abbrev_map", side_effect=boom_teams):
        res = client.get("/api/mlb/standings")
        assert res.status_code == 200
        assert res.json()["season"] == 2026
