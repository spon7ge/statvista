from app.domains.wnba.prop_board_form import (
    actual_for_stat,
    h2h_rate,
    hit_rates,
    opponent_abbrev_from_split,
    qualifying_splits,
)


def test_l5_skips_zero_minutes_and_push_is_miss():
    splits = [
        {"MIN": 0, "PTS": 0, "GAME_DATE": "2026-07-20"},
        {"MIN": 32, "PTS": 22, "GAME_DATE": "2026-07-22"},
        {"MIN": 30, "PTS": 20, "GAME_DATE": "2026-07-24"},
        {"MIN": 28, "PTS": 18, "GAME_DATE": "2026-07-26"},
        {"MIN": 34, "PTS": 10, "GAME_DATE": "2026-07-28"},
        {"MIN": 31, "PTS": 21, "GAME_DATE": "2026-07-30"},
    ]
    l5, l10, l15 = hit_rates("points", "over", 18.5, splits)
    assert l5 == 60  # 3/5 newest (skip 0 MIN)
    assert l10 == l15 == 60


def test_under_is_complement_except_pushes():
    splits = [{"MIN": 30, "PTS": 20}]
    over, _, _ = hit_rates("points", "over", 20.0, splits)
    under, _, _ = hit_rates("points", "under", 20.0, splits)
    assert over == 0
    assert under == 0


def test_zero_qualifying_games_are_null():
    splits = [{"MIN": 0, "PTS": 30}]
    assert hit_rates("points", "over", 18.5, splits) == (None, None, None)


def test_pts_rebs_asts_sums_components():
    splits = [{"MIN": 32, "PTS": 20, "REB": 8, "AST": 6}]
    l5, _, _ = hit_rates("pts_rebs_asts", "over", 33.5, splits)
    assert l5 == 100


def test_threes_maps_fg3m():
    splits = [{"MIN": 30, "FG3M": 4}]
    assert actual_for_stat("threes", splits[0]) == 4
    l5, _, _ = hit_rates("threes", "over", 2.5, splits)
    assert l5 == 100


def test_missing_stat_field_nulls_window():
    splits = [{"MIN": 30}]
    assert hit_rates("points", "over", 18.5, splits) == (None, None, None)


def test_qualifying_splits_keeps_played_order():
    splits = [
        {"MIN": 0, "PTS": 0},
        {"MIN": 20, "PTS": 10},
        {"MIN": 28, "PTS": 22},
    ]
    kept = qualifying_splits(splits)
    assert [s["PTS"] for s in kept] == [10, 22]


def test_l5_uses_latest_dates_when_log_is_oldest_first():
    early_hits = [
        {"GAME_DATE": f"2026-05-{day:02d}", "MIN": 30, "PTS": 22}
        for day in range(25, 30)
    ]
    late_misses = [
        {"GAME_DATE": f"2026-07-{day:02d}", "MIN": 30, "PTS": 10}
        for day in range(27, 32)
    ]
    l5, l10, _ = hit_rates("points", "over", 18.5, early_hits + late_misses)
    assert l5 == 0
    assert l10 == 50


def test_h2h_rate_pools_this_and_last_season_games():
    this_season = [
        {"MIN": 30, "PTS": 22, "MATCHUP": "IND vs. NYL"},
        {"MIN": 28, "PTS": 10, "MATCHUP": "IND @ NYL"},
    ]
    last_season = [
        {"MIN": 32, "PTS": 24, "MATCHUP": "IND vs. NYL"},
    ]
    assert h2h_rate("points", "over", 18.5, this_season + last_season, "NYL") == 67


def test_h2h_rate_only_counts_games_against_that_opponent():
    splits = [
        {"MIN": 30, "PTS": 22, "MATCHUP": "IND vs. NYL"},
        {"MIN": 28, "PTS": 10, "MATCHUP": "IND @ NYL"},
        {"MIN": 30, "PTS": 25, "MATCHUP": "IND vs. CHI"},
        {"MIN": 0, "PTS": 0, "MATCHUP": "IND vs. NYL"},
    ]
    assert h2h_rate("points", "over", 18.5, splits, "NYL") == 50


def test_h2h_rate_null_without_opponent_or_matchups():
    splits = [{"MIN": 30, "PTS": 22, "MATCHUP": "IND vs. NYL"}]
    assert h2h_rate("points", "over", 18.5, splits, None) is None
    assert h2h_rate("points", "over", 18.5, splits, "CHI") is None
    assert h2h_rate("points", "over", 18.5, [], "NYL") is None


def test_opponent_abbrev_from_matchup_canonicalizes_phoenix():
    assert opponent_abbrev_from_split({"MATCHUP": "LVA @ PHO"}) == "PHO"
    assert opponent_abbrev_from_split({"MATCHUP": "LVA vs. NYL"}) == "NYL"
    assert opponent_abbrev_from_split({"opponent_abbrev": "PHX"}) == "PHO"
