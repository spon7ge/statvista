"""NFL Underdog sport mapping. No live network."""

from __future__ import annotations

import os

from src.scrapers.nfl import nfl_underdog as ud


def test_default_allowlist_is_nfl() -> None:
    assert ud._DEFAULT_CONFIG["sport_allowlist"] == ["NFL"]
    assert ud.get_sport_allowlist({}) == frozenset({"NFL"})


def test_sport_to_league_maps_nfl_only() -> None:
    assert ud.sport_to_league("NFL") == "nfl"
    assert ud.sport_to_league(" nfl ") == "nfl"
    assert ud.sport_to_league("NBA") is None
    assert ud.sport_to_league("MLB") is None
    assert ud.sport_to_league("") is None


def test_output_dir_is_nfl_underdogs() -> None:
    assert ud._DEFAULT_OUTPUT_DIR.endswith(os.path.join("underdogs", "nfl"))
