from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.core import odds_snapshots as svc


def _mock_engine(rows: list[dict]):
    conn = MagicMock()
    result = MagicMock()
    result.__iter__ = lambda self: iter(
        [MagicMock(_mapping=row) for row in rows]
    )
    conn.execute.return_value = result
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    engine = MagicMock()
    engine.connect.return_value = conn
    return engine, conn


def test_pinnacle_sql_targets_wnba_pinnacle_table():
    assert "odds.wnba_pinnacle" in svc._PINNACLE_SQL
    assert "market_type" in svc._PINNACLE_SQL
    assert "american_price" in svc._PINNACLE_SQL


def test_pinnacle_team_sql_excludes_alternates_and_non_full_game():
    engine, conn = _mock_engine([])
    with patch("src.utils.db.get_engine", return_value=engine):
        svc.fetch_latest_pinnacle_team("wnba")
    sql = str(conn.execute.call_args[0][0])
    assert "odds.wnba_pinnacle_team" in sql
    assert "period = 0" in sql
    assert "is_alternate = false" in sql


def test_fetch_latest_pinnacle_team_mlb_uses_mlb_table():
    engine, conn = _mock_engine([])
    with patch("src.utils.db.get_engine", return_value=engine):
        svc.fetch_latest_pinnacle_team("mlb")
    sql = str(conn.execute.call_args[0][0])
    assert "mlb_pinnacle_team" in sql
    params = conn.execute.call_args[0][1]
    assert params["league"] == "mlb"


def test_fetch_latest_pinnacle_returns_rows():
    rows = [
        {
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 22.5,
            "american_price": -115,
        }
    ]
    engine, conn = _mock_engine(rows)

    with patch("src.utils.db.get_engine", return_value=engine):
        out = svc.fetch_latest_pinnacle("wnba")

    assert out == rows
    conn.execute.assert_called_once()
    params = conn.execute.call_args[0][1]
    assert params["league"] == "wnba"


def test_fetch_latest_pinnacle_team_returns_rows():
    rows = [
        {
            "away_team": "Las Vegas Aces",
            "home_team": "New York Liberty",
            "start_time": "2026-08-03T19:00:00+00:00",
            "market_type": "spread",
            "period": 0,
            "is_alternate": False,
            "side": "away",
            "team": "Las Vegas Aces",
            "points": -4.5,
            "american_price": -110,
            "matchup_id": 12345,
        }
    ]
    engine, conn = _mock_engine(rows)

    with patch("src.utils.db.get_engine", return_value=engine):
        out = svc.fetch_latest_pinnacle_team("wnba")

    assert out == rows
    conn.execute.assert_called_once()
    params = conn.execute.call_args[0][1]
    assert params["league"] == "wnba"


def test_fetch_latest_pinnacle_empty_on_db_error():
    with patch("src.utils.db.get_engine", side_effect=RuntimeError("no db")):
        assert svc.fetch_latest_pinnacle() == []


def test_fetch_latest_pinnacle_team_empty_on_query_error():
    engine = MagicMock()
    conn = MagicMock()
    conn.execute.side_effect = Exception("query failed")
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    engine.connect.return_value = conn

    with patch("src.utils.db.get_engine", return_value=engine):
        assert svc.fetch_latest_pinnacle_team() == []


def test_fetch_latest_prophetx_team_filters_full_game_markets():
    engine, conn = _mock_engine([])
    with patch("src.utils.db.get_engine", return_value=engine):
        svc.fetch_latest_prophetx_team("mlb")
    sql = str(conn.execute.call_args[0][0])
    assert "odds.mlb_prophetx_team" in sql
    assert "run_line" in sql
    assert "moneyline" in sql
    params = conn.execute.call_args[0][1]
    assert params["league"] == "mlb"
