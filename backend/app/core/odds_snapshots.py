"""Read latest PrizePicks / Underdog / Pinnacle / ProphetX / Novig / Parlay API odds snapshots from Supabase.

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
_PARLAY_API_ODDS_TABLE = {
    "mlb": "mlb_parlay_api_odds",
    "wnba": "wnba_parlay_api_odds",
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


def _fetch_rows(sql: str, league: str, *, reraise: bool = False) -> list[dict[str, Any]]:
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
        if reraise:
            raise
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


def fetch_latest_parlay_api_odds(league: str = "mlb") -> list[dict]:
    """Return latest-per-identity Parlay sportsbook odds for *league*.

    Quote identity includes ``sportsbook`` so each book keeps its own latest
    over/under; callers group those rows into per-book SideIndexes.
    """
    lg = _normalized_league(league, "mlb")
    table = _PARLAY_API_ODDS_TABLE.get(lg, "mlb_parlay_api_odds")
    sql = _latest_snapshot_sql(
        table,
        "sportsbook, player_name, market_type, side, line_score, "
        "american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)


def fetch_latest_prophetx(league: str = "mlb", *, mains_only: bool = False) -> list[dict]:
    """Return rows from the latest ProphetX player snapshot for *league*.

    Includes ``is_main`` when the column exists (mlb/wnba ProphetX migrations).
    If an environment has not applied that column, retry without it so callers
    can balance-pick among all candidate lines instead of dropping the book.

    ``mains_only=True`` adds ``WHERE is_main = true`` so books_main assembly is
    not stuck with a False-alt when DISTINCT ON identity omits ``line_score``.
    Fair/edge callers must leave this False (default).
    """
    lg = _normalized_league(league, "mlb")
    table = _PROPHETX_TABLE.get(lg, "mlb_prophetx")
    return _fetch_player_prop_snapshot(table, lg, mains_only=mains_only)


def fetch_latest_novig(league: str = "mlb", *, mains_only: bool = False) -> list[dict]:
    """Return rows from the latest Novig player snapshot for *league*.

    Same ``is_main`` try/fallback as :func:`fetch_latest_prophetx`.
    """
    lg = _normalized_league(league, "mlb")
    table = _NOVIG_TABLE.get(lg, "mlb_novig")
    return _fetch_player_prop_snapshot(table, lg, mains_only=mains_only)


def _is_missing_is_main_column(exc: BaseException) -> bool:
    """True when the SELECT failed because ``is_main`` is not on the table."""
    text = str(exc).lower()
    if "is_main" not in text:
        return False
    name = type(exc).__name__.lower()
    return (
        "undefinedcolumn" in name
        or "programmingerror" in name
        or "does not exist" in text
        or "undefined column" in text
    )


def _is_missing_stake_column(exc: BaseException) -> bool:
    """True when the SELECT failed because ``stake`` is not on the table."""
    text = str(exc).lower()
    if "stake" not in text:
        return False
    name = type(exc).__name__.lower()
    return (
        "undefinedcolumn" in name
        or "programmingerror" in name
        or "does not exist" in text
        or "undefined column" in text
    )


def _fetch_player_prop_snapshot(
    table: str, league: str, *, mains_only: bool = False
) -> list[dict[str, Any]]:
    """Latest player-prop rows; prefer ``is_main`` and ``stake``, else retry without.

    Pinnacle player tables have no ``is_main`` column — those fetchers stay
    on the base column list and callers balance-pick mains from row dicts.
    When ``is_main`` is absent, ``mains_only`` is ignored (no SQL filter) so
    callers can still balance-pick mains from row dicts.

    ``mains_only`` filters ``is_main = true`` in SQL when the column exists.
    Quote identity still omits ``line_score`` (same DISTINCT ON as fair/edge);
    the filter is what keeps a later-scraped alt from winning the collapse.
    Changing identity cols would also change upserts/change-filters, so it
    stays out of this PR.
    """
    base_cols = (
        "player_name, stat_name, line_score, side, american_price, stake, scraped_at"
    )
    base_cols_no_stake = (
        "player_name, stat_name, line_score, side, american_price, scraped_at"
    )
    extra_where = "AND is_main = true" if mains_only else ""
    sql_with = _latest_snapshot_sql(
        table, f"{base_cols}, is_main", extra_where=extra_where
    )
    try:
        return _fetch_rows(sql_with, league, reraise=True)
    except Exception as exc:
        if _is_missing_is_main_column(exc):
            logger.warning(
                "odds.%s has no is_main column; selecting without it "
                "(balance-pick mains)",
                table,
            )
            try:
                return _fetch_rows(
                    _latest_snapshot_sql(table, base_cols),
                    league,
                    reraise=True,
                )
            except Exception as exc2:
                if not _is_missing_stake_column(exc2):
                    logger.warning("odds snapshot query failed: %s", exc2)
                    return []
                logger.warning(
                    "odds.%s has no stake column; selecting without it",
                    table,
                )
                return _fetch_rows(
                    _latest_snapshot_sql(table, base_cols_no_stake),
                    league,
                )
        if _is_missing_stake_column(exc):
            logger.warning(
                "odds.%s has no stake column; selecting without it",
                table,
            )
            try:
                return _fetch_rows(
                    _latest_snapshot_sql(
                        table, f"{base_cols_no_stake}, is_main", extra_where=extra_where
                    ),
                    league,
                    reraise=True,
                )
            except Exception as exc2:
                if not _is_missing_is_main_column(exc2):
                    logger.warning("odds snapshot query failed: %s", exc2)
                    return []
                logger.warning(
                    "odds.%s has no is_main column; selecting without it "
                    "(balance-pick mains)",
                    table,
                )
                return _fetch_rows(
                    _latest_snapshot_sql(table, base_cols_no_stake),
                    league,
                )
        logger.warning("odds snapshot query failed: %s", exc)
        return []


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
