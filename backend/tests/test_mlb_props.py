from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import props as svc
from app.main import app
from app.providers.espn.wnba_roster import norm_player_name

FIXTURE = Path(__file__).parent / "fixtures" / "parlay_mlb_props_minimal.json"


def _parlay_rows() -> list[dict]:
    return json.loads(FIXTURE.read_text())


async def _async_return(value):
    return value


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _stub_snapshots(
    monkeypatch,
    *,
    dfs_pp: list[dict] | None = None,
    dfs_ud: list[dict] | None = None,
    prophetx: list[dict] | None = None,
    pinnacle: list[dict] | None = None,
    parlay_rows: list[dict] | None = None,
    parlay_error: Exception | None = None,
):
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="mlb": dfs_pp or [])
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="mlb": dfs_ud or [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="mlb": prophetx or [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="mlb": pinnacle or [])

    async def fake_fetch_parlay():
        if parlay_error is not None:
            raise parlay_error
        return parlay_rows or []

    monkeypatch.setattr(svc, "_fetch_parlay_rows", fake_fetch_parlay)


def test_assemble_ranks_consensus_above_no_read(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now - timedelta(minutes=5),
            },
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now - timedelta(minutes=5),
            },
        ],
        prophetx=[
            {
                "player_name": "Aaron Judge",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now - timedelta(minutes=4),
            },
        ],
        parlay_rows=_parlay_rows(),  # Novig/FD/DK Judge TB 1.5 over -125/-128
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    assert len(response.props) == 2
    assert response.props[0].player_name == "Aaron Judge"
    assert response.props[0].source_tier == "sharp_consensus"
    assert response.props[0].recommended_side == "over"
    assert response.props[0].fair_pct is not None
    assert response.props[0].books.prophetx is not None
    assert response.props[0].books.novig is not None

    assert response.props[-1].player_name == "Mookie Betts"
    assert response.props[-1].source_tier == "no_sharp_read"
    assert response.props[-1].fair_pct is None
    assert response.props[-1].edge_pct is None


def test_exact_line_mismatch_omits_book(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[
            # ProphetX only quotes the 2.5 line; must not attach to the 1.5 DFS row.
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 2.5,
                "side": "over",
                "american_price": -110,
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    assert len(response.props) == 1
    row = response.props[0]
    assert row.line == 1.5
    assert row.books.prophetx is None
    assert row.source_tier == "no_sharp_read"


def test_exact_line_attaches_prophetx_alt_when_favourite_differs(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 2.5,
                "side": "over",
                "american_price": -105,
                "is_main": True,
                "scraped_at": now,
            },
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "is_main": False,
                "scraped_at": now,
            },
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "under",
                "american_price": 110,
                "is_main": False,
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(
        svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    )

    assert len(response.props) == 1
    row = response.props[0]
    assert row.line == 1.5
    assert row.books.prophetx is not None
    assert row.books.prophetx.american == -130
    assert row.source_tier != "no_sharp_read"


def test_exact_line_attaches_parlay_alternate_market_key(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[],  # force fair via Parlay Novig only
        parlay_rows=[
            {
                "player": "Mookie Betts",
                "market_key": "player_total_bases",
                "line": 2.5,
                "bookmaker": "novig",
                "over_price": -110,
                "under_price": -110,
            },
            {
                "player": "Mookie Betts",
                "market_key": "player_total_bases_alternate",
                "line": 1.5,
                "bookmaker": "novig",
                "over_price": -130,
                "under_price": 110,
            },
            {
                "player": "Mookie Betts",
                "market_key": "player_total_bases_alternate",
                "line": 0.5,
                "bookmaker": "novig",
                "over_price": -200,
                "under_price": 160,
            },
        ],
    )

    import asyncio

    response = asyncio.run(
        svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    )

    assert len(response.props) == 1
    row = response.props[0]
    assert row.line == 1.5
    assert row.books.novig is not None
    assert row.books.novig.american == -130
    assert row.source_tier == "sharp_single_source"
    assert row.fair_pct is not None


def test_pinnacle_only_drives_soft_consensus(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        pinnacle=[
            {
                "player_name": "Mookie Betts",
                "market_type": "player_total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    row = response.props[0]
    assert row.books.pinnacle is not None
    assert row.books.pinnacle.role == "comparison"
    assert row.source_tier == "soft_consensus"
    assert row.fair_pct is not None
    assert row.edge_pct is not None


def test_soft_parlay_cmp_only_drives_soft_consensus(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        parlay_rows=[
            {
                "bookmaker": "caesars",
                "player": "Mookie Betts",
                "market_key": "player_total_bases",
                "line": 1.5,
                "over_price": -135,
                "under_price": 110,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    row = response.props[0]
    assert row.source_tier == "soft_consensus"
    assert row.fair_pct is not None
    assert row.edge_pct is not None
    assert row.books.caesars is not None
    assert row.books.caesars.role == "comparison"


def test_prophetx_beats_soft_books(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now,
            },
        ],
        pinnacle=[
            {
                "player_name": "Mookie Betts",
                "market_type": "player_total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
            },
        ],
        parlay_rows=[
            {
                "bookmaker": "caesars",
                "player": "Mookie Betts",
                "market_key": "player_total_bases",
                "line": 1.5,
                "over_price": -135,
                "under_price": 110,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    row = response.props[0]
    assert row.source_tier.startswith("sharp_")
    assert row.books.pinnacle is not None
    assert row.books.pinnacle.role == "comparison"
    assert row.books.caesars is not None
    assert row.books.caesars.role == "comparison"


def test_underdog_uses_stored_side_only(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_ud=[
            {
                "player_name": "Paul Skenes",
                "stat_name": "strikeouts",
                "line_score": 6.5,
                "side": "over",
                "american_price": -150,
                "payout_multiplier": 1.05,
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="underdog", format="standard", legs=3))

    assert len(response.props) == 1
    assert response.props[0].recommended_side == "over"
    assert response.props[0].dfs.line == 6.5
    assert response.props[0].dfs.american == -150
    assert response.props[0].dfs.payout_multiplier == 1.05


def test_underdog_dfs_quote_matches_recommended_side(monkeypatch):
    """When both sides exist at a line, dfs quote follows recommended_side."""
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_ud=[
            {
                "player_name": "Aaron Judge",
                "stat_name": "total bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -110,
                "payout_multiplier": 1.0,
                "scraped_at": now,
            },
            {
                "player_name": "Aaron Judge",
                "stat_name": "total bases",
                "line_score": 1.5,
                "side": "under",
                "american_price": 120,
                "payout_multiplier": 0.91,
                "scraped_at": now,
            },
        ],
        prophetx=[
            {
                "player_name": "Aaron Judge",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -140,
                "scraped_at": now,
            },
            {
                "player_name": "Aaron Judge",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "under",
                "american_price": 150,
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="underdog", format="standard", legs=3))
    assert len(response.props) == 1
    row = response.props[0]
    assert row.recommended_side in ("over", "under")
    if row.recommended_side == "over":
        assert row.dfs.american == -110
        assert row.dfs.payout_multiplier == 1.0
    else:
        assert row.dfs.american == 120
        assert row.dfs.payout_multiplier == 0.91


def test_mid_tier_fallback_recency_chip_uses_dk_fd_timestamps():
    """recency_chip must reflect DK/FD changed_at when fair is DK/FD-driven.

    Regression test: previously ``_assemble_rows`` only looked at
    ProphetX/Novig ``changed_at`` for the recency chip, so ``mid_tier_fallback``
    rows (fair driven by DraftKings/FanDuel alone) always got ``recency_chip =
    None`` even when the DK/FD quotes were fresh and the DFS line was stale.
    """
    now = datetime.now(timezone.utc)
    board = {
        ("aaron judge", "total_bases", 1.5): {
            "player_name": "Aaron Judge",
            "stat": "Total Bases",
            "line": 1.5,
            "sides": {"over", "under"},
            "scraped_at": now - timedelta(minutes=41),
        },
    }
    dk_hit = {"american": -130, "changed_at": now - timedelta(minutes=4)}
    fd_hit = {"american": -125, "changed_at": now - timedelta(minutes=4)}
    parlay_by_book = {
        "novig": {},
        "draftkings": {("aaron judge", "total_bases", "over", 1.5): dk_hit},
        "fanduel": {("aaron judge", "total_bases", "over", 1.5): fd_hit},
    }

    rows = svc._assemble_rows(
        board,
        breakeven=52.4,
        prophetx_idx={},
        pinnacle_idx={},
        parlay_by_book=parlay_by_book,
        now=now,
    )

    assert len(rows) == 1
    row = rows[0]
    assert row.source_tier == "mid_tier_fallback"
    assert row.recency_chip == "fresh_sharp_vs_stale_dfs"


def test_parlay_failure_still_returns_dfs_and_prophetx(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[
            {
                "player_name": "Aaron Judge",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now,
            },
        ],
        parlay_error=RuntimeError("parlay down"),
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    assert response.error == "parlay down"
    assert len(response.props) == 1
    assert response.props[0].books.novig is None
    assert response.props[0].books.prophetx is not None
    assert response.props[0].source_tier == "sharp_single_source"


def test_prizepicks_ignores_non_standard_odds_type(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "demon",
                "scraped_at": now,
            },
        ],
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    assert response.props == []


def test_response_is_cached_within_ttl(monkeypatch):
    now = datetime.now(timezone.utc)
    calls = {"count": 0}

    def fake_pp(league="mlb"):
        calls["count"] += 1
        return [
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ]

    monkeypatch.setattr(svc, "fetch_latest_prizepicks", fake_pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="mlb": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="mlb": [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="mlb": [])
    monkeypatch.setattr(svc, "_fetch_parlay_rows", lambda: _async_return([]))

    import asyncio

    first = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))
    second = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    assert calls["count"] == 1
    assert first is second


def test_validate_query_rejects_mismatched_app_format():
    with pytest.raises(ValueError):
        svc.validate_query("prizepicks", "standard", 4)
    with pytest.raises(ValueError):
        svc.validate_query("underdog", "power", 4)
    with pytest.raises(ValueError):
        svc.validate_query("draftkings", "power", 4)


def test_route_validation_legs(client):
    r = client.get("/api/mlb/props/today", params={"app": "prizepicks", "format": "power", "legs": 1})
    assert r.status_code == 422


def test_route_validation_app_format_mismatch(client):
    r = client.get(
        "/api/mlb/props/today", params={"app": "prizepicks", "format": "standard", "legs": 4}
    )
    assert r.status_code == 422


def test_props_attach_roster_enrichment(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now - timedelta(minutes=5),
            },
        ],
        prophetx=[
            {
                "player_name": "Aaron Judge",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now - timedelta(minutes=4),
            },
        ],
        parlay_rows=_parlay_rows(),
    )

    async def fake_index():
        return {
            norm_player_name("Aaron Judge"): {
                "espn_id": "33192",
                "position": "RF",
                "team_abbrev": "NYY",
                "headshot_url": "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
            }
        }

    monkeypatch.setattr(svc, "get_mlb_player_index", fake_index)

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))
    judge = next(r for r in response.props if r.player_name == "Aaron Judge")
    assert judge.position == "RF"
    assert judge.team_abbrev == "NYY"
    assert judge.headshot_url and "33192" in judge.headshot_url


def test_props_survive_roster_index_failure(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
    )

    async def boom():
        raise RuntimeError("espn down")

    monkeypatch.setattr(svc, "get_mlb_player_index", boom)

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))
    assert response.props
    assert all(r.headshot_url is None for r in response.props)


def test_route_success_sets_no_store(client, monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
    )
    r = client.get(
        "/api/mlb/props/today", params={"app": "prizepicks", "format": "power", "legs": 4}
    )
    assert r.status_code == 200
    assert r.headers.get("cache-control") == "no-store"
    body = r.json()
    assert body["app"] == "prizepicks"
    assert body["legs"] == 4
    assert len(body["props"]) == 1
    assert body["props"][0]["player_name"] == "Aaron Judge"
