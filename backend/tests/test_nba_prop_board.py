from datetime import datetime, timezone

import pytest

from app.domains.nba.prop_board import (
    UnknownBoardBookError,
    collect_board_quotes,
    get_nba_prop_board,
    resolve_board_book,
)
from app.domains.nba.prop_board_cluster import BoardQuote


@pytest.mark.asyncio
async def test_anchor_book_keeps_only_identical_player_stat_and_line(monkeypatch):
    quotes = [
        BoardQuote("Tatum", "jayson tatum", "points", 27.5, "prizepicks", None, None),
        BoardQuote(
            "Tatum", "jayson tatum", "points", 27.5, "draftkings", -110, -110
        ),
        BoardQuote("Tatum", "jayson tatum", "points", 28.5, "fanduel", -105, -115),
        BoardQuote(
            "Tatum", "jayson tatum", "rebounds", 8.5, "draftkings", -110, -110
        ),
    ]
    monkeypatch.setattr(
        "app.domains.nba.prop_board.collect_board_quotes",
        lambda: quotes,
    )
    monkeypatch.setattr(
        "app.domains.nba.prop_board.load_enrichment",
        lambda *_: ({}, [], set()),
    )

    board = await get_nba_prop_board("prizepicks")

    keys = {(row.stat, row.line) for row in board.rows}
    assert keys == {("points", 27.5)}
    row = next(row for row in board.rows if row.side == "over")
    assert row.anchor.book == "prizepicks"
    assert row.anchor.american == -137
    assert [book.book for book in row.books] == ["draftkings"]


@pytest.mark.asyncio
async def test_board_omits_props_once_the_game_has_started(monkeypatch):
    future = datetime(2099, 1, 1, tzinfo=timezone.utc)
    past = datetime(2020, 1, 1, tzinfo=timezone.utc)
    quotes = [
        BoardQuote("Later", "later player", "points", 20.5, "prizepicks", None, None),
        BoardQuote("Started", "started player", "points", 20.5, "prizepicks", None, None),
        BoardQuote("Live", "live player", "points", 20.5, "prizepicks", None, None),
        BoardQuote("Wilson", "aja wilson", "points", 22.5, "prizepicks", None, None),
    ]
    monkeypatch.setattr(
        "app.domains.nba.prop_board.collect_board_quotes",
        lambda: quotes,
    )
    monkeypatch.setattr(
        "app.domains.nba.prop_board.load_enrichment",
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

    board = await get_nba_prop_board("prizepicks")

    assert {row.player_name for row in board.rows} == {"Later"}


def test_betmgm_is_unknown_book():
    with pytest.raises(UnknownBoardBookError):
        resolve_board_book("betmgm")


def test_collect_board_quotes_loads_only_seven_nba_books(monkeypatch):
    calls: list[tuple[str, str]] = []

    def rows_for(book: str, stat_field: str):
        def fetch(league: str, **_kwargs):
            calls.append((book, league))
            return [
                {
                    "player_name": "Jayson Tatum",
                    stat_field: "points",
                    "side": "over",
                    "line_score": 27.5,
                    "american_price": -110,
                },
                {
                    "player_name": "Jayson Tatum",
                    stat_field: "points",
                    "side": "under",
                    "line_score": 27.5,
                    "american_price": -110,
                },
            ]

        return fetch

    for book in ("prophetx", "novig"):
        monkeypatch.setattr(
            f"app.domains.nba.prop_board.fetch_latest_{book}",
            rows_for(book, "stat_name"),
        )
    for book in ("pinnacle", "draftkings", "fanduel"):
        monkeypatch.setattr(
            f"app.domains.nba.prop_board.fetch_latest_{book}",
            rows_for(book, "market_type"),
        )
    monkeypatch.setattr(
        "app.domains.nba.prop_board.fetch_latest_prizepicks",
        lambda league: calls.append(("prizepicks", league)) or [],
    )
    monkeypatch.setattr(
        "app.domains.nba.prop_board.fetch_latest_underdog",
        lambda league: calls.append(("underdog", league)) or [],
    )

    quotes = collect_board_quotes()

    assert calls == [
        ("prophetx", "nba"),
        ("novig", "nba"),
        ("pinnacle", "nba"),
        ("draftkings", "nba"),
        ("fanduel", "nba"),
        ("prizepicks", "nba"),
        ("underdog", "nba"),
    ]
    assert {quote.book for quote in quotes} == {
        "prophetx",
        "novig",
        "pinnacle",
        "draftkings",
        "fanduel",
    }
    assert not hasattr(collect_board_quotes, "warnings")
