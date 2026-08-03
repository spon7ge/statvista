from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from app.schemas.wnba_props import WnbaPropBookQuote, WnbaPropLine
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
