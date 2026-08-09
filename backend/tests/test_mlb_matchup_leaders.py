from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.matchup_leaders import (
    intersect_category_with_rosters,
    select_matchup_leader_specs,
)


def test_select_matchup_leader_specs_six_keys():
    specs = select_matchup_leader_specs()
    assert [s[0] for s in specs] == ["hr", "avg", "ops", "era", "so", "whip"]


def test_intersect_category_keeps_top_three_roster_hits():
    category = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="1", name="A", team_abbrev="NYY", gp=10, value="30"),
            MlbLeaderRow(rank=2, player_id="2", name="B", team_abbrev="LAD", gp=10, value="28"),
            MlbLeaderRow(rank=3, player_id="3", name="C", team_abbrev="BOS", gp=10, value="27"),
            MlbLeaderRow(rank=4, player_id="4", name="D", team_abbrev="LAD", gp=10, value="26"),
            MlbLeaderRow(rank=5, player_id="5", name="E", team_abbrev="NYY", gp=10, value="25"),
        ],
    )
    out = intersect_category_with_rosters(
        category,
        away_ids={"2", "4"},
        home_ids={"5"},
        away_abbrev="LAD",
        home_abbrev="NYY",
    )
    assert out.key == "hr"
    assert out.label == "HR"
    assert [e.player_id for e in out.leaders] == ["2", "4", "5"]
    assert [e.side for e in out.leaders] == ["away", "away", "home"]
    assert out.leaders[0].rank == 2


def test_intersect_empty_when_no_overlap():
    category = MlbLeaderCategory(
        key="avg",
        label="Batting Average",
        stat="AVG",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value=".340"),
        ],
    )
    out = intersect_category_with_rosters(
        category,
        away_ids={"1"},
        home_ids={"2"},
        away_abbrev="LAD",
        home_abbrev="NYY",
    )
    assert out.leaders == []
