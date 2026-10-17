from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.domains.wnba import routes
from app.domains.wnba.prop_board import collect_board_quotes, get_wnba_prop_board
from app.domains.wnba.prop_board_cluster import BoardQuote, consensus_ip_pct
from app.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_board_omits_props_once_the_game_has_started(monkeypatch):
    future = datetime(2099, 1, 1, tzinfo=timezone.utc)
    past = datetime(2020, 1, 1, tzinfo=timezone.utc)
    quotes = [
        BoardQuote("Later", "later player", "points", 18.5, "prizepicks", None, None),
        BoardQuote("Started", "started player", "points", 18.5, "prizepicks", None, None),
        BoardQuote("Live", "live player", "points", 18.5, "prizepicks", None, None),
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
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
            [],
            set(),
        ),
    )

    body = await get_wnba_prop_board()

    assert {row.player_name for row in body.rows} == {"Later"}


def test_wnba_props_board_route_returns_200(monkeypatch):
    async def fake(book: str | None = None):
        from app.domains.wnba.schemas_prop_board import WnbaPropBoardResponse

        return WnbaPropBoardResponse(
            as_of=datetime.now(timezone.utc), rows=[], warnings=[]
        )

    monkeypatch.setattr(routes, "get_wnba_prop_board", fake)
    res = client.get("/api/wnba/props/board")
    assert res.status_code == 200
    assert res.json()["rows"] == []


def test_wnba_props_board_route_passes_book(monkeypatch):
    seen: dict[str, str | None] = {}

    async def fake(book: str | None = None):
        from app.domains.wnba.schemas_prop_board import WnbaPropBoardResponse

        seen["book"] = book
        return WnbaPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[])

    monkeypatch.setattr(routes, "get_wnba_prop_board", fake)
    res = client.get("/api/wnba/props/board?book=draftkings")
    assert res.status_code == 200
    assert seen["book"] == "draftkings"


def test_wnba_props_board_route_rejects_unknown_book(monkeypatch):
    async def fake(book: str | None = None):
        from app.domains.wnba.prop_board import UnknownBoardBookError

        raise UnknownBoardBookError(book or "")

    monkeypatch.setattr(routes, "get_wnba_prop_board", fake)
    res = client.get("/api/wnba/props/board?book=not-a-book")
    assert res.status_code == 422
    assert res.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_assembler_splits_lines_and_null_ip_for_dfs_only(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=18.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=19.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes",
        lambda: quotes,
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )
    body = await get_wnba_prop_board()
    lines = sorted({r.line for r in body.rows})
    assert lines == [19.5]
    over = next(r for r in body.rows if r.line == 19.5 and r.side == "over")
    assert over.anchor.american == -137
    assert over.books == []
    assert over.ip_pct == consensus_ip_pct([-137])
    assert {r.side for r in body.rows} == {"over", "under"}


@pytest.mark.asyncio
async def test_assembler_splits_dfs_and_sportsbook_lines(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=19.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=19.5,
            book="underdog",
            over_american=-105,
            under_american=-115,
        ),
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=19.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=20.5,
            book="pinnacle",
            over_american=-108,
            under_american=-112,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )
    body = await get_wnba_prop_board()
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
            player_name="Howard",
            player_key="rhyne howard",
            stat="points",
            line=18.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Howard",
            player_key="rhyne howard",
            stat="points",
            line=18.5,
            book="draftkings",
            over_american=-115,
            under_american=-105,
        ),
        BoardQuote(
            player_name="Howard",
            player_key="rhyne howard",
            stat="points",
            line=18.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="assists",
            line=8.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    ctx = {
        "rhyne howard": {
            "team_abbrev": "ATL",
            "opponent_abbrev": "IND",
            "home_away": "away",
            "game_id": "401810001",
            "game_start_at": start,
            "headshot_url": None,
        },
        "caitlin clark": {
            "team_abbrev": "IND",
            "opponent_abbrev": "NYL",
            "home_away": "home",
            "game_id": "401810002",
            "game_start_at": None,
            "headshot_url": None,
        },
    }
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: (ctx, ["gamelogs_unavailable"], set()),
    )
    body = await get_wnba_prop_board()
    assert body.warnings == ["gamelogs_unavailable"]
    labels = [r.market_label for r in body.rows]
    assert "Over 18.5 Points" in labels
    assert "Under 18.5 Points" in labels
    assert "Over 8.5 Assists" in labels
    howard_over = next(
        r for r in body.rows if r.player_name == "Howard" and r.side == "over"
    )
    assert [c.book for c in howard_over.books] == ["prophetx", "draftkings"]
    assert howard_over.books[0].american == -110
    assert howard_over.books[0].devig_pct is None
    assert howard_over.books[1].american == -115
    assert howard_over.books[1].devig_pct is None
    assert howard_over.ip_pct == consensus_ip_pct([-137, -110, -115])
    names_in_order = [r.player_name for r in body.rows]
    assert names_in_order[:2] == ["Howard", "Howard"]
    assert names_in_order[2:] == ["Clark", "Clark"]
    assert [r.side for r in body.rows[:2]] == ["over", "under"]
    assert howard_over.game_id == "401810001"


@pytest.mark.asyncio
async def test_chips_skip_books_without_american_on_that_side(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Wilson",
            player_key="aja wilson",
            stat="points",
            line=1.5,
            book="fanduel",
            over_american=-108,
            under_american=None,
        ),
        BoardQuote(
            player_name="Wilson",
            player_key="aja wilson",
            stat="points",
            line=1.5,
            book="draftkings",
            over_american=-115,
            under_american=-105,
        ),
        BoardQuote(
            player_name="Wilson",
            player_key="aja wilson",
            stat="points",
            line=1.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )
    body = await get_wnba_prop_board()
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
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=18.5,
            book="fanduel",
            over_american=-108,
            under_american=None,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )
    body = await get_wnba_prop_board()
    assert body.rows == []
    fanduel_body = await get_wnba_prop_board("fanduel")
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
            player_name="Wilson",
            player_key="aja wilson",
            stat="points",
            line=1.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Wilson",
            player_key="aja wilson",
            stat="points",
            line=1.5,
            book="draftkings",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Wilson",
            player_key="aja wilson",
            stat="points",
            line=2.5,
            book="fanduel",
            over_american=-108,
            under_american=-112,
        ),
        BoardQuote(
            player_name="Wilson",
            player_key="aja wilson",
            stat="rebounds",
            line=1.5,
            book="draftkings",
            over_american=-120,
            under_american=-110,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )

    prizepicks = await get_wnba_prop_board()
    assert {row.line for row in prizepicks.rows} == {1.5}
    assert {row.stat for row in prizepicks.rows} == {"points"}
    over = next(row for row in prizepicks.rows if row.side == "over")
    assert over.anchor.book == "prizepicks"
    assert over.anchor.american == -137
    assert [chip.book for chip in over.books] == ["draftkings"]
    assert over.books[0].line == 1.5
    assert over.ip_pct == consensus_ip_pct([-137, -110])

    draftkings = await get_wnba_prop_board("draftkings")
    assert {(row.stat, row.line) for row in draftkings.rows} == {
        ("points", 1.5),
        ("rebounds", 1.5),
    }
    hits = next(
        row
        for row in draftkings.rows
        if row.stat == "points" and row.line == 1.5 and row.side == "over"
    )
    assert hits.anchor.book == "draftkings"
    assert hits.anchor.american == -110
    assert [chip.book for chip in hits.books] == ["prizepicks"]
    assert hits.books[0].american == -137
    assert hits.ip_pct == consensus_ip_pct([-110, -137])


@pytest.mark.asyncio
async def test_unknown_board_book_raises(monkeypatch):
    from app.domains.wnba.prop_board import UnknownBoardBookError

    monkeypatch.setattr("app.domains.wnba.prop_board.collect_board_quotes", lambda: [])
    with pytest.raises(UnknownBoardBookError):
        await get_wnba_prop_board("not-a-book")


@pytest.mark.asyncio
async def test_known_book_with_no_quotes_returns_empty_rows(monkeypatch):
    monkeypatch.setattr("app.domains.wnba.prop_board.collect_board_quotes", lambda: [])
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )
    body = await get_wnba_prop_board("fanduel")
    assert body.rows == []


def test_collect_board_quotes_maps_wnba_stats_and_skips_unknown(monkeypatch):
    def _empty(*_a, **_k):
        return []

    px = [
        {
            "player_name": "Caitlin Clark",
            "stat_name": "points",
            "side": "over",
            "line_score": 18.5,
            "american_price": -120,
            "is_main": True,
        },
        {
            "player_name": "Caitlin Clark",
            "stat_name": "points",
            "side": "under",
            "line_score": 18.5,
            "american_price": 100,
            "is_main": True,
        },
    ]
    pp = [
        {
            "player_name": "Caitlin Clark",
            "stat_type": "Points",
            "line_score": 19.5,
            "odds_type": "standard",
        },
        {
            "player_name": "Caitlin Clark",
            "stat_type": "Fantasy Score",
            "line_score": 32.5,
            "odds_type": "standard",
        },
    ]
    ud = [
        {
            "player_name": "Caitlin Clark",
            "stat_name": "points",
            "side": "over",
            "line_score": 18.5,
            "american_price": -105,
        },
        {
            "player_name": "Caitlin Clark",
            "stat_name": "points",
            "side": "under",
            "line_score": 18.5,
            "american_price": -115,
        },
    ]
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_latest_prophetx", lambda *a, **k: px
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_latest_novig", _empty
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_latest_pinnacle", _empty
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_latest_parlay_api_odds", _empty
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_latest_prizepicks", lambda *a, **k: pp
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_latest_underdog", lambda *a, **k: ud
    )

    quotes = collect_board_quotes()
    assert collect_board_quotes.warnings == ["parlay_unavailable"]
    by_book = {(q.book, q.line, q.stat): q for q in quotes}
    assert set(by_book) == {
        ("prophetx", 18.5, "points"),
        ("prizepicks", 19.5, "points"),
        ("underdog", 18.5, "points"),
    }
    assert by_book[("prophetx", 18.5, "points")].over_american == -120
    assert by_book[("underdog", 18.5, "points")].under_american == -115
    assert all(q.stat != "fantasy_score" for q in quotes)


@pytest.mark.asyncio
async def test_assembler_fills_hit_rates_from_enrichment_splits(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=18.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Clark",
            player_key="caitlin clark",
            stat="points",
            line=18.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
    ]
    ctx = {
        "caitlin clark": {
            "opponent_abbrev": "NYL",
            "splits": [
                {"MIN": 32, "PTS": 22, "MATCHUP": "IND vs. NYL"},
                {"MIN": 30, "PTS": 10, "MATCHUP": "IND @ NYL"},
            ],
            "splits_prev": [
                {"MIN": 34, "PTS": 24, "MATCHUP": "IND vs. NYL"},
            ],
        }
    }
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.collect_board_quotes", lambda: quotes
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.load_enrichment",
        lambda *_: (ctx, [], set()),
    )
    body = await get_wnba_prop_board()
    over = next(r for r in body.rows if r.side == "over")
    under = next(r for r in body.rows if r.side == "under")
    assert over.hit_l5 == 50
    assert under.hit_l5 == 50
    assert over.hit_h2h == 67
    assert under.hit_h2h == 33


def test_game_index_maps_team_to_opponent_and_side():
    from types import SimpleNamespace
    from app.domains.wnba.prop_board import _game_index_from_scoreboard

    board = SimpleNamespace(
        games=[
            SimpleNamespace(
                id="401810001",
                espn_event_id="401810001",
                start_time_et="2026-08-23T23:10:00Z",
                status="final",
                away=SimpleNamespace(abbrev="IND"),
                home=SimpleNamespace(abbrev="NYL"),
            )
        ]
    )
    index = _game_index_from_scoreboard(board)
    assert index["IND"]["opponent_abbrev"] == "NYL"
    assert index["IND"]["home_away"] == "away"
    assert index["IND"]["game_id"] == "401810001"
    assert index["NYL"]["home_away"] == "home"
    assert index["NYL"]["opponent_abbrev"] == "IND"
    assert index["IND"]["game_status"] == "final"
    assert index["NYL"]["game_status"] == "final"


def test_stats_player_id_index_matches_accented_alias_and_allplayers_shape():
    from app.domains.betting.player_match_keys import match_player_key
    from app.domains.wnba.prop_board import stats_player_id_index

    rows = [
        {"PLAYER_NAME": "Janelle Salaün", "PLAYER_ID": 1001},
        {"DISPLAY_FIRST_LAST": "Jessica Lynn Shepard", "PERSON_ID": 2002},
        {"PLAYER": "A'ja Wilson", "PLAYER_ID": "1628932"},
    ]
    index = stats_player_id_index(rows)
    assert index[match_player_key("Janelle Salaun")] == "1001"
    assert index[match_player_key("Jessica Shepard")] == "2002"
    assert index[match_player_key("A'ja Wilson")] == "1628932"


@pytest.mark.asyncio
async def test_attach_game_logs_uses_allplayers_when_dash_fails(monkeypatch):
    from app.domains.wnba.prop_board import _attach_game_logs

    async def boom_dash(_season: int):
        raise RuntimeError("403")

    async def allplayers(_season: int):
        return {
            "resultSets": [
                {
                    "headers": ["PERSON_ID", "DISPLAY_FIRST_LAST"],
                    "rowSet": [[1628932, "A'ja Wilson"]],
                }
            ]
        }

    async def gamelog(_player_id: str, _season: int):
        return {
            "resultSets": [
                {
                    "headers": ["GAME_DATE", "MATCHUP", "MIN", "PTS"],
                    "rowSet": [["2026-08-28", "LVA vs. TOR", 30, 27]],
                }
            ]
        }

    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_leaguedashplayerstats", boom_dash
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_commonallplayers", allplayers
    )
    monkeypatch.setattr(
        "app.domains.wnba.prop_board.fetch_playergamelog", gamelog
    )

    player_ctx: dict = {}
    missing: set[str] = set()
    failed = await _attach_game_logs(
        player_ctx, {"a'ja wilson": "A'ja Wilson"}, missing
    )
    assert failed is False
    assert missing == set()
    assert player_ctx["a'ja wilson"]["splits"][0]["PTS"] == 27
