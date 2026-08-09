from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.domains.mlb.game_detail import (
    attach_injuries,
    attach_matchup_leaders,
    attach_matchup_prediction,
    attach_season_team_stats,
    clear_mlb_game_detail_cache,
    get_mlb_game_detail,
)
from app.domains.mlb.schemas import (
    MlbGameDetail,
    MlbGameDetailTeam,
    MlbMatchupPrediction,
)
from app.domains.mlb.schemas_game_detail import (
    MlbInjuries,
    MlbInjury,
    MlbMatchupLeaderCategory,
    MlbMatchupLeaderEntry,
    MlbMatchupLeaders,
    MlbSeasonTeamStatLine,
    MlbSeasonTeamStatsPair,
)


def _scheduled_detail() -> MlbGameDetail:
    away = MlbGameDetailTeam(
        id="119",
        abbrev="LAD",
        name="Los Angeles Dodgers",
        score=None,
        color="#005A9C",
    )
    home = MlbGameDetailTeam(
        id="147",
        abbrev="NYY",
        name="New York Yankees",
        score=None,
        color="#0C2340",
    )
    return MlbGameDetail(
        mlb_game_pk="776543",
        status="scheduled",
        status_label="8:10 PM ET",
        venue="Yankee Stadium",
        away=away,
        home=home,
        game_date="2026-08-05",
        sources=["mlb_stats_api"],
        fetched_at="2026-08-05T18:00:00+00:00",
    )


def test_attach_season_team_stats():
    pair = MlbSeasonTeamStatsPair(
        away=MlbSeasonTeamStatLine(hr=1),
        home=MlbSeasonTeamStatLine(hr=2),
    )
    out = attach_season_team_stats(_scheduled_detail(), pair)
    assert out.season_team_stats is not None
    assert out.season_team_stats.home.hr == 2


def test_attach_season_team_stats_none_noop():
    detail = _scheduled_detail()
    assert attach_season_team_stats(detail, None) is detail


def test_attach_injuries():
    injuries = MlbInjuries(
        away=[MlbInjury(name="A", position="P", status="IL", detail=None)],
        home=[],
    )
    out = attach_injuries(_scheduled_detail(), injuries)
    assert out.injuries is not None
    assert out.injuries.away[0].name == "A"
    assert "espn" in out.sources


def test_attach_injuries_none_noop():
    detail = _scheduled_detail()
    assert attach_injuries(detail, None) is detail


def test_attach_matchup_prediction():
    detail = _scheduled_detail()
    pred = MlbMatchupPrediction(
        away_win_pct=59, home_win_pct=41, source_label="ESPN game projection"
    )
    out = attach_matchup_prediction(detail, pred)
    assert out.matchup_prediction == pred
    assert "espn" in out.sources


def test_attach_matchup_prediction_none_noop():
    detail = _scheduled_detail()
    assert attach_matchup_prediction(detail, None) is detail


def test_attach_matchup_leaders():
    leaders = MlbMatchupLeaders(
        categories=[
            MlbMatchupLeaderCategory(
                key="hr",
                label="HR",
                leaders=[
                    MlbMatchupLeaderEntry(
                        rank=2,
                        player_id="123",
                        name="Slugger",
                        team_abbrev="LAD",
                        side="away",
                        value="28",
                    )
                ],
            )
        ]
    )
    out = attach_matchup_leaders(_scheduled_detail(), leaders)
    assert out.matchup_leaders is not None
    assert out.matchup_leaders.categories[0].leaders[0].name == "Slugger"


def test_attach_matchup_leaders_none_noop():
    detail = _scheduled_detail()
    assert attach_matchup_leaders(detail, None) is detail


@pytest.mark.asyncio
async def test_get_mlb_game_detail_soft_fails_season_and_espn():
    live_payload = {
        "gameData": {
            "game": {"pk": 776543},
            "datetime": {"officialDate": "2026-08-05"},
            "status": {
                "abstractGameState": "Preview",
                "detailedState": "Scheduled",
            },
            "teams": {
                "away": {
                    "id": 119,
                    "abbreviation": "LAD",
                    "name": "Los Angeles Dodgers",
                    "teamName": "Dodgers",
                },
                "home": {
                    "id": 147,
                    "abbreviation": "NYY",
                    "name": "New York Yankees",
                    "teamName": "Yankees",
                },
            },
            "venue": {"name": "Yankee Stadium"},
        },
        "liveData": {
            "plays": {"allPlays": []},
            "linescore": {},
            "boxscore": {"teams": {"away": {}, "home": {}}},
        },
    }

    with (
        patch(
            "app.domains.mlb.game_detail.fetch_mlb_live_feed",
            new=AsyncMock(return_value=live_payload),
        ),
        patch(
            "app.domains.mlb.game_detail._standings_last10_map",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "app.domains.mlb.game_detail.fetch_season_team_stats_pair",
            new=AsyncMock(side_effect=RuntimeError("stats down")),
        ),
        patch(
            "app.domains.mlb.game_detail.resolve_espn_event_id",
            new=AsyncMock(side_effect=RuntimeError("espn down")),
        ),
    ):
        clear_mlb_game_detail_cache()
        detail = await get_mlb_game_detail("776543")

    assert detail.mlb_game_pk == "776543"
    assert detail.status == "scheduled"
    assert detail.season_team_stats is None
    assert detail.injuries is None
