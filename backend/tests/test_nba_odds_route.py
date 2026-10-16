from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.nba import odds as nba_odds_svc
from app.main import app
from app.providers.sharp import odds as sharp_svc
from app.schemas.odds import WnbaOddsGame, WnbaOddsResponse


@pytest.fixture(autouse=True)
def clear_caches():
    nba_odds_svc._cache.clear()
    sharp_svc._cache.clear()
    yield
    nba_odds_svc._cache.clear()
    sharp_svc._cache.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_nba_odds_today_200_shape(client):
    sample = WnbaOddsResponse(
        as_of="2026-10-15T12:00:00Z",
        games=[],
        book_boards=[],
    )
    with patch(
        "app.domains.nba.routes.get_today_odds",
        new=AsyncMock(return_value=sample),
    ):
        res = client.get("/api/nba/odds/today")

    assert res.status_code == 200
    body = res.json()
    assert "as_of" in body
    assert "games" in body
    assert "book_boards" in body
    assert res.headers["cache-control"] == "no-store"


def test_nba_odds_today_returns_games_when_service_populated(client):
    sample = WnbaOddsResponse(
        as_of="2026-10-15T12:00:00Z",
        games=[
            WnbaOddsGame(
                home_abbrev="LAL",
                away_abbrev="BOS",
                spread_team_abbrev="BOS",
                spread_line=-3.5,
                total=224.5,
                game_date="2026-10-15",
                sportsbook="draftkings",
            )
        ],
    )
    with patch(
        "app.domains.nba.routes.get_today_odds",
        new=AsyncMock(return_value=sample),
    ):
        res = client.get("/api/nba/odds/today")
    assert res.status_code == 200
    body = res.json()
    assert body["games"][0]["away_abbrev"] == "BOS"
    assert body["games"][0]["total"] == 224.5
