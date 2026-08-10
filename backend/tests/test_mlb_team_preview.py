from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb.schemas import MlbGameDetail, MlbGameDetailTeam
from app.domains.mlb.schemas_team_preview import (
    MlbTeamBatterSeasonRow,
    MlbTeamLeaderCard,
    MlbTeamPitcherSeasonRow,
    MlbTeamPreviewResponse,
    MlbTeamPreviewTeam,
)
from app.domains.mlb.team_preview import get_mlb_team_preview
from app.main import app
from app.providers.mlb_stats.roster import ActiveRosterEntry
from app.providers.mlb_stats.team_player_season import (
    filter_rows_to_roster,
    merge_batter_rows_for_roster,
    merge_pitcher_rows_for_roster,
    parse_batter_season_row,
    parse_pitcher_season_row,
    sort_batter_rows,
    sort_pitcher_rows,
)

client = TestClient(app)


def test_team_preview_response_constructs():
    payload = MlbTeamPreviewResponse(
        side="away",
        team=MlbTeamPreviewTeam(
            id="120", abbrev="WSH", name="Washington Nationals", logo_url=None
        ),
        batting_leaders=[
            MlbTeamLeaderCard(
                key="hr",
                label="HR",
                rank=12,
                value="28",
                player_id="1",
                last_name="Smith",
                headshot_url=None,
            )
        ],
        pitching_leaders=[],
        batting_roster=[
            MlbTeamBatterSeasonRow(
                player_id="1",
                name="C. Smith",
                g=98,
                avg=".278",
                obp=".341",
                slg=".512",
                ops=".853",
                ab=400,
                r=60,
                h=111,
                hr=28,
                rbi=74,
                bb=40,
                so=90,
                sb=5,
            )
        ],
        pitching_roster=[
            MlbTeamPitcherSeasonRow(
                player_id="2",
                name="J. Gray",
                g=22,
                gs=22,
                w=9,
                l=4,
                sv=0,
                ip="130.1",
                h=100,
                er=35,
                bb=30,
                so=142,
                era="2.41",
                whip="0.98",
            )
        ],
    )
    assert payload.side == "away"
    assert payload.batting_leaders[0].key == "hr"
    assert payload.batting_roster[0].ops == ".853"


def test_parse_batter_prefers_boxscore_name():
    row = parse_batter_season_row(
        "1",
        {"fullName": "Christopher Smith", "boxscoreName": "C. Smith"},
        {
            "gamesPlayed": 98,
            "avg": ".278",
            "obp": ".341",
            "slg": ".512",
            "ops": ".853",
            "atBats": 400,
            "runs": 60,
            "hits": 111,
            "homeRuns": 28,
            "rbi": 74,
            "baseOnBalls": 40,
            "strikeOuts": 90,
            "stolenBases": 5,
        },
    )
    assert row.name == "C. Smith"
    assert row.hr == 28
    assert row.ops == ".853"


def test_sort_batters_by_ops_desc_nulls_last():
    a = parse_batter_season_row("1", {"boxscoreName": "A"}, {"ops": ".700", "gamesPlayed": 1})
    b = parse_batter_season_row("2", {"boxscoreName": "B"}, {"ops": ".900", "gamesPlayed": 1})
    c = parse_batter_season_row("3", {"boxscoreName": "C"}, {"ops": None, "gamesPlayed": 1})
    ordered = sort_batter_rows([a, c, b])
    assert [r.player_id for r in ordered] == ["2", "1", "3"]


def test_sort_pitchers_by_ip_desc():
    a = parse_pitcher_season_row(
        "1", {"boxscoreName": "A"},
        {"gamesPlayed": 10, "gamesStarted": 10, "wins": 1, "losses": 1, "saves": 0,
         "inningsPitched": "50.0", "hits": 40, "earnedRuns": 20, "baseOnBalls": 10,
         "strikeOuts": 40, "era": "3.60", "whip": "1.00"},
    )
    b = parse_pitcher_season_row(
        "2", {"boxscoreName": "B"},
        {"gamesPlayed": 20, "gamesStarted": 20, "wins": 5, "losses": 2, "saves": 0,
         "inningsPitched": "130.1", "hits": 100, "earnedRuns": 35, "baseOnBalls": 30,
         "strikeOuts": 142, "era": "2.41", "whip": "0.98"},
    )
    ordered = sort_pitcher_rows([a, b])
    assert [r.player_id for r in ordered] == ["2", "1"]


def test_filter_rows_to_roster():
    a = parse_batter_season_row("1", {"boxscoreName": "A"}, {"ops": ".8", "gamesPlayed": 1})
    b = parse_batter_season_row("2", {"boxscoreName": "B"}, {"ops": ".9", "gamesPlayed": 1})
    assert [r.player_id for r in filter_rows_to_roster([a, b], {"2"})] == ["2"]


def test_merge_batter_rows_includes_roster_hitters_without_season_stats():
    entries = [
        ActiveRosterEntry("1", "C. Smith", "Infielder"),
        ActiveRosterEntry("2", "A. Rookie", "Outfielder"),
        ActiveRosterEntry("3", "J. Gray", "Pitcher"),
    ]
    season = [
        parse_batter_season_row(
            "1", {"boxscoreName": "C. Smith"}, {"ops": ".900", "gamesPlayed": 50}
        )
    ]
    rows = merge_batter_rows_for_roster(entries, season)
    assert [r.player_id for r in rows] == ["1", "2"]
    assert rows[0].ops == ".900"
    assert rows[1].name == "A. Rookie"
    assert rows[1].ops is None


def test_merge_pitcher_rows_includes_roster_pitchers_without_season_stats():
    entries = [
        ActiveRosterEntry("1", "C. Smith", "Infielder"),
        ActiveRosterEntry("3", "J. Gray", "Pitcher"),
        ActiveRosterEntry("4", "B. Bullpen", "Pitcher"),
    ]
    season = [
        parse_pitcher_season_row(
            "3",
            {"boxscoreName": "J. Gray"},
            {
                "gamesPlayed": 20,
                "gamesStarted": 20,
                "wins": 5,
                "losses": 2,
                "saves": 0,
                "inningsPitched": "130.1",
                "hits": 100,
                "earnedRuns": 35,
                "baseOnBalls": 30,
                "strikeOuts": 142,
                "era": "2.41",
                "whip": "0.98",
            },
        )
    ]
    rows = merge_pitcher_rows_for_roster(entries, season)
    assert [r.player_id for r in rows] == ["3", "4"]
    assert rows[0].ip == "130.1"
    assert rows[1].name == "B. Bullpen"
    assert rows[1].ip is None


def test_merge_batter_rows_falls_back_to_season_when_roster_empty():
    season = [
        parse_batter_season_row(
            "9", {"boxscoreName": "X"}, {"ops": ".800", "gamesPlayed": 10}
        )
    ]
    rows = merge_batter_rows_for_roster([], season)
    assert [r.player_id for r in rows] == ["9"]


def _preview() -> MlbTeamPreviewResponse:
    return MlbTeamPreviewResponse(
        side="away",
        team=MlbTeamPreviewTeam(
            id="120", abbrev="WSH", name="Washington Nationals", logo_url=None
        ),
        batting_leaders=[],
        pitching_leaders=[],
        batting_roster=[],
        pitching_roster=[],
    )


def test_team_preview_ok_no_store():
    with patch(
        "app.domains.mlb.routes.get_mlb_team_preview",
        new=AsyncMock(return_value=_preview()),
    ):
        res = client.get("/api/mlb/games/776543/team-preview?side=away")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["side"] == "away"


def test_team_preview_invalid_side_422():
    res = client.get("/api/mlb/games/776543/team-preview?side=midwest")
    assert res.status_code == 422


def test_team_preview_lookup_error_404():
    with patch(
        "app.domains.mlb.routes.get_mlb_team_preview",
        new=AsyncMock(side_effect=LookupError("missing")),
    ):
        res = client.get("/api/mlb/games/776543/team-preview?side=home")
    assert res.status_code == 404


def test_team_preview_upstream_502():
    with patch(
        "app.domains.mlb.routes.get_mlb_team_preview",
        new=AsyncMock(side_effect=RuntimeError("up")),
    ):
        res = client.get("/api/mlb/games/776543/team-preview?side=away")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"


def _scheduled_detail() -> MlbGameDetail:
    away = MlbGameDetailTeam(
        id="120", abbrev="WSH", name="Washington Nationals", score=None, color="#AB0003"
    )
    home = MlbGameDetailTeam(
        id="143", abbrev="PHI", name="Philadelphia Phillies", score=None, color="#E81828"
    )
    return MlbGameDetail(
        mlb_game_pk="776543",
        status="scheduled",
        status_label="8:00 PM ET",
        venue="Nationals Park",
        away=away,
        home=home,
        game_date="2026-08-10",
        sources=["mlb_stats_api"],
        fetched_at="2026-08-10T12:00:00+00:00",
    )


@pytest.mark.asyncio
async def test_get_mlb_team_preview_soft_fails_leaders():
    batter = MlbTeamBatterSeasonRow(
        player_id="1",
        name="C. Smith",
        g=1,
        ops=".900",
        avg=None,
        obp=None,
        slg=None,
        ab=None,
        r=None,
        h=None,
        hr=None,
        rbi=None,
        bb=None,
        so=None,
        sb=None,
    )
    with (
        patch(
            "app.domains.mlb.team_preview.get_mlb_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_leaders",
            new=AsyncMock(side_effect=RuntimeError("board down")),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_active_roster_entries",
            new=AsyncMock(
                return_value=[ActiveRosterEntry("1", "C. Smith", "Infielder")]
            ),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_batter_season_rows",
            new=AsyncMock(return_value=[batter]),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_pitcher_season_rows",
            new=AsyncMock(return_value=[]),
        ),
    ):
        result = await get_mlb_team_preview("776543", "away")
    assert result.batting_leaders == []
    assert result.pitching_leaders == []
    assert len(result.batting_roster) == 1
    assert result.team.abbrev == "WSH"


@pytest.mark.asyncio
async def test_get_mlb_team_preview_soft_fails_roster_entries():
    batter = MlbTeamBatterSeasonRow(
        player_id="1",
        name="C. Smith",
        g=1,
        ops=".900",
        avg=None,
        obp=None,
        slg=None,
        ab=None,
        r=None,
        h=None,
        hr=None,
        rbi=None,
        bb=None,
        so=None,
        sb=None,
    )
    with (
        patch(
            "app.domains.mlb.team_preview.get_mlb_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_leaders",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_active_roster_entries",
            new=AsyncMock(side_effect=RuntimeError("roster down")),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_batter_season_rows",
            new=AsyncMock(return_value=[batter]),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_pitcher_season_rows",
            new=AsyncMock(return_value=[]),
        ),
    ):
        result = await get_mlb_team_preview("776543", "away")
    assert len(result.batting_roster) == 1
    assert result.batting_roster[0].player_id == "1"
    assert result.pitching_roster == []
    assert result.team.abbrev == "WSH"
