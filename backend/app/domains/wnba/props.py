"""Assemble GET /api/wnba/props/today: DFS board + fair/edge/tier per row.

Pipeline (WNBA parity with MLB props assemble):
  1. Load the selected app's DFS lines from Parlay PrizePicks board
     (fallback: PrizePicks snapshot) or Underdog snapshot and bucket into one
     board row per (player, stat, line).
  2. Index ProphetX, Novig, and Pinnacle scrapers; merge Parlay book indexes
     (draftkings, fanduel) by (player, stat, side, line) — exact line only, no
     closest-line fallback. Pinnacle expand quotes keep ``role="comparison"``.
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
    fetch_latest_novig,
    fetch_latest_pinnacle,
    fetch_latest_prizepicks,
    fetch_latest_prophetx,
    fetch_latest_underdog,
)
from app.domains.betting.prop_stat_keys import (
    canonical_stat_key_from_exchange,
    canonical_stat_key_from_pp,
    canonical_stat_key_from_ud,
    display_stat_label,
)
from app.domains.wnba.prop_fair import (
    SOFT_FAIR_BOOKS,
    FairResult,
    american_to_fair_pct,
    compute_fair,
    recency_chip,
)
from app.domains.wnba.prop_formats import breakeven_pct
from app.domains.wnba.schemas_prop_picks import (
    WnbaPropBooks,
    WnbaPropBookQuote,
    WnbaPropDfs,
    WnbaPropPicksResponse,
    WnbaPropRow,
)
from app.providers.espn.wnba_roster import get_wnba_player_index, norm_player_name
from app.providers.parlay.wnba_board import (
    FETCH_TIMEOUT_SECONDS,
    ParlayWnbaNormalized,
    fetch_wnba_parlay_board_normalized,
)

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 15 * 60

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


def _as_datetime(raw: Any) -> datetime | None:
    """Coerce scraper datetimes or Parlay ISO strings to aware UTC datetimes."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        if raw.tzinfo is None:
            return raw.replace(tzinfo=timezone.utc)
        return raw.astimezone(timezone.utc)
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return None


def _iso(raw: Any) -> str | None:
    dt = _as_datetime(raw)
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _commence_time(raw: Any) -> str | None:
    if raw is None:
        return None
    iso = _iso(raw)
    if iso is not None:
        return iso
    text = str(raw).strip()
    return text or None


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
            stat_key = canonical_stat_key_from_pp(stat_type)
            if stat_key is None:
                continue
            sides_offered = _VALID_SIDES
            stat_label = display_stat_label(stat_key, fallback=stat_type)
        else:
            stat_name = str(row.get("stat_name") or "").strip()
            side = str(row.get("side") or "").lower()
            if not stat_name or side not in _VALID_SIDES:
                continue
            stat_key = canonical_stat_key_from_ud(stat_name)
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
                "commence_time": None,
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
        scraped_at = _as_datetime(row.get("scraped_at"))
        if scraped_at is not None:
            bucket["scraped_at"] = scraped_at
        if bucket.get("commence_time") is None:
            bucket["commence_time"] = _commence_time(row.get("commence_time"))

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
        stat_key = canonical_stat_key_from_exchange(stat_raw)
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
        index[key] = {
            "american": american,
            "changed_at": _as_datetime(row.get("scraped_at")),
        }
    return index


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
) -> WnbaPropBookQuote | None:
    hit = index.get(key)
    if hit is None:
        return None
    american = hit["american"]
    return WnbaPropBookQuote(
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
    (``soft_consensus``) by soft books and/or Pinnacle. Recency chips must
    reflect the driving book so mid-tier/soft rows aren't silently missing a
    chip those timestamps would warrant.
    """
    if source_tier == "soft_consensus":
        candidates = soft_indexes
    elif source_tier == "mid_tier_fallback":
        candidates = (dk_idx, fd_idx)
    else:
        candidates = (prophetx_idx, novig_idx)

    changed_ats = [
        dt
        for idx in candidates
        for hit in (idx.get(display_key),)
        if hit is not None
        for dt in (_as_datetime(hit.get("changed_at")),)
        if dt is not None
    ]
    # When multiple books contributed (agree-and-blend, disagree-use-one, or
    # soft average), the more recent timestamp best represents freshness.
    return max(changed_ats) if changed_ats else None


def _assemble_rows(
    board: dict[BoardKey, dict[str, Any]],
    breakeven: float,
    prophetx_idx: SideIndex,
    novig_idx: SideIndex,
    pinnacle_idx: SideIndex,
    parlay_book_indexes: dict[str, SideIndex],
    now: datetime,
) -> list[WnbaPropRow]:
    dk_idx = parlay_book_indexes.get("draftkings", {})
    fd_idx = parlay_book_indexes.get("fanduel", {})
    fair_book_indexes = {
        "prophetx": prophetx_idx,
        "novig": novig_idx,
        "draftkings": dk_idx,
        "fanduel": fd_idx,
        "pinnacle": pinnacle_idx,
    }
    soft_indexes = tuple(fair_book_indexes[book] for book in SOFT_FAIR_BOOKS)

    rows: list[WnbaPropRow] = []
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

        books = WnbaPropBooks(
            prophetx=_book_quote(prophetx_idx, display_key),
            novig=_book_quote(novig_idx, display_key),
            draftkings=_book_quote(dk_idx, display_key),
            fanduel=_book_quote(fd_idx, display_key),
            pinnacle=_book_quote(pinnacle_idx, display_key, role="comparison"),
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
            WnbaPropRow(
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
                dfs=WnbaPropDfs(
                    line=line_f,
                    changed_at=_iso(dfs_changed_at),
                    american=side_quote.get("american"),
                    payout_multiplier=side_quote.get("payout_multiplier"),
                ),
                fair_explain=primary.fair_explain,
                commence_time=bucket.get("commence_time"),
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
    rows: list[WnbaPropRow],
    index: dict[str, Any],
) -> list[WnbaPropRow]:
    enriched: list[WnbaPropRow] = []
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


def _empty_parlay(*, unavailable: bool = True) -> ParlayWnbaNormalized:
    return ParlayWnbaNormalized(
        prizepicks_board=[], book_indexes={}, as_of=None, unavailable=unavailable
    )


async def get_wnba_props_today(*, app: str, format: str, legs: int) -> WnbaPropPicksResponse:
    """Assemble the DFS-first, +EV-ranked WNBA prop board for one app/format/legs."""
    validate_query(app, format, legs)

    cache_key = (app, format, legs)
    now_mono = time.monotonic()
    cached = _cache.get(cache_key)
    if cached is not None and now_mono < cached["expires_at"]:
        return cached["response"]

    now = _utcnow()
    breakeven = breakeven_pct(app, format, legs)

    parlay_raised = False
    try:
        parlay = await fetch_wnba_parlay_board_normalized(timeout=FETCH_TIMEOUT_SECONDS)
    except Exception as exc:
        logger.warning("Parlay WNBA props unavailable: %s", exc)
        parlay_raised = True
        parlay = _empty_parlay()

    if app == "prizepicks":
        dfs_rows = list(parlay.prizepicks_board)
        if not dfs_rows:
            dfs_rows = fetch_latest_prizepicks("wnba")
    else:
        dfs_rows = fetch_latest_underdog("wnba")
    board = _build_board(app, dfs_rows)

    # Soft-fail: surface parlay_unavailable only when Parlay failed and seed is empty.
    # Empty successful seed → app-specific unavailable token.
    error: str | None = None
    if not board:
        if parlay_raised or parlay.unavailable:
            error = "parlay_unavailable"
        elif app == "prizepicks":
            error = "prizepicks_unavailable"
        else:
            error = "underdog_unavailable"

    prophetx_idx = _index_snapshot_rows(
        fetch_latest_prophetx("wnba"), player_field="player_name", stat_field="stat_name"
    )
    novig_idx = _index_snapshot_rows(
        fetch_latest_novig("wnba"), player_field="player_name", stat_field="stat_name"
    )
    pinnacle_idx = _index_snapshot_rows(
        fetch_latest_pinnacle("wnba"), player_field="player_name", stat_field="market_type"
    )

    rows = _assemble_rows(
        board,
        breakeven,
        prophetx_idx,
        novig_idx,
        pinnacle_idx,
        parlay.book_indexes,
        now,
    )

    try:
        roster_index = await get_wnba_player_index()
        if isinstance(roster_index, dict):
            rows = _apply_roster_enrichment(rows, roster_index)
    except Exception as exc:
        logger.warning("WNBA prop roster enrichment skipped: %s", exc)

    response = WnbaPropPicksResponse(
        as_of=_iso(now) or "",
        app=app,
        format=format,
        legs=legs,
        breakeven_pct=breakeven,
        props=rows,
        error=error,
    )
    _cache[cache_key] = {"response": response, "expires_at": now_mono + CACHE_TTL_SECONDS}
    return response
