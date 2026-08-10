"""MlbPropBooks field set for Parlay + Supabase scraper books."""

from __future__ import annotations

from app.domains.mlb.schemas_props import MlbPropBooks

EXPECTED = ("prophetx", "novig", "draftkings", "fanduel", "pinnacle")

REMOVED_BOOKS = (
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
    assert tuple(MlbPropBooks.model_fields.keys()) == EXPECTED
    for removed in REMOVED_BOOKS:
        assert removed not in MlbPropBooks.model_fields
