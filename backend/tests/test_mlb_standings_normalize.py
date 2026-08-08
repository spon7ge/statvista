from __future__ import annotations

import json
from pathlib import Path

from app.domains.mlb.standings import normalize_mlb_standings

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {
    139: "TB",
    142: "MIN",
    117: "HOU",
    143: "PHI",
    158: "MIL",
    119: "LAD",
}


def _payload():
    return json.loads((FIXTURES / "mlb_standings_full_sample.json").read_text())


def test_normalize_orders_al_then_nl_with_six_divisions():
    result = normalize_mlb_standings(_payload(), TEAM_MAP)
    assert result.season == 2026
    assert [lg.key for lg in result.leagues] == ["al", "nl"]
    assert [lg.label for lg in result.leagues] == [
        "American League",
        "National League",
    ]
    assert [d.key for d in result.leagues[0].divisions] == [
        "al_east",
        "al_central",
        "al_west",
    ]
    assert [d.key for d in result.leagues[1].divisions] == [
        "nl_east",
        "nl_central",
        "nl_west",
    ]


def test_normalize_maps_core_columns_and_skips_broken_rows():
    result = normalize_mlb_standings(_payload(), TEAM_MAP)
    al_east = result.leagues[0].divisions[0]
    assert al_east.label == "AL East"
    assert len(al_east.teams) == 1
    row = al_east.teams[0]
    assert row.rank == 1
    assert row.team_id == "139"
    assert row.abbrev == "TB"
    assert row.name == "Rays"
    assert row.wl == "69-46"
    assert row.pct == ".600"
    assert row.gb == "-"
    assert row.l10 == "7-3"
    assert row.streak == "W4"
    assert row.logo_url is None


def test_normalize_requires_abbrev_from_map():
    result = normalize_mlb_standings(_payload(), {})
    assert result.leagues[0].divisions[0].teams == []
