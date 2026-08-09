import pytest
from app.providers.mlb_stats.team_season import (
    build_season_pair_from_league_splits,
    clear_team_season_cache,
    competition_rank,
    fetch_season_team_stats_pair,
    fetch_team_season_stat_line,
    parse_hitting_split,
    parse_pitching_split,
)

class FakeResponse:
    def __init__(self, payload): self.payload = payload
    def raise_for_status(self): return None
    def json(self): return self.payload

def response(stat): return FakeResponse({"stats": [{"splits": [{"stat": stat}]}]})

def test_parse_hitting_and_pitching_splits():
    assert parse_hitting_split({"homeRuns": 146, "runs": 578, "hits": 1003, "avg": ".261", "obp": ".339", "slg": ".430"}) == {"hr": 146, "r": 578, "h": 1003, "avg": ".261", "obp": ".339", "slg": ".430"}
    assert parse_pitching_split({"era": "3.71", "strikeOuts": 1019, "baseOnBalls": 350}) == {"era": "3.71", "so": 1019, "bb": 350}

@pytest.mark.asyncio
async def test_fetch_team_season_stat_line_merges_groups_and_caches():
    class Client:
        def __init__(self): self.calls = []
        async def get(self, url, params):
            self.calls.append((url, params))
            return response({"homeRuns": 1, "runs": 2, "hits": 3, "avg": ".200", "obp": ".300", "slg": ".400"} if params["group"] == "hitting" else {"era": "4.00", "strikeOuts": 10, "baseOnBalls": 5})
    clear_team_season_cache(); client = Client()
    line = await fetch_team_season_stat_line(client, 119, 2026)
    assert await fetch_team_season_stat_line(client, 119, 2026) == line
    assert line["hr"] == 1 and line["era"] == "4.00" and line["so"] == 10
    assert len(client.calls) == 2 and client.calls[0][1] == {"stats": "season", "group": "hitting", "season": 2026, "sportIds": 1}

@pytest.mark.asyncio
async def test_fetch_team_season_stat_line_soft_fails_per_group():
    class Client:
        async def get(self, url, params):
            if params["group"] == "hitting": raise RuntimeError("unavailable")
            return response({"era": "4.00", "strikeOuts": 10, "baseOnBalls": 5})
    clear_team_season_cache()
    assert await fetch_team_season_stat_line(Client(), 119, 2026) == {"era": "4.00", "so": 10, "bb": 5}

@pytest.mark.asyncio
async def test_fetch_season_team_stats_pair_returns_none_when_empty():
    class Client:
        async def get(self, url, params): return FakeResponse({"stats": [{"splits": []}]})
    clear_team_season_cache()
    assert await fetch_season_team_stats_pair(Client(), away_team_id=119, home_team_id=147, season=2026) is None

@pytest.mark.asyncio
async def test_fetch_team_season_stat_line_does_not_cache_total_failure():
    class Client:
        def __init__(self): self.calls = []
        async def get(self, url, params):
            self.calls.append((url, params))
            raise RuntimeError("stats unavailable")
    clear_team_season_cache()
    client = Client()
    assert await fetch_team_season_stat_line(client, 119, 2026) == {}
    assert await fetch_team_season_stat_line(client, 119, 2026) == {}
    assert len(client.calls) == 4


def test_competition_rank_ties_skip():
    ranks = competition_rank(
        [(1, 10.0), (2, 20.0), (3, 20.0), (4, 5.0)],
        lower_is_better=False,
    )
    assert ranks == {2: 1, 3: 1, 1: 3, 4: 4}


def test_competition_rank_lower_better():
    ranks = competition_rank(
        [(1, 3.50), (2, 2.10), (3, 2.10)],
        lower_is_better=True,
    )
    assert ranks == {2: 1, 3: 1, 1: 3}


def test_build_season_pair_from_league_splits_assigns_ranks():
    hitting = [
        {"team": {"id": 119}, "stat": {"homeRuns": 100, "runs": 400, "hits": 800, "avg": ".250", "obp": ".320", "slg": ".400"}},
        {"team": {"id": 147}, "stat": {"homeRuns": 120, "runs": 450, "hits": 850, "avg": ".260", "obp": ".330", "slg": ".420"}},
        {"team": {"id": 111}, "stat": {"homeRuns": 90, "runs": 380, "hits": 780, "avg": ".240", "obp": ".310", "slg": ".390"}},
    ]
    pitching = [
        {"team": {"id": 119}, "stat": {"era": "3.50", "strikeOuts": 900, "baseOnBalls": 400}},
        {"team": {"id": 147}, "stat": {"era": "4.00", "strikeOuts": 850, "baseOnBalls": 420}},
        {"team": {"id": 111}, "stat": {"era": "3.20", "strikeOuts": 950, "baseOnBalls": 380}},
    ]
    pair = build_season_pair_from_league_splits(
        hitting, pitching, away_team_id=119, home_team_id=147
    )
    assert pair is not None
    assert pair.away.hr == 100
    assert pair.home.hr == 120
    assert pair.home.hr_rank == 1
    assert pair.away.hr_rank == 2
    assert pair.away.era_rank == 2
    assert pair.home.era_rank == 3
