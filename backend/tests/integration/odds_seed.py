from __future__ import annotations

from datetime import datetime

from sqlalchemy import text

from src.utils.db import get_engine


def insert_mlb_prizepicks(
    *,
    player_name: str,
    stat_type: str,
    line_score: float,
    scraped_at: datetime,
    league: str = "mlb",
    odds_type: str = "standard",
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO odds.mlb_prizepicks (
                    league, player_name, stat_type, line_score, odds_type, scraped_at
                ) VALUES (
                    :league, :player_name, :stat_type, :line_score, :odds_type, :scraped_at
                )
                """
            ),
            {
                "league": league,
                "player_name": player_name,
                "stat_type": stat_type,
                "line_score": line_score,
                "odds_type": odds_type,
                "scraped_at": scraped_at,
            },
        )


def insert_mlb_prophetx(
    *,
    player_name: str,
    stat_name: str,
    line_score: float,
    side: str,
    american_price: int,
    scraped_at: datetime,
    league: str = "mlb",
    is_main: bool = True,
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO odds.mlb_prophetx (
                    league, player_name, stat_name, line_score, side,
                    american_price, scraped_at, is_main
                ) VALUES (
                    :league, :player_name, :stat_name, :line_score, :side,
                    :american_price, :scraped_at, :is_main
                )
                """
            ),
            {
                "league": league,
                "player_name": player_name,
                "stat_name": stat_name,
                "line_score": line_score,
                "side": side,
                "american_price": american_price,
                "scraped_at": scraped_at,
                "is_main": is_main,
            },
        )


def insert_mlb_parlay(
    *,
    sportsbook: str,
    player_name: str,
    market_type: str,
    side: str,
    line_score: float,
    american_price: int,
    scraped_at: datetime,
    league: str = "mlb",
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO odds.mlb_parlay_api_odds (
                    sportsbook, league, player_name, market_type, side,
                    line_score, american_price, scraped_at
                ) VALUES (
                    :sportsbook, :league, :player_name, :market_type, :side,
                    :line_score, :american_price, :scraped_at
                )
                """
            ),
            {
                "sportsbook": sportsbook,
                "league": league,
                "player_name": player_name,
                "market_type": market_type,
                "side": side,
                "line_score": line_score,
                "american_price": american_price,
                "scraped_at": scraped_at,
            },
        )
