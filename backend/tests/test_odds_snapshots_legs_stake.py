from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core import odds_snapshots as svc


@pytest.mark.parametrize(
    ("fetcher", "table"),
    [
        (svc.fetch_latest_prophetx, "mlb_prophetx"),
        (svc.fetch_latest_novig, "mlb_novig"),
    ],
)
def test_fetch_latest_px_novig_happy_path_includes_stake(fetcher, table):
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        fetcher("mlb")

    sql, league = fetch_rows.call_args.args
    assert (
        "player_name, stat_name, line_score, side, american_price, stake, scraped_at"
        in sql
    )
    assert f"FROM odds.{table}" in sql
    assert "DISTINCT ON" in sql
    assert league == "mlb"


@pytest.mark.parametrize(
    ("fetcher", "table"),
    [
        (svc.fetch_latest_prophetx, "mlb_prophetx"),
        (svc.fetch_latest_novig, "mlb_novig"),
    ],
)
def test_fetch_player_prop_snapshot_mains_only_drops_is_main_filter_when_column_missing(
    fetcher, table
):
    is_main_exc = Exception('column "is_main" does not exist')
    rows = [{"player_name": "Mike Trout", "line_score": 1.5}]

    with patch.object(svc, "_fetch_rows") as fetch_rows:
        fetch_rows.side_effect = [is_main_exc, rows]
        out = fetcher("mlb", mains_only=True)

    assert out == rows
    assert fetch_rows.call_count == 2
    first_sql = fetch_rows.call_args_list[0].args[0]
    second_sql = fetch_rows.call_args_list[1].args[0]
    assert "AND is_main = true" in first_sql
    assert "AND is_main = true" not in second_sql
    assert f"FROM odds.{table}" in second_sql


def test_fetch_player_prop_snapshot_retries_without_stake_when_undefined():
    stake_exc = Exception('column "stake" does not exist')
    rows = [{"player_name": "Mike Trout", "stake": None}]

    with patch.object(svc, "_fetch_rows") as fetch_rows:
        fetch_rows.side_effect = [stake_exc, rows]
        out = svc._fetch_player_prop_snapshot("mlb_prophetx", "mlb")

    assert out == rows
    assert fetch_rows.call_count == 2
    first_sql = fetch_rows.call_args_list[0].args[0]
    second_sql = fetch_rows.call_args_list[1].args[0]
    assert "stake" in first_sql
    assert "stake" not in second_sql
    assert "is_main" in first_sql
    assert "is_main" in second_sql
