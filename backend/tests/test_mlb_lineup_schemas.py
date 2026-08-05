from app.domains.mlb.schemas import (
    MlbLineupMatchupBatter,
    MlbLineupMatchupPitcher,
    MlbLineupMatchupResponse,
    MlbLineupMatchupSide,
    MlbVsPitcherStats,
)


def test_matchup_response_round_trip():
    side = MlbLineupMatchupSide(
        pitcher=MlbLineupMatchupPitcher(
            name="Zack Littell",
            hand="R",
            mlbam_id=641793,
            wins=7,
            losses=8,
            era="4.97",
            innings_pitched="112.1",
            strikeouts=70,
            whip="1.34",
            k_per_9="5.61",
            bb_per_9="2.40",
            strikeout_walk_ratio="2.33",
        ),
        batters=[
            MlbLineupMatchupBatter(
                order=1,
                position="RF",
                name="James Wood",
                hand="L",
                mlbam_id=695578,
                vs_pitcher=MlbVsPitcherStats(ab=10, h=3, hr=0, avg=".300"),
            )
        ],
    )
    body = MlbLineupMatchupResponse(
        date="2026-08-04",
        away_abbrev="WSH",
        home_abbrev="SF",
        status="expected",
        away=side,
        home=None,
        fetched_at="2026-08-04T17:00:00+00:00",
    )
    dumped = body.model_dump()
    assert dumped["away"]["pitcher"]["whip"] == "1.34"
    assert dumped["away"]["pitcher"]["k_per_9"] == "5.61"
    assert dumped["away"]["pitcher"]["bb_per_9"] == "2.40"
    assert dumped["away"]["pitcher"]["strikeout_walk_ratio"] == "2.33"
    assert dumped["away"]["batters"][0]["vs_pitcher"]["ab"] == 10
    assert dumped["source"] == "rotowire+statsapi"
