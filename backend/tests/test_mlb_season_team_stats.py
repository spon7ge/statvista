import pytest
from app.providers.mlb_stats.team_season import clear_team_season_cache, fetch_season_team_stats_pair, fetch_team_season_stat_line, parse_hitting_split, parse_pitching_split

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
