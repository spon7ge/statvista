"""MlbPropBooks field set for Parlay + Supabase scraper books."""

from __future__ import annotations

from app.domains.mlb.schemas_props import MlbPropBooks, MlbPropBooksMain, MlbPropRow

EXPECTED_BOOKS = ("prophetx", "novig", "draftkings", "fanduel", "pinnacle")
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

# Exact-line fair/edge books stay DK/FD + scrapers; cmp Parlay books are books_main only.
REMOVED_FROM_EXACT_BOOKS = (
    "kalshi",
    "betmgm",
    "betonline",
    "caesars",
    "bet365",
    "fanatics",
    "hardrock",
    "fliff",
)


def test_mlb_prop_books_fields_match_parlay_supabase_set():
    assert tuple(MlbPropBooks.model_fields.keys()) == EXPECTED_BOOKS
    for removed in REMOVED_FROM_EXACT_BOOKS:
        assert removed not in MlbPropBooks.model_fields


def test_mlb_prop_books_main_fields_match_book_set():
    assert tuple(MlbPropBooksMain.model_fields.keys()) == EXPECTED_BOOKS_MAIN


def test_mlb_prop_row_includes_books_main():
    assert "books_main" in MlbPropRow.model_fields
