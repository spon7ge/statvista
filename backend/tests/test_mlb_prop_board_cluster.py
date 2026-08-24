from app.domains.mlb.prop_board_cluster import (
    BoardQuote,
    cluster_quotes,
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


def test_ip_uses_prophetx_over_draftkings():
    cluster = cluster_quotes(
        [
            _q(book="draftkings", over_american=100, under_american=-120),
            _q(book="prophetx", over_american=-150, under_american=130),
        ]
    )[0]
    over = ip_pct_for_side(cluster, "over")
    under = ip_pct_for_side(cluster, "under")
    assert over is not None and under is not None
    assert over + under == 100


def test_dfs_only_cluster_has_null_ip():
    cluster = cluster_quotes(
        [_q(book="prizepicks", over_american=None, under_american=None)]
    )[0]
    assert ip_pct_for_side(cluster, "over") is None
