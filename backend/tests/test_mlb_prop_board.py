from fastapi.testclient import TestClient

from app.domains.mlb import routes
from app.main import app

client = TestClient(app)


def test_mlb_props_board_route_returns_200(monkeypatch):
    async def fake():
        from datetime import datetime, timezone
        from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse

        return MlbPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[], warnings=[])

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    assert res.json()["rows"] == []
