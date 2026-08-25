from __future__ import annotations

from datetime import datetime, timezone

import pytest

from odds_seed import insert_mlb_prizepicks

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
