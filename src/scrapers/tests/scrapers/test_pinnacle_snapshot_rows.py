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


def test_mlb_props_map_baseball_stats_to_player_markets():
    games = [{
        "participants": ["Baltimore Orioles", "Minnesota Twins"],
        "props": [
            {
                "stat": "strikeouts",
                "player": "Dean Kremer",
                "line": 5.5,
                "american_over": 108,
                "american_under": -143,
            },
            {
                "stat": "home_runs",
                "player": "Aaron Judge",
                "line": 0.5,
                "american_over": -120,
                "american_under": 100,
            },
            {
                "stat": "hits_allowed",
                "player": "Trevor Rogers",
                "line": 5.5,
                "american_over": -110,
                "american_under": -110,
            },
            {
                "stat": "runs",
                "player": "Juan Soto",
                "line": 0.5,
                "american_over": -105,
                "american_under": -115,
            },
        ],
    }]
    rows = selenium_pinnacle_props_to_rows(games, league="mlb", scraped_at=SCRAPED)
    assert len(rows) == 8
    by_key = {(r["player_name"], r["market_type"], r["side"]): r for r in rows}
    assert by_key[("Dean Kremer", "player_strikeouts", "over")]["american_price"] == 108
    assert by_key[("Aaron Judge", "player_home_runs", "under")]["line_score"] == 0.5
    assert by_key[("Trevor Rogers", "player_hits_allowed", "over")]["american_price"] == -110
    assert by_key[("Juan Soto", "player_runs", "under")]["american_price"] == -115


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
