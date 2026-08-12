"""Read latest PrizePicks / Underdog / Pinnacle / ProphetX / Novig odds snapshots from Supabase.

Board queries return the latest row per quote identity (``DISTINCT ON``), not a
single ``MAX(scraped_at)`` batch.

DB-only reads (no vendor HTTP), so this does not belong under ``providers/``.
It lives in ``core`` rather than a single domain because both the MLB and
betting domains read team-odds snapshots for their own leagues
(see ``fetch_latest_pinnacle_team`` / ``fetch_latest_prophetx_team`` /
``fetch_latest_novig_team``) and
domains must not import each other.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text

from src.odds.quote_specs import get_quote_spec

logger = logging.getLogger(__name__)

_PRIZEPICKS_TABLE = {
    "mlb": "mlb_prizepicks",
    "wnba": "wnba_prizepicks",
    "nba": "wnba_prizepicks",
}
_UNDERDOG_TABLE = {
    "mlb": "mlb_underdogs",
    "wnba": "wnba_underdogs",
    "nba": "wnba_underdogs",
}
_PINNACLE_TABLE = {
    "mlb": "mlb_pinnacle",
    "wnba": "wnba_pinnacle",
    "nba": "wnba_pinnacle",
}
_PROPHETX_TABLE = {"mlb": "mlb_prophetx", "wnba": "wnba_prophetx"}
_PROPHETX_TEAM_TABLE = {
    "mlb": "mlb_prophetx_team",
    "wnba": "wnba_prophetx_team",
}
_NOVIG_TABLE = {"mlb": "mlb_novig", "wnba": "wnba_novig"}
_NOVIG_TEAM_TABLE = {
    "mlb": "mlb_novig_team",
    "wnba": "wnba_novig_team",
}

_PINNACLE_TEAM_TABLE = {
    "mlb": "mlb_pinnacle_team",
    "wnba": "wnba_pinnacle_team",
    "nba": "wnba_pinnacle_team",
}


def _latest_snapshot_sql(
    table: str,
    columns: str,
    *,
    identity_cols: tuple[str, ...] | None = None,
    extra_where: str = "",
) -> str:
    identity = identity_cols or get_quote_spec(table).identity_cols
    identity_sql = ", ".join(identity)
    order_sql = f"{identity_sql}, scraped_at DESC"
    where_extra = f"\n  {extra_where}" if extra_where else ""
    return f"""
SELECT DISTINCT ON ({identity_sql}) {columns}
FROM odds.{table}
WHERE league = :league{where_extra}
ORDER BY {order_sql}
"""


_PRIZEPICKS_SQL = _latest_snapshot_sql(
    "wnba_prizepicks", "player_name, stat_type, line_score, odds_type"
)
_UNDERDOG_SQL = _latest_snapshot_sql(
    "wnba_underdogs",
    "player_name, stat_name, line_score, side, american_price, payout_multiplier",
)
_PINNACLE_SQL = _latest_snapshot_sql(
    "wnba_pinnacle",
    "player_name, market_type, side, line_score, american_price",
)


def _normalized_league(league: str, default: str) -> str:
    return (league or default).strip().lower()


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
    """Return rows from the latest PrizePicks snapshot for *league*.

    Includes ``scraped_at`` so callers can derive a v1 "line last changed"
    timestamp without a per-quote change-history table.
    """
    lg = _normalized_league(league, "wnba")
    table = _PRIZEPICKS_TABLE.get(lg, "wnba_prizepicks")
    sql = _latest_snapshot_sql(
        table, "player_name, stat_type, line_score, odds_type, scraped_at"
    )
    return _fetch_rows(sql, lg)


def fetch_latest_underdog(league: str = "wnba") -> list[dict]:
    """Return rows from the latest Underdog snapshot for *league*."""
    lg = _normalized_league(league, "wnba")
    table = _UNDERDOG_TABLE.get(lg, "wnba_underdogs")
    sql = _latest_snapshot_sql(
        table,
        "player_name, stat_name, line_score, side, american_price, "
        "payout_multiplier, scraped_at",
    )
    return _fetch_rows(sql, lg)


def fetch_latest_pinnacle(league: str = "wnba") -> list[dict]:
    """Return rows from the latest Selenium Pinnacle player snapshot for *league*."""
    lg = _normalized_league(league, "wnba")
    table = _PINNACLE_TABLE.get(lg, "wnba_pinnacle")
    sql = _latest_snapshot_sql(
        table,
        "player_name, market_type, side, line_score, american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)


def fetch_latest_prophetx(league: str = "mlb") -> list[dict]:
    """Return rows from the latest ProphetX player snapshot for *league*."""
    lg = _normalized_league(league, "mlb")
    table = _PROPHETX_TABLE.get(lg, "mlb_prophetx")
    sql = _latest_snapshot_sql(
        table,
        "player_name, stat_name, line_score, side, american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)


def fetch_latest_novig(league: str = "mlb") -> list[dict]:
    """Return rows from the latest Novig player snapshot for *league*."""
    lg = _normalized_league(league, "mlb")
    table = _NOVIG_TABLE.get(lg, "mlb_novig")
    sql = _latest_snapshot_sql(
        table,
        "player_name, stat_name, line_score, side, american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)


def fetch_latest_pinnacle_team(league: str = "wnba") -> list[dict]:
    """Return full-game (period=0, non-alternate) team rows from latest snapshot."""
    lg = _normalized_league(league, "wnba")
    table = _PINNACLE_TEAM_TABLE.get(lg, "wnba_pinnacle_team")
    sql = _latest_snapshot_sql(
        table,
        "away_team, home_team, start_time, market_type, period, is_alternate, "
        "side, team, points, american_price, matchup_id",
        extra_where="AND period = 0\n  AND is_alternate = false",
    )
    return _fetch_rows(sql, lg)


def fetch_latest_prophetx_team(league: str = "mlb") -> list[dict]:
    """Return full-game team market rows from the latest ProphetX snapshot.

    Filters to moneyline / run line / total so period markets
    (1st inning, F5, etc.) never reach the matchup board.
    """
    lg = _normalized_league(league, "mlb")
    table = _PROPHETX_TEAM_TABLE.get(lg, "mlb_prophetx_team")
    sql = _latest_snapshot_sql(
        table,
        "away_team, home_team, start_time, market_type, side, team, points, "
        "american_price, event_id",
        extra_where=(
            "AND market_type IN "
            "('moneyline', 'run_line', 'spread', 'total', 'total_runs')"
        ),
    )
    return _fetch_rows(sql, lg)


def fetch_latest_novig_team(league: str = "mlb") -> list[dict]:
    """Return full-game team market rows from the latest Novig snapshot."""
    lg = _normalized_league(league, "mlb")
    table = _NOVIG_TEAM_TABLE.get(lg, "mlb_novig_team")
    sql = _latest_snapshot_sql(
        table,
        "away_team, home_team, start_time, market_type, side, team, points, "
        "american_price, event_id",
        extra_where=(
            "AND market_type IN "
            "('moneyline', 'run_line', 'spread', 'total', 'total_runs')"
        ),
    )
    return _fetch_rows(sql, lg)
