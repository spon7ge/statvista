from app.domains.mlb.schemas_game_detail import (
    MlbInjuries,
    MlbInjury,
    MlbSeasonTeamStatLine,
    MlbSeasonTeamStatsPair,
)


def test_season_team_stat_line_round_trip():
    line = MlbSeasonTeamStatLine(
        hr=146, r=578, h=1003, avg=".261", obp=".339", slg=".430",
        era="3.71", so=1019, bb=350,
    )
    assert line.model_dump()["so"] == 1019


def test_injuries_round_trip():
    injuries = MlbInjuries(
        away=[MlbInjury(name="Dalton Rushing", position="C", status="10-Day IL", detail="Arm")],
        home=[],
    )
    assert injuries.away[0].detail == "Arm"
