from app.domains.mlb.prop_board_form import (
    actual_for_stat,
    h2h_rate,
    hit_rates,
    opponent_abbrev_from_split,
    qualifying_splits,
)


def test_l5_skips_zero_pa_and_push_is_miss():
    splits = [
        {"stat": {"plateAppearances": 0, "hits": 0}},  # skip
        {"stat": {"plateAppearances": 4, "hits": 3}},  # over 1.5 hit
        {"stat": {"plateAppearances": 4, "hits": 2}},  # over 1.5 hit
        {"stat": {"plateAppearances": 4, "hits": 1}},  # miss
        {"stat": {"plateAppearances": 4, "hits": 0}},  # miss
        {"stat": {"plateAppearances": 4, "hits": 2}},  # hit
    ]
    l5, l10, l15 = hit_rates("hits", "over", 1.5, splits)
    assert l5 == 60  # 3/5
    assert l10 == l15 == 60


def test_under_is_complement_except_pushes():
    splits = [{"stat": {"plateAppearances": 3, "hits": 2}}]
    over, _, _ = hit_rates("hits", "over", 2.0, splits)
    under, _, _ = hit_rates("hits", "under", 2.0, splits)
    assert over == 0  # push
    assert under == 0


def test_trailing_dnp_is_ignored():
    splits = [
        {"stat": {"plateAppearances": 4, "hits": 2}},
        {"stat": {"plateAppearances": 4, "hits": 2}},
        {"stat": {"plateAppearances": 4, "hits": 2}},
        {"stat": {"plateAppearances": 4, "hits": 2}},
        {"stat": {"plateAppearances": 0, "hits": 0}},
    ]
    l5, l10, l15 = hit_rates("hits", "over", 1.5, splits)
    assert l5 == l10 == l15 == 100


def test_zero_qualifying_games_are_null():
    splits = [{"stat": {"plateAppearances": 0, "hits": 3}}]
    assert hit_rates("hits", "over", 1.5, splits) == (None, None, None)


def test_pitcher_skips_no_appearance():
    splits = [
        {"stat": {"inningsPitched": "0.0", "strikeOuts": 0, "outs": 0, "battersFaced": 0}},
        {"stat": {"inningsPitched": "5.0", "strikeOuts": 8, "outs": 15, "battersFaced": 20}},
    ]
    l5, _, _ = hit_rates("pitcher_strikeouts", "over", 6.5, splits)
    assert l5 == 100


def test_hits_runs_rbis_sums_components():
    splits = [{"stat": {"plateAppearances": 4, "hits": 2, "runs": 1, "rbi": 1}}]
    l5, _, _ = hit_rates("hits_runs_rbis", "over", 3.5, splits)
    assert l5 == 100


def test_pitching_outs_parses_ip_one_point_two_as_five():
    splits = [{"stat": {"inningsPitched": "1.2"}}]
    assert actual_for_stat("pitching_outs", splits[0]) == 5
    l5, _, _ = hit_rates("pitching_outs", "over", 4.5, splits)
    assert l5 == 100


def test_missing_stat_field_nulls_window():
    splits = [{"stat": {"plateAppearances": 4}}]
    assert hit_rates("hits", "over", 1.5, splits) == (None, None, None)


def test_qualifying_splits_keeps_played_order():
    splits = [
        {"stat": {"plateAppearances": 0, "hits": 0}},
        {"stat": {"plateAppearances": 3, "hits": 1}},
        {"stat": {"plateAppearances": 4, "hits": 2}},
    ]
    kept = qualifying_splits("hits", splits)
    assert [s["stat"]["hits"] for s in kept] == [1, 2]


def test_windows_use_first_n_qualifying():
    hits = [{"stat": {"plateAppearances": 4, "hits": 2}}] * 5
    misses = [{"stat": {"plateAppearances": 4, "hits": 0}}] * 10
    l5, l10, l15 = hit_rates("hits", "over", 1.5, hits + misses)
    assert l5 == 100
    assert l10 == 50
    assert l15 == 33


def test_l5_uses_latest_dates_when_log_is_oldest_first():
    """Stats API gameLog is oldest-first; L5 must be the most recent five games."""
    early_hits = [
        {"date": f"2026-03-{day:02d}", "stat": {"plateAppearances": 4, "hits": 2}}
        for day in range(25, 30)
    ]
    late_misses = [
        {"date": f"2026-05-{day:02d}", "stat": {"plateAppearances": 4, "hits": 0}}
        for day in range(27, 32)
    ]
    l5, l10, _ = hit_rates("hits", "over", 1.5, early_hits + late_misses)
    assert l5 == 0
    assert l10 == 50


def test_actual_for_stat_maps_canonical_fields():
    hitting = {
        "stat": {
            "hits": 3,
            "runs": 1,
            "rbi": 2,
            "homeRuns": 1,
            "doubles": 1,
            "triples": 0,
            "totalBases": 7,
            "stolenBases": 1,
            "baseOnBalls": 2,
            "strikeOuts": 1,
            "plateAppearances": 5,
        }
    }
    assert actual_for_stat("hits", hitting) == 3
    assert actual_for_stat("hits_runs_rbis", hitting) == 6
    assert actual_for_stat("home_runs", hitting) == 1
    assert actual_for_stat("rbis", hitting) == 2
    assert actual_for_stat("total_bases", hitting) == 7
    assert actual_for_stat("walks", hitting) == 2
    assert actual_for_stat("batter_strikeouts", hitting) == 1
    assert actual_for_stat("singles", hitting) == 1
    pitching = {
        "stat": {
            "strikeOuts": 8,
            "hits": 4,
            "baseOnBalls": 1,
            "earnedRuns": 2,
            "runs": 3,
            "numberOfPitches": 92,
            "inningsPitched": "6.1",
        }
    }
    assert actual_for_stat("pitcher_strikeouts", pitching) == 8
    assert actual_for_stat("hits_allowed", pitching) == 4
    assert actual_for_stat("walks_allowed", pitching) == 1
    assert actual_for_stat("earned_runs_allowed", pitching) == 2
    assert actual_for_stat("runs_allowed", pitching) == 3
    assert actual_for_stat("pitches_thrown", pitching) == 92
    assert actual_for_stat("pitching_outs", pitching) == 19


def test_h2h_rate_pools_this_and_last_season_games():
    this_season = [
        {
            "opponent": {"name": "Boston Red Sox"},
            "stat": {"plateAppearances": 4, "hits": 3},
        },
        {
            "opponent": {"name": "Boston Red Sox"},
            "stat": {"plateAppearances": 4, "hits": 0},
        },
    ]
    last_season = [
        {
            "opponent": {"name": "Boston Red Sox"},
            "stat": {"plateAppearances": 4, "hits": 2},
        },
    ]
    assert h2h_rate("hits", "over", 1.5, this_season + last_season, "BOS") == 67


def test_h2h_rate_only_counts_games_against_that_opponent():
    splits = [
        {
            "opponent": {"name": "Boston Red Sox"},
            "stat": {"plateAppearances": 4, "hits": 3},
        },
        {
            "opponent": {"name": "Boston Red Sox"},
            "stat": {"plateAppearances": 4, "hits": 0},
        },
        {
            "opponent": {"name": "Tampa Bay Rays"},
            "stat": {"plateAppearances": 4, "hits": 3},
        },
        {
            "stat": {"plateAppearances": 0, "hits": 0},
            "opponent": {"name": "Boston Red Sox"},
        },
    ]
    assert h2h_rate("hits", "over", 1.5, splits, "BOS") == 50


def test_h2h_rate_null_without_opponent_or_matchups():
    splits = [
        {
            "opponent": {"name": "Boston Red Sox"},
            "stat": {"plateAppearances": 4, "hits": 3},
        }
    ]
    assert h2h_rate("hits", "over", 1.5, splits, None) is None
    assert h2h_rate("hits", "over", 1.5, splits, "TB") is None
    assert h2h_rate("hits", "over", 1.5, [], "BOS") is None


def test_h2h_rate_resolves_opponent_id_via_map():
    splits = [
        {
            "opponent": {"id": 111},
            "stat": {"plateAppearances": 4, "hits": 2},
        }
    ]
    assert h2h_rate("hits", "over", 1.5, splits, "BOS", {111: "BOS"}) == 100


def test_opponent_abbrev_from_split_prefers_stamped_then_name():
    assert opponent_abbrev_from_split({"opponent_abbrev": "BOS"}) == "BOS"
    assert opponent_abbrev_from_split(
        {"opponent": {"name": "Boston Red Sox"}}
    ) == "BOS"
    assert opponent_abbrev_from_split(
        {"opponent": {"id": 147}}, {147: "NYY"}
    ) == "NYY"
