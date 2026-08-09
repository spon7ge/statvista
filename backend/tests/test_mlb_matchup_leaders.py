import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.matchup_leaders import (
    fetch_matchup_leaders,
    intersect_category_with_rosters,
    select_matchup_leader_specs,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_select_matchup_leader_specs_six_keys():
    specs = select_matchup_leader_specs()
    assert [s[0] for s in specs] == ["hr", "avg", "ops", "era", "so", "whip"]


def test_intersect_category_keeps_top_three_roster_hits():
    category = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="1", name="A", team_abbrev="NYY", gp=10, value="30"),
            MlbLeaderRow(rank=2, player_id="2", name="B", team_abbrev="LAD", gp=10, value="28"),
            MlbLeaderRow(rank=3, player_id="3", name="C", team_abbrev="BOS", gp=10, value="27"),
            MlbLeaderRow(rank=4, player_id="4", name="D", team_abbrev="LAD", gp=10, value="26"),
            MlbLeaderRow(rank=5, player_id="5", name="E", team_abbrev="NYY", gp=10, value="25"),
        ],
    )
    out = intersect_category_with_rosters(
        category,
        away_ids={"2", "4"},
        home_ids={"5"},
        away_abbrev="LAD",
        home_abbrev="NYY",
    )
    assert out.key == "hr"
    assert out.label == "HR"
    assert [e.player_id for e in out.leaders] == ["2", "4", "5"]
    assert [e.side for e in out.leaders] == ["away", "away", "home"]
    assert out.leaders[0].rank == 2


def test_intersect_empty_when_no_overlap():
    category = MlbLeaderCategory(
        key="avg",
        label="Batting Average",
        stat="AVG",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value=".340"),
        ],
    )
    out = intersect_category_with_rosters(
        category,
        away_ids={"1"},
        home_ids={"2"},
        away_abbrev="LAD",
        home_abbrev="NYY",
    )
    assert out.leaders == []


@pytest.mark.asyncio
async def test_fetch_matchup_leaders_soft_fails_single_category_fetch():
    avg_payload = json.loads((FIXTURES / "statsapi_mlb_leaders_avg.json").read_text())
    empty_payload = {"stats": [{"splits": []}]}

    async def fake_roster(_client, team_id, _season):
        return {"670541"} if team_id == 119 else set()

    async def fake_team_map(_client, _season):
        return {117: "HOU"}

    async def fake_category(_client, sort_stat, _group, _order, _season):
        if sort_stat == "homeRuns":
            raise RuntimeError("hr board unavailable")
        if sort_stat == "avg":
            return avg_payload
        return empty_payload

    with (
        patch(
            "app.providers.mlb_stats.matchup_leaders.fetch_active_roster_player_ids",
            side_effect=fake_roster,
        ),
        patch(
            "app.providers.mlb_stats.matchup_leaders.fetch_team_abbrev_map",
            side_effect=fake_team_map,
        ),
        patch(
            "app.providers.mlb_stats.matchup_leaders.fetch_category_payload",
            side_effect=fake_category,
        ),
    ):
        result = await fetch_matchup_leaders(
            client=AsyncMock(),
            away_team_id=119,
            home_team_id=147,
            away_abbrev="LAD",
            home_abbrev="NYY",
            season=2026,
        )

    assert result is not None
    assert [c.key for c in result.categories] == ["hr", "avg", "ops", "era", "so", "whip"]
    hr = next(c for c in result.categories if c.key == "hr")
    avg = next(c for c in result.categories if c.key == "avg")
    assert hr.leaders == []
    assert len(avg.leaders) == 1
    assert avg.leaders[0].player_id == "670541"
