from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import routes
from app.domains.mlb.prop_board import collect_board_quotes, get_mlb_prop_board
from app.domains.mlb.prop_board_cluster import BoardQuote, consensus_ip_pct
from app.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_board_omits_props_once_the_game_has_started(monkeypatch):
    future = datetime(2099, 1, 1, tzinfo=timezone.utc)
    past = datetime(2020, 1, 1, tzinfo=timezone.utc)
    quotes = [
        BoardQuote("Later", "later player", "hits", 1.5, "prizepicks", None, None),
        BoardQuote("Started", "started player", "hits", 1.5, "prizepicks", None, None),
        BoardQuote("Live", "live player", "hits", 1.5, "prizepicks", None, None),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: (
            {
                "later player": {
                    "game_start_at": future,
                    "game_status": "scheduled",
                },
                "started player": {
                    "game_start_at": past,
                    "game_status": "scheduled",
                },
                "live player": {
                    "game_start_at": future,
                    "game_status": "live",
                },
            },
            {},
            [],
            set(),
        ),
    )

    body = await get_mlb_prop_board()

    assert {row.player_name for row in body.rows} == {"Later"}


def test_mlb_props_board_route_returns_200(monkeypatch):
    async def fake(book: str | None = None):
        from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse

        return MlbPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[], warnings=[])

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    assert res.json()["rows"] == []


def test_mlb_props_board_route_passes_book(monkeypatch):
    seen: dict[str, str | None] = {}

    async def fake(book: str | None = None):
        from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse

        seen["book"] = book
        return MlbPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[])

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board?book=draftkings")
    assert res.status_code == 200
    assert seen["book"] == "draftkings"


def test_mlb_props_board_route_rejects_unknown_book(monkeypatch):
    async def fake(book: str | None = None):
        from app.domains.mlb.prop_board import UnknownBoardBookError

        raise UnknownBoardBookError(book or "")

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board?book=not-a-book")
    assert res.status_code == 422
    assert res.headers["cache-control"] == "no-store"


def test_player_context_resolves_jr_when_dfs_omits_suffix():
    from app.domains.mlb.prop_board import _player_context
    from app.providers.espn.wnba_roster import norm_player_name

    roster = {
        norm_player_name("Fernando Tatis Jr."): {
            "team_abbrev": "SD",
            "headshot_url": "https://example.test/tatis.png",
        }
    }
    ctx = _player_context(
        {"fernando tatis": "Fernando Tatis"},
        roster,
        {
            "SD": {
                "opponent_abbrev": "CIN",
                "game_pk": 1,
                "game_start_at": None,
                "home_away": "home",
            }
        },
    )
    assert ctx["fernando tatis"]["team_abbrev"] == "SD"
    assert ctx["fernando tatis"]["opponent_abbrev"] == "CIN"
    assert ctx["fernando tatis"]["headshot_url"] == "https://example.test/tatis.png"


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
    assert lines == [2.0]
    over = next(r for r in body.rows if r.line == 2.0 and r.side == "over")
    assert over.anchor.american == -137
    assert over.books == []
    assert over.ip_pct == consensus_ip_pct([-137])
    assert {r.side for r in body.rows} == {"over", "under"}


@pytest.mark.asyncio
async def test_assembler_splits_dfs_and_sportsbook_lines(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=19.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=19.5,
            book="underdog",
            over_american=-105,
            under_american=-115,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=19.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=20.5,
            book="pinnacle",
            over_american=-108,
            under_american=-112,
        ),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )
    body = await get_mlb_prop_board()
    lines = sorted({r.line for r in body.rows})
    assert lines == [19.5]
    over_195 = next(r for r in body.rows if r.line == 19.5 and r.side == "over")
    assert over_195.anchor.book == "prizepicks"
    assert over_195.anchor.american == -137
    assert [c.book for c in over_195.books] == ["prophetx", "underdog"]
    assert over_195.books[0].line == 19.5
    assert over_195.books[0].devig_pct is None
    assert over_195.ip_pct == consensus_ip_pct([-137, -110, -105])


@pytest.mark.asyncio
async def test_assembler_market_label_chips_and_sort(monkeypatch):
    start = datetime(2099, 8, 23, 20, 10, tzinfo=timezone.utc)
    quotes = [
        BoardQuote(
            player_name="Betts",
            player_key="mookie betts",
            stat="hits",
            line=1.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
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
    assert betts_over.books[0].devig_pct is None
    assert betts_over.books[1].american == -115
    assert betts_over.books[1].devig_pct is None
    assert betts_over.ip_pct == consensus_ip_pct([-137, -110, -115])
    names_in_order = [r.player_name for r in body.rows]
    assert names_in_order[:2] == ["Betts", "Betts"]
    assert names_in_order[2:] == ["Judge", "Judge"]
    assert [r.side for r in body.rows[:2]] == ["over", "under"]


@pytest.mark.asyncio
async def test_chips_skip_books_without_american_on_that_side(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Betts",
            player_key="mookie betts",
            stat="hits",
            line=1.5,
            book="fanduel",
            over_american=-108,
            under_american=None,
        ),
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
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )
    body = await get_mlb_prop_board()
    over = next(r for r in body.rows if r.side == "over")
    under = next(r for r in body.rows if r.side == "under")
    assert over.anchor.book == "prizepicks"
    assert over.anchor.american == -137
    assert [c.book for c in over.books] == ["draftkings", "fanduel"]
    assert [c.american for c in over.books] == [-115, -108]
    assert under.anchor.book == "prizepicks"
    assert under.anchor.american == -137
    assert [c.book for c in under.books] == ["draftkings"]
    assert [c.american for c in under.books] == [-105]


@pytest.mark.asyncio
async def test_assembler_omits_sportsbook_only_rows(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Betts",
            player_key="mookie betts",
            stat="hits",
            line=1.5,
            book="fanduel",
            over_american=-108,
            under_american=None,
        ),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )
    body = await get_mlb_prop_board()
    assert body.rows == []
    fanduel_body = await get_mlb_prop_board("fanduel")
    assert len(fanduel_body.rows) == 1
    over = next(r for r in fanduel_body.rows if r.side == "over")
    assert over.anchor.book == "fanduel"
    assert over.anchor.american == -108
    assert over.books == []
    assert not any(r.side == "under" for r in fanduel_body.rows)


@pytest.mark.asyncio
async def test_anchor_book_keeps_only_identical_player_stat_and_line(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="draftkings",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=2.5,
            book="fanduel",
            over_american=-108,
            under_american=-112,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="runs",
            line=1.5,
            book="draftkings",
            over_american=-120,
            under_american=-110,
        ),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )

    prizepicks = await get_mlb_prop_board()
    assert {row.line for row in prizepicks.rows} == {1.5}
    assert {row.stat for row in prizepicks.rows} == {"hits"}
    over = next(row for row in prizepicks.rows if row.side == "over")
    assert over.anchor.book == "prizepicks"
    assert over.anchor.american == -137
    assert [chip.book for chip in over.books] == ["draftkings"]
    assert over.books[0].line == 1.5
    assert over.ip_pct == consensus_ip_pct([-137, -110])

    draftkings = await get_mlb_prop_board("draftkings")
    assert {(row.stat, row.line) for row in draftkings.rows} == {
        ("hits", 1.5),
        ("runs", 1.5),
    }
    hits = next(
        row
        for row in draftkings.rows
        if row.stat == "hits" and row.line == 1.5 and row.side == "over"
    )
    assert hits.anchor.book == "draftkings"
    assert hits.anchor.american == -110
    assert [chip.book for chip in hits.books] == ["prizepicks"]
    assert hits.books[0].american == -137
    assert hits.ip_pct == consensus_ip_pct([-110, -137])


@pytest.mark.asyncio
async def test_unknown_board_book_raises(monkeypatch):
    from app.domains.mlb.prop_board import UnknownBoardBookError

    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: [])
    with pytest.raises(UnknownBoardBookError):
        await get_mlb_prop_board("not-a-book")


@pytest.mark.asyncio
async def test_known_book_with_no_quotes_returns_empty_rows(monkeypatch):
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: [])
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )
    body = await get_mlb_prop_board("fanduel")
    assert body.rows == []


@pytest.mark.asyncio
async def test_missing_person_id_keeps_hit_rates_null(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
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
    assert body.rows
    assert all(
        r.hit_l5 is None
        and r.hit_l10 is None
        and r.hit_l15 is None
        and r.hit_h2h is None
        for r in body.rows
    )


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
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
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
            "opponent_abbrev": "BOS",
            "splits_hitting": [
                {
                    "opponent": {"name": "Boston Red Sox"},
                    "stat": {"plateAppearances": 4, "hits": 3},
                },
                {
                    "opponent": {"name": "Boston Red Sox"},
                    "stat": {"plateAppearances": 4, "hits": 0},
                },
            ],
            "splits_hitting_prev": [
                {
                    "opponent": {"name": "Boston Red Sox"},
                    "stat": {"plateAppearances": 4, "hits": 2},
                },
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
    assert over.hit_h2h == 67
    assert under.hit_h2h == 33


def test_stamp_opponent_abbrev_writes_canonical_code():
    from app.domains.mlb.prop_board import _stamp_opponent_abbrev

    rows = _stamp_opponent_abbrev(
        [{"opponent": {"name": "Boston Red Sox"}, "stat": {"hits": 1}}],
        {},
    )
    assert rows[0]["opponent_abbrev"] == "BOS"
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
                status="live",
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
    assert index["NYY"]["game_status"] == "live"
    assert index["BOS"]["game_status"] == "live"

@pytest.mark.asyncio
async def test_load_enrichment_soft_fails_ranks_and_missing_person(monkeypatch):
    from app.domains.mlb.prop_board import _person_cache, load_enrichment
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

    async def ok_map(*_a, **_k):
        return {}

    async def no_person(*_a, **_k):
        return None

    monkeypatch.setattr("app.domains.mlb.prop_board.get_mlb_player_index", boom_roster)
    monkeypatch.setattr("app.domains.mlb.prop_board.get_today_scoreboard", boom_board)
    monkeypatch.setattr("app.domains.mlb.prop_board._load_team_ranks", boom_ranks)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_team_abbrev_map", ok_map)
    monkeypatch.setattr("app.domains.mlb.prop_board.search_person_id", no_person)
    _person_cache.clear()

    ctx, ranks, warnings, missing = await load_enrichment([cluster])
    assert warnings == ["team_ranks_unavailable"]
    assert ranks == {}
    assert "aaron judge" in missing
    assert ctx["aaron judge"]["team_abbrev"] is None


def _hits_cluster():
    from app.domains.mlb.prop_board_cluster import Cluster

    return Cluster(
        player_name="Judge",
        player_key="aaron judge",
        stat="hits",
        line=1.5,
        quotes=(),
    )


@pytest.mark.asyncio
async def test_load_enrichment_warns_when_game_log_get_fails(monkeypatch):
    from app.domains.mlb.prop_board import _log_cache, _person_cache, load_enrichment

    class BoomClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, *args, **kwargs):
            raise RuntimeError("stats api down")

    async def ok_roster():
        return {}

    async def ok_board():
        from types import SimpleNamespace

        return SimpleNamespace(games=[])

    async def ok_ranks(*_a, **_k):
        return {}

    async def ok_map(*_a, **_k):
        return {}

    async def person_id(*_a, **_k):
        return 592450

    _log_cache.clear()
    _person_cache.clear()
    monkeypatch.setattr("app.domains.mlb.prop_board.httpx.AsyncClient", BoomClient)
    monkeypatch.setattr("app.domains.mlb.prop_board.get_mlb_player_index", ok_roster)
    monkeypatch.setattr("app.domains.mlb.prop_board.get_today_scoreboard", ok_board)
    monkeypatch.setattr("app.domains.mlb.prop_board._load_team_ranks", ok_ranks)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_team_abbrev_map", ok_map)
    monkeypatch.setattr("app.domains.mlb.prop_board.search_person_id", person_id)

    ctx, _ranks, warnings, missing = await load_enrichment([_hits_cluster()])
    assert warnings.count("gamelogs_unavailable") == 1
    assert missing == set()
    assert ctx["aaron judge"]["splits_hitting"] == []


@pytest.mark.asyncio
async def test_load_enrichment_empty_success_logs_do_not_warn(monkeypatch):
    from app.domains.mlb.prop_board import _log_cache, _person_cache, load_enrichment

    async def ok_roster():
        return {}

    async def ok_board():
        from types import SimpleNamespace

        return SimpleNamespace(games=[])

    async def ok_ranks(*_a, **_k):
        return {}

    async def ok_map(*_a, **_k):
        return {}

    async def person_id(*_a, **_k):
        return 592450

    seasons: list[int] = []

    async def empty_logs(_client, _person_id, season, _group):
        seasons.append(season)
        return []

    _log_cache.clear()
    _person_cache.clear()
    monkeypatch.setattr("app.domains.mlb.prop_board.get_mlb_player_index", ok_roster)
    monkeypatch.setattr("app.domains.mlb.prop_board.get_today_scoreboard", ok_board)
    monkeypatch.setattr("app.domains.mlb.prop_board._load_team_ranks", ok_ranks)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_team_abbrev_map", ok_map)
    monkeypatch.setattr("app.domains.mlb.prop_board.search_person_id", person_id)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_game_log_splits", empty_logs)

    ctx, _ranks, warnings, missing = await load_enrichment([_hits_cluster()])
    assert "gamelogs_unavailable" not in warnings
    assert missing == set()
    assert len(seasons) == 2
    assert seasons[0] == seasons[1] + 1
    assert ctx["aaron judge"]["splits_hitting_prev"] == []


@pytest.mark.asyncio
async def test_load_enrichment_reuses_cached_person_id(monkeypatch):
    from app.domains.mlb.prop_board import _log_cache, _person_cache, load_enrichment

    calls = {"n": 0}

    async def ok_roster():
        return {}

    async def ok_board():
        from types import SimpleNamespace

        return SimpleNamespace(games=[])

    async def ok_ranks(*_a, **_k):
        return {}

    async def ok_map(*_a, **_k):
        return {}

    async def person_id(*_a, **_k):
        calls["n"] += 1
        return 592450

    async def empty_logs(*_a, **_k):
        return []

    _log_cache.clear()
    _person_cache.clear()
    monkeypatch.setattr("app.domains.mlb.prop_board.get_mlb_player_index", ok_roster)
    monkeypatch.setattr("app.domains.mlb.prop_board.get_today_scoreboard", ok_board)
    monkeypatch.setattr("app.domains.mlb.prop_board._load_team_ranks", ok_ranks)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_team_abbrev_map", ok_map)
    monkeypatch.setattr("app.domains.mlb.prop_board.search_person_id", person_id)
    monkeypatch.setattr("app.domains.mlb.prop_board.fetch_game_log_splits", empty_logs)

    await load_enrichment([_hits_cluster()])
    await load_enrichment([_hits_cluster()])
    assert calls["n"] == 1
