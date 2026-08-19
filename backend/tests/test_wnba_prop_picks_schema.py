from app.domains.wnba.schemas_prop_picks import (
    WnbaPropBooksMain,
    WnbaPropPicksResponse,
    WnbaPropRow,
)

EXPECTED_BOOKS_MAIN = (
    "prophetx",
    "novig",
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
    "pinnacle",
)


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


def test_wnba_prop_books_main_fields_match_mlb_set():
    assert tuple(WnbaPropBooksMain.model_fields.keys()) == EXPECTED_BOOKS_MAIN


def test_wnba_prop_row_includes_books_main():
    assert "books_main" in WnbaPropRow.model_fields
