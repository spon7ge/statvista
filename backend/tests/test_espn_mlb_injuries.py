from app.providers.espn.mlb_bridge import normalize_espn_mlb_injuries

SUMMARY = {
    "injuries": [
        {
            "team": {"id": "19"},
            "injuries": [
                {
                    "status": "10-Day IL",
                    "athlete": {
                        "displayName": "Dalton Rushing",
                        "position": {"abbreviation": "C"},
                    },
                    "details": {"type": "Arm"},
                }
            ],
        },
        {"team": {"id": "16"}, "injuries": []},
    ]
}


def test_normalize_espn_mlb_injuries():
    result = normalize_espn_mlb_injuries(
        SUMMARY, away_espn_team_id="19", home_espn_team_id="16"
    )
    assert result is not None
    assert result.away[0].name == "Dalton Rushing"
    assert result.away[0].status == "10-Day IL"
    assert result.away[0].detail == "Arm"
    assert result.home == []


def test_normalize_espn_mlb_injuries_none_when_empty():
    assert (
        normalize_espn_mlb_injuries(
            {
                "injuries": [
                    {"team": {"id": "1"}, "injuries": []},
                    {"team": {"id": "2"}, "injuries": []},
                ]
            },
            away_espn_team_id="1",
            home_espn_team_id="2",
        )
        is None
    )
