from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.nba import scoreboard as svc

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    svc._date_cache.clear()
    yield
    svc._cache.clear()
    svc._date_cache.clear()


def test_scoreboard_today_returns_no_store_and_nba_games():
    espn = json.loads((FIXTURES / "espn_nba_scoreboard.json").read_text())

    async def fake_fetch(date_et: str):
        return espn

    with patch.object(svc, "fetch_espn_scoreboard", side_effect=fake_fetch):
        client = TestClient(app)
        res = client.get("/api/nba/scoreboard/today")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    body = res.json()
    assert body["date"]
    assert len(body["games"]) >= 1
    assert body["games"][0]["league"] == "nba"


def test_scoreboard_by_date_returns_requested_date():
    espn = json.loads((FIXTURES / "espn_nba_scoreboard.json").read_text())

    async def fake_fetch(date_et: str):
        return espn

    with patch.object(svc, "fetch_espn_scoreboard", side_effect=fake_fetch):
        client = TestClient(app)
        res = client.get("/api/nba/scoreboard?date=2026-10-14")
    assert res.status_code == 200
    assert res.json()["date"] == "2026-10-14"


def test_scoreboard_by_date_rejects_bad_date():
    client = TestClient(app)
    res = client.get("/api/nba/scoreboard?date=not-a-date")
    assert res.status_code == 422


def test_scoreboard_today_502_when_upstream_fails_with_empty_cache():
    async def boom(date_et: str):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_espn_scoreboard", side_effect=boom):
        client = TestClient(app)
        res = client.get("/api/nba/scoreboard/today")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"
