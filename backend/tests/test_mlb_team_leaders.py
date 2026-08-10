from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.team_leaders import pick_team_leader_from_board


def test_pick_team_leader_first_roster_hit():
    cat = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="Other Guy", team_abbrev="SEA", gp=10, value="40"),
            MlbLeaderRow(rank=4, player_id="2", name="Matt Olson", team_abbrev="ATL", gp=10, value="33"),
        ],
    )
    card = pick_team_leader_from_board(
        cat,
        roster_ids={"2"},
        headshot_by_norm={"matt olson": "https://example.com/o.png"},
    )
    assert card is not None
    assert card.key == "hr"
    assert card.label == "HR"
    assert card.rank == 4
    assert card.last_name == "Olson"
    assert card.headshot_url == "https://example.com/o.png"


def test_pick_team_leader_none_when_no_roster_hit():
    cat = MlbLeaderCategory(
        key="era",
        label="ERA",
        stat="ERA",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value="1.90"),
        ],
    )
    assert (
        pick_team_leader_from_board(cat, roster_ids={"1"}, headshot_by_norm={})
        is None
    )
