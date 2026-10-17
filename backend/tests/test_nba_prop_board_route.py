from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.domains.nba import routes
from app.domains.nba.prop_board import UnknownBoardBookError
from app.domains.nba.schemas_prop_board import NbaPropBoardResponse
from app.main import app

client = TestClient(app)


def test_nba_props_board_route_returns_200_when_book_is_omitted(monkeypatch):
    seen: dict[str, str | None] = {}

    async def fake(book: str | None = None) -> NbaPropBoardResponse:
        seen["book"] = book
        return NbaPropBoardResponse(
            as_of=datetime.now(timezone.utc),
            rows=[],
            warnings=[],
        )

    monkeypatch.setattr(routes, "get_nba_prop_board", fake, raising=False)

    response = client.get("/api/nba/props/board")

    assert response.status_code == 200
    assert response.json()["rows"] == []
    assert response.headers["cache-control"] == "no-store"
    assert seen["book"] is None


def test_nba_props_board_route_rejects_betmgm(monkeypatch):
    async def fake(book: str | None = None) -> NbaPropBoardResponse:
        raise UnknownBoardBookError(book or "")

    monkeypatch.setattr(routes, "get_nba_prop_board", fake, raising=False)

    response = client.get("/api/nba/props/board?book=betmgm")

    assert response.status_code == 422
    assert response.json()["detail"] == "unknown book: betmgm"
    assert response.headers["cache-control"] == "no-store"
