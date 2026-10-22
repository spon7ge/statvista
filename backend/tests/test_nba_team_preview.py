"""Tests for GET /api/nba/games/{espn_event_id}/team-preview."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.nba.schemas_game_detail import GameDetailTeam, NbaGameDetail
from app.domains.nba.schemas_team_preview import (
    NbaTeamPreviewResponse,
    NbaTeamPreviewTeam,
)
from app.domains.nba.team_preview import _season_year, get_nba_team_preview
from app.main import app
from app.providers.espn.nba_team_player_stats import (
    build_team_leaders,
    fetch_league_player_stat_map,
    fetch_team_roster_athletes,
    merge_roster_rows,
    parse_byathlete_stat_map,
    parse_roster_athletes,
)

client = TestClient(app)


def _roster_payload() -> dict:
    return {
        "athletes": [
            {
                "id": "1",
                "displayName": "Alpha Guard",
                "lastName": "Guard",
                "jersey": "1",
                "position": {"abbreviation": "G"},
                "headshot": {"href": "https://example.test/1.png"},
            },
            {
                "id": "2",
                "displayName": "Beta Center",
                "lastName": "Center",
                "jersey": "2",
                "position": {"abbreviation": "C"},
            },
        ]
    }


def _stat(name: str, value: float, display: str, rank: int = 1) -> dict:
    return {"name": name, "value": value, "displayValue": display, "rank": rank}


def _byathlete_payload() -> dict:
    return {
        "items": [
            {
                "athlete": {
                    "$ref": "https://sports.core.api.espn.com/v2/sports/"
                    "basketball/leagues/nba/athletes/1"
                },
                "splits": {
                    "categories": [
                        {
                            "stats": [
                                _stat("gamesPlayed", 10, "10"),
                                _stat("avgPoints", 20.1, "20.1", 9),
                                _stat("avgRebounds", 4.2, "4.2", 20),
                                _stat("avgAssists", 8.3, "8.3", 2),
                                _stat("avgSteals", 1.7, "1.7", 4),
                                _stat("avgBlocks", 0.3, "0.3", 50),
                            ]
                        }
                    ]
                },
            },
            {
                "athlete": {
                    "$ref": "https://sports.core.api.espn.com/v2/sports/"
                    "basketball/leagues/nba/athletes/2"
                },
                "splits": {
                    "categories": [
                        {
                            "stats": [
                                _stat("gamesPlayed", 12, "12"),
                                _stat("avgPoints", 14.0, "14.0", 30),
                                _stat("avgRebounds", 11.2, "11.2", 3),
                                _stat("avgAssists", 2.1, "2.1", 70),
                                _stat("avgSteals", 0.5, "0.5", 80),
                                _stat("avgBlocks", 2.4, "2.4", 1),
                            ]
                        }
                    ]
                },
            },
        ]
    }


def test_parse_merge_and_build_nba_team_leaders():
    athletes = parse_roster_athletes(_roster_payload())
    stats = parse_byathlete_stat_map(_byathlete_payload())
    rows = merge_roster_rows(athletes, stats)

    assert [row.name for row in rows] == ["Alpha Guard", "Beta Center"]
    assert rows[0].pts == "20.1"
    leaders = build_team_leaders(rows, stats)
    assert [card.key for card in leaders] == ["ppg", "rpg", "apg", "bpg", "spg"]
    assert [card.last_name for card in leaders] == [
        "Guard",
        "Center",
        "Guard",
        "Center",
        "Guard",
    ]


def _preview() -> NbaTeamPreviewResponse:
    return NbaTeamPreviewResponse(
        side="away",
        team=NbaTeamPreviewTeam(
            id="1", abbrev="BOS", name="Boston Celtics", logo_url=None
        ),
        leaders=[],
        roster=[],
    )


def test_nba_team_preview_route_200_shape_and_no_store():
    with patch(
        "app.domains.nba.routes.get_nba_team_preview",
        new=AsyncMock(return_value=_preview()),
    ):
        response = client.get("/api/nba/games/401810001/team-preview?side=away")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["side"] == "away"
    assert response.json()["team"]["abbrev"] == "BOS"
    assert "leaders" in response.json()
    assert "roster" in response.json()


def test_nba_team_preview_invalid_side_422():
    response = client.get("/api/nba/games/401810001/team-preview?side=midwest")
    assert response.status_code == 422


def test_nba_team_preview_lookup_error_404():
    with patch(
        "app.domains.nba.routes.get_nba_team_preview",
        new=AsyncMock(side_effect=LookupError("missing")),
    ):
        response = client.get("/api/nba/games/401810001/team-preview?side=home")
    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"


def test_nba_team_preview_upstream_error_502():
    with patch(
        "app.domains.nba.routes.get_nba_team_preview",
        new=AsyncMock(side_effect=RuntimeError("upstream unavailable")),
    ):
        response = client.get("/api/nba/games/401810001/team-preview?side=away")
    assert response.status_code == 502
    assert response.headers["cache-control"] == "no-store"


def _scheduled_detail() -> NbaGameDetail:
    return NbaGameDetail(
        espn_event_id="401810001",
        status="scheduled",
        status_label="7:00 PM ET",
        venue="TD Garden",
        away=GameDetailTeam(
            id="1",
            abbrev="BOS",
            name="Boston Celtics",
            score=None,
            color="#007A33",
            logo_url=None,
        ),
        home=GameDetailTeam(
            id="2",
            abbrev="NY",
            name="New York Knicks",
            score=None,
            color="#006BB6",
            logo_url=None,
        ),
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
        fetched_at="2026-10-15T12:00:00-04:00",
    )


@pytest.mark.asyncio
async def test_get_nba_team_preview_soft_fails_stats():
    athletes = parse_roster_athletes(_roster_payload())
    with (
        patch(
            "app.domains.nba.team_preview.get_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.nba.team_preview.fetch_team_roster_athletes",
            new=AsyncMock(return_value=athletes),
        ),
        patch(
            "app.domains.nba.team_preview.fetch_league_player_stat_map",
            new=AsyncMock(side_effect=RuntimeError("stats down")),
        ),
    ):
        result = await get_nba_team_preview("401810001", "away")

    assert result.team.abbrev == "BOS"
    assert result.leaders == []
    assert len(result.roster) == 2
    assert result.roster[0].pts is None


@pytest.mark.asyncio
async def test_nba_espn_helpers_use_nba_urls_and_mozilla_user_agent(monkeypatch):
    import httpx

    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        payload = (
            _roster_payload()
            if "/teams/" in str(request.url)
            else _byathlete_payload()
        )
        return httpx.Response(200, json=payload)

    transport = httpx.MockTransport(handler)

    class _Client(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _Client)

    assert await fetch_team_roster_athletes("1")
    assert await fetch_league_player_stat_map(2026)
    assert all("/nba/" in str(request.url) for request in requests)
    assert all("/wnba/" not in str(request.url) for request in requests)
    assert all(request.headers["User-Agent"] == "Mozilla/5.0" for request in requests)


@pytest.mark.asyncio
async def test_fetch_league_player_stat_map_includes_players_from_all_pages(
    monkeypatch,
):
    import httpx

    requested_pages: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        page = request.url.params["page"]
        requested_pages.append(page)
        payload = _byathlete_payload()
        payload["pageCount"] = 2
        payload["items"] = [payload["items"][int(page) - 1]]
        return httpx.Response(200, json=payload)

    transport = httpx.MockTransport(handler)

    class _Client(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _Client)

    stats = await fetch_league_player_stat_map(2026)

    assert requested_pages == ["1", "2"]
    assert set(stats) == {"1", "2"}


@pytest.mark.parametrize(
    ("now", "expected"),
    [
        (datetime(2025, 9, 30, tzinfo=timezone.utc), 2025),
        (datetime(2025, 10, 1, tzinfo=timezone.utc), 2026),
        (datetime(2025, 12, 31, tzinfo=timezone.utc), 2026),
        (datetime(2026, 1, 1, tzinfo=timezone.utc), 2026),
    ],
)
def test_nba_season_year_uses_espn_season_label(
    now: datetime,
    expected: int,
):
    assert _season_year(now) == expected


@pytest.mark.asyncio
async def test_team_preview_adds_cached_advanced_stats_after_traditional_line():
    athletes = parse_roster_athletes(_roster_payload())
    with (
        patch(
            "app.domains.nba.team_preview.get_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.nba.team_preview.fetch_team_roster_athletes",
            new=AsyncMock(return_value=athletes),
        ),
        patch(
            "app.domains.nba.team_preview.fetch_league_player_stat_map",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "app.domains.nba.team_preview.load_player_advanced",
            return_value={
                "alpha guard": {
                    "usg_pct": "26.0",
                    "efg_pct": "44.0",
                    "ts_pct": "54.0",
                    "ast_pct": "16.0",
                    "pie": "18.0",
                }
            },
        ),
    ):
        result = await get_nba_team_preview("401810001", "away")

    guard = next(row for row in result.roster if row.name == "Alpha Guard")
    assert guard.usg_pct == "26.0"
    assert guard.efg_pct == "44.0"
    assert guard.ts_pct == "54.0"
    assert guard.ast_pct == "16.0"
    assert guard.pie == "18.0"
    assert guard.pts is None
