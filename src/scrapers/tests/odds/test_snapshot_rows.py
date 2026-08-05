from datetime import datetime, timezone

import pytest

from src.odds.snapshot_rows import (
    parse_american_price,
    parlay_props_to_api_odds_rows,
    parlay_props_to_book_rows,
    prizepicks_projections_to_rows,
    prophetx_props_to_rows,
    prophetx_team_to_rows,
    sharp_props_to_book_rows,
    underdog_picks_to_rows,
)


def test_parse_american_price():
    assert parse_american_price("+477") == 477
    assert parse_american_price("-130") == -130
    assert parse_american_price(None) is None


def test_prizepicks_mapper():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rows = prizepicks_projections_to_rows(
        [{"player": "A'ja Wilson", "stat_type": "Points", "line_score": 22.5,
          "odds_type": "standard", "updated_at": "2026-07-31T12:00:00-04:00", "league": "WNBA"}],
        league="wnba",
        scraped_at=scraped,
    )
    assert rows[0]["player_name"] == "A'ja Wilson"
    assert rows[0]["league"] == "wnba"
    assert rows[0]["line_score"] == 22.5
    assert rows[0]["scraped_at"] == scraped


def test_underdog_mapper():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rows = underdog_picks_to_rows(
        [{"full_name": "Caitlin Clark", "stat_name": "points", "stat_value": "19.5",
          "choice": "over", "american_price": "-130", "payout_multiplier": "0.94",
          "updated_at": "2026-07-31T23:57:11Z"}],
        league="wnba",
        scraped_at=scraped,
    )
    assert rows[0]["side"] == "over"
    assert rows[0]["american_price"] == -130
    assert float(rows[0]["line_score"]) == 19.5


def test_sharp_props_to_book_rows_filters_and_maps():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rows = sharp_props_to_book_rows(
        [
            {
                "sportsbook": "fanduel",
                "is_main_line": True,
                "market_type": "player_assists",
                "selection_type": "over",
                "player_name": "Rhyne Howard",
                "stat_category": "assists",
                "line": 3.5,
                "odds_american": -114,
            },
            {
                "sportsbook": "draftkings",
                "is_main_line": True,
                "market_type": "player_assists",
                "selection_type": "over",
                "player_name": "Rhyne Howard",
                "stat_category": "assists",
                "line": 3.5,
                "odds_american": -120,
            },
            {
                "sportsbook": "fanduel",
                "is_main_line": False,
                "market_type": "player_assists",
                "selection_type": "over",
                "player_name": "Alt Line",
                "line": 4.5,
                "odds_american": -110,
            },
            {
                "sportsbook": "fanduel",
                "is_main_line": True,
                "market_type": "team_total",
                "selection_type": "over",
                "player_name": "Team",
                "line": 80.5,
                "odds_american": -110,
            },
        ],
        sportsbook="fanduel",
        league="WNBA",
        scraped_at=scraped,
    )
    assert len(rows) == 1
    assert rows[0] == {
        "league": "wnba",
        "player_name": "Rhyne Howard",
        "market_type": "player_assists",
        "stat_category": "assists",
        "side": "over",
        "line_score": 3.5,
        "american_price": -114,
        "scraped_at": scraped,
    }


def test_sharp_props_to_book_rows_rejects_unknown_book():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    with pytest.raises(ValueError, match="unsupported sportsbook"):
        sharp_props_to_book_rows(
            [], sportsbook="betmgm", league="wnba", scraped_at=scraped
        )


def test_parlay_props_to_book_rows_main_line_over_under():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rows = parlay_props_to_book_rows(
        [
            {
                "bookmaker": "pinnacle",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -108,
                "under_price": -112,
            },
            {
                "bookmaker": "pinnacle",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 4.5,
                "over_price": 140,
                "under_price": -180,
            },
            {
                "bookmaker": "fanduel",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -114,
                "under_price": -110,
            },
        ],
        sportsbook="pinnacle",
        league="WNBA",
        scraped_at=scraped,
    )
    assert len(rows) == 2
    sides = {r["side"]: r for r in rows}
    assert sides["over"]["line_score"] == 3.5
    assert sides["over"]["american_price"] == -108
    assert sides["under"]["american_price"] == -112
    assert sides["over"]["stat_category"] == "Assists"
    assert sides["over"]["sportsbook"] == "pinnacle"


def test_parlay_props_to_api_odds_rows_multi_book_skips_pinnacle_when_excluded():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rows = parlay_props_to_api_odds_rows(
        [
            {
                "bookmaker": "fanduel",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -114,
                "under_price": -110,
            },
            {
                "bookmaker": "pinnacle",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -108,
                "under_price": -112,
            },
            {
                "bookmaker": "novig",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -110,
                "under_price": -110,
            },
        ],
        league="wnba",
        scraped_at=scraped,
        books=("fanduel", "novig"),
    )
    books = {r["sportsbook"] for r in rows}
    assert books == {"fanduel", "novig"}
    assert "pinnacle" not in books
    assert len(rows) == 4


def test_parlay_props_to_book_rows_allows_one_sided_dfs():
    scraped = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rows = parlay_props_to_book_rows(
        [
            {
                "bookmaker": "fanduel",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -114,
                "under_price": -110,
            },
            {
                "bookmaker": "underdog",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 3.5,
                "over_price": -110,
                "under_price": None,
            },
            {
                "bookmaker": "underdog",
                "player": "Rhyne Howard",
                "market_key": "player_assists",
                "market": "Assists",
                "line": 6.5,
                "over_price": -110,
                "under_price": None,
            },
        ],
        sportsbook="underdog",
        league="wnba",
        scraped_at=scraped,
    )
    assert len(rows) == 1
    assert rows[0]["side"] == "over"
    assert rows[0]["line_score"] == 3.5
    assert rows[0]["american_price"] == -110


def test_prophetx_props_to_rows_emits_over_under_with_stake():
    scraped = datetime(2026, 8, 5, tzinfo=timezone.utc)
    games = [
        {
            "event_id": 10079004,
            "scheduled": "2026-08-05T22:35:00Z",
            "competitors": [
                {"name": "Baltimore Orioles", "seq": 0},
                {"name": "Los Angeles Angels", "seq": 1},
            ],
            "props": [
                {
                    "player": "Mike Trout",
                    "stat": "hits",
                    "line": 0.5,
                    "over": {"american": -200, "stake": 134.33},
                    "under": {"american": 172, "stake": 400.37},
                    "market_id": 460000600,
                    "sub_type": "player_total_hits",
                },
                {
                    "player": "Skip Me",
                    "stat": "hits",
                    "line": 0.5,
                    "over": {"american": None, "stake": 1},
                    "under": None,
                    "market_id": 1,
                    "sub_type": "player_total_hits",
                },
            ],
        }
    ]
    rows = prophetx_props_to_rows(games, league="mlb", scraped_at=scraped)
    assert len(rows) == 2
    over = next(r for r in rows if r["side"] == "over")
    assert over["player_name"] == "Mike Trout"
    assert over["stat_name"] == "hits"
    assert float(over["line_score"]) == 0.5
    assert over["american_price"] == -200
    assert float(over["stake"]) == 134.33
    assert over["away_team"] == "Los Angeles Angels"
    assert over["home_team"] == "Baltimore Orioles"
    assert over["event_id"] == 10079004
    assert over["scraped_at"] == scraped


def test_prophetx_team_to_rows_moneyline_and_run_line():
    scraped = datetime(2026, 8, 5, tzinfo=timezone.utc)
    games = [
        {
            "event_id": 10079004,
            "scheduled": "2026-08-05T22:35:00Z",
            "competitors": [
                {"id": 10000019, "name": "Baltimore Orioles", "seq": 0},
                {"id": 10000021, "name": "Los Angeles Angels", "seq": 1},
            ],
            "team_markets": {
                "moneyline": [
                    {
                        "name": "Baltimore Orioles",
                        "competitor_id": 10000019,
                        "american": -134,
                        "line": None,
                        "stake": 100.0,
                    },
                    {
                        "name": "Los Angeles Angels",
                        "competitor_id": 10000021,
                        "american": 129,
                        "line": None,
                        "stake": 50.0,
                    },
                ],
                "run_line": [
                    {
                        "name": "Baltimore Orioles -1",
                        "competitor_id": 10000019,
                        "american": 110,
                        "line": -1,
                        "stake": 2.2,
                    },
                ],
                "total": [
                    {"name": "over 8", "competitor_id": None, "american": 105, "line": 8, "stake": 3654.5},
                    {"name": "under 8", "competitor_id": None, "american": -107, "line": 8, "stake": 445.14},
                ],
                "1st_inning_moneyline": [
                    {
                        "name": "Baltimore Orioles",
                        "competitor_id": 10000019,
                        "american": -105,
                        "line": None,
                        "stake": 10.0,
                    },
                ],
            },
        }
    ]
    rows = prophetx_team_to_rows(games, league="mlb", scraped_at=scraped)
    types = {r["market_type"] for r in rows}
    assert types == {"moneyline", "run_line", "total", "1st_inning_moneyline"}
    ml = [r for r in rows if r["market_type"] == "moneyline"]
    assert len(ml) == 2
    assert ml[0]["american_price"] == -134
    assert float(ml[0]["stake"]) == 100.0
    assert ml[0]["side"] == "home"
    assert ml[0]["team"] == "Baltimore Orioles"
    assert ml[1]["side"] == "away"
    assert ml[1]["team"] == "Los Angeles Angels"
    rl = next(r for r in rows if r["market_type"] == "run_line")
    assert float(rl["points"]) == -1.0
    assert rl["side"] == "home"
    assert rl["team"] == "Baltimore Orioles -1"
    totals = {r["side"]: r for r in rows if r["market_type"] == "total"}
    assert set(totals) == {"over", "under"}
    assert totals["over"]["team"] == "over 8"
    assert totals["under"]["team"] == "under 8"
    assert float(totals["over"]["points"]) == 8.0
    inn = next(r for r in rows if r["market_type"] == "1st_inning_moneyline")
    assert inn["side"] == "home"
    assert inn["team"] == "Baltimore Orioles"
