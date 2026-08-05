from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.domains.mlb import odds as svc
from app.domains.mlb.schemas import MlbOddsGame


def test_normalize_mlb_pinnacle_spread_and_total():
    rows = [
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Los Angeles Dodgers",
            "points": -1.5,
            "american_price": -115,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "home",
            "team": "Chicago Cubs",
            "points": 1.5,
            "american_price": -105,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "over",
            "points": 8.5,
            "american_price": -110,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "under",
            "points": 8.5,
            "american_price": -110,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    g = games[0]
    assert g.away_abbrev == "LAD" and g.home_abbrev == "CHC"
    assert g.spread_team_abbrev == "LAD" and g.spread_line == -1.5
    assert g.total == 8.5
    assert g.sportsbook == "pinnacle"
    assert g.game_date == "2026-08-03"


def test_normalize_builds_team_perspective_board():
    rows = [
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "moneyline",
            "side": "away",
            "team": "Los Angeles Angels",
            "points": None,
            "american_price": 113,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "moneyline",
            "side": "home",
            "team": "Baltimore Orioles",
            "points": None,
            "american_price": -115,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Los Angeles Angels",
            "points": 1.5,
            "american_price": -182,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "spread",
            "side": "home",
            "team": "Baltimore Orioles",
            "points": -1.5,
            "american_price": 174,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "total",
            "side": "over",
            "points": 7.5,
            "american_price": -113,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "total",
            "side": "under",
            "points": 7.5,
            "american_price": 108,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    g = games[0]
    assert g.board is not None
    assert g.board.away.moneyline == 113
    assert g.board.home.moneyline == -115
    assert g.board.away.spread is not None and g.board.away.spread.line == 1.5
    assert g.board.away.spread.price == -182
    assert g.board.home.spread is not None and g.board.home.spread.line == -1.5
    assert g.board.home.spread.price == 174
    assert g.board.away.total is not None
    assert g.board.away.total.side == "over" and g.board.away.total.line == 7.5
    assert g.board.away.total.price == -113
    assert g.board.home.total is not None
    assert g.board.home.total.side == "under" and g.board.home.total.line == 7.5
    assert g.board.home.total.price == 108
    assert g.spread_team_abbrev == "BAL" and g.spread_line == -1.5
    assert g.total == 7.5


def test_normalize_keeps_board_lines_without_prices():
    rows = [
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Los Angeles Angels",
            "points": 1.5,
            "american_price": None,
        },
        {
            "away_team": "Los Angeles Angels",
            "home_team": "Baltimore Orioles",
            "start_time": "2026-08-05T23:05:00Z",
            "market_type": "total",
            "side": "over",
            "points": 7.5,
            "american_price": None,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    board = games[0].board
    assert board is not None
    assert board.away.spread is not None
    assert board.away.spread.line == 1.5 and board.away.spread.price is None
    assert board.away.total is not None
    assert board.away.total.line == 7.5 and board.away.total.price is None


def test_merge_prefers_pinnacle_board():
    from app.domains.mlb.schemas import (
        MlbOddsBoard,
        MlbOddsBoardSide,
    )

    pin = [
        MlbOddsGame(
            home_abbrev="BAL",
            away_abbrev="LAA",
            spread_team_abbrev="BAL",
            spread_line=-1.5,
            total=7.5,
            sportsbook="pinnacle",
            board=MlbOddsBoard(
                away=MlbOddsBoardSide(moneyline=113),
                home=MlbOddsBoardSide(moneyline=-115),
            ),
        )
    ]
    sharp = [
        MlbOddsGame(
            home_abbrev="BAL",
            away_abbrev="LAA",
            spread_team_abbrev="BAL",
            spread_line=-1.5,
            total=8.0,
            sportsbook="draftkings",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "pinnacle"
    assert merged[0].board is not None
    assert merged[0].board.away.moneyline == 113


def test_skips_junk_away_runs_events():
    rows = [
        {
            "away_team": "Away Runs (8 Games)",
            "home_team": "Home Runs (8 Games)",
            "start_time": "2026-08-03T22:39:00Z",
            "market_type": "total",
            "side": "over",
            "points": 7.5,
            "american_price": -110,
        }
    ]
    assert svc.normalize_pinnacle_team_rows(rows) == []


def test_arizona_maps_to_ari_not_az():
    rows = [
        {
            "away_team": "San Diego Padres",
            "home_team": "Arizona Diamondbacks",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "San Diego Padres",
            "points": -1.5,
            "american_price": -110,
        },
        {
            "away_team": "San Diego Padres",
            "home_team": "Arizona Diamondbacks",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "over",
            "points": 9.0,
            "american_price": -110,
        },
    ]
    games = svc.normalize_pinnacle_team_rows(rows)
    assert len(games) == 1
    assert games[0].home_abbrev == "ARI"
    assert games[0].away_abbrev == "SD"


def test_merge_collapses_az_and_ari_aliases():
    pin = [
        MlbOddsGame(
            home_abbrev="AZ",
            away_abbrev="SD",
            spread_team_abbrev="SD",
            spread_line=-1.5,
            total=9.0,
            sportsbook="pinnacle",
        )
    ]
    sharp = [
        MlbOddsGame(
            home_abbrev="ARI",
            away_abbrev="SD",
            spread_team_abbrev="SD",
            spread_line=-1.5,
            total=8.5,
            sportsbook="draftkings",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert len(merged) == 1
    assert merged[0].home_abbrev == "ARI"
    assert merged[0].sportsbook == "pinnacle"
    assert merged[0].total == 9.0


def test_merge_falls_back_to_sharp_when_pinnacle_empty_markets():
    pin = [MlbOddsGame(home_abbrev="CHC", away_abbrev="LAD", sportsbook="pinnacle")]
    sharp = [
        MlbOddsGame(
            home_abbrev="CHC",
            away_abbrev="LAD",
            spread_team_abbrev="LAD",
            spread_line=-1.5,
            total=8.5,
            sportsbook="draftkings",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "draftkings"
    assert merged[0].spread_line == -1.5


def test_merge_keeps_pinnacle_when_markets_present():
    pin = [
        MlbOddsGame(
            home_abbrev="CHC",
            away_abbrev="LAD",
            spread_team_abbrev="LAD",
            spread_line=-1.5,
            total=8.5,
            sportsbook="pinnacle",
            game_date="2026-08-03",
        )
    ]
    sharp = [
        MlbOddsGame(
            home_abbrev="CHC",
            away_abbrev="LAD",
            spread_team_abbrev="LAD",
            spread_line=-2.0,
            total=9.0,
            sportsbook="draftkings",
            game_date="2026-08-03",
        )
    ]
    merged = svc.merge_pinnacle_prefer_sharp(pin, sharp)
    assert merged[0].sportsbook == "pinnacle"
    assert merged[0].spread_line == -1.5


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


def test_get_today_odds_prefers_pinnacle(monkeypatch):
    pin_rows = [
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "spread",
            "side": "away",
            "team": "Los Angeles Dodgers",
            "points": -1.5,
            "american_price": -115,
        },
        {
            "away_team": "Los Angeles Dodgers",
            "home_team": "Chicago Cubs",
            "start_time": "2026-08-03T23:00:00Z",
            "market_type": "total",
            "side": "over",
            "points": 8.5,
            "american_price": -110,
        },
    ]
    sharp_games = [
        MlbOddsGame(
            home_abbrev="BOS",
            away_abbrev="NYY",
            spread_team_abbrev="NYY",
            spread_line=-1.5,
            total=8.5,
            game_date="2026-08-03",
            sportsbook="draftkings",
        )
    ]

    with (
        patch(
            "app.domains.mlb.odds.fetch_latest_pinnacle_team",
            return_value=pin_rows,
        ),
        patch.object(
            svc, "_fetch_sharp_games", return_value=(sharp_games, [])
        ),
    ):
        body = asyncio.run(svc.get_today_odds())

    assert body.sportsbook == "pinnacle"
    assert len(body.games) == 2
    chc = next(g for g in body.games if g.home_abbrev == "CHC")
    assert chc.sportsbook == "pinnacle"
    assert chc.spread_line == -1.5
    bos = next(g for g in body.games if g.home_abbrev == "BOS")
    assert bos.sportsbook == "draftkings"


def test_get_today_odds_sharp_only_when_pinnacle_empty(monkeypatch):
    sharp_games = [
        MlbOddsGame(
            home_abbrev="BOS",
            away_abbrev="NYY",
            spread_team_abbrev="NYY",
            spread_line=-1.5,
            total=8.5,
            game_date="2026-08-03",
            sportsbook="draftkings",
        )
    ]

    with (
        patch(
            "app.domains.mlb.odds.fetch_latest_pinnacle_team",
            return_value=[],
        ),
        patch.object(
            svc, "_fetch_sharp_games", return_value=(sharp_games, [])
        ),
    ):
        body = asyncio.run(svc.get_today_odds())

    assert body.sportsbook == "draftkings"
    assert len(body.games) == 1
    assert body.games[0].away_abbrev == "NYY"
