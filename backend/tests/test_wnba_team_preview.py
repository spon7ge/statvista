"""Tests for GET /api/wnba/games/{espn_event_id}/team-preview."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.wnba.schemas_game_detail import GameDetailTeam, WnbaGameDetail
from app.domains.wnba.schemas_team_preview import (
    WnbaTeamLeaderCard,
    WnbaTeamPreviewResponse,
    WnbaTeamPreviewTeam,
    WnbaTeamRosterRow,
)
from app.domains.wnba.team_preview import get_wnba_team_preview
from app.main import app
from app.providers.espn.wnba_team_player_stats import (
    build_team_leaders,
    fetch_league_player_stat_map,
    fetch_team_roster_athletes,
    merge_roster_rows,
    parse_byathlete_stat_map,
    parse_roster_athletes,
)

client = TestClient(app)
FIXTURES = Path(__file__).parent / "fixtures"


def _roster_fixture() -> dict:
    return json.loads(
        (FIXTURES / "espn_wnba_roster_atl_team_preview.json").read_text()
    )


def _byathlete_fixture() -> dict:
    return json.loads((FIXTURES / "espn_wnba_byathlete_atl.json").read_text())


def test_team_preview_response_constructs():
    payload = WnbaTeamPreviewResponse(
        side="away",
        team=WnbaTeamPreviewTeam(
            id="20", abbrev="ATL", name="Atlanta Dream", logo_url=None
        ),
        leaders=[
            WnbaTeamLeaderCard(
                key="ppg",
                label="PPG",
                rank=9,
                value="19.1",
                player_id="3058901",
                last_name="Gray",
                headshot_url=None,
            )
        ],
        roster=[
            WnbaTeamRosterRow(
                player_id="3058901",
                name="Allisha Gray",
                jersey="15",
                position="G",
                gp=31,
                min="32.9",
                pts="19.1",
                reb="3.1",
                ast="2.3",
                stl="1.4",
                blk="0.4",
                to="1.5",
                fg_pct="45.6",
                fg3_pct="30.2",
                ft_pct="76.7",
                headshot_url=None,
            )
        ],
    )
    assert payload.side == "away"
    assert payload.leaders[0].key == "ppg"
    assert payload.roster[0].pts == "19.1"


def test_parse_roster_athletes_extracts_identity():
    athletes = parse_roster_athletes(_roster_fixture())
    by_id = {a.player_id: a for a in athletes}
    assert "4398674" in by_id
    rhyne = by_id["4398674"]
    assert rhyne.name == "Rhyne Howard"
    assert rhyne.jersey == "10"
    assert rhyne.position == "G"
    assert rhyne.headshot_url


def test_parse_byathlete_and_merge_roster_rows():
    athletes = parse_roster_athletes(_roster_fixture())
    stats = parse_byathlete_stat_map(_byathlete_fixture())
    rows = merge_roster_rows(athletes, stats)
    assert rows
    assert all(r.player_id for r in rows)
    # Sorted by PPG desc; nulls last
    pts_values = [float(r.pts) for r in rows if r.pts is not None]
    assert pts_values == sorted(pts_values, reverse=True)
    top = rows[0]
    assert top.name == "Allisha Gray"
    assert top.pts == "19.1"
    assert top.gp == 31


def test_build_team_leaders_ppg_rpg_apg_bpg_spg():
    athletes = parse_roster_athletes(_roster_fixture())
    stats = parse_byathlete_stat_map(_byathlete_fixture())
    rows = merge_roster_rows(athletes, stats)
    leaders = build_team_leaders(rows, stats)
    assert [c.key for c in leaders] == ["ppg", "rpg", "apg", "bpg", "spg"]
    assert [c.label for c in leaders] == ["PPG", "RPG", "APG", "BPG", "SPG"]
    assert leaders[0].value == "19.1"
    assert leaders[0].last_name == "Gray"
    # BPG / SPG: highest avgBlocks / avgSteals among roster
    assert leaders[3].last_name == "Howard"
    assert leaders[4].last_name == "Howard"


def test_merge_roster_includes_efficiency_fields():
    athletes = parse_roster_athletes(_roster_fixture())
    stats = parse_byathlete_stat_map(_byathlete_fixture())
    rows = merge_roster_rows(athletes, stats)
    gray = next(r for r in rows if r.player_id == "3058901")
    assert gray.sh_eff == "1.12"
    assert gray.sc_eff == "1.05"
    assert gray.ppep == "0.98"
    assert gray.rtg == "112.3"
    assert gray.plus_minus == "+3.2"


def _preview() -> WnbaTeamPreviewResponse:
    return WnbaTeamPreviewResponse(
        side="away",
        team=WnbaTeamPreviewTeam(
            id="20", abbrev="ATL", name="Atlanta Dream", logo_url=None
        ),
        leaders=[],
        roster=[],
    )


def test_team_preview_ok_no_store():
    with patch(
        "app.domains.wnba.routes.get_wnba_team_preview",
        new=AsyncMock(return_value=_preview()),
    ):
        res = client.get("/api/wnba/games/401734891/team-preview?side=away")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["side"] == "away"


def test_team_preview_invalid_side_422():
    res = client.get("/api/wnba/games/401734891/team-preview?side=midwest")
    assert res.status_code == 422


def test_team_preview_lookup_error_404():
    with patch(
        "app.domains.wnba.routes.get_wnba_team_preview",
        new=AsyncMock(side_effect=LookupError("missing")),
    ):
        res = client.get("/api/wnba/games/401734891/team-preview?side=home")
    assert res.status_code == 404


def test_team_preview_upstream_502():
    with patch(
        "app.domains.wnba.routes.get_wnba_team_preview",
        new=AsyncMock(side_effect=RuntimeError("up")),
    ):
        res = client.get("/api/wnba/games/401734891/team-preview?side=away")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"


def _scheduled_detail() -> WnbaGameDetail:
    return WnbaGameDetail(
        espn_event_id="401734891",
        status="scheduled",
        status_label="7:00 PM ET",
        venue="Climate Pledge Arena",
        away=GameDetailTeam(
            id="20",
            abbrev="ATL",
            name="Atlanta Dream",
            score=None,
            color="#E03A3E",
            logo_url=None,
        ),
        home=GameDetailTeam(
            id="14",
            abbrev="SEA",
            name="Seattle Storm",
            score=None,
            color="#2C5234",
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
        fetched_at="2026-08-10T12:00:00+00:00",
    )


@pytest.mark.asyncio
async def test_get_wnba_team_preview_soft_fails_stats():
    athletes = parse_roster_athletes(_roster_fixture())
    with (
        patch(
            "app.domains.wnba.team_preview.get_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.wnba.team_preview.fetch_team_roster_athletes",
            new=AsyncMock(return_value=athletes),
        ),
        patch(
            "app.domains.wnba.team_preview.fetch_league_player_stat_map",
            new=AsyncMock(side_effect=RuntimeError("stats down")),
        ),
    ):
        result = await get_wnba_team_preview("401734891", "away")
    assert result.leaders == []
    # Roster identity still returned without season averages
    assert len(result.roster) == len(athletes)
    assert result.roster[0].pts is None
    assert result.team.abbrev == "ATL"


@pytest.mark.asyncio
async def test_get_wnba_team_preview_soft_fails_roster():
    with (
        patch(
            "app.domains.wnba.team_preview.get_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.wnba.team_preview.fetch_team_roster_athletes",
            new=AsyncMock(side_effect=RuntimeError("roster down")),
        ),
        patch(
            "app.domains.wnba.team_preview.fetch_league_player_stat_map",
            new=AsyncMock(return_value=parse_byathlete_stat_map(_byathlete_fixture())),
        ),
    ):
        result = await get_wnba_team_preview("401734891", "away")
    assert result.leaders == []
    assert result.roster == []
    assert result.team.abbrev == "ATL"


@pytest.mark.asyncio
async def test_fetch_team_roster_athletes_sends_mozilla_user_agent(monkeypatch):
    import httpx

    seen: dict[str, str | None] = {"ua": None}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["ua"] = request.headers.get("User-Agent")
        return httpx.Response(200, json=_roster_fixture())

    transport = httpx.MockTransport(handler)

    class _Client(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _Client)
    athletes = await fetch_team_roster_athletes("20")
    assert athletes
    assert seen["ua"] == "Mozilla/5.0"


@pytest.mark.asyncio
async def test_fetch_league_player_stat_map_sends_mozilla_user_agent(monkeypatch):
    import httpx

    seen: dict[str, str | None] = {"ua": None}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["ua"] = request.headers.get("User-Agent")
        return httpx.Response(200, json=_byathlete_fixture())

    transport = httpx.MockTransport(handler)

    class _Client(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _Client)
    stats = await fetch_league_player_stat_map(2026)
    assert stats
    assert seen["ua"] == "Mozilla/5.0"
