"""Fetch + normalize The Odds API MLB player props into PP board + book indexes."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from app.domains.mlb.prop_fair import american_to_fair_pct
from app.domains.mlb.prop_stat_keys import (
    canonical_stat_key_from_odds_api_mlb,
    display_stat_label,
)
from app.providers.odds_api.client import odds_api_get

logger = logging.getLogger(__name__)

SideKey = tuple[str, str, str, float]
SideIndex = dict[SideKey, dict[str, Any]]

_VALID_SIDES = frozenset({"over", "under"})

_BOOK_KEY_MAP = {
    "prizepicks": "prizepicks",  # DFS only — board, not books.*
    "novig": "novig",
    "kalshi": "kalshi",
    "draftkings": "draftkings",
    "fanduel": "fanduel",
    "betmgm": "betmgm",
    "betonlineag": "betonline",
}

_SCHEMA_BOOK_KEYS: tuple[str, ...] = (
    "novig",
    "kalshi",
    "draftkings",
    "fanduel",
    "betmgm",
    "betonline",
)

_REGIONS = "us,us_ex,us_dfs"
_BOOKMAKERS = "prizepicks,novig,kalshi,draftkings,fanduel,betmgm,betonlineag"
# Task 2 allowlist (must stay in sync with prop_stat_keys._ODDS_API_ALIASES).
_MARKETS = (
    "batter_hits,batter_home_runs,batter_total_bases,batter_rbis,"
    "batter_runs_scored,batter_singles,batter_doubles,batter_triples,"
    "batter_walks,batter_strikeouts,batter_stolen_bases,batter_hits_runs_rbis,"
    "pitcher_strikeouts,pitcher_hits_allowed,pitcher_walks,pitcher_earned_runs,"
    "pitcher_outs"
)

_SPORT_PATH = "/v4/sports/baseball_mlb"
_EVENTS_PATH = f"{_SPORT_PATH}/events"
_FETCH_CONCURRENCY = 3


@dataclass(frozen=True)
class OddsApiMlbNormalized:
    prizepicks_board: list[dict[str, Any]]
    book_indexes: dict[str, SideIndex]
    as_of: str | None
    # True only for real unavailability (missing key / HTTP failure), not empty slate.
    unavailable: bool = False


def _empty(*, unavailable: bool = True) -> OddsApiMlbNormalized:
    return OddsApiMlbNormalized(
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


def _parse_side(raw: Any) -> str | None:
    side = str(raw or "").strip().lower()
    if side in _VALID_SIDES:
        return side
    return None


def normalize_event_odds(
    events_odds: list[dict[str, Any]],
) -> OddsApiMlbNormalized:
    """Pure transform of Odds API event-odds payloads → board + side indexes."""
    prizepicks_board: list[dict[str, Any]] = []
    # Dedupe PP board seeds by (player_norm, canonical, line).
    pp_seen: set[tuple[str, str, float]] = set()
    book_indexes: dict[str, SideIndex] = {book: {} for book in _SCHEMA_BOOK_KEYS}
    as_of: str | None = None

    for event in events_odds:
        if not isinstance(event, dict):
            continue
        for bookmaker in event.get("bookmakers") or []:
            if not isinstance(bookmaker, dict):
                continue
            odds_key = str(bookmaker.get("key") or "").strip().lower()
            schema_key = _BOOK_KEY_MAP.get(odds_key)
            if schema_key is None:
                continue
            last_update = bookmaker.get("last_update")
            if isinstance(last_update, str) and last_update:
                if as_of is None or last_update > as_of:
                    as_of = last_update

            for market in bookmaker.get("markets") or []:
                if not isinstance(market, dict):
                    continue
                market_key = str(market.get("key") or "").strip()
                canonical = canonical_stat_key_from_odds_api_mlb(market_key)
                if canonical is None:
                    continue
                stat_label = display_stat_label(canonical)

                for outcome in market.get("outcomes") or []:
                    if not isinstance(outcome, dict):
                        continue
                    player = str(outcome.get("description") or "").strip()
                    side = _parse_side(outcome.get("name"))
                    point = outcome.get("point")
                    if not player or side is None or point is None:
                        continue
                    try:
                        line_f = _line_key(float(point))
                    except (TypeError, ValueError):
                        continue
                    american = _parse_american(outcome.get("price"))
                    changed_at = last_update if isinstance(last_update, str) else None

                    if schema_key == "prizepicks":
                        board_key = (_norm_player(player), canonical, line_f)
                        if board_key in pp_seen:
                            continue
                        pp_seen.add(board_key)
                        row: dict[str, Any] = {
                            "player_name": player,
                            "line_score": line_f,
                            "odds_type": "standard",
                            "stat_type": stat_label,
                            "scraped_at": changed_at,
                        }
                        if american is not None:
                            row["american_price"] = american
                        prizepicks_board.append(row)
                        continue

                    if american is None:
                        continue
                    side_key: SideKey = (
                        _norm_player(player),
                        canonical,
                        side,
                        line_f,
                    )
                    book_indexes[schema_key][side_key] = {
                        "american": american,
                        "fair_pct": american_to_fair_pct(american),
                        "changed_at": changed_at,
                    }

    # Drop empty book indexes so callers can use `in` checks cleanly.
    book_indexes = {k: v for k, v in book_indexes.items() if v}
    return OddsApiMlbNormalized(
        prizepicks_board=prizepicks_board,
        book_indexes=book_indexes,
        as_of=as_of,
        unavailable=False,
    )


async def _fetch_event_odds(
    event_id: str,
    *,
    timeout: float,
    sem: asyncio.Semaphore,
) -> dict[str, Any] | None:
    async with sem:
        try:
            payload = await odds_api_get(
                f"{_EVENTS_PATH}/{event_id}/odds",
                params={
                    "regions": _REGIONS,
                    "bookmakers": _BOOKMAKERS,
                    "markets": _MARKETS,
                    "oddsFormat": "american",
                },
                timeout=timeout,
            )
        except Exception:
            logger.exception("Odds API event odds failed for %s", event_id)
            return None
    if isinstance(payload, dict):
        return payload
    return None


async def fetch_mlb_props_normalized(
    *, timeout: float = 12.0
) -> OddsApiMlbNormalized:
    """List MLB events, fetch per-event props, normalize. Soft-fails to empty."""
    try:
        events_payload = await odds_api_get(_EVENTS_PATH, timeout=timeout)
    except Exception:
        logger.exception("Odds API MLB events list failed")
        return _empty()

    if not isinstance(events_payload, list):
        return _empty()

    event_ids = [
        str(ev["id"])
        for ev in events_payload
        if isinstance(ev, dict) and ev.get("id")
    ]
    if not event_ids:
        # Successful fetch, zero events — empty slate, not unavailable.
        return _empty(unavailable=False)

    sem = asyncio.Semaphore(_FETCH_CONCURRENCY)
    results = await asyncio.gather(
        *(_fetch_event_odds(eid, timeout=timeout, sem=sem) for eid in event_ids)
    )
    events_odds = [ev for ev in results if isinstance(ev, dict)]
    if not events_odds:
        # Events listed but every per-event odds fetch failed.
        return _empty(unavailable=True)
    return normalize_event_odds(events_odds)
