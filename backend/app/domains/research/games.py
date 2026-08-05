"""Database queries for research game and slate data."""
from __future__ import annotations

import re

from app.core import db
from app.domains.research.schemas_game import Game, GameSlate, GameWithProps
from app.schemas.prop import PropLine

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_GAMES_SQL = """
SELECT
    game_date,
    game_id,
    event_id,
    home_team_abbrev,
    away_team_abbrev,
    season_year,
    source
FROM silver.silver_games
WHERE game_date = %(game_date)s
ORDER BY home_team_abbrev
"""

_PROPS_ALL_SQL = """
SELECT
    bookmaker,
    market_category,
    player_id,
    player_name,
    player_name_raw,
    normalized_name,
    side,
    game_date,
    line,
    odds,
    prop_source,
    last_update_at,
    player_team_abbrev,
    home_team_abbrev,
    away_team_abbrev,
    game_season_year,
    min_roll5,
    pts_per_min_roll5,
    reb_per_min_roll5,
    ast_per_min_roll5,
    min_roll10,
    pts_per_min_roll10,
    team_min_rank_l10,
    team_usg_rank_l10,
    expected_pace,
    opp_def_rating_roll10,
    team_spread,
    game_total
FROM gold.gold_prop_history
WHERE game_date = %(game_date)s
ORDER BY player_name, market_category, side
"""

_PROPS_BY_MATCHUP_SQL = """
SELECT
    bookmaker,
    market_category,
    player_id,
    player_name,
    player_name_raw,
    normalized_name,
    side,
    game_date,
    line,
    odds,
    prop_source,
    last_update_at,
    player_team_abbrev,
    home_team_abbrev,
    away_team_abbrev,
    game_season_year,
    min_roll5,
    pts_per_min_roll5,
    reb_per_min_roll5,
    ast_per_min_roll5,
    min_roll10,
    pts_per_min_roll10,
    team_min_rank_l10,
    team_usg_rank_l10,
    expected_pace,
    opp_def_rating_roll10,
    team_spread,
    game_total
FROM gold.gold_prop_history
WHERE game_date = %(game_date)s
  AND (%(home)s IS NULL OR player_team_abbrev IN (%(home)s, %(away)s))
ORDER BY player_name, market_category, side
"""

def validate_date(date_str: str) -> str:
    if not _DATE_RE.match(date_str):
        raise ValueError(f"Invalid date format '{date_str}'. Use YYYY-MM-DD.")
    return date_str


def get_games(date: str) -> list[Game]:
    """Return all games on a date from silver.silver_games."""
    validate_date(date)
    rows = db.query(_GAMES_SQL, {"game_date": date})
    return [Game(**r) for r in rows]


def get_game_props(
    date: str,
    bookmaker: str | None = None,
    market: str | None = None,
) -> list[PropLine]:
    """Return prop lines for a slate date from gold.gold_prop_history."""
    validate_date(date)
    sql = _PROPS_ALL_SQL
    params: dict = {"game_date": date}
    if bookmaker:
        sql += " AND lower(bookmaker) = lower(%(bookmaker)s)"
        params["bookmaker"] = bookmaker
    if market:
        sql += " AND lower(market_category) = lower(%(market)s)"
        params["market"] = market
    rows = db.query(sql, params)
    return [PropLine(**row) for row in rows]


def get_games_with_props(
    date: str,
    bookmaker: str | None = None,
    market: str | None = None,
) -> list[GameWithProps]:
    """Return games with their prop lines grouped by matchup."""
    validate_date(date)
    game_rows = db.query(_GAMES_SQL, {"game_date": date})
    if not game_rows:
        return []

    results: list[GameWithProps] = []
    for game_row in game_rows:
        home = game_row["home_team_abbrev"]
        away = game_row["away_team_abbrev"]

        prop_sql = _PROPS_BY_MATCHUP_SQL
        prop_params: dict = {"game_date": date, "home": home, "away": away}

        if bookmaker:
            prop_sql += " AND lower(bookmaker) = lower(%(bookmaker)s)"
            prop_params["bookmaker"] = bookmaker
        if market:
            prop_sql += " AND lower(market_category) = lower(%(market)s)"
            prop_params["market"] = market

        prop_rows = db.query(prop_sql, prop_params)
        results.append(
            GameWithProps(
                **game_row,
                props=[PropLine(**p) for p in prop_rows],
            )
        )

    return results
