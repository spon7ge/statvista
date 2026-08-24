from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import routes
from app.domains.mlb.prop_board import collect_board_quotes, get_mlb_prop_board
from app.domains.mlb.prop_board_cluster import BoardQuote
from app.main import app

client = TestClient(app)


def test_mlb_props_board_route_returns_200(monkeypatch):
    async def fake():
        from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse

        return MlbPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[], warnings=[])

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    assert res.json()["rows"] == []


@pytest.mark.asyncio
async def test_assembler_splits_lines_and_null_ip_for_dfs_only(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=2.0,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.collect_board_quotes",
        lambda: quotes,
    )
    monkeypatch.setattr("app.domains.mlb.prop_board.load_enrichment", lambda *_: ({}, {}, [], set()))
    body = await get_mlb_prop_board()
    lines = sorted({r.line for r in body.rows})
    assert lines == [1.5, 2.0]
    dfs = [r for r in body.rows if r.line == 2.0]
    assert all(r.ip_pct is None for r in dfs)
    assert {r.side for r in body.rows} == {"over", "under"}


@pytest.mark.asyncio
async def test_assembler_market_label_chips_and_sort(monkeypatch):
    start = datetime(2026, 8, 23, 20, 10, tzinfo=timezone.utc)
    quotes = [
        BoardQuote(
            player_name="Betts",
            player_key="mookie betts",
            stat="hits",
            line=1.5,
            book="draftkings",
            over_american=-115,
            under_american=-105,
        ),
        BoardQuote(
            player_name="Betts",
            player_key="mookie betts",
            stat="hits",
            line=1.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="home_runs",
            line=0.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    ctx = {
        "mookie betts": {
            "team_abbrev": "LAD",
            "opponent_abbrev": "SD",
            "home_away": "away",
            "game_pk": 10,
            "game_start_at": start,
            "headshot_url": None,
        },
        "aaron judge": {
            "team_abbrev": "NYY",
            "opponent_abbrev": "BOS",
            "home_away": "home",
            "game_pk": 11,
            "game_start_at": None,
            "headshot_url": None,
        },
    }
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: (ctx, {}, ["gamelogs_unavailable"], set()),
    )
    body = await get_mlb_prop_board()
    assert body.warnings == ["gamelogs_unavailable"]
    labels = [r.market_label for r in body.rows]
    assert "Over 1.5 Hits" in labels
    assert "Under 1.5 Hits" in labels
    assert "Over 0.5 Home Runs" in labels
    betts_over = next(r for r in body.rows if r.player_name == "Betts" and r.side == "over")
    assert [c.book for c in betts_over.books] == ["prophetx", "draftkings"]
    assert betts_over.books[0].american == -110
    assert betts_over.books[1].american == -115
    names_in_order = [r.player_name for r in body.rows]
    assert names_in_order[:2] == ["Betts", "Betts"]
    assert names_in_order[2:] == ["Judge", "Judge"]
    assert [r.side for r in body.rows[:2]] == ["over", "under"]


@pytest.mark.asyncio
async def test_missing_person_id_keeps_hit_rates_null(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
    ]
    ctx = {
        "aaron judge": {
            "splits_hitting": [{"stat": {"plateAppearances": 4, "hits": 3}}],
        }
    }
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: (ctx, {}, [], {"aaron judge"}),
    )
    body = await get_mlb_prop_board()
    assert all(r.hit_l5 is None and r.hit_l10 is None and r.hit_l15 is None for r in body.rows)


def _empty(*_a, **_k):
    return []


def test_collect_board_quotes_mains_and_dfs_skip_unknown(monkeypatch):
    px = [
        {
            "player_name": "Aaron Judge",
            "stat_name": "hits",
            "side": "over",
            "line_score": 1.5,
            "american_price": -120,
            "is_main": True,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "hits",
            "side": "under",
            "line_score": 1.5,
            "american_price": 100,
            "is_main": True,
        },
    ]
    pp = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Hits",
            "line_score": 2.0,
            "odds_type": "standard",
        },
        {
            "player_name": "Aaron Judge",
            "stat_type": "Fantasy Score",
            "line_score": 12.5,
            "odds_type": "standard",
        },
    ]
    ud = [
        {
            "player_name": "Aaron Judge",
            "stat_name": "hits",
            "side": "over",
            "line_score": 1.5,
            "american_price": -105,
        },
        {
            "player_name": "Aaron Judge",
            "stat_name": "hits",
            "side": "under",
            "line_score": 1.5,
            "american_price": -115,
        },
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_latest_prophetx", lambda *a, **k: px)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_latest_novig", _empty)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_latest_pinnacle", _empty)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_latest_parlay_api_odds", _empty)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_latest_prizepicks", lambda *a, **k: pp)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_latest_underdog", lambda *a, **k: ud)

    quotes = collect_board_quotes()
    assert collect_board_quotes.warnings == ["parlay_unavailable"]
    by_book = {(q.book, q.line, q.stat): q for q in quotes}
    assert set(by_book) == {
        ("prophetx", 1.5, "hits"),
        ("prizepicks", 2.0, "hits"),
        ("underdog", 1.5, "hits"),
    }
    assert by_book[("prophetx", 1.5, "hits")].over_american == -120
    assert by_book[("underdog", 1.5, "hits")].under_american == -115
    assert all(q.stat != "fantasy_score" for q in quotes)

@pytest.mark.asyncio
async def test_assembler_fills_hit_rates_from_enrichment_splits(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
    ]
    ctx = {
        "aaron judge": {
            "splits_hitting": [
                {"stat": {"plateAppearances": 4, "hits": 3}},
                {"stat": {"plateAppearances": 4, "hits": 0}},
            ],
        }
    }
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: (ctx, {}, [], set()),
    )
    body = await get_mlb_prop_board()
    over = next(r for r in body.rows if r.side == "over")
    under = next(r for r in body.rows if r.side == "under")
    assert over.hit_l5 == 50
    assert under.hit_l5 == 50


def test_annotate_splits_resolves_team_id_to_abbrev():
    from app.domains.mlb.prop_board import _annotate_splits_with_abbrev

    rows = _annotate_splits_with_abbrev(
        [{"team": {"id": 147}, "stat": {"era": "3.00"}}],
        {147: "NYY"},
    )
    assert rows[0]["abbrev"] == "NYY"


def test_game_index_maps_team_to_opponent_and_side():
    from types import SimpleNamespace
    from app.domains.mlb.prop_board import _game_index_from_scoreboard

    board = SimpleNamespace(
        games=[
            SimpleNamespace(
                mlb_game_pk="777",
                start_time_et="2026-08-23T23:10:00Z",
                home=SimpleNamespace(abbrev="NYY"),
                away=SimpleNamespace(abbrev="BOS"),
            )
        ]
    )
    index = _game_index_from_scoreboard(board)
    assert index["BOS"]["opponent_abbrev"] == "NYY"
    assert index["BOS"]["home_away"] == "away"
    assert index["NYY"]["home_away"] == "home"
    assert index["NYY"]["game_pk"] == 777

@pytest.mark.asyncio
async def test_load_enrichment_soft_fails_ranks_and_missing_person(monkeypatch):
    from app.domains.mlb.prop_board import load_enrichment
    from app.domains.mlb.prop_board_cluster import Cluster

    cluster = Cluster(
        player_name="Judge",
        player_key="aaron judge",
        stat="hits",
        line=1.5,
        quotes=(),
    )

    async def boom_roster():
        raise RuntimeError("espn down")

    async def boom_board():
        raise RuntimeError("scoreboard down")

    async def boom_ranks(*_a, **_k):
        raise RuntimeError("ranks down")

    async def no_person(*_a, **_k):
        return None

    monkeypatch.setattr("app.domains.mlb.prop_board.get_mlb_player_index", boom_roster)
    monkeypatch.setattr("app.domains.mlb.prop_board.get_today_scoreboard", boom_board)
    monkeypatch.setattr("app.domains.mlb.prop_board._load_team_ranks", boom_ranks)
    monkeypatch.setattr("app.domains.mlb.prop_board.search_person_id", no_person)

    ctx, ranks, warnings, missing = await load_enrichment([cluster])
    assert warnings == ["team_ranks_unavailable"]
    assert ranks == {}
    assert "aaron judge" in missing
    assert ctx["aaron judge"]["team_abbrev"] is None
