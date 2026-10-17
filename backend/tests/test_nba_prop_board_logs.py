from datetime import date

import pytest

from app.domains.nba import prop_board_logs as logs


def test_current_nba_season_october_uses_new_start_year(monkeypatch):
    monkeypatch.setattr(logs, "_today", lambda: date(2026, 10, 16))
    assert logs.current_nba_season() == "2026-27"


def test_current_nba_season_january_uses_prior_start_year(monkeypatch):
    monkeypatch.setattr(logs, "_today", lambda: date(2027, 1, 5))
    assert logs.current_nba_season() == "2026-27"


@pytest.mark.asyncio
async def test_fetch_playergamelog_uses_nba_league_id(monkeypatch):
    captured = {}

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"resultSets": []}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def get(self, url, params=None):
            captured["url"] = url
            captured["params"] = params
            return FakeResp()

    monkeypatch.setattr(logs.httpx, "AsyncClient", lambda **kw: FakeClient())
    await logs.fetch_playergamelog("1628369", "2026-27")
    assert "stats.nba.com" in captured["url"]
    assert captured["params"]["LeagueID"] == "00"
    assert captured["params"]["Season"] == "2026-27"
