from __future__ import annotations

from datetime import date, datetime, timedelta
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


def _today_et_date() -> date:
    # The route resolves "today" against ET, not the test runner's local
    # timezone, so tests near midnight local time must anchor to ET too.
    return datetime.now(ET).date()


def _today_et() -> str:
    return _today_et_date().isoformat()


def test_lineups_requires_date(client):
    assert client.get("/api/mlb/lineups").status_code == 422


def test_matchup_requires_params(client):
    assert client.get("/api/mlb/lineups/matchup").status_code == 422


def test_matchup_returns_enriched_payload(client):
    from app.schemas.mlb_lineups import MlbLineupMatchupResponse

    async def fake_matchup(date_et, away, home):
        return MlbLineupMatchupResponse(
            date=date_et,
            away_abbrev=away.upper(),
            home_abbrev=home.upper(),
            status="expected",
            away=None,
            home=None,
            fetched_at="2026-08-04T17:00:00+00:00",
        )

    with patch(
        "app.api.routes.mlb_lineups.get_mlb_lineup_matchup",
        side_effect=fake_matchup,
    ):
        res = client.get(
            "/api/mlb/lineups/matchup?date=2026-08-04&away=WSH&home=SF"
        )

    assert res.status_code == 200
    assert res.json()["source"] == "rotowire+statsapi"
    assert res.json()["away_abbrev"] == "WSH"


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


def test_lineups_invalid_calendar_date_is_422(client):
    assert client.get("/api/mlb/lineups?date=2026-99-99").status_code == 422


def test_lineups_cache_hit_skips_scrape(client):
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    today_et = _today_et()

    with patch(
        "app.services.mlb_lineups.scrape_mlb_lineups",
        return_value=games,
    ) as mock_scrape:
        first = client.get(f"/api/mlb/lineups?date={today_et}")
        second = client.get(f"/api/mlb/lineups?date={today_et}")

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    mock_scrape.assert_called_once()


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


def test_lineups_normalizes_ari_to_az_for_diamondbacks(client):
    # RotoWire abbreviates Arizona as ARI; the Stats API (which backs game
    # detail) uses AZ, so the service must alias it for findCompleteMatch.
    today_et = _today_et()
    dbacks_game = [
        {
            "away_abbrev": "ARI",
            "home_abbrev": "LAD",
            "status": "expected",
            "away": {
                "pitcher": {"name": "Brandon Pfaadt", "hand": "R", "record": "12-6", "era": "3.20"},
                "batters": [],
            },
            "home": {
                "pitcher": {"name": "Walker Buehler", "hand": "R", "record": "8-5", "era": "4.50"},
                "batters": [],
            },
        }
    ]

    with patch(
        "app.services.mlb_lineups.scrape_mlb_lineups",
        return_value=dbacks_game,
    ):
        res = client.get(f"/api/mlb/lineups?date={today_et}")

    assert res.status_code == 200
    assert res.json()["games"][0]["away_abbrev"] == "AZ"


def test_lineups_tomorrow_uses_tomorrow_token(client):
    tomorrow_et = (_today_et_date() + timedelta(days=1)).isoformat()
    games = parse_mlb_lineups_html(FIXTURE.read_text())

    with patch(
        "app.services.mlb_lineups.scrape_mlb_lineups",
        return_value=games,
    ) as mock_scrape:
        res = client.get(f"/api/mlb/lineups?date={tomorrow_et}")

    assert res.status_code == 200
    assert res.json()["date"] == tomorrow_et
    mock_scrape.assert_called_once_with(date_token="tomorrow")
