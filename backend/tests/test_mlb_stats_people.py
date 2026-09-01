import pytest
from app.providers.mlb_stats.people import (
    MlbStatsRequestError,
    fetch_game_log_splits,
    fetch_season_pitching,
    fetch_vs_pitcher_total,
    pick_best_person,
    search_person_id,
)


def test_pick_best_person_prefers_active_exact():
    people = [
        {"id": 1, "fullName": "James Wood", "active": False},
        {"id": 695578, "fullName": "James Wood", "active": True},
    ]
    assert pick_best_person(people, "James Wood")["id"] == 695578


def test_pick_best_person_prefers_active_jr_when_query_omits_jr():
    """DFS often drops Jr.; exact retired dad must not beat the active son."""
    people = [
        {"id": 124492, "fullName": "Bobby Witt", "active": False},
        {"id": 677951, "fullName": "Bobby Witt Jr.", "active": True},
    ]
    assert pick_best_person(people, "Bobby Witt")["id"] == 677951
    assert pick_best_person(people, "Bobby Witt Jr.")["id"] == 677951


def test_pick_best_person_prefers_active_jr_over_other_active_when_query_omits_jr():
    people = [
        {"id": 472610, "fullName": "Luis García", "active": True},
        {"id": 671277, "fullName": "Luis García Jr.", "active": True},
        {"id": 677651, "fullName": "Luis Garcia", "active": True},
    ]
    assert pick_best_person(people, "Luis Garcia")["id"] == 671277


@pytest.mark.asyncio
async def test_search_person_id_reads_people(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"people": [{"id": 641793, "fullName": "Zack Littell", "active": True}]}

    class FakeClient:
        async def get(self, url, params=None):
            assert "people/search" in url
            return FakeResp()

    assert await search_person_id(FakeClient(), "Zack Littell") == 641793


@pytest.mark.asyncio
async def test_search_person_id_raise_on_error_signals_outage():
    class FakeClient:
        async def get(self, url, params=None):
            raise RuntimeError("timeout")

    assert await search_person_id(FakeClient(), "Zack Littell") is None
    with pytest.raises(MlbStatsRequestError):
        await search_person_id(FakeClient(), "Zack Littell", raise_on_error=True)


@pytest.mark.asyncio
async def test_fetch_season_pitching_maps_fields():
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "stats": [
                    {
                        "splits": [
                            {
                                "stat": {
                                    "wins": 7,
                                    "losses": 8,
                                    "era": "4.97",
                                    "inningsPitched": "112.1",
                                    "strikeOuts": 70,
                                    "whip": "1.34",
                                    "strikeoutsPer9Inn": "5.61",
                                    "walksPer9Inn": "2.40",
                                    "strikeoutWalkRatio": "2.33",
                                }
                            }
                        ]
                    }
                ]
            }

    class FakeClient:
        async def get(self, url, params=None):
            return FakeResp()

    stats = await fetch_season_pitching(FakeClient(), 641793, 2026)
    assert stats["wins"] == 7
    assert stats["innings_pitched"] == "112.1"
    assert stats["strikeouts"] == 70
    assert stats["k_per_9"] == "5.61"
    assert stats["bb_per_9"] == "2.40"
    assert stats["strikeout_walk_ratio"] == "2.33"


@pytest.mark.asyncio
async def test_fetch_vs_pitcher_total_maps_fields():
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "stats": [
                    {
                        "splits": [
                            {
                                "stat": {
                                    "atBats": 10,
                                    "hits": 3,
                                    "homeRuns": 1,
                                    "avg": ".300",
                                }
                            }
                        ]
                    }
                ]
            }

    class FakeClient:
        async def get(self, url, params=None):
            return FakeResp()

    stats = await fetch_vs_pitcher_total(FakeClient(), 695578, 554430)
    assert stats == {"ab": 10, "h": 3, "hr": 1, "avg": ".300"}


@pytest.mark.asyncio
async def test_fetch_vs_pitcher_total_empty_splits_returns_none():
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"stats": [{"splits": []}]}

    class FakeClient:
        async def get(self, url, params=None):
            return FakeResp()

    assert await fetch_vs_pitcher_total(FakeClient(), 1, 2) is None


@pytest.mark.asyncio
async def test_fetch_game_log_splits_returns_splits():
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "stats": [
                    {
                        "splits": [
                            {"stat": {"hits": 2, "plateAppearances": 4}},
                            {"stat": {"hits": 0, "plateAppearances": 3}},
                        ]
                    }
                ]
            }

    class FakeClient:
        async def get(self, url, params=None):
            assert url.endswith("/people/695578/stats")
            assert params == {
                "stats": "gameLog",
                "group": "hitting",
                "season": 2026,
                "sportId": 1,
            }
            return FakeResp()

    splits = await fetch_game_log_splits(FakeClient(), 695578, 2026, "hitting")
    assert len(splits) == 2
    assert splits[0]["stat"]["hits"] == 2


@pytest.mark.asyncio
async def test_fetch_game_log_splits_failure_raises():
    class FakeClient:
        async def get(self, url, params=None):
            raise RuntimeError("timeout")

    with pytest.raises(MlbStatsRequestError):
        await fetch_game_log_splits(FakeClient(), 1, 2026, "pitching")
