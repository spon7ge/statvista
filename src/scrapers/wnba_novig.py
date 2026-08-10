"""Novig WNBA scraper — public GraphQL (team markets + player props).

After writing JSON snapshots, upserts to odds.wnba_novig / odds.wnba_novig_team
unless NOVIG_SKIP_DB is set.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "novig", "wnba")
_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")


def output_filename(league: str, now: datetime, *, kind: str) -> str:
    if kind not in ("props", "team"):
        raise ValueError(f"kind must be 'props' or 'team', got {kind!r}")
    stamp = now.astimezone(_OUTPUT_TZ).strftime("%Y-%m-%d_%H%M%S")
    return f"novig_{league.strip().lower()}_{stamp}_{kind}.json"


def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return props_path[: -len("_props.json")] + "_team.json"
    root, ext = os.path.splitext(props_path)
    return f"{root}_team{ext or '.json'}"


def resolve_props_output_path(*, now: datetime | None = None) -> str:
    when = now or datetime.now(_OUTPUT_TZ)
    env_file = os.environ.get("NOVIG_OUTPUT", "").strip()
    env_dir = os.environ.get("NOVIG_OUTPUT_DIR", "").strip()
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


def probability_to_american(prob: float) -> int | None:
    if prob <= 0.0 or prob >= 1.0:
        return None
    if abs(prob - 0.5) < 1e-12:
        return -100
    if prob > 0.5:
        return int(round(-100.0 * prob / (1.0 - prob)))
    return int(round(100.0 * (1.0 - prob) / prob))


def qty_cents_to_stake_dollars(qty: float | int | None) -> float | None:
    if qty is None:
        return None
    try:
        cents = float(qty)
    except (TypeError, ValueError):
        return None
    if cents <= 0:
        return None
    return cents / 100.0


def outcome_quote(
    outcome: dict[str, Any],
    opposite: dict[str, Any] | None,
) -> dict[str, int | float | None] | None:
    raw = outcome.get("available")
    if raw is None:
        return None
    try:
        prob = float(raw)
    except (TypeError, ValueError):
        return None
    american = probability_to_american(prob)
    if american is None:
        return None
    stake: float | None = None
    if opposite:
        total = 0.0
        for order in opposite.get("orders") or []:
            if not isinstance(order, dict):
                continue
            if str(order.get("status") or "OPEN").upper() != "OPEN":
                continue
            part = qty_cents_to_stake_dollars(order.get("qty"))
            if part is not None:
                total += part
        if total > 0:
            stake = total
    return {"american": american, "stake": stake}


_STATUS_MAP = {
    "OPEN_INGAME": "live",
    "OPEN_PREGAME": "not_started",
}
_SPREAD_LINE_RE = re.compile(r"([+-]?\d+(?:\.\d+)?)\s*$")


def _map_status(raw: str) -> str:
    if raw in _STATUS_MAP:
        return _STATUS_MAP[raw]
    return raw.lower() if raw else ""


def normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    game = event.get("game") if isinstance(event.get("game"), dict) else {}
    home = game.get("homeTeam") if isinstance(game.get("homeTeam"), dict) else {}
    away = game.get("awayTeam") if isinstance(game.get("awayTeam"), dict) else {}
    competitors: list[dict[str, Any]] = []
    if home:
        competitors.append(
            {
                "id": home.get("id"),
                "name": home.get("name"),
                "seq": 0,
            }
        )
    if away:
        competitors.append(
            {
                "id": away.get("id"),
                "name": away.get("name"),
                "seq": 1,
            }
        )
    return {
        "event_id": event.get("id"),
        "name": event.get("description"),
        "scheduled": game.get("scheduled_start"),
        "status": _map_status(str(event.get("status") or "")),
        "competitors": competitors,
    }


def _outcome_available(outcome: dict[str, Any]) -> float | None:
    raw = outcome.get("available")
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _market_outcomes(market: dict[str, Any]) -> list[dict[str, Any]]:
    outcomes = market.get("outcomes") or []
    return [o for o in outcomes if isinstance(o, dict)]


def _both_sides_available(market: dict[str, Any]) -> bool:
    outcomes = _market_outcomes(market)
    if len(outcomes) < 2:
        return False
    return all(_outcome_available(o) is not None for o in outcomes[:2])


def _evenness_score(market: dict[str, Any]) -> float:
    outcomes = _market_outcomes(market)
    if len(outcomes) < 2:
        return float("inf")
    a = _outcome_available(outcomes[0])
    b = _outcome_available(outcomes[1])
    if a is None or b is None:
        return float("inf")
    return abs(a - 0.5) + abs(b - 0.5)


def pick_main_spread(markets: list[dict[str, Any]]) -> dict[str, Any] | None:
    # WNBA: pick by evenness only — no MLB-style |strike| == 1.5 preference.
    candidates = [
        m
        for m in markets
        if isinstance(m, dict) and m.get("type") == "SPREAD" and _both_sides_available(m)
    ]
    if not candidates:
        return None
    return min(candidates, key=_evenness_score)


def pick_main_total(markets: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [
        m
        for m in markets
        if isinstance(m, dict) and m.get("type") == "TOTAL" and _both_sides_available(m)
    ]
    if not candidates:
        return None
    return min(candidates, key=_evenness_score)


def _competitor_id_for_outcome(
    description: str,
    competitors: list[dict[str, Any]] | None,
) -> Any:
    if not competitors:
        return None
    for comp in competitors:
        name = str(comp.get("name") or "")
        if description == name:
            return comp.get("id")
    return None


def _line_from_spread_outcome(description: str, strike: float | None) -> float | None:
    match = _SPREAD_LINE_RE.search(str(description).strip())
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    if strike is not None:
        return float(strike)
    return None


def _side_row(
    outcome: dict[str, Any],
    opposite: dict[str, Any],
    *,
    line: float | None = None,
    competitors: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    quote = outcome_quote(outcome, opposite)
    if quote is None:
        return None
    description = str(outcome.get("description") or "")
    return {
        "name": description,
        "competitor_id": _competitor_id_for_outcome(description, competitors),
        "american": quote["american"],
        "line": line,
        "stake": quote["stake"],
    }


def _rows_from_outcomes(
    market: dict[str, Any],
    *,
    line_for_outcome: Any | None = None,
    competitors: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    outcomes = _market_outcomes(market)
    if len(outcomes) < 2:
        return []
    rows: list[dict[str, Any]] = []
    for idx, outcome in enumerate(outcomes):
        opposite = outcomes[1 - idx]
        line: float | None = None
        if line_for_outcome is not None:
            line = line_for_outcome(outcome, market)
        row = _side_row(outcome, opposite, line=line, competitors=competitors)
        if row is not None:
            rows.append(row)
    return rows


def _moneyline_rows(market: dict[str, Any]) -> list[dict[str, Any]]:
    return _rows_from_outcomes(market)


def _spread_rows(market: dict[str, Any]) -> list[dict[str, Any]]:
    strike_raw = market.get("strike")
    strike: float | None
    try:
        strike = float(strike_raw) if strike_raw is not None else None
    except (TypeError, ValueError):
        strike = None

    def line_for_outcome(outcome: dict[str, Any], _market: dict[str, Any]) -> float | None:
        return _line_from_spread_outcome(str(outcome.get("description") or ""), strike)

    return _rows_from_outcomes(market, line_for_outcome=line_for_outcome)


def _total_rows(market: dict[str, Any]) -> list[dict[str, Any]]:
    strike_raw = market.get("strike")
    try:
        line = float(strike_raw) if strike_raw is not None else None
    except (TypeError, ValueError):
        line = None

    def line_for_outcome(_outcome: dict[str, Any], _market: dict[str, Any]) -> float | None:
        return line

    return _rows_from_outcomes(market, line_for_outcome=line_for_outcome)


def extract_team_markets(markets: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for market in markets:
        if not isinstance(market, dict):
            continue
        if market.get("type") == "MONEY" and _both_sides_available(market):
            rows = _moneyline_rows(market)
            if rows:
                out["moneyline"] = rows
            break

    spread = pick_main_spread(markets)
    if spread:
        rows = _spread_rows(spread)
        if rows:
            out["spread"] = rows

    total = pick_main_total(markets)
    if total:
        rows = _total_rows(total)
        if rows:
            out["total"] = rows

    return out
