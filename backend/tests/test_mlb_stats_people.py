import pytest
from app.providers.mlb_stats.people import (
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
