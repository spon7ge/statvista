from app.domains.nba.prop_board_form import h2h_rate, hit_rates


def test_hit_rates_over_points_l5():
    splits = [
        {
            "GAME_DATE": f"2026-10-{i:02d}",
            "MIN": 30,
            "PTS": 30,
            "MATCHUP": "BOS @ NYK",
        }
        for i in range(1, 6)
    ]

    l5, l10, l15 = hit_rates("points", "over", 25.5, splits)

    assert (l5, l10, l15) == (100, 100, 100)


def test_hit_rates_l5_sorts_month_name_dates_chronologically():
    splits = [
        {"GAME_DATE": f"Nov {day}, 2025", "MIN": 30, "PTS": 30}
        for day in range(1, 6)
    ]
    splits.append({"GAME_DATE": "Oct 22, 2025", "MIN": 30, "PTS": 20})

    l5, _, _ = hit_rates("points", "over", 25.5, splits)

    assert l5 == 100


def test_h2h_rate_matches_local_opponent_abbreviation():
    splits = [
        {"GAME_DATE": "2026-10-02", "MIN": 30, "PTS": 20, "MATCHUP": "BOS vs. NYK"},
        {"GAME_DATE": "2026-10-01", "MIN": 30, "PTS": 30, "MATCHUP": "BOS @ LAL"},
    ]

    assert h2h_rate("points", "under", 25.5, splits, "nyk") == 100
