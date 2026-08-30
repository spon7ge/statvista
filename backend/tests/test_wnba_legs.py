from __future__ import annotations

from datetime import datetime, timezone

from app.domains.betting.player_match_keys import match_player_key
from app.domains.wnba.props import index_parlay_api_odds_by_book


def test_index_parlay_api_odds_maps_player_points():
    now = datetime.now(timezone.utc)
    rows = [
        {
            "sportsbook": "draftkings",
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "over",
            "line_score": 22.5,
            "american_price": -120,
            "scraped_at": now,
        },
        {
            "sportsbook": "draftkings",
            "player_name": "A'ja Wilson",
            "market_type": "player_points",
            "side": "under",
            "line_score": 22.5,
            "american_price": 100,
            "scraped_at": now,
        },
        {
            "sportsbook": "draftkings",
            "player_name": "Someone",
            "market_type": "player_foo_unknown",
            "side": "over",
            "line_score": 1.5,
            "american_price": -110,
            "scraped_at": now,
        },
    ]
    indexes = index_parlay_api_odds_by_book(rows)
    key = (match_player_key("A'ja Wilson"), "points", "over", 22.5)
    assert indexes["draftkings"][key]["american"] == -120
    assert (match_player_key("Someone"), "player_foo_unknown", "over", 1.5) not in indexes.get(
        "draftkings", {}
    )
