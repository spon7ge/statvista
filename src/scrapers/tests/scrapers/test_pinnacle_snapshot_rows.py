from datetime import datetime, timezone

from src.odds.snapshot_rows import (
    selenium_pinnacle_props_to_rows,
    selenium_pinnacle_team_to_rows,
)

SCRAPED = datetime(2026, 8, 3, 10, 0, tzinfo=timezone.utc)


def test_props_emit_over_under_player_points():
    games = [{
        "participants": ["Las Vegas Aces", "Atlanta Dream"],
        "props": [{
            "stat": "points",
            "player": "A'ja Wilson",
            "line": 26.5,
            "american_over": -102,
            "american_under": -130,
        }],
    }]
    rows = selenium_pinnacle_props_to_rows(games, league="wnba", scraped_at=SCRAPED)
    assert len(rows) == 2
    by_side = {r["side"]: r for r in rows}
    assert by_side["over"]["market_type"] == "player_points"
    assert by_side["over"]["line_score"] == 26.5
    assert by_side["over"]["american_price"] == -102
    assert by_side["under"]["american_price"] == -130


def test_team_mains_and_alts():
    games = [{
        "matchup_id": 1,
        "participants": ["Las Vegas Aces", "Atlanta Dream"],
        "start_time": "2026-08-03T23:00:00Z",
        "team_markets": {
            "moneyline": [{
                "period": 0,
                "lines": [
                    {"side": "home", "team": "Atlanta Dream", "american": -134, "decimal": 1.746},
                    {"side": "away", "team": "Las Vegas Aces", "american": 111, "decimal": 2.11},
                ],
            }],
            "spread": [{
                "period": 0,
                "is_alternate": True,
                "lines": [
                    {"side": "home", "team": "Atlanta Dream", "points": 1.5, "american": -151, "decimal": 1.662},
                    {"side": "away", "team": "Las Vegas Aces", "points": -1.5, "american": 119, "decimal": 2.19},
                ],
            }],
            "total": [],
        },
    }]
    rows = selenium_pinnacle_team_to_rows(games, league="wnba", scraped_at=SCRAPED)
    assert any(r["market_type"] == "moneyline" and r["points"] is None for r in rows)
    assert any(r["market_type"] == "spread" and r["is_alternate"] is True for r in rows)
    assert all(r["away_team"] == "Las Vegas Aces" and r["home_team"] == "Atlanta Dream" for r in rows)
