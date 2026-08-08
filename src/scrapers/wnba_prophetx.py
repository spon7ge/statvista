"""ProphetX WNBA scraper — public API (team markets + player props)."""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "prophetx", "wnba")
_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")

logger = logging.getLogger(__name__)


def output_filename(league: str, now: datetime, *, kind: str) -> str:
    stamp = now.astimezone(_OUTPUT_TZ).strftime("%Y-%m-%d_%H%M%S")
    return f"prophetx_{league.strip().lower()}_{stamp}_{kind}.json"


def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return props_path[: -len("_props.json")] + "_team.json"
    root, ext = os.path.splitext(props_path)
    return f"{root}_team{ext or '.json'}"


def resolve_props_output_path(*, now: datetime | None = None) -> str:
    when = now or datetime.now(_OUTPUT_TZ)
    env_file = os.environ.get("PROPHETX_OUTPUT", "").strip()
    env_dir = os.environ.get("PROPHETX_OUTPUT_DIR", "").strip()
    name = output_filename("wnba", when, kind="props")
    if env_file:
        expanded = os.path.expanduser(env_file)
        if expanded.lower().endswith(".json") and not os.path.isdir(expanded):
            return expanded
        os.makedirs(expanded, exist_ok=True)
        return os.path.join(expanded, name)
    base = env_dir or _DEFAULT_OUTPUT_DIR
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, name)


def pick_main_market_line(market: dict[str, Any]) -> dict[str, Any] | None:
    lines = [ln for ln in (market.get("marketLines") or []) if isinstance(ln, dict)]
    if not lines:
        return None
    favourites = [ln for ln in lines if ln.get("favourite") is True]
    if len(favourites) == 1:
        return favourites[0]
    if len(favourites) > 1:
        return favourites[0]
    if len(lines) == 1:
        return lines[0]
    return None


def best_selection(side: list[dict[str, Any]]) -> dict[str, Any] | None:
    for sel in side:
        if isinstance(sel, dict):
            return sel
    return None


def american_and_stake(sel: dict[str, Any]) -> tuple[int | None, float | None]:
    raw = sel.get("odds")
    american: int | None
    try:
        american = int(raw) if raw is not None else None
    except (TypeError, ValueError):
        american = None
    stake_raw = sel.get("stake")
    try:
        stake = float(stake_raw) if stake_raw is not None else None
    except (TypeError, ValueError):
        stake = None
    return american, stake


TEAM_SUBTYPE_TO_KEY: dict[str, str] = {
    "moneyline": "moneyline",
    "spread": "spread",
    "total": "total",
}

_MONEYLINE_OUTPUT_KEYS = frozenset({"moneyline"})


def normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    competitors = []
    for c in event.get("competitors") or []:
        if not isinstance(c, dict):
            continue
        competitors.append(
            {
                "id": c.get("id"),
                "name": c.get("name") or c.get("displayName"),
                "abbreviation": c.get("abbreviation"),
                "seq": c.get("seq"),
            }
        )
    return {
        "event_id": event.get("id"),
        "name": event.get("name") or event.get("displayName"),
        "scheduled": event.get("scheduled"),
        "status": event.get("status"),
        "competitors": competitors,
    }


def _sides_from_book(book: dict[str, Any]) -> list[list[dict[str, Any]]]:
    sels = book.get("selections")
    if isinstance(sels, list) and sels:
        return [s for s in sels if isinstance(s, list)]
    return []


def _side_rows(sides: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for side in sides:
        best = best_selection(side)
        if not best:
            continue
        american, stake = american_and_stake(best)
        line = best.get("line")
        rows.append(
            {
                "name": best.get("name") or best.get("displayName"),
                "competitor_id": best.get("competitorId"),
                "american": american,
                "line": None
                if line in (0, 0.0, None)
                and "over" not in str(best.get("name", "")).lower()
                else line,
                "stake": stake,
            }
        )
    return rows


def extract_team_markets(markets: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or market.get("type") or "")
        key = TEAM_SUBTYPE_TO_KEY.get(sub)
        if not key:
            continue
        book: dict[str, Any] | None
        if key in _MONEYLINE_OUTPUT_KEYS and market.get("selections"):
            book = market
        else:
            book = pick_main_market_line(market)
        if not book:
            continue
        rows = _side_rows(_sides_from_book(book))
        if rows:
            out[key] = rows
    return out


PROP_SUBTYPE_TO_STAT: dict[str, str] = {
    "player_total_points": "points",
    "player_total_rebounds": "rebounds",
    "player_total_assists": "assists",
    "player_total_points_rebounds_assists": "points_rebounds_assists",
    "player_total_points_rebounds": "points_rebounds",
    "player_total_points_assists": "points_assists",
    "player_total_rebounds_assists": "rebounds_assists",
}

_PROP_NAME_SUFFIXES = (
    " Total Points, Rebounds & Assists",
    " Total Points & Rebounds",
    " Total Points & Assists",
    " Total Rebounds & Assists",
    " Total Points",
    " Total Rebounds",
    " Total Assists",
)


def player_name_from_market(market: dict[str, Any]) -> str:
    name = str(market.get("name") or "").strip()
    for suffix in _PROP_NAME_SUFFIXES:
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name


def _prop_row_from_book(
    market: dict[str, Any],
    book: dict[str, Any],
    *,
    stat: str,
    sub: str,
    is_main: bool,
) -> dict[str, Any] | None:
    sides = _sides_from_book(book)
    over = under = None
    line: float | None = None
    for side in sides:
        best = best_selection(side)
        if not best:
            continue
        american, stake = american_and_stake(best)
        side_name = str(best.get("name") or "").lower()
        payload = {"american": american, "stake": stake}
        if best.get("line") is not None:
            try:
                line = float(best["line"])
            except (TypeError, ValueError):
                pass
        if side_name.startswith("over"):
            over = payload
        elif side_name.startswith("under"):
            under = payload
    if over is None and under is None:
        return None
    return {
        "player": player_name_from_market(market),
        "stat": stat,
        "line": line,
        "over": over,
        "under": under,
        "market_id": market.get("id"),
        "sub_type": sub,
        "is_main": is_main,
    }


def extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or "")
        stat = PROP_SUBTYPE_TO_STAT.get(sub)
        if not stat:
            continue
        lines = [ln for ln in (market.get("marketLines") or []) if isinstance(ln, dict)]
        if not lines:
            continue
        favourites = [ln for ln in lines if ln.get("favourite") is True]
        if len(favourites) > 1:
            logger.debug(
                "ProphetX prop market %s has %s favourite lines; marking first as is_main",
                market.get("id"),
                len(favourites),
            )
        if favourites:
            main_book = favourites[0]
        elif len(lines) == 1:
            main_book = lines[0]
        else:
            main_book = None
        for book in lines:
            is_main = book is main_book
            row = _prop_row_from_book(
                market, book, stat=stat, sub=sub, is_main=is_main
            )
            if row is not None:
                rows.append(row)
    return rows
