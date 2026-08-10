from app.domains.wnba.schemas_game_detail import (
    GameDetailTeam,
    WnbaGameLeaderCard,
    WnbaGameLeaders,
    WnbaSeasonTeamStatLine,
    WnbaSeasonTeamStatsPair,
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
