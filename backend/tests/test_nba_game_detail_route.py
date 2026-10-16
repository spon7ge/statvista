from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.domains.nba.schemas_game_detail import NbaGameDetail

client = TestClient(app)


def _minimal_detail() -> NbaGameDetail:
    return NbaGameDetail(
        espn_event_id="401810001",
        status="live",
        status_label="4:20 - 3rd",
        venue="Crypto.com Arena",
        away={
            "id": "13",
            "abbrev": "LAL",
            "name": "Los Angeles Lakers",
            "score": 95,
            "color": "#552583",
        },
        home={
            "id": "9",
            "abbrev": "GSW",
            "name": "Golden State Warriors",
            "score": 98,
            "color": "#1D428A",
        },
        fg_made=0,
        fg_attempted=0,
        latest_play=None,
        shots=[],
        plays=[],
        win_probability=None,
        matchup_prediction=None,
        projected_starters=None,
        season_leaders=None,
        injuries=None,
        box_score=None,
        fetched_at="2026-10-15T00:00:00Z",
    )


def test_nba_game_detail_200():
    with patch(
        "app.domains.nba.routes.get_game_detail",
        new=AsyncMock(return_value=_minimal_detail()),
    ):
        res = client.get("/api/nba/games/401810001")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-store"
    assert res.json()["league"] == "nba"


def test_nba_game_detail_404():
    with patch(
        "app.domains.nba.routes.get_game_detail",
        new=AsyncMock(side_effect=LookupError("Game not found")),
    ):
        res = client.get("/api/nba/games/999")
    assert res.status_code == 404


def test_nba_game_detail_502():
    with patch(
        "app.domains.nba.routes.get_game_detail",
        new=AsyncMock(side_effect=RuntimeError("espn down")),
    ):
        res = client.get("/api/nba/games/401810001")
    assert res.status_code == 502
