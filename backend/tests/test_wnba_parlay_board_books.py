from app.providers.parlay import wnba_board as board

EXPECTED_SCHEMA_BOOKS = (
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
)


def test_wnba_parlay_schema_book_keys_match_mlb_cmp_set():
    assert board._SCHEMA_BOOK_KEYS == EXPECTED_SCHEMA_BOOKS
    for book in EXPECTED_SCHEMA_BOOKS:
        assert book in board._ALLOWED_BOOKS
    assert "prizepicks" in board._ALLOWED_BOOKS
