from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.domains.mlb import leaders as svc
from app.domains.mlb import routes
from app.domains.mlb.schemas_leaders import MlbLeadersResponse
from app.main import app


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


def test_leaders_request_params_includes_stat_group():
    request_params = getattr(svc, "leaders_request_params", None)

    assert request_params is not None
    assert request_params("homeRuns", "hitting", 2026) == {
        "leaderCategories": "homeRuns",
        "statGroup": "hitting",
        "season": 2026,
        "sportId": 1,
        "limit": 10,
    }
