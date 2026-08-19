from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from app.core import odds_snapshots as svc
from app.domains.mlb import props as mlb_props
from app.domains.mlb.prop_fair import american_to_fair_pct


def test_fetch_latest_parlay_api_odds_mlb_sql():
    assert hasattr(svc, "fetch_latest_parlay_api_odds")
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_parlay_api_odds("mlb")

    sql, league = fetch_rows.call_args.args
    assert "FROM odds.mlb_parlay_api_odds" in sql
    assert "DISTINCT ON (sportsbook, league, player_name, market_type, side)" in sql
    assert "scraped_at DESC" in sql
    assert "sportsbook, player_name, market_type, side, line_score" in sql
    assert "american_price, scraped_at" in sql
    assert "SELECT MAX(scraped_at) FROM odds.mlb_parlay_api_odds" not in sql
    assert league == "mlb"


def test_fetch_latest_parlay_api_odds_defaults_to_mlb_table():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_parlay_api_odds()

    sql, league = fetch_rows.call_args.args
    assert "FROM odds.mlb_parlay_api_odds" in sql
    assert league == "mlb"


def test_fetch_latest_parlay_api_odds_wnba_sql():
    with patch.object(svc, "_fetch_rows", return_value=[]) as fetch_rows:
        svc.fetch_latest_parlay_api_odds(" WNBA ")

    sql, league = fetch_rows.call_args.args
    assert "FROM odds.wnba_parlay_api_odds" in sql
    assert "DISTINCT ON (sportsbook, league, player_name, market_type, side)" in sql
    assert league == "wnba"


def test_index_parlay_api_odds_by_book_builds_side_keys():
    scraped_at = datetime(2026, 8, 19, 16, 0, tzinfo=timezone.utc)
    rows = [
        {
            "sportsbook": "draftkings",
            "player_name": "Aaron Judge",
            "market_type": "batter_home_runs",
            "side": "over",
            "line_score": 0.5,
            "american_price": -130,
            "scraped_at": scraped_at,
        },
        {
            "sportsbook": "kalshi",
            "player_name": "Aaron Judge",
            "market_type": "batter_home_runs",
            "side": "under",
            "line_score": 0.5,
            "american_price": 110,
            "scraped_at": scraped_at.isoformat(),
        },
    ]
    assert hasattr(mlb_props, "index_parlay_api_odds_by_book")
    indexes = mlb_props.index_parlay_api_odds_by_book(rows)
    assert "draftkings" in indexes
    assert "kalshi" in indexes

    dk_key = ("aaron judge", "home_runs", "over", 0.5)
    kalshi_key = ("aaron judge", "home_runs", "under", 0.5)
    assert dk_key in indexes["draftkings"]
    assert kalshi_key in indexes["kalshi"]

    dk_hit = indexes["draftkings"][dk_key]
    assert dk_hit["american"] == -130
    assert dk_hit["fair_pct"] == american_to_fair_pct(-130)
    assert dk_hit["changed_at"] == scraped_at

    kalshi_hit = indexes["kalshi"][kalshi_key]
    assert kalshi_hit["american"] == 110
    assert kalshi_hit["fair_pct"] == american_to_fair_pct(110)
    assert kalshi_hit["changed_at"] == scraped_at


def test_index_parlay_api_odds_by_book_skips_unknown_markets():
    rows = [
        {
            "sportsbook": "fanduel",
            "player_name": "Aaron Judge",
            "market_type": "player_first_touchdown",
            "side": "over",
            "line_score": 0.5,
            "american_price": -110,
            "scraped_at": "2026-08-19T16:00:00+00:00",
        }
    ]
    assert hasattr(mlb_props, "index_parlay_api_odds_by_book")
    assert mlb_props.index_parlay_api_odds_by_book(rows) == {}
