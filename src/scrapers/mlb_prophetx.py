"""ProphetX MLB scraper — public API (team markets + player props)."""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://www.prophetx.co"
MLB_TOURNAMENT_ID = 109
MARKET_BATCH_SIZE = 20
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "X-Currency": "cash",
}

T = TypeVar("T")

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "prophetx", "mlb")
_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")


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
    name = output_filename("mlb", when, kind="props")
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
    "spread": "run_line",
    "total": "total",
    "1st_inning_moneyline": "1st_inning_moneyline",
    "1st_5th_inning_moneyline": "1st_5th_inning_moneyline",
}


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
                "line": None if line in (0, 0.0, None) and "over" not in str(best.get("name", "")).lower() else line,
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
        if key == "moneyline" and market.get("selections"):
            book = market
        else:
            book = pick_main_market_line(market) or (
                market if market.get("selections") else None
            )
        if not book:
            continue
        rows = _side_rows(_sides_from_book(book))
        if rows:
            out[key] = rows
    return out


PROP_SUBTYPE_TO_STAT: dict[str, str] = {
    "player_total_hits": "hits",
    "player_total_home_runs": "home_runs",
    "player_total_rbis": "rbis",
    "player_total_runs": "runs",
    "player_total_bases": "total_bases",
    "player_stolen_bases": "stolen_bases",
    "player_singles": "singles",
    "player_doubles": "doubles",
    "player_hits_allowed": "hits_allowed",
}

_PROP_NAME_SUFFIXES = (
    " Total Hits",
    " Total Home Runs",
    " Total RBIs",
    " Total Runs",
    " Total Bases",
    " Stolen Bases",
    " Singles",
    " Doubles",
    " Hits Allowed",
)


def player_name_from_market(market: dict[str, Any]) -> str:
    name = str(market.get("name") or "").strip()
    for suffix in _PROP_NAME_SUFFIXES:
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name


def extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or "")
        stat = PROP_SUBTYPE_TO_STAT.get(sub)
        if not stat:
            continue
        book = pick_main_market_line(market)
        if not book:
            continue
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
            continue
        rows.append(
            {
                "player": player_name_from_market(market),
                "stat": stat,
                "line": line,
                "over": over,
                "under": under,
                "market_id": market.get("id"),
                "sub_type": sub,
            }
        )
    return rows


def chunked(items: list[T], size: int) -> list[list[T]]:
    if size <= 0:
        raise ValueError("size must be positive")
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_json(
    session: requests.Session,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    retries: int = 3,
) -> Any:
    url = path if path.startswith("http") else f"{BASE_URL}{path}"
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session.get(url, params=params, timeout=60, headers=DEFAULT_HEADERS)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt + 1 < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last_err = exc
            if attempt + 1 >= retries:
                break
            time.sleep(0.5 * (attempt + 1))
    assert last_err is not None
    raise last_err


def fetch_mlb_events(session: requests.Session) -> list[dict[str, Any]]:
    path = f"/trade/public/api/v1/tournaments/{MLB_TOURNAMENT_ID}/events"
    events: list[dict[str, Any]] = []
    nxt: str | int | None = None
    while True:
        params = {"next": nxt} if nxt is not None else None
        payload = fetch_json(session, path, params=params)
        chunk = payload.get("data") or []
        if isinstance(chunk, list):
            events.extend([e for e in chunk if isinstance(e, dict)])
        nxt = payload.get("next")
        if not nxt or not chunk:
            break
    max_events = os.environ.get("PROPHETX_MAX_EVENTS", "").strip()
    if max_events.isdigit():
        events = events[: int(max_events)]
    return events


def fetch_markets_for_events(
    session: requests.Session,
    event_ids: list[int],
    *,
    market_types: str | None = None,
    market_sub_types: str | None = None,
    batch_size: int = MARKET_BATCH_SIZE,
) -> list[dict[str, Any]]:
    path = "/partner/v3/public/get_multiple_markets"
    out: list[dict[str, Any]] = []
    for batch in chunked(event_ids, batch_size):
        params: dict[str, Any] = {"event_ids": ",".join(str(i) for i in batch)}
        if market_types:
            params["market_types"] = market_types
        if market_sub_types:
            params["market_sub_types"] = market_sub_types
        payload = fetch_json(session, path, params=params)
        data = payload.get("data") or []
        if isinstance(data, list):
            out.extend([row for row in data if isinstance(row, dict)])
    return out
