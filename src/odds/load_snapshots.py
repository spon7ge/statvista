"""Load scraper / Parlay snapshots into Supabase odds tables."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
from sqlalchemy import text

from src.odds.snapshot_rows import (
    parlay_props_to_api_odds_rows,
    prizepicks_projections_to_rows,
    prophetx_props_to_rows,
    prophetx_team_to_rows,
    selenium_pinnacle_props_to_rows,
    selenium_pinnacle_team_to_rows,
    sharp_props_to_book_rows,
    underdog_picks_to_rows,
)
from src.utils.db import upsert_df

logger = logging.getLogger(__name__)

_PRIZEPICKS_CONFLICT_COLS = [
    "league",
    "player_name",
    "stat_type",
    "odds_type",
    "line_score",
    "scraped_at",
]

_UNDERDOG_CONFLICT_COLS = [
    "league",
    "player_name",
    "stat_name",
    "side",
    "line_score",
    "scraped_at",
]

_SHARP_BOOK_CONFLICT_COLS = [
    "league",
    "player_name",
    "market_type",
    "side",
    "line_score",
    "scraped_at",
]

_PARLAY_API_ODDS_CONFLICT_COLS = [
    "sportsbook",
    "league",
    "player_name",
    "market_type",
    "side",
    "line_score",
    "scraped_at",
]

# Same shape as Sharp / Selenium Pinnacle prop tables (no sportsbook column).
_PARLAY_BOOK_CONFLICT_COLS = _SHARP_BOOK_CONFLICT_COLS

_PARLAY_API_ODDS_TABLE = "wnba_parlay_api_odds"

_PINNACLE_TEAM_CONFLICT_COLS = [
    "league",
    "away_team",
    "home_team",
    "market_type",
    "period",
    "is_alternate",
    "side",
    "points",
    "scraped_at",
]

_PROPHETX_PROPS_CONFLICT_COLS = [
    "league",
    "event_id",
    "player_name",
    "stat_name",
    "side",
    "line_score",
    "scraped_at",
]

_PROPHETX_TEAM_CONFLICT_COLS = [
    "league",
    "event_id",
    "market_type",
    "side",
    "points",
    "scraped_at",
]

_SHARP_BOOK_TABLES = {
    "fanduel": "wnba_fanduel",
    "draftkings": "wnba_draftkings",
}

# Books persisted from Parlay into odds.wnba_parlay_api_odds (no Pinnacle).
PARLAY_PROP_SPORTSBOOKS = (
    "fanduel",
    "draftkings",
    "caesars",
    "betmgm",
    "bet365",
    "prizepicks",
    "underdog",
    "betr",
    "novig",
    "sleeper",
    "betrivers",
)

DEFAULT_SNAPSHOT_MINUTES = 30


def _skip_db(env_var: str) -> bool:
    return os.environ.get(env_var, "").strip().lower() in {"1", "true", "yes"}


def _coerce_float_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _dedupe_conflict_rows(
    df: pd.DataFrame, conflict_cols: list[str]
) -> pd.DataFrame:
    """Drop duplicate PK rows so Postgres ON CONFLICT does not raise CardinalityViolation."""
    present = [c for c in conflict_cols if c in df.columns]
    if not present:
        return df
    before = len(df)
    out = df.drop_duplicates(subset=present, keep="last")
    dropped = before - len(out)
    if dropped:
        logger.warning(
            "Dropped %s duplicate snapshot row(s) on %s",
            dropped,
            ", ".join(present),
        )
    return out


def snapshot_interval_minutes() -> int:
    raw = (
        os.environ.get("PARLAY_PROPS_SNAPSHOT_MINUTES", "").strip()
        or os.environ.get("SHARP_PROPS_SNAPSHOT_MINUTES", "").strip()
    )
    if not raw:
        return DEFAULT_SNAPSHOT_MINUTES
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_SNAPSHOT_MINUTES
    return max(value, 0)


def _prizepicks_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_prizepicks"
    return "wnba_prizepicks"


def load_prizepicks_snapshot(
    projections: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PRIZEPICKS_SKIP_DB"):
        return 0

    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = prizepicks_projections_to_rows(projections, league=league, scraped_at=scraped_at)
    if not rows:
        return 0

    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score"])
    df = _dedupe_conflict_rows(df, _PRIZEPICKS_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        _prizepicks_table(league),
        df,
        schema="odds",
        conflict_cols=_PRIZEPICKS_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def _underdog_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_underdogs"
    return "wnba_underdogs"


def _pinnacle_props_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_pinnacle"
    return "wnba_pinnacle"


def load_underdog_snapshot(
    picks: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("UNDERDOG_SKIP_DB"):
        return 0

    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = underdog_picks_to_rows(picks, league=league, scraped_at=scraped_at)
    if not rows:
        return 0

    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score", "payout_multiplier"])
    df = _dedupe_conflict_rows(df, _UNDERDOG_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        _underdog_table(league),
        df,
        schema="odds",
        conflict_cols=_UNDERDOG_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def load_pinnacle_props_snapshot(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PINNACLE_SKIP_DB"):
        return 0

    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = selenium_pinnacle_props_to_rows(
        games, league=league, scraped_at=scraped_at
    )
    if not rows:
        return 0

    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score"])
    df = _dedupe_conflict_rows(df, _PARLAY_BOOK_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        _pinnacle_props_table(league),
        df,
        schema="odds",
        conflict_cols=_PARLAY_BOOK_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def _pinnacle_team_table(league: str) -> str:
    lg = (league or "").strip().lower()
    if lg == "mlb":
        return "mlb_pinnacle_team"
    return "wnba_pinnacle_team"


def load_pinnacle_team_snapshot(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PINNACLE_SKIP_DB"):
        return 0

    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = selenium_pinnacle_team_to_rows(
        games, league=league, scraped_at=scraped_at
    )
    if not rows:
        return 0

    df = _coerce_float_columns(pd.DataFrame(rows), ["decimal_price"])
    df = _dedupe_conflict_rows(df, _PINNACLE_TEAM_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        _pinnacle_team_table(league),
        df,
        schema="odds",
        conflict_cols=_PINNACLE_TEAM_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def load_pinnacle_team_json_file(path: str, *, scraped_at: datetime | None = None) -> int:
    """Load a Selenium *_team.json snapshot into the league-appropriate table."""
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    league = str(payload.get("league") or "mlb").strip().lower()
    games = payload.get("games") or []
    if not isinstance(games, list):
        raise ValueError(f"invalid team snapshot games in {path}")
    return load_pinnacle_team_snapshot(
        games, league=league, scraped_at=scraped_at
    )


def load_prophetx_props_snapshot(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PROPHETX_SKIP_DB"):
        return 0
    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = prophetx_props_to_rows(games, league=league, scraped_at=scraped_at)
    if not rows:
        return 0
    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score", "stake"])
    df = _dedupe_conflict_rows(df, _PROPHETX_PROPS_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        "mlb_prophetx",
        df,
        schema="odds",
        conflict_cols=_PROPHETX_PROPS_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def load_prophetx_team_snapshot(
    games: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("PROPHETX_SKIP_DB"):
        return 0
    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = prophetx_team_to_rows(games, league=league, scraped_at=scraped_at)
    if not rows:
        return 0
    df = _coerce_float_columns(pd.DataFrame(rows), ["points", "stake"])
    df = _dedupe_conflict_rows(df, _PROPHETX_TEAM_CONFLICT_COLS)
    if df.empty:
        return 0
    upsert_df(
        "mlb_prophetx_team",
        df,
        schema="odds",
        conflict_cols=_PROPHETX_TEAM_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(df)


def load_prophetx_props_json_file(path: str, *, scraped_at: datetime | None = None) -> int:
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    league = str(payload.get("league") or "mlb").strip().lower()
    games = payload.get("games") or []
    if not isinstance(games, list):
        raise ValueError(f"invalid props snapshot games in {path}")
    return load_prophetx_props_snapshot(games, league=league, scraped_at=scraped_at)


def load_prophetx_team_json_file(path: str, *, scraped_at: datetime | None = None) -> int:
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    league = str(payload.get("league") or "mlb").strip().lower()
    games = payload.get("games") or []
    if not isinstance(games, list):
        raise ValueError(f"invalid team snapshot games in {path}")
    return load_prophetx_team_snapshot(games, league=league, scraped_at=scraped_at)


def _latest_scraped_at(table: str, league: str) -> datetime | None:
    try:
        from src.utils.db import get_engine
    except ImportError:
        return None

    try:
        engine = get_engine()
    except Exception:
        return None

    sql = text(
        f"SELECT MAX(scraped_at) AS scraped_at FROM odds.{table} WHERE league = :league"
    )
    try:
        with engine.connect() as conn:
            row = conn.execute(sql, {"league": league}).mappings().first()
    except Exception as exc:
        logger.warning("odds snapshot max(scraped_at) failed for %s: %s", table, exc)
        return None

    if not row:
        return None
    value = row.get("scraped_at")
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    return None


def latest_sharp_props_scraped_at(league: str = "wnba") -> datetime | None:
    """Return the newest scraped_at across FanDuel and DraftKings tables."""
    times = [
        _latest_scraped_at("wnba_fanduel", league),
        _latest_scraped_at("wnba_draftkings", league),
    ]
    present = [t for t in times if t is not None]
    if not present:
        return None
    return max(present)


def latest_parlay_props_scraped_at(league: str = "wnba") -> datetime | None:
    """Return the newest scraped_at on the unified Parlay API odds table."""
    return _latest_scraped_at(_PARLAY_API_ODDS_TABLE, league)


def should_persist_sharp_props(
    *,
    league: str = "wnba",
    now: datetime | None = None,
    interval_minutes: int | None = None,
) -> bool:
    """True when no recent joint FD/DK snapshot exists within the throttle window."""
    minutes = (
        snapshot_interval_minutes()
        if interval_minutes is None
        else max(interval_minutes, 0)
    )
    if minutes == 0:
        return True

    latest = latest_sharp_props_scraped_at(league)
    if latest is None:
        return True

    now = now or datetime.now(timezone.utc)
    return now - latest >= timedelta(minutes=minutes)


def should_persist_parlay_props(
    *,
    league: str = "wnba",
    now: datetime | None = None,
    interval_minutes: int | None = None,
) -> bool:
    """True when no recent joint Parlay snapshot exists within the throttle window."""
    minutes = (
        snapshot_interval_minutes()
        if interval_minutes is None
        else max(interval_minutes, 0)
    )
    if minutes == 0:
        return True

    latest = latest_parlay_props_scraped_at(league)
    if latest is None:
        return True

    now = now or datetime.now(timezone.utc)
    return now - latest >= timedelta(minutes=minutes)


def load_sharp_book_snapshot(
    sharp_rows: list[dict],
    *,
    sportsbook: str,
    league: str,
    scraped_at: datetime | None = None,
) -> int:
    if _skip_db("SHARP_PROPS_SKIP_DB"):
        return 0

    book = sportsbook.lower().strip()
    table = _SHARP_BOOK_TABLES.get(book)
    if not table:
        raise ValueError(f"unsupported sportsbook: {sportsbook}")

    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = sharp_props_to_book_rows(
        sharp_rows, sportsbook=book, league=league, scraped_at=scraped_at
    )
    if not rows:
        return 0

    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score"])
    upsert_df(
        table,
        df,
        schema="odds",
        conflict_cols=_SHARP_BOOK_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    return len(rows)


def load_parlay_api_odds_snapshot(
    parlay_rows: list[dict],
    *,
    league: str,
    scraped_at: datetime | None = None,
    books: tuple[str, ...] = PARLAY_PROP_SPORTSBOOKS,
) -> dict[str, int]:
    """Upsert Parlay main lines for all books into odds.wnba_parlay_api_odds."""
    empty = {book: 0 for book in books}
    if _skip_db("PARLAY_PROPS_SKIP_DB") or _skip_db("SHARP_PROPS_SKIP_DB"):
        return empty

    scraped_at = scraped_at or datetime.now(timezone.utc)
    rows = parlay_props_to_api_odds_rows(
        parlay_rows, league=league, scraped_at=scraped_at, books=books
    )
    if not rows:
        return empty

    df = _coerce_float_columns(pd.DataFrame(rows), ["line_score"])
    df = _dedupe_conflict_rows(df, _PARLAY_API_ODDS_CONFLICT_COLS)
    if df.empty:
        return empty
    upsert_df(
        _PARLAY_API_ODDS_TABLE,
        df,
        schema="odds",
        conflict_cols=_PARLAY_API_ODDS_CONFLICT_COLS,
        lineage_col="fetched_at",
    )
    counts = dict(empty)
    for book, n in df["sportsbook"].value_counts().items():
        key = str(book)
        if key in counts:
            counts[key] = int(n)
    return counts


def maybe_persist_sharp_props(
    sharp_rows: list[dict[str, Any]],
    *,
    league: str = "wnba",
    scraped_at: datetime | None = None,
) -> dict[str, int]:
    """
    Persist FanDuel + DraftKings Sharp props when the throttle allows.

    Best-effort: never raises. Returns counts written per book (0 if skipped).
    """
    empty = {"fanduel": 0, "draftkings": 0}
    if _skip_db("SHARP_PROPS_SKIP_DB"):
        return empty
    if not sharp_rows:
        return empty

    try:
        if not should_persist_sharp_props(league=league):
            return empty
    except Exception as exc:
        logger.warning("Sharp props snapshot throttle check failed: %s", exc)
        return empty

    scraped_at = scraped_at or datetime.now(timezone.utc)
    counts = dict(empty)
    try:
        counts["fanduel"] = load_sharp_book_snapshot(
            sharp_rows, sportsbook="fanduel", league=league, scraped_at=scraped_at
        )
        counts["draftkings"] = load_sharp_book_snapshot(
            sharp_rows,
            sportsbook="draftkings",
            league=league,
            scraped_at=scraped_at,
        )
        if counts["fanduel"] or counts["draftkings"]:
            logger.info(
                "Sharp props snapshot written league=%s scraped_at=%s fd=%s dk=%s",
                league,
                scraped_at.isoformat(),
                counts["fanduel"],
                counts["draftkings"],
            )
    except Exception as exc:
        logger.warning("Sharp props snapshot write failed: %s", exc)
        return empty

    return counts


def maybe_persist_parlay_props(
    parlay_rows: list[dict[str, Any]],
    *,
    league: str = "wnba",
    scraped_at: datetime | None = None,
) -> dict[str, int]:
    """
    Persist Parlay display books into odds.wnba_parlay_api_odds when the throttle allows.

    Best-effort: never raises. Returns counts written per book (0 if skipped).
    """
    empty = {book: 0 for book in PARLAY_PROP_SPORTSBOOKS}
    if _skip_db("PARLAY_PROPS_SKIP_DB") or _skip_db("SHARP_PROPS_SKIP_DB"):
        return empty
    if not parlay_rows:
        return empty

    try:
        if not should_persist_parlay_props(league=league):
            return empty
    except Exception as exc:
        logger.warning("Parlay props snapshot throttle check failed: %s", exc)
        return empty

    scraped_at = scraped_at or datetime.now(timezone.utc)
    try:
        counts = load_parlay_api_odds_snapshot(
            parlay_rows,
            league=league,
            scraped_at=scraped_at,
            books=PARLAY_PROP_SPORTSBOOKS,
        )
        if any(counts.values()):
            logger.info(
                "Parlay props snapshot written league=%s scraped_at=%s counts=%s",
                league,
                scraped_at.isoformat(),
                counts,
            )
        return counts
    except Exception as exc:
        logger.warning("Parlay props snapshot write failed: %s", exc)
        return empty
