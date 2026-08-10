from app.domains.wnba.game_detail import attach_record_last10
from app.domains.wnba.schemas_game_detail import (
    GameDetailTeam,
    WnbaGameDetail,
    WnbaGameLeaderCard,
    WnbaGameLeaders,
    WnbaSeasonTeamStatLine,
    WnbaSeasonTeamStatsPair,
)


def _minimal_scheduled_detail() -> WnbaGameDetail:
    return WnbaGameDetail(
        espn_event_id="401857099",
        status="scheduled",
        status_label="Scheduled",
        venue=None,
        away=GameDetailTeam(
            id="17", abbrev="LVA", name="Las Vegas Aces", score=None, color="#000000"
        ),
        home=GameDetailTeam(
            id="9", abbrev="NYL", name="New York Liberty", score=None, color="#FFFFFF"
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
        fetched_at="2026-08-10T12:00:00-04:00",
    )


def test_game_detail_team_accepts_record_and_last10():
    t = GameDetailTeam(
        id="1", abbrev="LVA", name="Aces", score=None, color="#000",
        record="22-8", last_10="7-3",
    )
    assert t.record == "22-8"
    assert t.last_10 == "7-3"


def test_season_team_stats_and_game_leaders_shapes():
    line = WnbaSeasonTeamStatLine(pts=92.0, pts_rank=3, reb=34.0, reb_rank=5)
    pair = WnbaSeasonTeamStatsPair(away=line, home=line)
    leaders = WnbaGameLeaders(
        leaders=[
            WnbaGameLeaderCard(
                key="ppg", label="PPG", rank=1, value="26.6",
                player_id="9", last_name="Wilson", team_abbrev="LVA",
                side="away", headshot_url=None,
            )
        ]
    )
    assert pair.away.pts_rank == 3
    assert leaders.leaders[0].key == "ppg"


def test_attach_record_last10():
    detail = _minimal_scheduled_detail()
    out = attach_record_last10(
        detail,
        {"17": ("22-8", "7-3"), "9": ("20-10", "6-4")},
    )
    assert out.away.record == "22-8"
    assert out.away.last_10 == "7-3"
    assert out.home.record == "20-10"
    assert out.home.last_10 == "6-4"


def test_attach_record_last10_missing_team_leaves_null():
    detail = _minimal_scheduled_detail()
    out = attach_record_last10(detail, {})
    assert out.away.record is None
    assert out.away.last_10 is None
