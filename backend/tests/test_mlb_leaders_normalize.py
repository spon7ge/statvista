import asyncio
import json
from pathlib import Path

from app.domains.mlb.leaders import (
    CATEGORY_SPECS,
    assemble_mlb_leaders,
    fetch_team_abbrev_map,
    normalize_category_payload,
)

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {117: "HOU", 139: "TB"}


def test_category_specs_order_and_whip_key():
    keys = [c[0] for c in CATEGORY_SPECS]
    assert keys == [
        "avg",
        "hr",
        "rbi",
        "sb",
        "ops",
        "hits",
        "era",
        "whip",
        "so",
        "w",
        "sv",
        "ip",
    ]
    whip = next(c for c in CATEGORY_SPECS if c[0] == "whip")
    assert whip[3] == "walksAndHitsPerInningPitched"
    assert whip[4] == "pitching"
    for _k, _l, _s, _cat, group in CATEGORY_SPECS:
        assert group in ("hitting", "pitching")


def test_normalize_hr_maps_team_and_null_gp():
    payload = json.loads((FIXTURES / "statsapi_mlb_leaders_hr.json").read_text())
    cat = normalize_category_payload(
        payload, key="hr", label="Home Runs", stat="HR", team_id_to_abbrev=TEAM_MAP
    )
    assert cat.key == "hr"
    assert cat.leaders[0].name == "Yordan Alvarez"
    assert cat.leaders[0].team_abbrev == "HOU"
    assert cat.leaders[0].gp is None
    assert cat.leaders[0].value == "35"
    assert cat.leaders[0].player_id == "670541"


def test_normalize_preserves_avg_string():
    payload = json.loads((FIXTURES / "statsapi_mlb_leaders_avg.json").read_text())
    cat = normalize_category_payload(
        payload,
        key="avg",
        label="Batting Average",
        stat="AVG",
        team_id_to_abbrev=TEAM_MAP,
    )
    assert cat.leaders[0].value == ".328"


def test_assemble_sets_pace_season():
    payload = json.loads((FIXTURES / "statsapi_mlb_leaders_hr.json").read_text())
    hr = normalize_category_payload(
        payload, key="hr", label="Home Runs", stat="HR", team_id_to_abbrev=TEAM_MAP
    )
    resp = assemble_mlb_leaders([hr], season=2026)
    assert resp.pace == "season"
    assert resp.season == 2026


def test_fetch_team_abbrev_map_canonicalizes_statsapi_aliases():
    class FakeResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict:
            return {"teams": [{"id": 109, "abbreviation": "AZ"}]}

    class FakeClient:
        async def get(self, *_args, **_kwargs) -> FakeResponse:
            return FakeResponse()

    result = asyncio.run(fetch_team_abbrev_map(FakeClient(), season=2026))

    assert result == {109: "ARI"}
