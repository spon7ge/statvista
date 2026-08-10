from app.domains.mlb.schemas_team_preview import (
    MlbTeamBatterSeasonRow,
    MlbTeamLeaderCard,
    MlbTeamPitcherSeasonRow,
    MlbTeamPreviewResponse,
    MlbTeamPreviewTeam,
)
from app.providers.mlb_stats.team_player_season import (
    filter_rows_to_roster,
    parse_batter_season_row,
    parse_pitcher_season_row,
    sort_batter_rows,
    sort_pitcher_rows,
)


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
