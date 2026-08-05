from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from app.domains.wnba.schemas_props import WnbaPropBookQuote, WnbaPropLine
from app.services import parlay_props as svc
from app.services.dfs_attach import attach_pinnacle_snapshot


def test_attach_overwrites_null_pinnacle():
    props = [
        WnbaPropLine(
            player_name="A'ja Wilson",
            stat="Points",
            market_type="prizepicks:Points",
            side="over",
            prizepicks=WnbaPropBookQuote(line=26.5, odds_american=100),
            pinnacle=None,
        )
    ]
    pin_rows = [
        {
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 26.5,
            "american_price": -102,
        }
    ]
    out = attach_pinnacle_snapshot(props, pin_rows)
    assert out[0].pinnacle is not None
    assert out[0].pinnacle.line == 26.5
    assert out[0].pinnacle.odds_american == -102


def test_attach_pick_closest_when_pinnacle_line_differs_from_dfs_slot():
    props = [
        WnbaPropLine(
            player_name="A'ja Wilson",
            stat="Points",
            market_type="prizepicks:Points",
            side="over",
            prizepicks=WnbaPropBookQuote(line=26.5, odds_american=100),
        )
    ]
    pin_rows = [
        {
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 27.5,
            "american_price": -115,
        }
    ]
    out = attach_pinnacle_snapshot(props, pin_rows)
    assert out[0].pinnacle is not None
    assert out[0].pinnacle.line == 27.5
    assert out[0].pinnacle.odds_american == -115


def test_attach_skips_when_line_too_far_from_dfs_slot():
    props = [
        WnbaPropLine(
            player_name="A'ja Wilson",
            stat="Points",
            market_type="prizepicks:Points",
            side="over",
            prizepicks=WnbaPropBookQuote(line=26.5, odds_american=100),
        )
    ]
    pin_rows = [
        {
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 30.5,
            "american_price": -200,
        }
    ]
    out = attach_pinnacle_snapshot(props, pin_rows)
    assert out[0].pinnacle is None


def test_normalize_skips_pinnacle_rows():
    rows = [
        {
            "bookmaker": "pinnacle",
            "market_key": "player_points",
            "player": "A'ja Wilson",
            "line": 99.5,
            "over_price": -110,
            "under_price": -110,
            "home_team": "Atlanta Dream",
            "away_team": "Las Vegas Aces",
        },
        {
            "bookmaker": "fanduel",
            "market_key": "player_points",
            "player": "A'ja Wilson",
            "line": 25.5,
            "over_price": -115,
            "under_price": -105,
            "home_team": "Atlanta Dream",
            "away_team": "Las Vegas Aces",
        },
    ]
    props = svc.normalize_parlay_props(rows)
    assert len(props) == 2
    for prop in props:
        assert prop.pinnacle is None
        if prop.side == "over":
            assert prop.fanduel is not None
            assert prop.fanduel.line == 25.5


def test_get_today_props_pinnacle_from_supabase_snapshot():
    parlay_payload = [
        {
            "bookmaker": "pinnacle",
            "market_key": "player_points",
            "player": "A'ja Wilson",
            "line": 99.5,
            "over_price": -110,
            "under_price": -110,
            "home_team": "Atlanta Dream",
            "away_team": "Las Vegas Aces",
        },
        {
            "bookmaker": "fanduel",
            "market_key": "player_points",
            "player": "A'ja Wilson",
            "line": 25.5,
            "over_price": -115,
            "under_price": -105,
            "home_team": "Atlanta Dream",
            "away_team": "Las Vegas Aces",
        },
    ]
    pin_snapshot = [
        {
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 26.5,
            "american_price": -102,
        }
    ]
    pp_snapshot = [
        {
            "player_name": "A'ja Wilson",
            "stat_type": "Points",
            "line_score": 26.5,
            "odds_type": "standard",
        }
    ]

    async def _run():
        with (
            patch("app.services.parlay_props.parlay_get", new_callable=AsyncMock) as mock_get,
            patch("app.services.parlay_props.fetch_latest_pinnacle", return_value=pin_snapshot),
            patch("app.services.parlay_props.fetch_latest_prizepicks", return_value=pp_snapshot),
            patch("app.services.parlay_props.fetch_latest_underdog", return_value=[]),
            patch(
                "app.services.parlay_props.build_player_team_index",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch("src.odds.load_snapshots.maybe_persist_parlay_props"),
            patch("app.services.parlay_props.PARLAY_API_KEY", "test-key"),
        ):
            mock_get.return_value = parlay_payload
            svc._cache.clear()
            return await svc.get_today_props()

    body = asyncio.run(_run())
    over = next(
        p for p in body.props if p.player_name == "A'ja Wilson" and p.side == "over"
    )
    assert over.prizepicks is not None
    assert over.prizepicks.line == 26.5
    assert over.fanduel is not None
    assert over.fanduel.line == 25.5
    assert over.pinnacle is not None
    assert over.pinnacle.line == 26.5
    assert over.pinnacle.odds_american == -102


def test_fetch_allowlist_excludes_pinnacle():
    payload = [
        {
            "bookmaker": "pinnacle",
            "market_key": "player_points",
            "player": "A",
            "line": 20.5,
            "over_price": -110,
            "under_price": -110,
        },
        {
            "bookmaker": "fanduel",
            "market_key": "player_points",
            "player": "A",
            "line": 20.5,
            "over_price": -110,
            "under_price": -110,
        },
    ]

    async def _run() -> list[dict]:
        with patch("app.services.parlay_props.parlay_get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = payload
            return await svc.fetch_parlay_prop_rows()

    rows = asyncio.run(_run())
    books = {str(r.get("bookmaker") or "").lower() for r in rows}
    assert "pinnacle" not in books
    assert "fanduel" in books
