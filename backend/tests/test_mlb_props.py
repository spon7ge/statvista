from __future__ import annotations

import inspect
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import props as svc
from app.domains.mlb.schemas_props import MlbPropBooks
from app.main import app
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.parlay.mlb_props import ParlayMlbNormalized


async def _async_return(value):
    return value


def _side(
    player: str, stat: str, side: str, line: float, american: int, changed_at=None
) -> tuple[tuple, dict]:
    key = (player.strip().casefold(), stat, side, round(float(line), 2))
    return key, {"american": american, "changed_at": changed_at}


def _parlay(
    *,
    board: list[dict] | None = None,
    book_indexes: dict | None = None,
    as_of: str | None = None,
    unavailable: bool = False,
) -> ParlayMlbNormalized:
    return ParlayMlbNormalized(
        prizepicks_board=board or [],
        book_indexes=book_indexes or {},
        as_of=as_of,
        unavailable=unavailable,
    )


def _judge_parlay_indexes(now: datetime | None = None) -> dict:
    """DK/FD Judge total bases 1.5 — Parlay side indexes only."""
    fd_o, fd_oq = _side("Aaron Judge", "total_bases", "over", 1.5, -125, now)
    fd_u, fd_uq = _side("Aaron Judge", "total_bases", "under", 1.5, 105, now)
    dk_o, dk_oq = _side("Aaron Judge", "total_bases", "over", 1.5, -128, now)
    dk_u, dk_uq = _side("Aaron Judge", "total_bases", "under", 1.5, 108, now)
    return {
        "fanduel": {fd_o: fd_oq, fd_u: fd_uq},
        "draftkings": {dk_o: dk_oq, dk_u: dk_uq},
    }


def _judge_novig_snapshot(now: datetime | None = None) -> list[dict]:
    return [
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 1.5,
            "side": "over",
            "american_price": -130,
            "scraped_at": now,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 1.5,
            "side": "under",
            "american_price": 110,
            "scraped_at": now,
        },
    ]


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
    novig: list[dict] | None = None,
    pinnacle: list[dict] | None = None,
    parlay: ParlayMlbNormalized | None = None,
    parlay_error: Exception | None = None,
    parlay_soft_empty: bool = False,
):
    monkeypatch.setattr(
        svc,
        "fetch_latest_prizepicks",
        lambda league="mlb": dfs_pp or [],
        raising=False,
    )
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="mlb": dfs_ud or [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="mlb": prophetx or [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="mlb": novig or [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="mlb": pinnacle or [])

    async def fake_fetch_parlay(**_kwargs):
        if parlay_error is not None:
            raise parlay_error
        if parlay_soft_empty:
            return _parlay(unavailable=True)
        if parlay is not None:
            return parlay
        # Books only — no PrizePicks board on Parlay path
        return _parlay(book_indexes=_judge_parlay_indexes())

    monkeypatch.setattr(svc, "fetch_mlb_parlay_props_normalized", fake_fetch_parlay)


def test_props_module_does_not_import_odds_api():
    source = inspect.getsource(svc)
    assert "odds_api" not in source
    assert "fetch_mlb_props_normalized" not in source
    assert "odds_api_unavailable" not in source


def test_assemble_ranks_consensus_above_no_read(monkeypatch):
    now = datetime.now(timezone.utc)
    pp_board = [
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
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp_board,
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
        novig=_judge_novig_snapshot(now),
        parlay=_parlay(
            board=pp_board,
            book_indexes=_judge_parlay_indexes(now),
        ),
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


def test_expand_books_only_five_retained(monkeypatch):
    expected = ("prophetx", "novig", "draftkings", "fanduel", "pinnacle")
    assert tuple(MlbPropBooks.model_fields.keys()) == expected

    now = datetime.now(timezone.utc)
    pp_board = [
        {
            "player_name": "Mookie Betts",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp_board,
        parlay=_parlay(),
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    dumped = response.props[0].books.model_dump()
    assert set(dumped.keys()) == set(expected)
    for dropped in ("kalshi", "betmgm", "betonline", "caesars"):
        assert dropped not in MlbPropBooks.model_fields
        assert dropped not in dumped


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


def test_exact_line_attaches_novig_snapshot_alternate_line(monkeypatch):
    now = datetime.now(timezone.utc)
    pp_board = [
        {
            "player_name": "Mookie Betts",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp_board,
        parlay=_parlay(),
        prophetx=[],
        novig=[
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 2.5,
                "side": "over",
                "american_price": -110,
                "scraped_at": now,
            },
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "over",
                "american_price": -130,
                "scraped_at": now,
            },
            {
                "player_name": "Mookie Betts",
                "stat_name": "total_bases",
                "line_score": 1.5,
                "side": "under",
                "american_price": 110,
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
    assert row.books.novig is not None
    assert row.books.novig.american == -130
    assert row.source_tier == "sharp_single_source"
    assert row.fair_pct is not None


def test_pinnacle_only_does_not_drive_soft_consensus(monkeypatch):
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
    assert row.source_tier == "no_sharp_read"
    assert row.fair_pct is None
    assert row.edge_pct is None


def test_prophetx_beats_pinnacle_comparison(monkeypatch):
    now = datetime.now(timezone.utc)
    pp_board = [
        {
            "player_name": "Mookie Betts",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp_board,
        parlay=_parlay(),
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
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="prizepicks", format="power", legs=4))

    row = response.props[0]
    assert row.source_tier.startswith("sharp_")
    assert row.books.pinnacle is not None
    assert row.books.pinnacle.role == "comparison"


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

    assert response.error is None
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
    assert response.error is None
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
    """recency_chip must reflect DK/FD changed_at when fair is DK/FD-driven."""
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
    parlay_book_indexes = {
        "draftkings": {("aaron judge", "total_bases", "over", 1.5): dk_hit},
        "fanduel": {("aaron judge", "total_bases", "over", 1.5): fd_hit},
    }

    rows = svc._assemble_rows(
        board,
        breakeven=52.4,
        prophetx_idx={},
        novig_idx={},
        pinnacle_idx={},
        parlay_book_indexes=parlay_book_indexes,
        now=now,
    )

    assert len(rows) == 1
    row = rows[0]
    assert row.source_tier == "mid_tier_fallback"
    assert row.recency_chip == "fresh_sharp_vs_stale_dfs"


def test_parlay_failure_still_returns_underdog_and_prophetx(monkeypatch):
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
        parlay_soft_empty=True,
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="underdog", format="standard", legs=3))

    assert response.error == "parlay_unavailable"
    assert len(response.props) == 1
    assert response.props[0].books.novig is None
    assert response.props[0].books.prophetx is not None
    assert response.props[0].source_tier == "sharp_single_source"


def test_parlay_exception_sets_stable_unavailable_token(monkeypatch):
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
                "scraped_at": now,
            },
        ],
        parlay_error=RuntimeError("parlay boom"),
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="underdog", format="standard", legs=3))

    assert response.error == "parlay_unavailable"
    assert len(response.props) == 1


def test_parlay_true_empty_slate_sets_no_error(monkeypatch):
    """Successful empty Parlay normalize must not surface parlay_unavailable."""
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
        ],
        parlay=_parlay(),
    )

    import asyncio

    response = asyncio.run(svc.get_mlb_props_today(app="underdog", format="standard", legs=3))

    assert response.error is None
    assert len(response.props) == 1


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


@pytest.mark.asyncio
async def test_prizepicks_board_from_supabase_not_parlay(monkeypatch):
    now = datetime.now(timezone.utc)
    pp = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]
    # Parlay PP board would be a different player if wrongly used
    bad_parlay = _parlay(
        board=[
            {
                "player_name": "Wrong Player",
                "stat_type": "Total Bases",
                "line_score": 9.5,
                "odds_type": "standard",
            }
        ],
        book_indexes=_judge_parlay_indexes(now),
    )
    _stub_snapshots(monkeypatch, dfs_pp=pp, parlay=bad_parlay, novig=_judge_novig_snapshot(now))
    monkeypatch.setattr(
        svc, "get_mlb_player_index", lambda: _async_return({})
    )
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    assert len(out.props) == 1
    assert out.props[0].player_name == "Aaron Judge"
    assert out.error is None


@pytest.mark.asyncio
async def test_prizepicks_unavailable_when_snapshot_empty(monkeypatch):
    _stub_snapshots(monkeypatch, dfs_pp=[])
    monkeypatch.setattr(svc, "get_mlb_player_index", lambda: _async_return({}))
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    assert out.props == []
    assert out.error == "prizepicks_unavailable"


@pytest.mark.asyncio
async def test_books_main_uses_book_main_line_not_dfs_only(monkeypatch):
    now = datetime.now(timezone.utc)
    pp = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]
    # Novig main at 2.5 while DFS is 1.5
    novig = [
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 2.5,
            "side": "over",
            "american_price": -115,
            "scraped_at": now,
            "is_main": True,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 2.5,
            "side": "under",
            "american_price": -105,
            "scraped_at": now,
            "is_main": True,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 1.5,
            "side": "over",
            "american_price": -200,
            "scraped_at": now,
            "is_main": False,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "total_bases",
            "line_score": 1.5,
            "side": "under",
            "american_price": 150,
            "scraped_at": now,
            "is_main": False,
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp,
        novig=novig,
        parlay=_parlay(book_indexes=_judge_parlay_indexes(now)),
    )
    monkeypatch.setattr(svc, "get_mlb_player_index", lambda: _async_return({}))
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    main = out.props[0].books_main.novig
    assert main is not None
    assert main.line == 2.5
    assert main.over_american == -115
    assert main.under_american == -105


def test_response_is_cached_within_ttl(monkeypatch):
    now = datetime.now(timezone.utc)
    calls = {"count": 0}

    async def fake_parlay(**_kwargs):
        calls["count"] += 1
        return _parlay()

    monkeypatch.setattr(svc, "fetch_mlb_parlay_props_normalized", fake_parlay)
    monkeypatch.setattr(
        svc,
        "fetch_latest_prizepicks",
        lambda league="mlb": [
            {
                "player_name": "Aaron Judge",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        raising=False,
    )
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="mlb": [])
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="mlb": [])
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="mlb": [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="mlb": [])

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
    pp_board = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now - timedelta(minutes=5),
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp_board,
        parlay=_parlay(book_indexes=_judge_parlay_indexes(now)),
        novig=_judge_novig_snapshot(now),
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
        parlay=_parlay(
            board=[
                {
                    "player_name": "Aaron Judge",
                    "stat_type": "Total Bases",
                    "line_score": 1.5,
                    "odds_type": "standard",
                    "scraped_at": now,
                },
            ],
        ),
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
        parlay=_parlay(),
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
    assert "caesars" not in body["props"][0]["books"]
