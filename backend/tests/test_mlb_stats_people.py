import pytest
from app.services.mlb_stats_people import (
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
