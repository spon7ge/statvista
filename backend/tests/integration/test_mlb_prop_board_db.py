from __future__ import annotations

from datetime import datetime, timezone

import pytest

from odds_seed import insert_mlb_parlay, insert_mlb_prizepicks, insert_mlb_prophetx

pytestmark = pytest.mark.integration


def test_empty_db_returns_no_rows(client):
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    body = res.json()
    assert body["rows"] == []
    assert "parlay_unavailable" in body["warnings"]


_T0 = datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc)
_T1 = datetime(2026, 8, 21, 12, 0, tzinfo=timezone.utc)


def test_latest_scraped_at_wins_prizepicks_line(client):
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T0,
    )
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=2.5,
        scraped_at=_T1,
    )
    body = client.get("/api/mlb/props/board").json()
    lines = sorted({row["line"] for row in body["rows"]})
    assert lines == [2.5]
    assert {row["player_name"] for row in body["rows"]} == {"Aaron Judge"}
    assert {row["stat"] for row in body["rows"]} == {"hits"}


def test_league_filter_excludes_wnba_rows(client):
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
        league="mlb",
    )
    insert_mlb_prizepicks(
        player_name="A'ja Wilson",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
        league="wnba",
    )
    body = client.get("/api/mlb/props/board").json()
    names = {row["player_name"] for row in body["rows"]}
    assert names == {"Aaron Judge"}
    assert "A'ja Wilson" not in names


def _px_two_way(*, player_name: str, line: float, scraped_at) -> None:
    for side, american in (("over", -110), ("under", -110)):
        insert_mlb_prophetx(
            player_name=player_name,
            stat_name="Hits",
            line_score=line,
            side=side,
            american_price=american,
            scraped_at=scraped_at,
        )


def test_prophetx_and_draftkings_share_line_chips(client):
    _px_two_way(player_name="Mookie Betts", line=1.5, scraped_at=_T1)
    for side, american in (("over", -115), ("under", -105)):
        insert_mlb_parlay(
            sportsbook="draftkings",
            player_name="Mookie Betts",
            market_type="Hits",
            side=side,
            line_score=1.5,
            american_price=american,
            scraped_at=_T1,
        )
    body = client.get("/api/mlb/props/board").json()
    rows = body["rows"]
    assert {row["side"] for row in rows} == {"over", "under"}
    assert {row["line"] for row in rows} == {1.5}
    assert {row["stat"] for row in rows} == {"hits"}
    over = next(row for row in rows if row["side"] == "over")
    under = next(row for row in rows if row["side"] == "under")
    assert {chip["book"] for chip in over["books"]} == {"prophetx", "draftkings"}
    assert {chip["book"] for chip in under["books"]} == {"prophetx", "draftkings"}
    over_by_book = {chip["book"]: chip["american"] for chip in over["books"]}
    assert over_by_book["prophetx"] == -110
    assert over_by_book["draftkings"] == -115


def test_prizepicks_extra_line_has_null_ip(client):
    _px_two_way(player_name="Mookie Betts", line=1.5, scraped_at=_T1)
    insert_mlb_prizepicks(
        player_name="Mookie Betts",
        stat_type="Hits",
        line_score=2.0,
        scraped_at=_T1,
    )
    body = client.get("/api/mlb/props/board").json()
    lines = sorted({row["line"] for row in body["rows"]})
    assert lines == [1.5, 2.0]
    dfs = [row for row in body["rows"] if row["line"] == 2.0]
    assert dfs
    assert all(row["ip_pct"] is None for row in dfs)
    assert all(
        any(chip["book"] == "prizepicks" for chip in row["books"]) for row in dfs
    )


import pytest
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError

from app.domains.mlb.prop_board import collect_board_quotes
from src.utils.db import get_engine


def test_duplicate_prizepicks_primary_key_raises():
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    with pytest.raises(IntegrityError):
        insert_mlb_prizepicks(
            player_name="Aaron Judge",
            stat_type="Hits",
            line_score=1.5,
            scraped_at=_T1,
        )


def _count_odds_selects(fn):
    engine = get_engine()
    seen: list[str] = []

    def _before(conn, cursor, statement, parameters, context, executemany):
        stmt = " ".join(str(statement).split()).lower()
        if stmt.startswith("select") and "odds." in stmt:
            seen.append(str(statement))

    event.listen(engine, "before_cursor_execute", _before)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", _before)
    return seen


def test_collect_board_quotes_select_count_does_not_scale_with_players():
    insert_mlb_prizepicks(
        player_name="Aaron Judge",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    one = _count_odds_selects(collect_board_quotes)

    insert_mlb_prizepicks(
        player_name="Mookie Betts",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    insert_mlb_prizepicks(
        player_name="Shohei Ohtani",
        stat_type="Hits",
        line_score=1.5,
        scraped_at=_T1,
    )
    many = _count_odds_selects(collect_board_quotes)

    assert one
    assert many == one
