from app.domains.mlb.prop_board_cluster import (
    BoardQuote,
    cluster_quotes,
    devig_pct_for_side,
    ip_pct_for_side,
)


def _q(**kwargs):
    base = dict(
        player_name="Jewell Loyd",
        player_key="jewell loyd",
        stat="points",
        line=9.5,
        book="prophetx",
        over_american=-110,
        under_american=-110,
        url=None,
    )
    base.update(kwargs)
    return BoardQuote(**base)


def test_split_mains_make_two_clusters():
    quotes = [
        _q(line=9.5, book="prophetx"),
        _q(line=9.5, book="draftkings", over_american=-115, under_american=-105),
        _q(line=10.0, book="prizepicks", over_american=None, under_american=None),
    ]
    clusters = cluster_quotes(quotes)
    lines = sorted(c.line for c in clusters)
    assert lines == [9.5, 10.0]
    c95 = next(c for c in clusters if c.line == 9.5)
    assert {q.book for q in c95.quotes} == {"prophetx", "draftkings"}


def test_ip_is_consensus_raw_implied():
    cluster = cluster_quotes(
        [
            _q(book="draftkings", over_american=100, under_american=-120),
            _q(book="prophetx", over_american=-150, under_american=130),
        ]
    )[0]
    over = ip_pct_for_side(cluster, "over")
    under = ip_pct_for_side(cluster, "under")
    # Raw implied: PX -150 → 60%, DK +100 → 50% → 55. Under: +130 → 43.5, -120 → 54.5 → 49.
    assert (over, under) == (55, 49)


def test_dfs_only_cluster_has_null_ip():
    cluster = cluster_quotes(
        [_q(book="prizepicks", over_american=None, under_american=None)]
    )[0]
    assert ip_pct_for_side(cluster, "over") is None


def test_devig_pct_for_side_even_juice():
    assert devig_pct_for_side(-110, -110, "over") == 50
    assert devig_pct_for_side(-110, -110, "under") == 50


def test_devig_pct_for_side_needs_both_americans():
    assert devig_pct_for_side(-122, None, "over") is None
    assert devig_pct_for_side(None, 102, "under") is None
