from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core import odds_snapshots as svc


def test_nba_table_maps_use_nba_tables():
    assert svc._PRIZEPICKS_TABLE["nba"] == "nba_prizepicks"
    assert svc._UNDERDOG_TABLE["nba"] == "nba_underdogs"
    assert svc._PINNACLE_TABLE["nba"] == "nba_pinnacle"
    assert svc._PINNACLE_TEAM_TABLE["nba"] == "nba_pinnacle_team"
    assert svc._PROPHETX_TABLE["nba"] == "nba_prophetx"
    assert svc._PROPHETX_TEAM_TABLE["nba"] == "nba_prophetx_team"
    assert svc._NOVIG_TABLE["nba"] == "nba_novig"
    assert svc._NOVIG_TEAM_TABLE["nba"] == "nba_novig_team"


@pytest.mark.parametrize(
    ("fetcher_name", "table"),
    [
        ("fetch_latest_prizepicks", "nba_prizepicks"),
        ("fetch_latest_underdog", "nba_underdogs"),
        ("fetch_latest_pinnacle", "nba_pinnacle"),
        ("fetch_latest_pinnacle_team", "nba_pinnacle_team"),
        ("fetch_latest_prophetx", "nba_prophetx"),
        ("fetch_latest_prophetx_team", "nba_prophetx_team"),
        ("fetch_latest_novig", "nba_novig"),
        ("fetch_latest_novig_team", "nba_novig_team"),
        ("fetch_latest_draftkings", "nba_draftkings"),
        ("fetch_latest_fanduel", "nba_fanduel"),
    ],
)
def test_fetch_latest_nba_uses_nba_table(fetcher_name: str, table: str):
    fetcher = getattr(svc, fetcher_name)
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        fetcher("nba")

    sql, league = fetch_rows.call_args.args
    assert f"FROM odds.{table}" in sql
    assert league == "nba"
