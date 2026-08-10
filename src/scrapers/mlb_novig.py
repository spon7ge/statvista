"""Novig MLB scraper — public GraphQL (team markets + player props).

After writing JSON snapshots, upserts to odds.mlb_novig / odds.mlb_novig_team
unless NOVIG_SKIP_DB is set.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import requests

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://api.novig.us/v1/graphql"
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Content-Type": "application/json",
}

_GET_MLB_EVENTS_QUERY = """
query GetMlbEvents($limit: Int!, $offset: Int!) {
  event(
    where: {
      status: { _in: ["OPEN_PREGAME", "OPEN_INGAME"] }
      game: { league: { _eq: "MLB" } }
    }
    limit: $limit
    offset: $offset
  ) {
    id
    description
    status
    game {
      scheduled_start
      league
      homeTeam { id name }
      awayTeam { id name }
    }
  }
}
"""

_GET_MLB_EVENTS_INLINE_QUERY = """
query GetMlbEvents {
  event(
    where: {
      status: { _in: ["OPEN_PREGAME", "OPEN_INGAME"] }
      game: { league: { _eq: "MLB" } }
    }
    limit: 500
  ) {
    id
    description
    status
    game {
      scheduled_start
      league
      homeTeam { id name }
      awayTeam { id name }
    }
  }
}
"""

_GET_EVENT_MARKETS_QUERY = """
query GetEventMarkets($id: uuid!) {
  event(where: { id: { _eq: $id } }) {
    markets {
      id
      description
      type
      strike
      player { id name }
      outcomes {
        id
        description
        available
        last
        orders(where: { status: { _eq: "OPEN" }, currency: { _eq: "CASH" } }) {
          qty
          price
          status
        }
      }
    }
  }
}
"""

_EVENTS_PAGE_SIZE = 100

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "novig", "mlb")
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


PROP_TYPE_TO_STAT: dict[str, str] = {
    "HITS": "hits",
    "HOME_RUNS": "home_runs",
    "RBIS": "rbis",
    "RUNS": "runs",
    "TOTAL_BASES": "total_bases",
    "STOLEN_BASES": "stolen_bases",
    "SINGLES": "singles",
    "DOUBLES": "doubles",
    "HITS_ALLOWED": "hits_allowed",
    "PITCHER_STRIKEOUTS": "strikeouts",
}


def _outcome_side(description: str) -> str | None:
    lower = str(description).strip().lower()
    if lower.startswith("over"):
        return "over"
    if lower.startswith("under"):
        return "under"
    return None


def _prop_evenness_score(
    over_outcome: dict[str, Any] | None,
    under_outcome: dict[str, Any] | None,
) -> float:
    over_avail = _outcome_available(over_outcome) if over_outcome else None
    under_avail = _outcome_available(under_outcome) if under_outcome else None
    if over_avail is None:
        over_avail = 1.0
    if under_avail is None:
        under_avail = 1.0
    return abs(over_avail - 0.5) + abs(under_avail - 0.5)


def extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    grouped: dict[tuple[Any, str], list[tuple[dict[str, Any], float]]] = {}

    for market in markets:
        if not isinstance(market, dict):
            continue
        player = market.get("player")
        if not isinstance(player, dict):
            continue
        stat = PROP_TYPE_TO_STAT.get(str(market.get("type") or ""))
        if stat is None:
            continue
        try:
            line = float(market.get("strike"))
        except (TypeError, ValueError):
            continue

        over_outcome: dict[str, Any] | None = None
        under_outcome: dict[str, Any] | None = None
        for outcome in _market_outcomes(market):
            side = _outcome_side(str(outcome.get("description") or ""))
            if side == "over":
                over_outcome = outcome
            elif side == "under":
                under_outcome = outcome

        over_quote = (
            outcome_quote(over_outcome, under_outcome) if over_outcome else None
        )
        under_quote = (
            outcome_quote(under_outcome, over_outcome) if under_outcome else None
        )
        if over_quote is None and under_quote is None:
            continue

        player_key = player.get("id") or player.get("name")
        row: dict[str, Any] = {
            "player": str(player.get("name") or ""),
            "stat": stat,
            "line": line,
            "over": over_quote,
            "under": under_quote,
            "market_id": str(market.get("id") or ""),
            "sub_type": str(market.get("type") or "").lower(),
            "is_main": False,
        }
        rows.append(row)
        score = _prop_evenness_score(over_outcome, under_outcome)
        grouped.setdefault((player_key, stat), []).append((row, score))

    for group in grouped.values():
        if len(group) == 1:
            group[0][0]["is_main"] = True
            continue
        best_row, _ = min(group, key=lambda item: item[1])
        best_row["is_main"] = True

    return rows


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
    candidates = [
        m
        for m in markets
        if isinstance(m, dict) and m.get("type") == "SPREAD" and _both_sides_available(m)
    ]
    if not candidates:
        return None
    for market in candidates:
        try:
            strike = abs(float(market.get("strike", 0)))
        except (TypeError, ValueError):
            continue
        if abs(strike - 1.5) < 1e-9:
            return market
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
            out["run_line"] = rows

    total = pick_main_total(markets)
    if total:
        rows = _total_rows(total)
        if rows:
            out["total"] = rows

    return out


def _max_events_cap() -> int | None:
    raw = os.environ.get("NOVIG_MAX_EVENTS", "").strip()
    if raw.isdigit():
        return int(raw)
    return None


def _graphql_post(
    session: requests.Session,
    query: str,
    variables: dict[str, Any] | None = None,
    *,
    retries: int = 3,
) -> Any:
    payload: dict[str, Any] = {"query": query}
    if variables is not None:
        payload["variables"] = variables
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session.post(
                GRAPHQL_URL,
                json=payload,
                headers=DEFAULT_HEADERS,
                timeout=60,
            )
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


def graphql(
    session: requests.Session,
    query: str,
    variables: dict[str, Any] | None = None,
    *,
    retries: int = 3,
) -> Any:
    body = _graphql_post(session, query, variables, retries=retries)
    if body.get("errors"):
        messages = [
            str(err.get("message") or err)
            for err in body["errors"]
            if isinstance(err, dict)
        ]
        if body.get("data"):
            logger.warning(
                "GraphQL partial errors: %s",
                "; ".join(messages or ["unknown error"]),
            )
        else:
            raise RuntimeError(
                "GraphQL errors: " + "; ".join(messages or ["unknown error"])
            )
    return body


def _events_from_graphql_payload(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if not isinstance(data, dict):
        return []
    events = data.get("event") or []
    if not isinstance(events, list):
        return []
    return [event for event in events if isinstance(event, dict)]


def fetch_mlb_events(session: requests.Session) -> list[dict[str, Any]]:
    cap = _max_events_cap()
    events: list[dict[str, Any]] = []
    offset = 0
    use_inline_query = False

    while True:
        if use_inline_query:
            payload = graphql(session, _GET_MLB_EVENTS_INLINE_QUERY)
            events.extend(_events_from_graphql_payload(payload))
            break

        limit = _EVENTS_PAGE_SIZE
        if cap is not None:
            remaining = cap - len(events)
            if remaining <= 0:
                break
            limit = min(limit, remaining)

        try:
            payload = graphql(
                session,
                _GET_MLB_EVENTS_QUERY,
                {"limit": limit, "offset": offset},
            )
        except RuntimeError as exc:
            if any(
                token in str(exc).lower()
                for token in ("limit", "offset", "variable")
            ):
                use_inline_query = True
                events.clear()
                continue
            raise

        chunk = _events_from_graphql_payload(payload)
        if not chunk:
            break
        events.extend(chunk)
        if cap is not None and len(events) >= cap:
            events = events[:cap]
            break
        if len(chunk) < limit:
            break
        offset += len(chunk)

    if cap is not None:
        events = events[:cap]
    return events


def fetch_event_markets(
    session: requests.Session,
    event_id: str,
) -> list[dict[str, Any]]:
    payload = graphql(
        session,
        _GET_EVENT_MARKETS_QUERY,
        {"id": event_id},
    )
    events = _events_from_graphql_payload(payload)
    if not events:
        return []
    markets = events[0].get("markets") or []
    if not isinstance(markets, list):
        return []
    return [market for market in markets if isinstance(market, dict)]


def build_game_snapshots(
    events: list[dict[str, Any]],
    markets_by_event_id: dict[str, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    props_games: list[dict[str, Any]] = []
    team_games: list[dict[str, Any]] = []
    for event in events:
        base = normalize_event(event)
        event_id = base.get("event_id")
        if event_id is None:
            continue
        markets = markets_by_event_id.get(str(event_id), [])
        props_games.append({**base, "props": extract_props(markets)})
        team_games.append(
            {**base, "team_markets": extract_team_markets(markets)}
        )
    return props_games, team_games


def _payload_base(*, fetched_at: str) -> dict[str, Any]:
    return {
        "source": "novig",
        "fetched_at": fetched_at,
        "league": "mlb",
    }


def write_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    props_path: str,
) -> tuple[str, str]:
    fetched_at = datetime.now(_OUTPUT_TZ).isoformat(timespec="seconds")
    base = _payload_base(fetched_at=fetched_at)
    props_payload = {**base, "snapshot_kind": "props", "games": props_games}
    team_payload = {**base, "snapshot_kind": "team", "games": team_games}
    team_path = team_output_path(props_path)
    for path, payload in ((props_path, props_payload), (team_path, team_payload)):
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as output_file:
            json.dump(payload, output_file, ensure_ascii=False, indent=2)
    return props_path, team_path


def _count_usable_quotes(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
) -> tuple[int, int]:
    n_props = sum(len(g.get("props") or []) for g in props_games)
    n_team = sum(len(g.get("team_markets") or {}) for g in team_games)
    return n_props, n_team


def selenium_fallback_enabled() -> bool:
    return os.environ.get("NOVIG_ALLOW_SELENIUM", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def fetch_via_selenium() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    raise RuntimeError(
        "Novig Selenium fallback is not implemented yet; "
        "GraphQL at api.novig.us/v1/graphql should work without auth. "
        "Set NOVIG_ALLOW_SELENIUM only after implementing CDP capture."
    )


def _fetch_graphql_snapshots(
    session: requests.Session,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    events = fetch_mlb_events(session)
    markets_by_event_id: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        event_id = event.get("id")
        if event_id is None:
            continue
        markets_by_event_id[str(event_id)] = fetch_event_markets(
            session, str(event_id)
        )
    props_games, team_games = build_game_snapshots(events, markets_by_event_id)
    return events, props_games, team_games


def run() -> None:
    logging.basicConfig(
        level=getattr(
            logging,
            os.environ.get("LOG_LEVEL", "INFO").upper(),
            logging.INFO,
        ),
        format="[%(levelname)-8s] %(name)s: %(message)s",
    )
    session = requests.Session()
    events: list[dict[str, Any]] = []
    props_games: list[dict[str, Any]] = []
    team_games: list[dict[str, Any]] = []
    graphql_failed = False

    try:
        events, props_games, team_games = _fetch_graphql_snapshots(session)
    except Exception as exc:
        graphql_failed = True
        logger.error("GraphQL fetch failed: %s", exc)

    n_props, n_team = _count_usable_quotes(props_games, team_games)
    needs_fallback = graphql_failed or (
        bool(events) and n_props == 0 and n_team == 0
    )

    if needs_fallback:
        if selenium_fallback_enabled():
            logger.warning("Attempting Selenium fallback for Novig MLB...")
            try:
                events, markets_by_event_id = fetch_via_selenium()
                props_games, team_games = build_game_snapshots(
                    events, markets_by_event_id
                )
                n_props, n_team = _count_usable_quotes(props_games, team_games)
            except Exception as exc:
                logger.error("Selenium fallback failed: %s", exc)
                sys.exit(1)
            if n_props == 0 and n_team == 0:
                logger.error("Selenium fallback returned no usable quotes")
                sys.exit(1)
        else:
            if graphql_failed:
                logger.error(
                    "Novig GraphQL fetch failed and NOVIG_ALLOW_SELENIUM is not set"
                )
            else:
                logger.error(
                    "Novig GraphQL returned %s events but zero usable quotes; "
                    "set NOVIG_ALLOW_SELENIUM to attempt browser fallback",
                    len(events),
                )
            sys.exit(1)

    props_path = resolve_props_output_path()
    props_path, team_path = write_snapshots(
        props_games, team_games, props_path=props_path
    )
    logger.info(
        "Wrote Novig snapshots: props_games=%s team_games=%s props_quotes=%s "
        "team_markets=%s props=%s team=%s",
        len(props_games),
        len(team_games),
        n_props,
        n_team,
        props_path,
        team_path,
    )
    load_supabase_snapshots(
        props_games,
        team_games,
        props_path=props_path,
        team_path=team_path,
    )


def load_supabase_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    scraped_at: datetime | None = None,
    props_path: str | None = None,
    team_path: str | None = None,
) -> None:
    """Upsert snapshot games to odds.mlb_novig / odds.mlb_novig_team."""
    try:
        from src.odds.load_snapshots import (
            load_novig_props_snapshot,
            load_novig_team_snapshot,
        )

        when = scraped_at or datetime.now(timezone.utc)
        n_props = load_novig_props_snapshot(
            props_games, league="mlb", scraped_at=when
        )
        n_team = load_novig_team_snapshot(
            team_games, league="mlb", scraped_at=when
        )
        logger.info(
            "Supabase Novig upserted props=%s team=%s%s%s",
            n_props,
            n_team,
            f" props_path={props_path}" if props_path else "",
            f" team_path={team_path}" if team_path else "",
        )
    except Exception as exc:
        logger.error("Supabase Novig load failed (JSON kept): %s", exc)


if __name__ == "__main__":
    run()
