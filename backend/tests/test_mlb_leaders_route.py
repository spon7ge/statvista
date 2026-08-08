from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import leaders as svc
from app.domains.mlb import routes
from app.domains.mlb.schemas_leaders import MlbLeadersResponse
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {117: "HOU", 139: "TB"}
HR_PAYLOAD = json.loads((FIXTURES / "statsapi_mlb_leaders_hr.json").read_text())


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


def test_leaders_returns_no_store(monkeypatch):
    async def fake_get_leaders() -> MlbLeadersResponse:
        return MlbLeadersResponse(season=2026, categories=[])

    monkeypatch.setattr(routes, "get_mlb_leaders", fake_get_leaders, raising=False)

    res = TestClient(app).get("/api/mlb/leaders")

    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json() == {"season": 2026, "pace": "season", "categories": []}


def test_leaders_returns_502_when_unavailable(monkeypatch):
    monkeypatch.setattr(
        routes,
        "get_mlb_leaders",
        AsyncMock(side_effect=RuntimeError("upstream down")),
        raising=False,
    )

    res = TestClient(app).get("/api/mlb/leaders")

    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["detail"] == "MLB leaders are temporarily unavailable"


def test_leaders_stale_while_error():
    async def ok_category(client, sort_stat, group, order, season):
        return HR_PAYLOAD

    async def ok_teams(client, season):
        return TEAM_MAP

    async def boom_category(client, sort_stat, group, order, season):
        raise RuntimeError("upstream down")

    async def boom_teams(client, season):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_category_payload", side_effect=ok_category), patch.object(
        svc, "fetch_team_abbrev_map", side_effect=ok_teams
    ):
        client = TestClient(app)
        assert client.get("/api/mlb/leaders").status_code == 200

    svc._cache["expires_at"] = 0

    with patch.object(
        svc, "fetch_category_payload", side_effect=boom_category
    ), patch.object(svc, "fetch_team_abbrev_map", side_effect=boom_teams):
        res = client.get("/api/mlb/leaders")

    assert res.status_code == 200
    hr = next(c for c in res.json()["categories"] if c["key"] == "hr")
    assert hr["leaders"][0]["name"] == "Yordan Alvarez"
    assert hr["leaders"][0]["gp"] == 115


def test_stats_request_params_includes_group_and_sort():
    params = svc.stats_request_params("homeRuns", "hitting", "desc", 2026)

    assert params["group"] == "hitting"
    assert params["sortStat"] == "homeRuns"
    assert params["stats"] == "season"
    assert params["limit"] == 10
    assert "statGroup" not in params
