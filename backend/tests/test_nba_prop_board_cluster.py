from app.domains.nba.prop_board_cluster import (
    BOOK_CHIP_ORDER,
    BoardQuote,
    cluster_quotes,
    consensus_ip_pct,
)
from app.domains.nba.prop_board_mains import _main_from_snapshot_rows
from app.domains.wnba.prop_fair import american_to_fair_pct


def test_nba_book_chip_order_is_supabase_only():
    assert BOOK_CHIP_ORDER == (
        "prophetx",
        "novig",
        "pinnacle",
        "draftkings",
        "fanduel",
        "prizepicks",
        "underdog",
    )
    assert "betmgm" not in BOOK_CHIP_ORDER


def test_consensus_ip_unique_prizepicks_uses_minus_137_raw():
    assert consensus_ip_pct([-137]) == round(american_to_fair_pct(-137))


def test_cluster_quotes_groups_rounded_matching_lines():
    quotes = [
        BoardQuote("Jalen Brunson", "jalen brunson", "points", 25.54, "novig", -110, -110),
        BoardQuote(
            "Jalen Brunson",
            "jalen brunson",
            "points",
            25.5,
            "pinnacle",
            -105,
            -115,
        ),
    ]

    clusters = cluster_quotes(quotes)

    assert len(clusters) == 1
    assert clusters[0].line == 25.5
    assert clusters[0].quotes == tuple(quotes)


def test_main_from_snapshot_rows_prefers_flagged_main_line():
    rows = [
        {
            "player_name": "Jalen Brunson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 25.5,
            "american_price": -110,
            "is_main": False,
        },
        {
            "player_name": "Jalen Brunson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 27.5,
            "american_price": -105,
            "is_main": True,
        },
        {
            "player_name": "Jalen Brunson",
            "market_type": "player_points",
            "side": "under",
            "line_score": 27.5,
            "american_price": -115,
            "is_main": True,
        },
    ]

    mains = _main_from_snapshot_rows(
        rows,
        player_field="player_name",
        stat_field="market_type",
    )

    main = mains[("jalen brunson", "points")]
    assert (main.line, main.over_american, main.under_american) == (27.5, -105, -115)
