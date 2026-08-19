"""Fetch + normalize ParlayAPI MLB player props into PP board + DK/FD indexes."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from app.domains.mlb.prop_fair import american_to_fair_pct
from app.domains.mlb.prop_stat_keys import (
    canonical_stat_key_from_sharp_mlb,
    display_stat_label,
)
from app.providers.parlay.client import parlay_get
from src.odds.parlay_main_lines import balance_score

logger = logging.getLogger(__name__)

SideKey = tuple[str, str, str, float]
SideIndex = dict[SideKey, dict[str, Any]]

SPORT_KEY = "baseball_mlb"
PROPS_LIMIT = 10000
# Full-slate MLB props (58 markets × up to 10k rows) routinely takes 8–15s;
# 12s was racing ReadTimeout under normal Parlay latency.
FETCH_TIMEOUT_SECONDS = 45.0
CACHE_TTL_SECONDS = 60.0

_cache: dict[str, Any] = {"expires_at": 0.0, "value": None}

_ALLOWED_BOOKS = frozenset(
    {
        "prizepicks",
        "draftkings",
        "fanduel",
        "betmgm",
        "caesars",
        "kalshi",
        "fliff",
        "bet365",
    }
)
# Sportsbook side indexes kept for books_main (exact-line fair stays DK/FD only).
_SCHEMA_BOOK_KEYS: tuple[str, ...] = (
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
)

# Task 2 Odds API allowlist plus Parlay ``player_*`` / ``_alternate`` variants.
_ODDS_API_MARKET_KEYS: tuple[str, ...] = (
    "batter_hits",
    "batter_home_runs",
    "batter_total_bases",
    "batter_rbis",
    "batter_runs_scored",
    "batter_singles",
    "batter_doubles",
    "batter_triples",
    "batter_walks",
    "batter_strikeouts",
    "batter_stolen_bases",
    "batter_hits_runs_rbis",
    "pitcher_strikeouts",
    "pitcher_hits_allowed",
    "pitcher_walks",
    "pitcher_earned_runs",
    "pitcher_outs",
)
_PLAYER_MARKET_KEYS: tuple[str, ...] = tuple(
    f"player_{key.split('_', 1)[1]}"
    for key in _ODDS_API_MARKET_KEYS
    if key.startswith("batter_")
)
_MLB_PROP_MARKET_KEYS: tuple[str, ...] = tuple(
    dict.fromkeys(
        _ODDS_API_MARKET_KEYS
        + _PLAYER_MARKET_KEYS
        + tuple(f"{key}_alternate" for key in _ODDS_API_MARKET_KEYS + _PLAYER_MARKET_KEYS)
    )
)
PROP_MARKETS = ",".join(_MLB_PROP_MARKET_KEYS)


@dataclass(frozen=True)
class ParlayMlbNormalized:
    prizepicks_board: list[dict[str, Any]]
    book_indexes: dict[str, SideIndex]
    as_of: str | None
    unavailable: bool = False


def _empty(*, unavailable: bool = True) -> ParlayMlbNormalized:
    return ParlayMlbNormalized(
        prizepicks_board=[],
        book_indexes={},
        as_of=None,
        unavailable=unavailable,
    )


def _norm_player(name: str) -> str:
    return name.strip().casefold()


def _line_key(line: float) -> float:
    return round(float(line), 2)


def _parse_american(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _changed_at(row: dict[str, Any]) -> str | None:
    for key in ("updated_at", "last_update", "line_updated_at"):
        raw = row.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def _is_allowed_market(market_key: str) -> bool:
    key = market_key.lower().strip()
    if not key:
        return False
    if "milestone" in key or key.endswith("_alt"):
        return False
    if canonical_stat_key_from_sharp_mlb(key) is None:
        return False
    return True


def _parse_prices(row: dict[str, Any]) -> tuple[float, int | None, int | None] | None:
    line_raw = row.get("line")
    over_raw = row.get("over_price")
    under_raw = row.get("under_price")
    if line_raw is None or (over_raw is None and under_raw is None):
        return None
    try:
        line_f = float(line_raw)
        over = int(over_raw) if over_raw is not None else None
        under = int(under_raw) if under_raw is not None else None
    except (TypeError, ValueError):
        return None
    return line_f, over, under


def _select_main_lines(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep one main line per (player, market_key, bookmaker) by price balance."""
    best: dict[tuple[str, str, str], tuple[float, dict[str, Any]]] = {}
    for row in rows:
        book = str(row.get("bookmaker") or "").lower().strip()
        if book not in _ALLOWED_BOOKS:
            continue
        player = str(row.get("player") or "").strip()
        market = str(row.get("market_key") or "").strip()
        if not player or not _is_allowed_market(market):
            continue
        parsed = _parse_prices(row)
        if parsed is None:
            continue
        line_f, over, under = parsed
        over_score = over if over is not None else -110
        under_score = under if under is not None else -110
        score = balance_score(over_score, under_score)
        key = (player.casefold(), market, book)
        prev = best.get(key)
        if prev is None or score < prev[0]:
            best[key] = (score, row)
    return [row for _score, row in best.values()]


def normalize_parlay_mlb_props(rows: list[dict[str, Any]]) -> ParlayMlbNormalized:
    """Pure transform of Parlay MLB prop rows → PP board + DK/FD side indexes."""
    prizepicks_board: list[dict[str, Any]] = []
    pp_seen: set[tuple[str, str, float]] = set()
    book_indexes: dict[str, SideIndex] = {book: {} for book in _SCHEMA_BOOK_KEYS}
    as_of: str | None = None

    for row in _select_main_lines(rows):
        book = str(row.get("bookmaker") or "").lower().strip()
        player = str(row.get("player") or "").strip()
        market_key = str(row.get("market_key") or "").strip()
        canonical = canonical_stat_key_from_sharp_mlb(market_key)
        if canonical is None:
            continue
        parsed = _parse_prices(row)
        if parsed is None:
            continue
        line_f, over_raw, under_raw = parsed
        line_k = _line_key(line_f)
        changed_at = _changed_at(row)
        if changed_at and (as_of is None or changed_at > as_of):
            as_of = changed_at
        stat_label = display_stat_label(canonical)

        if book == "prizepicks":
            board_key = (_norm_player(player), canonical, line_k)
            if board_key in pp_seen:
                continue
            pp_seen.add(board_key)
            pp_row: dict[str, Any] = {
                "player_name": player,
                "line_score": line_k,
                "odds_type": "standard",
                "stat_type": stat_label,
                "scraped_at": changed_at,
            }
            american = _parse_american(over_raw or under_raw)
            if american is not None:
                pp_row["american_price"] = american
            prizepicks_board.append(pp_row)
            continue

        for side, raw in (("over", over_raw), ("under", under_raw)):
            american = _parse_american(raw)
            if american is None:
                continue
            side_key: SideKey = (_norm_player(player), canonical, side, line_k)
            book_indexes[book][side_key] = {
                "american": american,
                "fair_pct": american_to_fair_pct(american),
                "changed_at": changed_at,
            }

    book_indexes = {k: v for k, v in book_indexes.items() if v}
    return ParlayMlbNormalized(
        prizepicks_board=prizepicks_board,
        book_indexes=book_indexes,
        as_of=as_of,
        unavailable=False,
    )


async def fetch_mlb_parlay_props_normalized(
    *, timeout: float = FETCH_TIMEOUT_SECONDS
) -> ParlayMlbNormalized:
    """Fetch Parlay MLB props and normalize. Soft-fails to empty on error."""
    now = time.monotonic()
    cached = _cache.get("value")
    expires_at = float(_cache.get("expires_at") or 0.0)
    if isinstance(cached, ParlayMlbNormalized) and now < expires_at:
        return cached

    try:
        payload = await parlay_get(
            f"/sports/{SPORT_KEY}/props",
            params={"markets": PROP_MARKETS, "limit": PROPS_LIMIT},
            timeout=timeout,
        )
    except Exception:
        logger.exception("Parlay MLB props fetch failed")
        return _empty()

    if not isinstance(payload, list):
        return _empty()

    rows = [
        row
        for row in payload
        if isinstance(row, dict)
        and str(row.get("bookmaker") or "").lower().strip() in _ALLOWED_BOOKS
        and _is_allowed_market(str(row.get("market_key") or ""))
    ]
    if not rows:
        return _empty(unavailable=False)

    try:
        from src.odds.load_snapshots import maybe_persist_parlay_props

        maybe_persist_parlay_props(rows, league="mlb")
    except Exception:
        logger.exception("MLB Parlay snapshot persist failed")

    out = normalize_parlay_mlb_props(rows)
    _cache["value"] = out
    _cache["expires_at"] = time.monotonic() + CACHE_TTL_SECONDS
    return out
