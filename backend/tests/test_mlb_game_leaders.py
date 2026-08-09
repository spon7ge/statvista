from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.game_leaders import (
    last_name_from_full,
    pick_game_leader_from_board,
)


def test_last_name_from_full():
    assert last_name_from_full("Matt Olson") == "Olson"
    assert last_name_from_full("Olson") == "Olson"


def test_pick_game_leader_first_roster_hit():
    cat = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="Other Guy", team_abbrev="SEA", gp=10, value="40"),
            MlbLeaderRow(rank=4, player_id="2", name="Matt Olson", team_abbrev="ATL", gp=10, value="33"),
            MlbLeaderRow(rank=8, player_id="3", name="Home Bat", team_abbrev="NYY", gp=10, value="28"),
        ],
    )
    card = pick_game_leader_from_board(
        cat,
        away_ids={"2"},
        home_ids={"3"},
        away_abbrev="ATL",
        home_abbrev="NYY",
        headshot_by_norm={"matt olson": "https://a.espncdn.com/i/headshots/mlb/players/full/1.png"},
    )
    assert card is not None
    assert card.key == "hr"
    assert card.rank == 4
    assert card.last_name == "Olson"
    assert card.side == "away"
    assert card.headshot_url is not None


def test_pick_game_leader_none_when_no_roster_hit():
    cat = MlbLeaderCategory(
        key="avg",
        label="Batting Average",
        stat="AVG",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value=".340"),
        ],
    )
    assert (
        pick_game_leader_from_board(
            cat,
            away_ids={"1"},
            home_ids={"2"},
            away_abbrev="ATL",
            home_abbrev="NYY",
            headshot_by_norm={},
        )
        is None
    )
