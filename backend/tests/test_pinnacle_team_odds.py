from __future__ import annotations

from unittest.mock import patch

import pytest

from app.providers.pinnacle import team_odds as svc
from app.domains.wnba.schemas_odds import WnbaOddsGame


def test_normalize_spread_and_total():
    rows = [
        {
            "away_team": "Las Vegas Aces",
            "home_team": "Atlanta Dream",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "home",
            "team": "Atlanta Dream",
            "points": -1.5,
            "american_price": -117,
        },
        {
            "away_team": "Las Vegas Aces",
            "home_team": "Atlanta Dream",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Las Vegas Aces",
            "points": 1.5,
            "american_price": -103,
        },
        {
            "away_team": "Las Vegas Aces",
            "home_team": "Atlanta Dream",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "over",
            "team": None,
            "points": 186.0,
            "american_price": -104,
        },
        {
            "away_team": "Las Vegas Aces",
            "home_team": "Atlanta Dream",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "under",
            "team": None,
            "points": 186.0,
            "american_price": -120,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    g = games[0]
    assert g.home_abbrev == "ATL" and g.away_abbrev == "LVA"
    assert g.spread_team_abbrev == "ATL" and g.spread_line == -1.5
    assert g.total == 186.0
    assert g.sportsbook == "pinnacle"
    assert g.game_date == "2026-08-03"


def test_merge_falls_back_to_sharp_when_pinnacle_empty_markets():
    pin = [WnbaOddsGame(home_abbrev="ATL", away_abbrev="LVA", sportsbook="pinnacle")]
    sharp = [
        WnbaOddsGame(
            home_abbrev="ATL",
            away_abbrev="LVA",
            spread_team_abbrev="ATL",
            spread_line=-2.0,
            total=180.0,
            sportsbook="draftkings",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "draftkings"
    assert merged[0].spread_line == -2.0


def test_merge_keeps_pinnacle_when_markets_present():
    pin = [
        WnbaOddsGame(
            home_abbrev="ATL",
            away_abbrev="LVA",
            spread_team_abbrev="ATL",
            spread_line=-1.5,
            total=186.0,
            sportsbook="pinnacle",
            game_date="2026-08-03",
        )
    ]
    sharp = [
        WnbaOddsGame(
            home_abbrev="ATL",
            away_abbrev="LVA",
            spread_team_abbrev="ATL",
            spread_line=-2.0,
            total=180.0,
            sportsbook="draftkings",
            game_date="2026-08-03",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "pinnacle"
    assert merged[0].spread_line == -1.5


def test_merge_falls_back_to_sharp_on_mismatched_game_date():
    pin = [
        WnbaOddsGame(
            home_abbrev="ATL",
            away_abbrev="LVA",
            sportsbook="pinnacle",
            game_date="2026-08-04",
        )
    ]
    sharp = [
        WnbaOddsGame(
            home_abbrev="ATL",
            away_abbrev="LVA",
            spread_team_abbrev="ATL",
            spread_line=-2.0,
            total=180.0,
            sportsbook="draftkings",
            game_date="2026-08-03",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert len(merged) == 1
    assert merged[0].sportsbook == "draftkings"
    assert merged[0].spread_line == -2.0
    assert merged[0].total == 180.0


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


def test_get_today_odds_merges_pinnacle_and_sharp():
    pin_rows = [
        {
            "away_team": "Las Vegas Aces",
            "home_team": "Atlanta Dream",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "home",
            "team": "Atlanta Dream",
            "points": -1.5,
            "american_price": -117,
        },
    ]
    sharp_games = [
        WnbaOddsGame(
            home_abbrev="WAS",
            away_abbrev="DAL",
            spread_team_abbrev="DAL",
            spread_line=-3.5,
            total=167.5,
            game_date="2026-08-03",
            sportsbook="draftkings",
        )
    ]

    with (
        patch(
            "app.providers.pinnacle.team_odds.fetch_latest_pinnacle_team",
            return_value=pin_rows,
        ),
        patch.object(svc, "_fetch_sharp_games", return_value=(sharp_games, [])),
    ):
        body = __import__("asyncio").run(svc.get_today_odds())

    assert len(body.games) == 2
    atl = next(g for g in body.games if g.home_abbrev == "ATL")
    assert atl.sportsbook == "pinnacle"
    assert atl.spread_line == -1.5
    was = next(g for g in body.games if g.home_abbrev == "WAS")
    assert was.sportsbook == "draftkings"
