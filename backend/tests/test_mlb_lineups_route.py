from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.mlb_lineups import clear_mlb_lineups_cache
from src.scrapers.mlb_rotowire_lineups import parse_mlb_lineups_html

ET = ZoneInfo("America/New_York")
FIXTURE = (
    Path(__file__).parent / "fixtures" / "rotowire_mlb_lineups_laa_bal.html"
)


@pytest.fixture
def client():
    clear_mlb_lineups_cache()
    yield TestClient(app)
    clear_mlb_lineups_cache()


def _today_et() -> str:
    return date.today().isoformat()


def test_lineups_requires_date(client):
    assert client.get("/api/mlb/lineups").status_code == 422


def test_lineups_today_returns_games(monkeypatch, client):
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    today_et = _today_et()

    with patch(
        "app.services.mlb_lineups.scrape_mlb_lineups",
        return_value=games,
    ):
        res = client.get(f"/api/mlb/lineups?date={today_et}")

    assert res.status_code == 200
    body = res.json()
    assert body["date"] == today_et
    assert body["source"] == "rotowire"
    assert body["games"][0]["away_abbrev"] == "LAA"
    assert body["games"][0]["home_abbrev"] == "BAL"
    assert body["games"][0]["away"]["pitcher"]["name"]
    assert len(body["games"][0]["away"]["batters"]) == 9


def test_lineups_unsupported_date_empty_games(client):
    res = client.get("/api/mlb/lineups?date=2099-01-01")
    assert res.status_code == 200
    assert res.json()["games"] == []


def test_lineups_invalid_date_format_is_422(client):
    assert client.get("/api/mlb/lineups?date=not-a-date").status_code == 422


def test_lineups_scrape_failure_returns_empty(monkeypatch, client):
    today_et = _today_et()

    with patch(
        "app.services.mlb_lineups.scrape_mlb_lineups",
        side_effect=RuntimeError("upstream down"),
    ):
        res = client.get(f"/api/mlb/lineups?date={today_et}")

    assert res.status_code == 200
    body = res.json()
    assert body["date"] == today_et
    assert body["games"] == []
    assert body["source"] == "rotowire"


def test_lineups_tomorrow_uses_tomorrow_token(client):
    tomorrow_et = (date.today() + timedelta(days=1)).isoformat()
    games = parse_mlb_lineups_html(FIXTURE.read_text())

    with patch(
        "app.services.mlb_lineups.scrape_mlb_lineups",
        return_value=games,
    ) as mock_scrape:
        res = client.get(f"/api/mlb/lineups?date={tomorrow_et}")

    assert res.status_code == 200
    assert res.json()["date"] == tomorrow_et
    mock_scrape.assert_called_once_with(date_token="tomorrow")
