from app.domains.mlb.prop_stat_keys import (
    canonical_stat_key_from_odds_api_mlb,
    canonical_stat_key_from_pp_mlb,
    canonical_stat_key_from_sharp_mlb,
    canonical_stat_key_from_ud_mlb,
)


def test_pp_core_stats():
    assert canonical_stat_key_from_pp_mlb("Total Bases") == "total_bases"
    assert canonical_stat_key_from_pp_mlb("Hits+Runs+RBIs") == "hits_runs_rbis"
    assert canonical_stat_key_from_pp_mlb("Hitter Strikeouts") == "batter_strikeouts"
    assert canonical_stat_key_from_pp_mlb("Pitcher Strikeouts") == "pitcher_strikeouts"


def test_pp_unmatched_returns_none():
    assert canonical_stat_key_from_pp_mlb("Pitcher Strikeouts (Combo)") is None
    assert canonical_stat_key_from_pp_mlb("1st Inning Runs Allowed") is None


def test_ud_core_stats():
    assert canonical_stat_key_from_ud_mlb("total_bases") == "total_bases"
    assert canonical_stat_key_from_ud_mlb("strikeouts") == "pitcher_strikeouts"
    assert canonical_stat_key_from_ud_mlb("batter_strikeouts") == "batter_strikeouts"


def test_sharp_prefixed_and_bare_forms():
    assert canonical_stat_key_from_sharp_mlb("player_total_bases") == "total_bases"
    assert canonical_stat_key_from_sharp_mlb("total_bases") == "total_bases"
    assert canonical_stat_key_from_sharp_mlb("batter_strikeouts") == "batter_strikeouts"
    assert canonical_stat_key_from_sharp_mlb("pitcher_strikeouts") == "pitcher_strikeouts"
    # ProphetX emits bare "strikeouts" for pitcher K props today.
    assert canonical_stat_key_from_sharp_mlb("strikeouts") == "pitcher_strikeouts"
    assert (
        canonical_stat_key_from_sharp_mlb("batter_hits_runs_rbis") == "hits_runs_rbis"
    )
    assert (
        canonical_stat_key_from_sharp_mlb("player_hits_runs_rbis") == "hits_runs_rbis"
    )
    assert canonical_stat_key_from_sharp_mlb("pitcher_walks") == "walks_allowed"
    assert canonical_stat_key_from_sharp_mlb("batter_walks") == "walks"


def test_sharp_unmatched_returns_none():
    assert canonical_stat_key_from_sharp_mlb("player_first_touchdown") is None


def test_sharp_strips_alternate_suffix():
    assert (
        canonical_stat_key_from_sharp_mlb("player_total_bases_alternate")
        == "total_bases"
    )
    assert (
        canonical_stat_key_from_sharp_mlb("batter_strikeouts_alternate")
        == "batter_strikeouts"
    )
    assert (
        canonical_stat_key_from_sharp_mlb("pitcher_strikeouts_alternate")
        == "pitcher_strikeouts"
    )
    # Main key unchanged
    assert canonical_stat_key_from_sharp_mlb("player_total_bases") == "total_bases"


def test_sharp_alternate_and_main_share_canonical_key():
    main = canonical_stat_key_from_sharp_mlb("player_total_bases")
    alt = canonical_stat_key_from_sharp_mlb("player_total_bases_alternate")
    assert main == alt == "total_bases"


def test_odds_api_batter_hits():
    assert canonical_stat_key_from_odds_api_mlb("batter_hits") == "hits"


def test_odds_api_pitcher_strikeouts():
    assert canonical_stat_key_from_odds_api_mlb("pitcher_strikeouts") == "pitcher_strikeouts"


def test_odds_api_unknown_returns_none():
    assert canonical_stat_key_from_odds_api_mlb("h2h") is None


def test_game_prop_category_order_includes_core_hitting():
    from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER
    assert "home_runs" in GAME_PROP_CATEGORY_ORDER
    assert "hits" in GAME_PROP_CATEGORY_ORDER
    assert "total_bases" in GAME_PROP_CATEGORY_ORDER
    assert GAME_PROP_CATEGORY_ORDER.index("home_runs") < GAME_PROP_CATEGORY_ORDER.index("hits")
