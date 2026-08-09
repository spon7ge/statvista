"""MlbPropBooks field set for Odds API + scraper books."""

from __future__ import annotations

from app.domains.mlb.schemas_props import MlbPropBooks

EXPECTED_BOOKS = (
    "prophetx",
    "novig",
    "kalshi",
    "draftkings",
    "fanduel",
    "pinnacle",
    "betmgm",
    "betonline",
)

REMOVED_BOOKS = (
    "caesars",
    "bet365",
    "fanatics",
    "hardrock",
    "fliff",
)


def test_mlb_prop_books_fields_match_odds_api_set():
    fields = set(MlbPropBooks.model_fields)
    assert fields == set(EXPECTED_BOOKS)
    for removed in REMOVED_BOOKS:
        assert removed not in fields
