from app.domains.mlb.prop_board_ranks import (
    BATTER_STATS,
    PITCHER_STATS,
    TeamRankRow,
    build_team_rank_index,
    def_and_pace_ranks,
    is_pitcher_stat,
)
from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER


def test_hits_is_batter_strikeouts_is_not_pitcher():
    assert is_pitcher_stat("hits") is False
    assert is_pitcher_stat("pitcher_strikeouts") is True


def test_batter_uses_era_rank_pitcher_uses_ops():
    ranks = {
        "BOS": TeamRankRow(abbrev="BOS", era_rank=2, ops_rank=14, pace_rank=5),
    }
    def_r, def_l, pace_r, pace_l = def_and_pace_ranks("hits", "BOS", ranks)
    assert def_r == 2 and def_l == "2nd BOS"
    assert pace_r == 5 and pace_l == "5th BOS"
    def_r, def_l, _, _ = def_and_pace_ranks("pitcher_strikeouts", "BOS", ranks)
    assert def_r == 14 and def_l == "14th BOS"


def test_missing_opponent_is_null():
    def_r, def_l, pace_r, pace_l = def_and_pace_ranks("hits", None, {})
    assert def_r is None and def_l is None and pace_r is None


def test_unknown_opponent_is_null():
    def_r, def_l, pace_r, pace_l = def_and_pace_ranks("hits", "NYY", {})
    assert (def_r, def_l, pace_r, pace_l) == (None, None, None, None)


def test_missing_rank_values_leave_labels_null():
    ranks = {
        "BOS": TeamRankRow(abbrev="BOS", era_rank=None, ops_rank=None, pace_rank=None),
    }
    assert def_and_pace_ranks("hits", "BOS", ranks) == (None, None, None, None)


def test_stat_sets_partition_canonical_keys():
    assert BATTER_STATS.isdisjoint(PITCHER_STATS)
    assert BATTER_STATS | PITCHER_STATS == frozenset(GAME_PROP_CATEGORY_ORDER)


def test_canonical_batter_and_pitcher_keys():
    assert is_pitcher_stat("batter_strikeouts") is False
    assert is_pitcher_stat("hits_runs_rbis") is False
    assert is_pitcher_stat("earned_runs_allowed") is True
    assert is_pitcher_stat("runs_allowed") is True


def test_ordinal_teen_and_twenty_first():
    ranks = {
        "BOS": TeamRankRow(abbrev="BOS", era_rank=11, ops_rank=21, pace_rank=23),
    }
    _, def_l, _, pace_l = def_and_pace_ranks("hits", "BOS", ranks)
    assert def_l == "11th BOS" and pace_l == "23rd BOS"
    _, def_l, _, _ = def_and_pace_ranks("pitcher_strikeouts", "BOS", ranks)
    assert def_l == "21st BOS"


def test_build_team_rank_index_era_ops_pace():
    hitting = [
        {
            "team": {"abbreviation": "BOS"},
            "stat": {
                "obp": ".340",
                "slg": ".450",
                "plateAppearances": 500,
                "gamesPlayed": 10,
            },
        },
        {
            "team": {"abbreviation": "NYY"},
            "stat": {
                "obp": ".320",
                "slg": ".400",
                "plateAppearances": 400,
                "gamesPlayed": 10,
            },
        },
    ]
    pitching = [
        {"team": {"abbreviation": "BOS"}, "stat": {"era": "4.00"}},
        {"team": {"abbreviation": "NYY"}, "stat": {"era": "3.00"}},
    ]
    index = build_team_rank_index(hitting, pitching)
    assert index["BOS"] == TeamRankRow(
        abbrev="BOS", era_rank=2, ops_rank=1, pace_rank=1
    )
    assert index["NYY"] == TeamRankRow(
        abbrev="NYY", era_rank=1, ops_rank=2, pace_rank=2
    )


def test_build_team_rank_index_ties_leave_gaps():
    hitting = [
        {
            "abbrev": "BOS",
            "stat": {
                "obp": ".300",
                "slg": ".400",
                "plateAppearances": 400,
                "gamesPlayed": 10,
            },
        },
        {
            "abbrev": "NYY",
            "stat": {
                "obp": ".300",
                "slg": ".400",
                "plateAppearances": 400,
                "gamesPlayed": 10,
            },
        },
        {
            "abbrev": "LAD",
            "stat": {
                "obp": ".280",
                "slg": ".360",
                "plateAppearances": 300,
                "gamesPlayed": 10,
            },
        },
    ]
    pitching = [
        {"abbrev": "BOS", "stat": {"era": "3.00"}},
        {"abbrev": "NYY", "stat": {"era": "3.00"}},
        {"abbrev": "LAD", "stat": {"era": "4.00"}},
    ]
    index = build_team_rank_index(hitting, pitching)
    assert index["BOS"].era_rank == index["NYY"].era_rank == 1
    assert index["LAD"].era_rank == 3
    assert index["BOS"].ops_rank == index["NYY"].ops_rank == 1
    assert index["LAD"].ops_rank == 3
    assert index["BOS"].pace_rank == index["NYY"].pace_rank == 1
    assert index["LAD"].pace_rank == 3
