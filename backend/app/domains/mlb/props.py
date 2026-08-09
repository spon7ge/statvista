"""Assemble GET /api/mlb/props/today: DFS board + fair/edge/tier per row.

Pipeline (see docs/superpowers/specs/2026-08-05-mlb-prop-picks-design.md):
  1. Load the selected app's DFS lines (PrizePicks standard only; Underdog as
     stored) and bucket into one board row per (player, stat, line).
  2. Index ProphetX (Tier 1), Parlay Novig/FanDuel/DraftKings (Tier 1/2),
     soft Parlay books + Pinnacle (Tier 3 Soft Consensus; expand role
     ``comparison``) by (player, stat, side, line) — exact line only, no
     closest-line fallback.
  3. For each side offered by the DFS app at that line, compute fair% via
     ``compute_fair`` and edge vs. the format breakeven; the recommended side
     is whichever has the higher edge.
  4. Sort rows with a sharp/mid-tier/soft read above ``no_sharp_read`` rows.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.core.odds_snapshots import (
    fetch_latest_pinnacle,
    fetch_latest_prizepicks,
    fetch_latest_prophetx,
    fetch_latest_underdog,
)
from app.domains.mlb.prop_fair import (
    SOFT_FAIR_BOOKS,
    FairResult,
    american_to_fair_pct,
    compute_fair,
    recency_chip,
)
from app.domains.mlb.prop_formats import breakeven_pct
from app.domains.mlb.prop_stat_keys import (
    canonical_stat_key_from_pp_mlb,
    canonical_stat_key_from_sharp_mlb,
    canonical_stat_key_from_ud_mlb,
    display_stat_label,
)
from app.domains.mlb.schemas_props import (
    MlbPropBooks,
    MlbPropBookQuote,
    MlbPropDfs,
    MlbPropRow,
    MlbPropsResponse,
)
from app.providers.espn.mlb_roster import get_mlb_player_index
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.parlay.client import parlay_get

logger = logging.getLogger(__name__)

SPORT_KEY = "baseball_mlb"
CACHE_TTL_SECONDS = 45.0
FETCH_TIMEOUT_SECONDS = 12.0
PROPS_LIMIT = 10000

# Parlay books that may drive fair% (Tier 1 exchange + Tier 2 fallback).
# Soft / prediction books (``_PARLAY_CMP_BOOKS``) plus Pinnacle (Selenium
# snapshots) feed Tier 3 Soft Consensus via ``SOFT_FAIR_BOOKS``; expand quotes
# keep ``role="comparison"``.
_PARLAY_FAIR_BOOKS: tuple[str, ...] = ("novig", "fanduel", "draftkings")
_PARLAY_CMP_BOOKS: tuple[str, ...] = (
    "caesars",
    "kalshi",
    "bet365",
    "betmgm",
    "fanatics",
    "hardrock",
    "fliff",
)
_PARLAY_KEEP_BOOKS: tuple[str, ...] = _PARLAY_FAIR_BOOKS + _PARLAY_CMP_BOOKS
_VALID_SIDES: tuple[str, ...] = ("over", "under")

# format is fixed per app in v1 (see prop_formats.py multiplier tables).
_APP_FORMATS: dict[str, str] = {"prizepicks": "power", "underdog": "standard"}

BoardKey = tuple[str, str, float]
SideKey = tuple[str, str, str, float]
SideIndex = dict[SideKey, dict[str, Any]]

_cache: dict[tuple[str, str, int], dict[str, Any]] = {}


def validate_query(app: str, format: str, legs: int) -> None:
    """Raise ``ValueError`` for any invalid app/format/legs combination."""
    expected_format = _APP_FORMATS.get(app)
    if expected_format is None:
        raise ValueError(f"unsupported app {app!r}")
    if format != expected_format:
        raise ValueError(
            f"app {app!r} requires format {expected_format!r}, got {format!r}"
        )
    breakeven_pct(app, format, legs)  # raises ValueError for bad legs


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


def _parse_payout_multiplier(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return value


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_board(app: str, dfs_rows: list[dict[str, Any]]) -> dict[BoardKey, dict[str, Any]]:
    """Bucket DFS rows into one board row per (player, stat, line).

    PrizePicks "standard" is a single pick-'em line the user can take either
    side of, so both sides are always considered available. Underdog rows
    carry an explicit ``side`` and are used as stored (one row per side).
    """
    buckets: dict[BoardKey, dict[str, Any]] = {}

    for row in dfs_rows:
        player = str(row.get("player_name") or "").strip()
        line_raw = row.get("line_score")
        if not player or line_raw is None:
            continue
        try:
            line_f = float(line_raw)
        except (TypeError, ValueError):
            continue

        if app == "prizepicks":
            if str(row.get("odds_type") or "").lower() != "standard":
                continue
            stat_type = str(row.get("stat_type") or "").strip()
            if not stat_type:
                continue
            stat_key = canonical_stat_key_from_pp_mlb(stat_type)
            if stat_key is None:
                continue
            sides_offered = _VALID_SIDES
            stat_label = display_stat_label(stat_key, fallback=stat_type)
        else:
            stat_name = str(row.get("stat_name") or "").strip()
            side = str(row.get("side") or "").lower()
            if not stat_name or side not in _VALID_SIDES:
                continue
            stat_key = canonical_stat_key_from_ud_mlb(stat_name)
            if stat_key is None:
                continue
            sides_offered = (side,)
            stat_label = display_stat_label(stat_key, fallback=stat_name)

        key: BoardKey = (_norm_player(player), stat_key, _line_key(line_f))
        bucket = buckets.setdefault(
            key,
            {
                "player_name": player,
                "stat": stat_label,
                "line": line_f,
                "sides": set(),
                "side_quotes": {},
                "scraped_at": None,
            },
        )
        bucket["sides"].update(sides_offered)
        if app != "prizepicks":
            # Underdog rows are one side each — keep american + payout for that side.
            quote = {
                "american": _parse_american(row.get("american_price")),
                "payout_multiplier": _parse_payout_multiplier(
                    row.get("payout_multiplier")
                ),
            }
            for side in sides_offered:
                bucket["side_quotes"][side] = quote
        scraped_at = row.get("scraped_at")
        if scraped_at is not None:
            bucket["scraped_at"] = scraped_at

    return buckets


def _index_snapshot_rows(
    rows: list[dict[str, Any]],
    *,
    player_field: str,
    stat_field: str,
) -> SideIndex:
    """Index ProphetX/Pinnacle snapshot rows by (player, stat, side, line)."""
    index: SideIndex = {}
    for row in rows:
        player = str(row.get(player_field) or "").strip()
        stat_raw = str(row.get(stat_field) or "").strip()
        side = str(row.get("side") or "").lower()
        line_raw = row.get("line_score")
        if not player or not stat_raw or side not in _VALID_SIDES or line_raw is None:
            continue
        stat_key = canonical_stat_key_from_sharp_mlb(stat_raw)
        if stat_key is None:
            continue
        american = _parse_american(row.get("american_price"))
        if american is None:
            continue
        try:
            line_f = float(line_raw)
        except (TypeError, ValueError):
            continue
        key: SideKey = (_norm_player(player), stat_key, side, _line_key(line_f))
        index[key] = {"american": american, "changed_at": row.get("scraped_at")}
    return index


def _index_parlay(
    rows: list[dict[str, Any]], now: datetime
) -> dict[str, SideIndex]:
    """Index Parlay rows by (player, stat, side, line) for fair + cmp books.

    Fair books (Novig/FD/DK) may drive ``compute_fair``. Cmp books
    (Caesars/Kalshi/bet365/BetMGM/Fanatics) are display-only on expand.

    ParlayAPI is fetched live with no persisted per-quote history in v1, so
    ``changed_at`` for these books is approximated as the current request
    time — a documented limitation vs. the sharp book's true last-move time
    (see design doc's "Open implementation notes").
    """
    by_book: dict[str, SideIndex] = {book: {} for book in _PARLAY_KEEP_BOOKS}
    for row in rows:
        book = str(row.get("bookmaker") or "").lower().strip()
        if book not in _PARLAY_KEEP_BOOKS:
            continue
        player = str(row.get("player") or "").strip()
        market_key = str(row.get("market_key") or "").strip()
        line_raw = row.get("line")
        if not player or not market_key or line_raw is None:
            continue
        stat_key = canonical_stat_key_from_sharp_mlb(market_key)
        if stat_key is None:
            continue
        try:
            line_f = float(line_raw)
        except (TypeError, ValueError):
            continue
        for side, price_field in (("over", "over_price"), ("under", "under_price")):
            american = _parse_american(row.get(price_field))
            if american is None:
                continue
            key: SideKey = (_norm_player(player), stat_key, side, _line_key(line_f))
            by_book[book][key] = {"american": american, "changed_at": now}
    return by_book


async def _fetch_parlay_rows() -> list[dict[str, Any]]:
    payload = await parlay_get(
        f"/sports/{SPORT_KEY}/props",
        params={"limit": PROPS_LIMIT},
        timeout=FETCH_TIMEOUT_SECONDS,
    )
    if not isinstance(payload, list):
        raise RuntimeError("Parlay MLB props response was not a list")
    return [row for row in payload if isinstance(row, dict)]


def _side_fair_books(
    indexes: dict[str, SideIndex], key: SideKey
) -> dict[str, float | None]:
    result: dict[str, float | None] = {}
    for book, index in indexes.items():
        hit = index.get(key)
        result[book] = None if hit is None else american_to_fair_pct(hit["american"])
    return result


def _book_quote(
    index: SideIndex, key: SideKey, *, role: str | None = None
) -> MlbPropBookQuote | None:
    hit = index.get(key)
    if hit is None:
        return None
    american = hit["american"]
    return MlbPropBookQuote(
        side=key[2],
        fair_pct=american_to_fair_pct(american),
        american=american,
        changed_at=_iso(hit.get("changed_at")),
        role=role,
    )


def _pick_recommended_side(
    available_sides: list[str], edges: dict[str, float | None]
) -> str | None:
    sides_with_edge = [s for s in available_sides if edges.get(s) is not None]
    if sides_with_edge:
        return max(sides_with_edge, key=lambda s: edges[s])
    # No sharp/mid-tier read on either side: default to "over" by convention
    # (design doc step 5) so the row still has a primary side to display.
    if "over" in available_sides:
        return "over"
    return available_sides[0] if available_sides else None


def _fair_driving_changed_at(
    source_tier: str,
    display_key: SideKey,
    prophetx_idx: SideIndex,
    novig_idx: SideIndex,
    dk_idx: SideIndex,
    fd_idx: SideIndex,
    soft_indexes: tuple[SideIndex, ...] = (),
) -> datetime | None:
    """Return ``changed_at`` for whichever book(s) actually drove ``fair_pct``.

    Tier 1 (consensus/disagreement/single-source) is driven by ProphetX and/or
    Novig; Tier 2 (``mid_tier_fallback``) by DraftKings and/or FanDuel; Tier 3
    (``soft_consensus``) by soft Parlay books and/or Pinnacle. Recency chips
    must reflect the driving book so mid-tier/soft rows aren't silently
    missing a chip those timestamps would warrant.
    """
    if source_tier == "soft_consensus":
        candidates = soft_indexes
    elif source_tier == "mid_tier_fallback":
        candidates = (dk_idx, fd_idx)
    else:
        candidates = (prophetx_idx, novig_idx)

    changed_ats = [
        hit["changed_at"]
        for idx in candidates
        for hit in (idx.get(display_key),)
        if hit is not None
    ]
    # When multiple books contributed (agree-and-blend, disagree-use-one, or
    # soft average), the more recent timestamp best represents freshness.
    return max(changed_ats) if changed_ats else None


def _assemble_rows(
    board: dict[BoardKey, dict[str, Any]],
    breakeven: float,
    prophetx_idx: SideIndex,
    pinnacle_idx: SideIndex,
    parlay_by_book: dict[str, SideIndex],
    now: datetime,
) -> list[MlbPropRow]:
    fair_book_indexes = {
        "prophetx": prophetx_idx,
        **{book: parlay_by_book.get(book, {}) for book in _PARLAY_FAIR_BOOKS},
        **{book: parlay_by_book.get(book, {}) for book in _PARLAY_CMP_BOOKS},
        "pinnacle": pinnacle_idx,
    }
    novig_idx = parlay_by_book.get("novig", {})
    dk_idx = parlay_by_book.get("draftkings", {})
    fd_idx = parlay_by_book.get("fanduel", {})
    soft_indexes = tuple(
        fair_book_indexes[book]
        for book in SOFT_FAIR_BOOKS
        if book in fair_book_indexes
    )

    rows: list[MlbPropRow] = []
    for (norm_player, stat_key, _line_rounded), bucket in board.items():
        line_f = float(bucket["line"])
        available_sides = sorted(bucket["sides"])
        if not available_sides:
            continue

        per_side_fair: dict[str, FairResult] = {}
        for side in available_sides:
            side_key: SideKey = (norm_player, stat_key, side, _line_key(line_f))
            side_books = _side_fair_books(fair_book_indexes, side_key)
            per_side_fair[side] = compute_fair(side_books)

        edges: dict[str, float | None] = {
            side: (
                None
                if per_side_fair[side].fair_pct is None
                else round(per_side_fair[side].fair_pct - breakeven, 3)
            )
            for side in available_sides
        }
        recommended = _pick_recommended_side(available_sides, edges)
        if recommended is None:
            continue

        primary = per_side_fair[recommended]
        alt_side = next((s for s in available_sides if s != recommended), None)
        alt_edge = edges.get(alt_side) if alt_side else None

        display_key: SideKey = (norm_player, stat_key, recommended, _line_key(line_f))

        def _cmp_quote(book: str) -> MlbPropBookQuote | None:
            return _book_quote(
                parlay_by_book.get(book, {}), display_key, role="comparison"
            )

        books = MlbPropBooks(
            prophetx=_book_quote(prophetx_idx, display_key),
            novig=_book_quote(novig_idx, display_key),
            draftkings=_book_quote(dk_idx, display_key),
            fanduel=_book_quote(fd_idx, display_key),
            pinnacle=_book_quote(pinnacle_idx, display_key, role="comparison"),
            caesars=_cmp_quote("caesars"),
            kalshi=_cmp_quote("kalshi"),
            bet365=_cmp_quote("bet365"),
            betmgm=_cmp_quote("betmgm"),
            fanatics=_cmp_quote("fanatics"),
            hardrock=_cmp_quote("hardrock"),
            fliff=_cmp_quote("fliff"),
        )

        driving_changed_at = _fair_driving_changed_at(
            primary.source_tier,
            display_key,
            prophetx_idx,
            novig_idx,
            dk_idx,
            fd_idx,
            soft_indexes,
        )

        dfs_changed_at = bucket.get("scraped_at")
        chip = recency_chip(
            sharp_changed_at=driving_changed_at,
            dfs_changed_at=dfs_changed_at,
            now=now,
        )

        side_quote = (bucket.get("side_quotes") or {}).get(recommended) or {}
        rows.append(
            MlbPropRow(
                player_name=bucket["player_name"],
                team_abbrev=None,
                stat=bucket["stat"],
                line=line_f,
                recommended_side=recommended,
                fair_pct=primary.fair_pct,
                edge_pct=edges[recommended],
                alt_edge_pct=alt_edge,
                source_tier=primary.source_tier,
                confidence_chips=primary.confidence_chips,
                sample_chips=primary.sample_chips,
                recency_chip=chip,
                books=books,
                dfs=MlbPropDfs(
                    line=line_f,
                    changed_at=_iso(dfs_changed_at),
                    american=side_quote.get("american"),
                    payout_multiplier=side_quote.get("payout_multiplier"),
                ),
                fair_explain=primary.fair_explain,
            )
        )

    rows.sort(
        key=lambda r: (
            r.source_tier == "no_sharp_read",
            -(r.edge_pct if r.edge_pct is not None else -999.0),
            r.player_name.lower(),
        )
    )
    return rows


def _apply_roster_enrichment(
    rows: list[MlbPropRow],
    index: dict[str, Any],
) -> list[MlbPropRow]:
    enriched: list[MlbPropRow] = []
    for row in rows:
        entry = index.get(norm_player_name(row.player_name))
        if not entry:
            enriched.append(row)
            continue
        enriched.append(
            row.model_copy(
                update={
                    "headshot_url": entry.get("headshot_url"),
                    "position": entry.get("position"),
                    "team_abbrev": entry.get("team_abbrev") or row.team_abbrev,
                }
            )
        )
    return enriched


async def get_mlb_props_today(*, app: str, format: str, legs: int) -> MlbPropsResponse:
    """Assemble the DFS-first, +EV-ranked MLB prop board for one app/format/legs."""
    validate_query(app, format, legs)

    cache_key = (app, format, legs)
    now_mono = time.monotonic()
    cached = _cache.get(cache_key)
    if cached is not None and now_mono < cached["expires_at"]:
        return cached["response"]

    now = _utcnow()
    breakeven = breakeven_pct(app, format, legs)

    if app == "prizepicks":
        dfs_rows = fetch_latest_prizepicks("mlb")
    else:
        dfs_rows = fetch_latest_underdog("mlb")
    board = _build_board(app, dfs_rows)

    prophetx_idx = _index_snapshot_rows(
        fetch_latest_prophetx("mlb"), player_field="player_name", stat_field="stat_name"
    )
    pinnacle_idx = _index_snapshot_rows(
        fetch_latest_pinnacle("mlb"), player_field="player_name", stat_field="market_type"
    )

    parlay_error: str | None = None
    parlay_by_book: dict[str, SideIndex] = {book: {} for book in _PARLAY_KEEP_BOOKS}
    try:
        parlay_rows = await _fetch_parlay_rows()
        parlay_by_book = _index_parlay(parlay_rows, now)
    except Exception as exc:
        logger.warning("Parlay MLB props unavailable: %s", exc)
        parlay_error = str(exc)

    rows = _assemble_rows(board, breakeven, prophetx_idx, pinnacle_idx, parlay_by_book, now)

    try:
        roster_index = await get_mlb_player_index()
        rows = _apply_roster_enrichment(rows, roster_index)
    except Exception as exc:
        logger.warning("MLB prop roster enrichment skipped: %s", exc)

    response = MlbPropsResponse(
        as_of=_iso(now) or "",
        app=app,
        format=format,
        legs=legs,
        breakeven_pct=breakeven,
        props=rows,
        error=parlay_error,
    )
    _cache[cache_key] = {"response": response, "expires_at": now_mono + CACHE_TTL_SECONDS}
    return response
