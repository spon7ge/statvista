"""Fetch + normalize ParlayAPI WNBA player props into PP board + DK/FD indexes."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from app.domains.betting.prop_stat_keys import canonical_stat_key_from_parlay_market
from app.domains.wnba.prop_fair import american_to_fair_pct
from app.providers.parlay.client import parlay_get
from src.odds.parlay_main_lines import select_parlay_main_lines

logger = logging.getLogger(__name__)

SideKey = tuple[str, str, str, float]
SideIndex = dict[SideKey, dict[str, Any]]

SPORT_KEY = "basketball_wnba"
PROPS_LIMIT = 10000
# Match WNBA parlay_props (full-slate props are smaller than MLB).
FETCH_TIMEOUT_SECONDS = 12.0
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
# Sportsbook side indexes for books_main (exact-line fair stays DK/FD + scrapers).
_SCHEMA_BOOK_KEYS: tuple[str, ...] = (
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
)

# Same allowlist as app.domains.betting.parlay_props._PROP_MARKET_KEYS.
_PROP_MARKET_KEYS = (
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_pra",
    "player_pts_rebs",
    "player_pts_asts",
    "player_rebs_asts",
    "player_pts_rebs_asts",
    "player_double_double",
    "player_triple_double",
    "player_points_rebounds",
    "player_points_assists",
    "player_assists_rebounds",
    "player_points_rebounds_assists",
    "player_three_pointers",
    "player_three_pointers_made",
)
PROP_MARKETS = ",".join(_PROP_MARKET_KEYS)
ALLOWED_PROP_MARKET_KEYS = frozenset(_PROP_MARKET_KEYS)


@dataclass(frozen=True)
class ParlayWnbaNormalized:
    prizepicks_board: list[dict[str, Any]]
    book_indexes: dict[str, SideIndex]
    as_of: str | None
    unavailable: bool = False


def _empty(*, unavailable: bool = True) -> ParlayWnbaNormalized:
    return ParlayWnbaNormalized(
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
    if key not in ALLOWED_PROP_MARKET_KEYS:
        return False
    if "milestone" in key or key.endswith("_alt"):
        return False
    if canonical_stat_key_from_parlay_market(key) is None:
        return False
    return True


def _parse_prices(
    row: dict[str, Any], *, require_side: bool
) -> tuple[float, int | None, int | None] | None:
    line_raw = row.get("line")
    if line_raw is None:
        return None
    over_raw = row.get("over_price")
    under_raw = row.get("under_price")
    if require_side and over_raw is None and under_raw is None:
        return None
    try:
        line_f = float(line_raw)
        over = int(over_raw) if over_raw is not None else None
        under = int(under_raw) if under_raw is not None else None
    except (TypeError, ValueError):
        return None
    return line_f, over, under


def _rows_for_normalize(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Main-line selection plus PrizePicks rows that only carry a line (no prices)."""
    filtered = [
        row
        for row in rows
        if isinstance(row, dict)
        and str(row.get("bookmaker") or "").lower().strip() in _ALLOWED_BOOKS
        and _is_allowed_market(str(row.get("market_key") or ""))
    ]
    selected = select_parlay_main_lines(filtered, books=_ALLOWED_BOOKS)
    selected_ids = {id(row) for row in selected}
    # Player/market keys already covered by a selected PrizePicks row (priced main).
    pp_player_markets = {
        (
            _norm_player(str(row.get("player") or "")),
            str(row.get("market_key") or "").lower().strip(),
        )
        for row in selected
        if str(row.get("bookmaker") or "").lower().strip() == "prizepicks"
    }
    # select_parlay_main_lines drops DFS rows with no over/under; keep PP line-only
    # only when that player/market has no already-selected PrizePicks row.
    for row in filtered:
        if id(row) in selected_ids:
            continue
        book = str(row.get("bookmaker") or "").lower().strip()
        if book != "prizepicks":
            continue
        if _parse_prices(row, require_side=False) is None:
            continue
        player_market = (
            _norm_player(str(row.get("player") or "")),
            str(row.get("market_key") or "").lower().strip(),
        )
        if player_market in pp_player_markets:
            continue
        selected.append(row)
        pp_player_markets.add(player_market)
    return selected


def normalize_parlay_wnba_board(rows: list[dict[str, Any]]) -> ParlayWnbaNormalized:
    """Pure transform of Parlay WNBA prop rows → PP board + DK/FD side indexes."""
    prizepicks_board: list[dict[str, Any]] = []
    pp_seen: set[tuple[str, str, float]] = set()
    book_indexes: dict[str, SideIndex] = {book: {} for book in _SCHEMA_BOOK_KEYS}
    as_of: str | None = None

    for row in _rows_for_normalize(rows):
        book = str(row.get("bookmaker") or "").lower().strip()
        player = str(row.get("player") or "").strip()
        market_key = str(row.get("market_key") or "").strip()
        canonical = canonical_stat_key_from_parlay_market(market_key)
        if canonical is None:
            continue
        parsed = _parse_prices(row, require_side=(book != "prizepicks"))
        if parsed is None:
            continue
        line_f, over_raw, under_raw = parsed
        line_k = _line_key(line_f)
        changed_at = _changed_at(row)
        if changed_at and (as_of is None or changed_at > as_of):
            as_of = changed_at

        if book == "prizepicks":
            board_key = (_norm_player(player), canonical, line_k)
            if board_key in pp_seen:
                continue
            pp_seen.add(board_key)
            commence = str(row.get("commence_time") or "").strip() or None
            pp_row: dict[str, Any] = {
                "player_name": player,
                "line_score": line_k,
                "odds_type": "standard",
                # Canonical key (not display_stat_label) — assemble joins on keys.
                "stat_type": canonical,
                "scraped_at": changed_at,
            }
            if commence:
                pp_row["commence_time"] = commence
            american = _parse_american(over_raw if over_raw is not None else under_raw)
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
    return ParlayWnbaNormalized(
        prizepicks_board=prizepicks_board,
        book_indexes=book_indexes,
        as_of=as_of,
        unavailable=False,
    )


async def fetch_wnba_parlay_board_normalized(
    *, timeout: float = FETCH_TIMEOUT_SECONDS
) -> ParlayWnbaNormalized:
    """Fetch Parlay WNBA props and normalize. Soft-fails to empty on error."""
    now = time.monotonic()
    cached = _cache.get("value")
    expires_at = float(_cache.get("expires_at") or 0.0)
    if isinstance(cached, ParlayWnbaNormalized) and now < expires_at:
        return cached

    try:
        payload = await parlay_get(
            f"/sports/{SPORT_KEY}/props",
            params={"markets": PROP_MARKETS, "limit": PROPS_LIMIT},
            timeout=timeout,
        )
    except Exception:
        logger.exception("Parlay WNBA props fetch failed")
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

    # Main-line selection runs inside normalize; fetch keeps the filter narrow.
    out = normalize_parlay_wnba_board(rows)
    _cache["value"] = out
    _cache["expires_at"] = time.monotonic() + CACHE_TTL_SECONDS
    return out
