"""ProphetX NFL scraper — public API (team markets + player props)."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://www.prophetx.co"
MARKET_BATCH_SIZE = 20

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "X-Currency": "cash",
}

T = TypeVar("T")

_ROOT = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
    )
)

if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

_DEFAULT_OUTPUT_DIR = os.path.join(
    _ROOT,
    "data",
    "props",
    "prophetx",
    "nfl",
)

_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")

TEAM_SUBTYPE_TO_KEY: dict[str, str] = {
    "moneyline": "moneyline",
    "spread": "spread",
    "total": "total",
}

_MONEYLINE_OUTPUT_KEYS = frozenset(
    {"moneyline"}
)

PROP_SUBTYPE_TO_STAT: dict[str, str] = {
    "player_passing_yards": "passing_yards",
    "player_total_passing_yards": "passing_yards",
    "player_passing_touchdowns": "passing_touchdowns",
    "player_total_passing_touchdowns": "passing_touchdowns",
    "player_pass_completions": "passing_completions",
    "player_passing_completions": "passing_completions",
    "player_pass_attempts": "passing_attempts",
    "player_passing_attempts": "passing_attempts",
    "player_interceptions": "interceptions",
    "player_interceptions_thrown": "interceptions",
    "player_passing_interceptions": "interceptions",
    "player_rushing_yards": "rushing_yards",
    "player_total_rushing_yards": "rushing_yards",
    "player_rushing_attempts": "rushing_attempts",
    "player_total_rushing_attempts": "rushing_attempts",
    "player_receiving_yards": "receiving_yards",
    "player_total_receiving_yards": "receiving_yards",
    "player_receptions": "receptions",
    "player_total_receptions": "receptions",
    "player_rushing_receiving_yards": "rushing_receiving_yards",
    "player_rushing_and_receiving_yards": "rushing_receiving_yards",
    "player_longest_reception": "longest_reception",
    "player_longest_rush": "longest_rush",
    "player_kicking_points": "kicking_points",
    "player_field_goals_made": "field_goals_made",
    "player_extra_points_made": "extra_points_made",
    "player_sacks": "sacks",
    "player_tackles_assists": "tackles_assists",
}

_PROP_NAME_SUFFIXES = (
    " Total Passing Yards",
    " Passing Yards",
    " Total Passing Touchdowns",
    " Passing Touchdowns",
    " Pass Completions",
    " Passing Completions",
    " Pass Attempts",
    " Passing Attempts",
    " Interceptions Thrown",
    " Passing Interceptions",
    " Interceptions",
    " Total Rushing Yards",
    " Rushing Yards",
    " Total Rushing Attempts",
    " Rushing Attempts",
    " Total Receiving Yards",
    " Receiving Yards",
    " Total Receptions",
    " Receptions",
    " Rushing And Receiving Yards",
    " Rushing + Receiving Yards",
    " Longest Reception",
    " Longest Rush",
    " Kicking Points",
    " Field Goals Made",
    " Extra Points Made",
    " Tackles + Assists",
    " Tackles And Assists",
    " Sacks",
)

def output_filename(
    league: str,
    now: datetime,
    *,
    kind: str,
) -> str:
    if kind not in ("props", "team"):
        raise ValueError(
            f"kind must be 'props' or 'team', got {kind!r}"
        )

    stamp = now.astimezone(_OUTPUT_TZ).strftime(
        "%Y-%m-%d_%H%M%S"
    )

    return (
        f"prophetx_{league.strip().lower()}_"
        f"{stamp}_{kind}.json"
    )

def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return (
            props_path[: -len("_props.json")]
            + "_team.json"
        )

    root, ext = os.path.splitext(props_path)
    return f"{root}_team{ext or '.json'}"

def resolve_props_output_path(
    *,
    now: datetime | None = None,
) -> str:
    when = now or datetime.now(_OUTPUT_TZ)

    env_file = os.environ.get(
        "PROPHETX_OUTPUT",
        "",
    ).strip()

    env_dir = os.environ.get(
        "PROPHETX_OUTPUT_DIR",
        "",
    ).strip()

    name = output_filename(
        "nfl",
        when,
        kind="props",
    )

    if env_file:
        expanded = os.path.expanduser(env_file)

        if (
            expanded.lower().endswith(".json")
            and not os.path.isdir(expanded)
        ):
            return expanded

        os.makedirs(expanded, exist_ok=True)
        return os.path.join(expanded, name)

    base = env_dir or _DEFAULT_OUTPUT_DIR
    os.makedirs(base, exist_ok=True)

    return os.path.join(base, name)

def _env_enabled(name: str) -> bool:
    return os.environ.get(
        name,
        "",
    ).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

def chunked(
    items: list[T],
    size: int,
) -> list[list[T]]:
    if size <= 0:
        raise ValueError("size must be positive")

    return [
        items[index : index + size]
        for index in range(0, len(items), size)
    ]

def fetch_json(
    session: requests.Session,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    retries: int = 3,
) -> Any:
    url = (
        path
        if path.startswith("http")
        else f"{BASE_URL}{path}"
    )

    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            response = session.get(
                url,
                params=params,
                timeout=60,
                headers=DEFAULT_HEADERS,
            )

            if (
                response.status_code
                in (429, 500, 502, 503, 504)
                and attempt + 1 < retries
            ):
                time.sleep(0.5 * (attempt + 1))
                continue

            response.raise_for_status()
            return response.json()

        except (
            requests.RequestException,
            ValueError,
        ) as exc:
            last_error = exc

            if attempt + 1 >= retries:
                break

            time.sleep(0.5 * (attempt + 1))

    assert last_error is not None
    raise last_error

def _tournament_records(
    payload: Any,
) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [
            row
            for row in payload
            if isinstance(row, dict)
        ]

    if not isinstance(payload, dict):
        return []

    data = payload.get("data", payload)

    if isinstance(data, list):
        return [
            row
            for row in data
            if isinstance(row, dict)
        ]

    if not isinstance(data, dict):
        return []

    for key in (
        "tournaments",
        "items",
        "results",
    ):
        rows = data.get(key)

        if isinstance(rows, list):
            return [
                row
                for row in rows
                if isinstance(row, dict)
            ]

    return [data]

def _tournament_name(
    tournament: dict[str, Any],
) -> str:
    values = [
        tournament.get("name"),
        tournament.get("displayName"),
        tournament.get("display_name"),
        tournament.get("league"),
        tournament.get("abbreviation"),
    ]

    return " ".join(
        str(value)
        for value in values
        if value
    ).strip()

def resolve_nfl_tournament_id(
    session: requests.Session,
) -> int:
    configured = os.environ.get(
        "PROPHETX_NFL_TOURNAMENT_ID",
        "",
    ).strip()

    if configured:
        try:
            return int(configured)
        except ValueError as exc:
            raise ValueError(
                "PROPHETX_NFL_TOURNAMENT_ID "
                "must be an integer"
            ) from exc

    paths = (
        "/trade/public/api/v1/tournaments",
        "/trade/public/api/v1/sports/tournaments",
    )

    errors: list[str] = []

    for path in paths:
        try:
            payload = fetch_json(
                session,
                path,
            )
        except Exception as exc:
            errors.append(f"{path}: {exc}")
            continue

        candidates: list[
            tuple[int, str]
        ] = []

        for tournament in _tournament_records(
            payload
        ):
            tournament_id = tournament.get("id")

            try:
                parsed_id = int(tournament_id)
            except (TypeError, ValueError):
                continue

            name = _tournament_name(
                tournament
            )

            normalized = (
                name.upper()
                .replace("-", " ")
                .replace("_", " ")
            )

            if (
                normalized == "NFL"
                or " NFL " in f" {normalized} "
                or "NATIONAL FOOTBALL LEAGUE"
                in normalized
            ):
                candidates.append(
                    (parsed_id, name)
                )

        if candidates:
            tournament_id, name = candidates[0]

            logger.info(
                "Discovered ProphetX NFL "
                "tournament id=%s name=%s",
                tournament_id,
                name,
            )

            return tournament_id

    detail = (
        "; ".join(errors)
        if errors
        else "NFL was absent from the tournament list"
    )

    raise RuntimeError(
        "Unable to discover the ProphetX NFL "
        "tournament ID. Set "
        "PROPHETX_NFL_TOURNAMENT_ID explicitly. "
        f"Details: {detail}"
    )

def pick_main_market_line(
    market: dict[str, Any],
) -> dict[str, Any] | None:
    lines = [
        line
        for line in (
            market.get("marketLines") or []
        )
        if isinstance(line, dict)
    ]

    if not lines:
        return None

    favourites = [
        line
        for line in lines
        if line.get("favourite") is True
    ]

    if favourites:
        return favourites[0]

    if len(lines) == 1:
        return lines[0]

    return None

def best_selection(
    side: list[dict[str, Any]],
) -> dict[str, Any] | None:
    for selection in side:
        if isinstance(selection, dict):
            return selection

    return None

def american_and_stake(
    selection: dict[str, Any],
) -> tuple[int | None, float | None]:
    raw_odds = selection.get("odds")

    try:
        american = (
            int(raw_odds)
            if raw_odds is not None
            else None
        )
    except (TypeError, ValueError):
        american = None

    raw_stake = selection.get("stake")

    try:
        stake = (
            float(raw_stake)
            if raw_stake is not None
            else None
        )
    except (TypeError, ValueError):
        stake = None

    return american, stake

def normalize_event(
    event: dict[str, Any],
) -> dict[str, Any]:
    competitors: list[dict[str, Any]] = []

    for competitor in (
        event.get("competitors") or []
    ):
        if not isinstance(competitor, dict):
            continue

        competitors.append(
            {
                "id": competitor.get("id"),
                "name": (
                    competitor.get("name")
                    or competitor.get(
                        "displayName"
                    )
                ),
                "abbreviation": competitor.get(
                    "abbreviation"
                ),
                "seq": competitor.get("seq"),
            }
        )

    return {
        "event_id": event.get("id"),
        "name": (
            event.get("name")
            or event.get("displayName")
        ),
        "scheduled": event.get("scheduled"),
        "status": event.get("status"),
        "competitors": competitors,
    }

def _sides_from_book(
    book: dict[str, Any],
) -> list[list[dict[str, Any]]]:
    selections = book.get("selections")

    if isinstance(selections, list):
        return [
            side
            for side in selections
            if isinstance(side, list)
        ]

    return []

def _side_rows(
    sides: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for side in sides:
        best = best_selection(side)

        if not best:
            continue

        american, stake = american_and_stake(
            best
        )

        name = str(
            best.get("name")
            or best.get("displayName")
            or ""
        )

        line = best.get("line")
        lower_name = name.lower()

        is_total_side = (
            lower_name.startswith("over")
            or lower_name.startswith("under")
        )

        if (
            line in (None, 0, 0.0)
            and not is_total_side
        ):
            output_line = None
        else:
            output_line = line

        rows.append(
            {
                "name": name,
                "competitor_id": best.get(
                    "competitorId"
                ),
                "american": american,
                "line": output_line,
                "stake": stake,
            }
        )

    return rows

def extract_team_markets(
    markets: list[dict[str, Any]],
) -> dict[str, Any]:
    output: dict[str, Any] = {}

    for market in markets:
        if not isinstance(market, dict):
            continue

        subtype = str(
            market.get("subType")
            or market.get("type")
            or ""
        ).lower()

        key = TEAM_SUBTYPE_TO_KEY.get(subtype)

        if not key:
            continue

        book: dict[str, Any] | None

        if (
            key in _MONEYLINE_OUTPUT_KEYS
            and market.get("selections")
        ):
            book = market
        else:
            book = pick_main_market_line(
                market
            )

        if not book:
            continue

        rows = _side_rows(
            _sides_from_book(book)
        )

        if rows:
            output[key] = rows

    return output

def player_name_from_market(
    market: dict[str, Any],
) -> str:
    name = str(
        market.get("name") or ""
    ).strip()

    lower_name = name.lower()

    for suffix in _PROP_NAME_SUFFIXES:
        if lower_name.endswith(
            suffix.lower()
        ):
            return name[
                : -len(suffix)
            ].strip()

    return name

def _prop_row_from_book(
    market: dict[str, Any],
    book: dict[str, Any],
    *,
    stat: str,
    subtype: str,
    is_main: bool,
) -> dict[str, Any] | None:
    sides = _sides_from_book(book)

    over: dict[
        str,
        int | float | None,
    ] | None = None

    under: dict[
        str,
        int | float | None,
    ] | None = None

    line: float | None = None

    for side in sides:
        best = best_selection(side)

        if not best:
            continue

        american, stake = american_and_stake(
            best
        )

        side_name = str(
            best.get("name") or ""
        ).strip().lower()

        payload = {
            "american": american,
            "stake": stake,
        }

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
        "player": player_name_from_market(
            market
        ),
        "stat": stat,
        "line": line,
        "over": over,
        "under": under,
        "market_id": market.get("id"),
        "sub_type": subtype,
        "is_main": is_main,
    }

def _looks_like_player_market(
    market: dict[str, Any],
) -> bool:
    subtype = str(
        market.get("subType") or ""
    ).lower()

    if subtype.startswith("player_"):
        return True

    name = str(
        market.get("name") or ""
    ).lower()

    return any(
        suffix.strip().lower() in name
        for suffix in _PROP_NAME_SUFFIXES
    )

def extract_props(
    markets: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for market in markets:
        if not isinstance(market, dict):
            continue

        subtype = str(
            market.get("subType") or ""
        ).lower()

        stat = PROP_SUBTYPE_TO_STAT.get(
            subtype
        )

        if not stat:
            if _looks_like_player_market(market):
                logger.debug(
                    "Skipping unsupported ProphetX "
                    "NFL prop subtype=%s name=%s",
                    subtype,
                    market.get("name"),
                )
            continue

        lines = [
            line
            for line in (
                market.get("marketLines") or []
            )
            if isinstance(line, dict)
        ]

        if not lines:
            continue

        favourites = [
            line
            for line in lines
            if line.get("favourite") is True
        ]

        if len(favourites) > 1:
            logger.debug(
                "ProphetX prop market %s has %s "
                "favourite lines; marking the first "
                "as is_main",
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
            row = _prop_row_from_book(
                market,
                book,
                stat=stat,
                subtype=subtype,
                is_main=book is main_book,
            )

            if row is not None:
                rows.append(row)

    return rows

def fetch_nfl_events(
    session: requests.Session,
    tournament_id: int,
) -> list[dict[str, Any]]:
    path = (
        "/trade/public/api/v1/tournaments/"
        f"{tournament_id}/events"
    )

    events: list[dict[str, Any]] = []
    next_value: str | int | None = None

    while True:
        params = (
            {"next": next_value}
            if next_value is not None
            else None
        )

        payload = fetch_json(
            session,
            path,
            params=params,
        )

        chunk = payload.get("data") or []

        if isinstance(chunk, list):
            events.extend(
                event
                for event in chunk
                if isinstance(event, dict)
            )

        next_value = payload.get("next")

        if not next_value or not chunk:
            break

    max_events = os.environ.get(
        "PROPHETX_MAX_EVENTS",
        "",
    ).strip()

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
    path = (
        "/partner/v3/public/"
        "get_multiple_markets"
    )

    output: list[dict[str, Any]] = []

    for batch in chunked(
        event_ids,
        batch_size,
    ):
        params: dict[str, Any] = {
            "event_ids": ",".join(
                str(event_id)
                for event_id in batch
            )
        }

        if market_types:
            params["market_types"] = market_types

        if market_sub_types:
            params[
                "market_sub_types"
            ] = market_sub_types

        payload = fetch_json(
            session,
            path,
            params=params,
        )

        data = payload.get("data") or []

        if isinstance(data, list):
            output.extend(
                row
                for row in data
                if isinstance(row, dict)
            )

    return output

def _markets_by_event(
    rows: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    output: dict[
        int,
        list[dict[str, Any]],
    ] = {}

    for row in rows:
        event_id = row.get("eventId")

        try:
            parsed_event_id = int(event_id)
        except (TypeError, ValueError):
            continue

        markets = row.get("markets") or []

        if not isinstance(markets, list):
            continue

        output.setdefault(
            parsed_event_id,
            [],
        ).extend(
            market
            for market in markets
            if isinstance(market, dict)
        )

    return output

def build_game_snapshots(
    events: list[dict[str, Any]],
    market_rows: list[dict[str, Any]],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    markets_by_event = _markets_by_event(
        market_rows
    )

    props_games: list[dict[str, Any]] = []
    team_games: list[dict[str, Any]] = []

    for event in events:
        base = normalize_event(event)
        event_id = base.get("event_id")

        try:
            parsed_event_id = int(event_id)
        except (TypeError, ValueError):
            continue

        markets = markets_by_event.get(
            parsed_event_id,
            [],
        )

        props_games.append(
            {
                **base,
                "props": extract_props(markets),
            }
        )

        team_games.append(
            {
                **base,
                "team_markets": (
                    extract_team_markets(markets)
                ),
            }
        )

    return props_games, team_games

def _payload_base(
    *,
    fetched_at: str,
    tournament_id: int,
) -> dict[str, Any]:
    return {
        "source": "prophetx",
        "fetched_at": fetched_at,
        "league": "nfl",
        "tournament_id": tournament_id,
    }

def write_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    props_path: str,
    tournament_id: int,
) -> tuple[str, str]:
    fetched_at = datetime.now(
        _OUTPUT_TZ
    ).isoformat(timespec="seconds")

    base = _payload_base(
        fetched_at=fetched_at,
        tournament_id=tournament_id,
    )

    props_payload = {
        **base,
        "snapshot_kind": "props",
        "games": props_games,
    }

    team_payload = {
        **base,
        "snapshot_kind": "team",
        "games": team_games,
    }

    team_path = team_output_path(
        props_path
    )

    for path, payload in (
        (props_path, props_payload),
        (team_path, team_payload),
    ):
        os.makedirs(
            os.path.dirname(
                os.path.abspath(path)
            ),
            exist_ok=True,
        )

        with open(
            path,
            "w",
            encoding="utf-8",
        ) as output_file:
            json.dump(
                payload,
                output_file,
                ensure_ascii=False,
                indent=2,
            )

    return props_path, team_path

def load_supabase_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    scraped_at: datetime | None = None,
    props_path: str | None = None,
    team_path: str | None = None,
) -> None:
    """Upsert games to NFL ProphetX tables."""

    if _env_enabled("PROPHETX_SKIP_DB"):
        logger.info(
            "Skipping Supabase load because "
            "PROPHETX_SKIP_DB is set"
        )
        return

    try:
        from src.odds.load_snapshots import (
            load_prophetx_props_snapshot,
            load_prophetx_team_snapshot,
        )

        when = (
            scraped_at
            or datetime.now(timezone.utc)
        )

        prop_count = (
            load_prophetx_props_snapshot(
                props_games,
                league="nfl",
                scraped_at=when,
            )
        )

        team_count = (
            load_prophetx_team_snapshot(
                team_games,
                league="nfl",
                scraped_at=when,
            )
        )

        logger.info(
            "Supabase ProphetX NFL upserted "
            "props=%s team=%s%s%s",
            prop_count,
            team_count,
            (
                f" props_path={props_path}"
                if props_path
                else ""
            ),
            (
                f" team_path={team_path}"
                if team_path
                else ""
            ),
        )

    except Exception as exc:
        logger.error(
            "Supabase ProphetX NFL load failed "
            "(JSON kept): %s",
            exc,
        )

def _count_quotes(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
) -> tuple[int, int]:
    prop_count = sum(
        len(game.get("props") or [])
        for game in props_games
    )

    team_count = sum(
        len(game.get("team_markets") or {})
        for game in team_games
    )

    return prop_count, team_count

def run() -> None:
    logging.basicConfig(
        level=getattr(
            logging,
            os.environ.get(
                "LOG_LEVEL",
                "INFO",
            ).upper(),
            logging.INFO,
        ),
        format=(
            "[%(levelname)-8s] "
            "%(name)s: %(message)s"
        ),
    )

    session = requests.Session()

    tournament_id = (
        resolve_nfl_tournament_id(session)
    )

    events = fetch_nfl_events(
        session,
        tournament_id,
    )

    event_ids = [
        int(event["id"])
        for event in events
        if event.get("id") is not None
    ]

    if not event_ids:
        logger.warning(
            "ProphetX returned no NFL events "
            "for tournament id=%s",
            tournament_id,
        )

    # NFL has few events per slate, so fetch all markets once.
    # This avoids silently missing provider-specific prop subtypes.
    market_rows = fetch_markets_for_events(
        session,
        event_ids,
    )

    props_games, team_games = (
        build_game_snapshots(
            events,
            market_rows,
        )
    )

    props_path = (
        resolve_props_output_path()
    )

    props_path, team_path = write_snapshots(
        props_games,
        team_games,
        props_path=props_path,
        tournament_id=tournament_id,
    )

    prop_count, team_count = _count_quotes(
        props_games,
        team_games,
    )

    logger.info(
        "Wrote ProphetX NFL snapshots: "
        "events=%s props_games=%s "
        "team_games=%s props_quotes=%s "
        "team_markets=%s props=%s team=%s",
        len(events),
        len(props_games),
        len(team_games),
        prop_count,
        team_count,
        props_path,
        team_path,
    )

    load_supabase_snapshots(
        props_games,
        team_games,
        props_path=props_path,
        team_path=team_path,
    )

if __name__ == "__main__":
    run()