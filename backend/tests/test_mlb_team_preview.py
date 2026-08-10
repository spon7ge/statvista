from app.domains.mlb.schemas_team_preview import (
    MlbTeamBatterSeasonRow,
    MlbTeamLeaderCard,
    MlbTeamPitcherSeasonRow,
    MlbTeamPreviewResponse,
    MlbTeamPreviewTeam,
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
