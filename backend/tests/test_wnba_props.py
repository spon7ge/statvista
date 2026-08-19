from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.domains.wnba import props as svc
from app.domains.wnba.schemas_prop_picks import WnbaPropPicksResponse
from app.main import app
from app.providers.parlay.wnba_board import ParlayWnbaNormalized


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


client = TestClient(app)


def test_props_today_422_on_bad_format():
    res = client.get(
        "/api/wnba/props/today",
        params={"app": "prizepicks", "format": "standard", "legs": 4},
    )
    assert res.status_code == 422


def test_props_today_requires_query():
    res = client.get("/api/wnba/props/today")
    assert res.status_code == 422


def test_props_today_success_sets_no_store(monkeypatch):
    from app.domains.wnba import routes as wnba_routes

    async def fake_get(*, app: str, format: str, legs: int) -> WnbaPropPicksResponse:
        return WnbaPropPicksResponse(
            as_of="2026-08-11T20:00:00+00:00",
            app=app,
            format=format,
            legs=legs,
            breakeven_pct=50.0,
            props=[],
        )

    monkeypatch.setattr(wnba_routes, "get_wnba_props_today", fake_get)
    res = client.get(
        "/api/wnba/props/today",
        params={"app": "prizepicks", "format": "power", "legs": 4},
    )
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    body = res.json()
    assert body["app"] == "prizepicks"
    assert body["format"] == "power"
    assert body["legs"] == 4
    assert body["props"] == []


def test_validate_query_rejects_wrong_format():
    with pytest.raises(ValueError):
        svc.validate_query("prizepicks", "standard", 4)


@pytest.mark.asyncio
async def test_prizepicks_board_from_supabase_not_parlay(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    pp = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[
                {
                    "player_name": "Wrong Player",
                    "stat_type": "points",
                    "line_score": 99.5,
                    "odds_type": "standard",
                    "scraped_at": now,
                }
            ],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    assert out.props[0].player_name == "Caitlin Clark"
    assert out.error is None


@pytest.mark.asyncio
async def test_exact_line_only_and_px_novig_set_fair(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    board = [{
        "player_name": "Caitlin Clark",
        "stat_type": "points",
        "line_score": 19.5,
        "odds_type": "standard",
        "scraped_at": now,
        "commence_time": "2026-08-11T23:00:00Z",
    }]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": board)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_prophetx",
        lambda league="wnba", **_kw: [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
            },
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 22.5,
                "side": "over",
                "american_price": -110,
                "scraped_at": now,
            },
        ],
    )
    monkeypatch.setattr(
        svc,
        "fetch_latest_novig",
        lambda league="wnba", **_kw: [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now,
            }
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    row = out.props[0]
    assert row.source_tier == "sharp_consensus"
    assert row.fair_pct is not None
    assert row.books.prophetx is not None
    assert row.commence_time == "2026-08-11T23:00:00Z"
    # 22.5 is not the DFS line — must not attach
    assert row.line == 19.5


@pytest.mark.asyncio
async def test_empty_seed_sets_error(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[
                {
                    "player_name": "Wrong Player",
                    "stat_type": "points",
                    "line_score": 99.5,
                    "odds_type": "standard",
                    "scraped_at": now,
                }
            ],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert out.props == []
    assert out.error == "prizepicks_unavailable"


@pytest.mark.asyncio
async def test_empty_underdog_seed_sets_underdog_unavailable(monkeypatch):
    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=None,
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="underdog", format="standard", legs=4)
    assert out.props == []
    assert out.error == "underdog_unavailable"


@pytest.mark.asyncio
async def test_league_roster_index_attaches_team_and_headshot(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    board = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    async def fake_roster():
        return {
            "caitlin clark": {
                "espn_id": "4433403",
                "position": "G",
                "team_abbrev": "IND",
                "headshot_url": (
                    "https://a.espncdn.com/i/headshots/wnba/players/full/4433403.png"
                ),
            }
        }

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": board)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])
    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    row = out.props[0]
    assert row.team_abbrev == "IND"
    assert row.position == "G"
    assert (
        row.headshot_url
        == "https://a.espncdn.com/i/headshots/wnba/players/full/4433403.png"
    )


@pytest.mark.asyncio
async def test_no_sharp_read_sorts_last(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    board = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
        {
            "player_name": "A'ja Wilson",
            "stat_type": "points",
            "line_score": 22.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": board)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_prophetx",
        lambda league="wnba", **_kw: [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
            },
        ],
    )
    monkeypatch.setattr(
        svc,
        "fetch_latest_novig",
        lambda league="wnba", **_kw: [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now,
            }
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 2
    assert out.props[0].player_name == "Caitlin Clark"
    assert out.props[0].source_tier == "sharp_consensus"
    assert out.props[-1].player_name == "A'ja Wilson"
    assert out.props[-1].source_tier == "no_sharp_read"


@pytest.mark.asyncio
async def test_mismatched_pinnacle_line_omitted(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    board = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=now.isoformat(),
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": board)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_pinnacle",
        lambda league="wnba": [
            {
                "player_name": "Caitlin Clark",
                "market_type": "player_total_points",
                "line_score": 22.5,
                "side": "over",
                "american_price": -110,
                "scraped_at": now,
            },
        ],
    )
    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    row = out.props[0]
    assert row.line == 19.5
    assert row.books.pinnacle is None
    assert row.source_tier == "no_sharp_read"


@pytest.mark.asyncio
async def test_books_main_attaches_main_quotes(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    pp = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "points",
            "line_score": 19.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=None,
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_prophetx",
        lambda league="wnba", mains_only=False, **_kw: [
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 20.5,
                "side": "over",
                "american_price": -115,
                "scraped_at": now,
                "is_main": True,
            },
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 20.5,
                "side": "under",
                "american_price": -105,
                "scraped_at": now,
                "is_main": True,
            },
            {
                "player_name": "Caitlin Clark",
                "stat_name": "points",
                "line_score": 19.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
                "is_main": False,
            },
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    main = out.props[0].books_main.prophetx
    assert main is not None
    assert main.line == 20.5
    assert main.over_american == -115
    assert main.under_american == -105
