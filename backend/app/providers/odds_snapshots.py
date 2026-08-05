"""Read latest PrizePicks / Underdog / Pinnacle odds snapshots from Supabase."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text

logger = logging.getLogger(__name__)

_PRIZEPICKS_SQL = """
SELECT player_name, stat_type, line_score, odds_type
FROM odds.wnba_prizepicks
WHERE league = :league
  AND scraped_at = (
    SELECT MAX(scraped_at) FROM odds.wnba_prizepicks WHERE league = :league
  )
"""

_UNDERDOG_SQL = """
SELECT player_name, stat_name, line_score, side, american_price
FROM odds.wnba_underdogs
WHERE league = :league
  AND scraped_at = (
    SELECT MAX(scraped_at) FROM odds.wnba_underdogs WHERE league = :league
  )
"""

_PINNACLE_SQL = """
SELECT player_name, market_type, side, line_score, american_price
FROM odds.wnba_pinnacle
WHERE league = :league
  AND scraped_at = (
    SELECT MAX(scraped_at) FROM odds.wnba_pinnacle WHERE league = :league
  )
"""

_PINNACLE_TEAM_TABLE = {
    "mlb": "mlb_pinnacle_team",
    "wnba": "wnba_pinnacle_team",
    "nba": "wnba_pinnacle_team",
}


def _fetch_rows(sql: str, league: str) -> list[dict[str, Any]]:
    try:
        from src.utils.db import get_engine
    except ImportError as exc:
        logger.warning("odds snapshot DB unavailable: %s", exc)
        return []

    try:
        engine = get_engine()
    except Exception as exc:
        logger.warning("odds snapshot DB unavailable: %s", exc)
        return []

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), {"league": league})
            return [dict(row._mapping) for row in result]
    except Exception as exc:
        logger.warning("odds snapshot query failed: %s", exc)
        return []


def fetch_latest_prizepicks(league: str = "wnba") -> list[dict]:
    """Return rows from the latest PrizePicks snapshot for *league*."""
    return _fetch_rows(_PRIZEPICKS_SQL, league)


def fetch_latest_underdog(league: str = "wnba") -> list[dict]:
    """Return rows from the latest Underdog snapshot for *league*."""
    return _fetch_rows(_UNDERDOG_SQL, league)


def fetch_latest_pinnacle(league: str = "wnba") -> list[dict]:
    """Return rows from the latest Selenium Pinnacle player snapshot for *league*."""
    return _fetch_rows(_PINNACLE_SQL, league)


def fetch_latest_pinnacle_team(league: str = "wnba") -> list[dict]:
    """Return full-game (period=0, non-alternate) team rows from latest snapshot."""
    lg = (league or "wnba").strip().lower()
    table = _PINNACLE_TEAM_TABLE.get(lg, "wnba_pinnacle_team")
    sql = f"""
SELECT away_team, home_team, start_time, market_type, period, is_alternate,
       side, team, points, american_price, matchup_id
FROM odds.{table}
WHERE league = :league
  AND scraped_at = (
    SELECT MAX(scraped_at) FROM odds.{table} WHERE league = :league
  )
  AND period = 0
  AND is_alternate = false
"""
    return _fetch_rows(sql, lg)
