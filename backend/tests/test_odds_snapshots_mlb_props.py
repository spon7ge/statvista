from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from app.core import odds_snapshots as svc
from src.odds import load_snapshots


@pytest.mark.parametrize(
    ("fetcher", "table"),
    [
        (svc.fetch_latest_prizepicks, "mlb_prizepicks"),
        (svc.fetch_latest_underdog, "mlb_underdogs"),
        (svc.fetch_latest_pinnacle, "mlb_pinnacle"),
    ],
)
def test_mlb_prop_fetchers_route_to_league_table(fetcher, table):
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        fetcher(" MLB ")

    sql, league = fetch_rows.call_args.args
    assert f"FROM odds.{table}" in sql
    assert "DISTINCT ON" in sql
    assert "scraped_at DESC" in sql
    assert f"SELECT MAX(scraped_at) FROM odds.{table}" not in sql
    assert league == "mlb"


def test_fetch_latest_prophetx_reads_latest_mlb_snapshot():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_prophetx()

    sql, league = fetch_rows.call_args.args
    assert "player_name, stat_name, line_score, side, american_price, scraped_at" in sql
    assert "FROM odds.mlb_prophetx" in sql
    assert "DISTINCT ON" in sql
    assert "scraped_at DESC" in sql
    assert "AND is_main = true" not in sql
    assert "SELECT MAX(scraped_at) FROM odds.mlb_prophetx" not in sql
    assert league == "mlb"


def test_fetch_latest_novig_reads_latest_mlb_snapshot():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_novig()

    sql, league = fetch_rows.call_args.args
    assert "player_name, stat_name, line_score, side, american_price, scraped_at" in sql
    assert "FROM odds.mlb_novig" in sql
    assert "DISTINCT ON" in sql
    assert "scraped_at DESC" in sql
    assert "AND is_main = true" not in sql
    assert "SELECT MAX(scraped_at) FROM odds.mlb_novig" not in sql
    assert league == "mlb"


@pytest.mark.parametrize(
    ("fetcher", "table"),
    [
        (svc.fetch_latest_prophetx, "mlb_prophetx"),
        (svc.fetch_latest_novig, "mlb_novig"),
    ],
)
def test_fetch_latest_px_novig_mains_only_filters_is_main(fetcher, table):
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        fetcher("mlb", mains_only=True)

    sql, league = fetch_rows.call_args.args
    assert f"FROM odds.{table}" in sql
    assert "AND is_main = true" in sql
    assert "DISTINCT ON" in sql
    assert league == "mlb"


def test_load_pinnacle_props_snapshot_routes_mlb_to_mlb_table():
    scraped_at = datetime(2026, 8, 5, tzinfo=timezone.utc)
    rows = [
        {
            "league": "mlb",
            "player_name": "Shohei Ohtani",
            "market_type": "player_total_bases",
            "stat_category": "hitting",
            "side": "over",
            "line_score": 1.5,
            "american_price": -110,
            "scraped_at": scraped_at,
            "fetched_at": scraped_at,
        }
    ]

    with (
        patch.object(
            load_snapshots,
            "selenium_pinnacle_props_to_rows",
            return_value=rows,
        ),
        patch.object(
            load_snapshots,
            "apply_change_filter",
            side_effect=lambda table, df, league: df,
        ),
        patch.object(load_snapshots, "upsert_df") as upsert_df,
    ):
        count = load_snapshots.load_pinnacle_props_snapshot(
            [{}],
            league=" MLB ",
            scraped_at=scraped_at,
        )

    assert count == 1
    assert upsert_df.call_args.args[0] == "mlb_pinnacle"
