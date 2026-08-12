from app.domains.wnba.schemas_prop_picks import WnbaPropPicksResponse, WnbaPropRow


def test_board_row_includes_commence_time():
    row = WnbaPropRow(
        player_name="Caitlin Clark",
        stat="Points",
        line=19.5,
        source_tier="no_sharp_read",
        dfs={"line": 19.5},
        fair_explain="No Tier 1/2/3 books available.",
        commence_time="2026-08-11T23:00:00Z",
    )
    assert row.commence_time == "2026-08-11T23:00:00Z"
    body = WnbaPropPicksResponse(
        as_of="2026-08-11T20:00:00Z",
        app="prizepicks",
        format="power",
        legs=4,
        breakeven_pct=56.234,
        props=[row],
    )
    assert body.props[0].books.pinnacle is None
