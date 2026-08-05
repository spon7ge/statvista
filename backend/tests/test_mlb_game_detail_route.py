from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.domains.mlb.schemas import MlbGameDetail, MlbGameDetailTeam

client = TestClient(app)


def _detail(status="live") -> MlbGameDetail:
    t = MlbGameDetailTeam(
        id="1", abbrev="BOS", name="Boston Red Sox", score=1, color="#BD3039"
    )
    h = MlbGameDetailTeam(
        id="2",
        abbrev="LAD",
        name="Los Angeles Dodgers",
        score=0,
        color="#005A9C",
    )
    return MlbGameDetail(
        mlb_game_pk="776543",
        status=status,
        status_label="Top 1st" if status == "live" else "Final",
        venue="Dodger Stadium",
        away=t,
        home=h,
        sources=["mlb_stats_api"],
        fetched_at="2026-08-02T18:00:00+00:00",
    )


def test_mlb_game_detail_ok_no_store():
    with patch(
        "app.domains.mlb.routes.get_mlb_game_detail",
        new=AsyncMock(return_value=_detail()),
    ):
        res = client.get("/api/mlb/games/776543")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["mlb_game_pk"] == "776543"


def test_mlb_game_detail_invalid_pk_404():
    res = client.get("/api/mlb/games/not-a-pk")
    assert res.status_code == 404


def test_mlb_game_detail_upstream_502():
    with patch(
        "app.domains.mlb.routes.get_mlb_game_detail",
        new=AsyncMock(side_effect=RuntimeError("up")),
    ):
        res = client.get("/api/mlb/games/776543")
    assert res.status_code == 502
