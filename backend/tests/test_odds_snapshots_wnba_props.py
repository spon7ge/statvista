from unittest.mock import patch

from app.core import odds_snapshots as svc


def test_fetch_latest_prophetx_wnba_reads_wnba_table():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_prophetx("wnba")
    sql, league = fetch_rows.call_args.args
    assert "FROM odds.wnba_prophetx" in sql
    assert league == "wnba"


def test_fetch_latest_novig_wnba_reads_wnba_table():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_novig("wnba")
    sql, league = fetch_rows.call_args.args
    assert "FROM odds.wnba_novig" in sql
    assert league == "wnba"
