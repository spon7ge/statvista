"""WNBA matchup odds: Selenium Pinnacle team lines with Sharp fallback."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.schemas.odds import WnbaOddsGame, WnbaOddsResponse
from app.providers.sharp.odds import (
    fetch_sharp_odds_rows,
    merge_odds_prefer_primary,
    normalize_sharp_odds,
)
from app.core.odds_snapshots import (
    fetch_latest_novig_team,
    fetch_latest_pinnacle_team,
    fetch_latest_prophetx_team,
)
from app.core.wnba_abbrevs import abbrev_from_team_name, canonical_abbrev

logger = logging.getLogger(__name__)

LA = ZoneInfo("America/Los_Angeles")
CACHE_TTL_SECONDS = 45.0
_BOOK_BOARD_ORDER = ("prophetx", "novig", "pinnacle")
_MARKET_KIND = {
    "moneyline": "moneyline",
    "spread": "spread",
    "run_line": "spread",
    "total": "total",
    "total_runs": "total",
}

_cache: dict[str, Any] = {}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def _parse_start_time(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        dt = raw
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    text = str(raw).strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _game_date_from_start_time(start_time: Any) -> str | None:
    dt = _parse_start_time(start_time)
    if dt is None:
        return None
    return dt.astimezone(LA).date().isoformat()


def _matchup_key(row: dict[str, Any]) -> tuple[str, str, str] | None:
    away = abbrev_from_team_name(str(row.get("away_team") or ""))
    home = abbrev_from_team_name(str(row.get("home_team") or ""))
    if not away or not home:
        return None
    start = row.get("start_time")
    start_key = str(start) if start is not None else ""
    return away, home, start_key


def _spread_side_abbrev(
    row: dict[str, Any], home: str, away: str
) -> str | None:
    team = abbrev_from_team_name(str(row.get("team") or ""))
    if team:
        return team
    side = str(row.get("side") or "").lower()
    if side == "home":
        return home
    if side == "away":
        return away
    return None


def _int_price(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def normalize_team_odds_rows(
    rows: list[dict[str, Any]],
    *,
    sportsbook: str,
) -> list[WnbaOddsGame]:
    """Collapse team snapshot rows into one game with favorite spread + total."""
    by_matchup: dict[tuple[str, str, str], dict[str, Any]] = {}

    for row in rows:
        key = _matchup_key(row)
        if key is None:
            continue
        away, home, start_key = key
        bucket = by_matchup.setdefault(
            key,
            {
                "home_abbrev": home,
                "away_abbrev": away,
                "game_date": _game_date_from_start_time(row.get("start_time")),
                "spreads": [],
                "totals": [],
                "moneylines": [],
            },
        )

        market = _MARKET_KIND.get(str(row.get("market_type") or "").lower())
        if market is None:
            continue
        if market == "moneyline":
            team = _spread_side_abbrev(row, home, away)
            price = _int_price(row.get("american_price"))
            if team and price is not None:
                bucket["moneylines"].append((team, price))
            continue

        points_raw = row.get("points")
        if points_raw is None:
            continue
        try:
            points_f = float(points_raw)
        except (TypeError, ValueError):
            continue

        if market == "spread":
            team = _spread_side_abbrev(row, home, away)
            if team:
                bucket["spreads"].append((team, points_f))
        elif market == "total":
            bucket["totals"].append(points_f)

    games: list[WnbaOddsGame] = []
    for bucket in by_matchup.values():
        spread_team: str | None = None
        spread_line: float | None = None
        spreads: list[tuple[str, float]] = bucket["spreads"]
        if spreads:
            favorites = [(t, ln) for t, ln in spreads if ln < 0]
            pick = favorites[0] if favorites else spreads[0]
            spread_team, spread_line = pick[0], pick[1]

        total: float | None = None
        if bucket["totals"]:
            total = bucket["totals"][0]

        if spread_line is None and total is None:
            continue

        moneylines: list[tuple[str, int]] = bucket["moneylines"]
        away_moneyline = next(
            (price for team, price in moneylines if team == bucket["away_abbrev"]),
            None,
        )
        home_moneyline = next(
            (price for team, price in moneylines if team == bucket["home_abbrev"]),
            None,
        )

        games.append(
            WnbaOddsGame(
                home_abbrev=bucket["home_abbrev"],
                away_abbrev=bucket["away_abbrev"],
                spread_team_abbrev=spread_team,
                spread_line=spread_line,
                total=total,
                away_moneyline=away_moneyline,
                home_moneyline=home_moneyline,
                game_date=bucket.get("game_date"),
                sportsbook=sportsbook,
            )
        )

    games.sort(key=lambda g: (g.game_date or "", g.home_abbrev, g.away_abbrev))
    return games


def normalize_pinnacle_team_rows(rows: list[dict[str, Any]]) -> list[WnbaOddsGame]:
    """Collapse Pinnacle team snapshot rows into one game with favorite spread + total."""
    return normalize_team_odds_rows(rows, sportsbook="pinnacle")


def _odds_merge_key(game: WnbaOddsGame) -> tuple[str, str, str]:
    return (
        canonical_abbrev(game.away_abbrev),
        canonical_abbrev(game.home_abbrev),
        game.game_date or "",
    )


def _team_merge_key(game: WnbaOddsGame) -> tuple[str, str]:
    return (
        canonical_abbrev(game.away_abbrev),
        canonical_abbrev(game.home_abbrev),
    )


def _has_markets(game: WnbaOddsGame) -> bool:
    return game.spread_line is not None or game.total is not None


def _canonicalize_game(game: WnbaOddsGame) -> WnbaOddsGame:
    return game.model_copy(
        update={
            "away_abbrev": canonical_abbrev(game.away_abbrev),
            "home_abbrev": canonical_abbrev(game.home_abbrev),
            "spread_team_abbrev": (
                canonical_abbrev(game.spread_team_abbrev)
                if game.spread_team_abbrev
                else None
            ),
        }
    )


def collect_book_boards(*sources: list[WnbaOddsGame]) -> list[WnbaOddsGame]:
    """All FG team games that have markets, ordered for Preview display."""
    order_index = {book: i for i, book in enumerate(_BOOK_BOARD_ORDER)}
    out: list[WnbaOddsGame] = []
    seen: set[tuple[str, str, str, str | None]] = set()
    for source in sources:
        for game in source:
            game = _canonicalize_game(game)
            if not _has_markets(game):
                continue
            book = (game.sportsbook or "").lower()
            key = (book, *_team_merge_key(game), game.game_date)
            if key in seen:
                continue
            seen.add(key)
            out.append(game)
    out.sort(
        key=lambda g: (
            order_index.get((g.sportsbook or "").lower(), 99),
            g.game_date or "",
            g.home_abbrev,
            g.away_abbrev,
        )
    )
    return out


def merge_pinnacle_prefer_sharp(
    pinnacle: list[WnbaOddsGame],
    sharp: list[WnbaOddsGame],
) -> list[WnbaOddsGame]:
    """Prefer Pinnacle per game when it has spread or total; else Sharp."""
    pin_by_team: dict[tuple[str, str], WnbaOddsGame] = {}

    for game in pinnacle:
        team_key = _team_merge_key(game)
        prev = pin_by_team.get(team_key)
        if prev is None or (not _has_markets(prev) and _has_markets(game)):
            pin_by_team[team_key] = game

    merged_by_team: dict[tuple[str, str], WnbaOddsGame] = {}

    for game in sharp:
        team_key = _team_merge_key(game)
        pin = pin_by_team.get(team_key)
        if pin is not None and _has_markets(pin):
            merged_by_team[team_key] = pin
        elif pin is not None and _has_markets(game):
            merged_by_team[team_key] = game
        elif _has_markets(game):
            merged_by_team[team_key] = game

    for game in pinnacle:
        team_key = _team_merge_key(game)
        if team_key not in merged_by_team and _has_markets(game):
            merged_by_team[team_key] = game

    games = [g for g in merged_by_team.values() if _has_markets(g)]
    games.sort(key=lambda g: (g.game_date or "", g.home_abbrev, g.away_abbrev))
    return games


async def _fetch_sharp_games() -> tuple[list[WnbaOddsGame], list[str]]:
    """Load Sharp DK+FD games; return (games, partial errors)."""
    dk_result, fd_result = await asyncio.gather(
        fetch_sharp_odds_rows("draftkings"),
        fetch_sharp_odds_rows("fanduel"),
        return_exceptions=True,
    )
    errors: list[str] = []
    dk_games: list[WnbaOddsGame] = []
    fd_games: list[WnbaOddsGame] = []
    if isinstance(dk_result, BaseException):
        errors.append(f"draftkings: {dk_result}")
    else:
        dk_games = normalize_sharp_odds(dk_result, sportsbook="draftkings")
    if isinstance(fd_result, BaseException):
        errors.append(f"fanduel: {fd_result}")
    else:
        fd_games = normalize_sharp_odds(fd_result, sportsbook="fanduel")

    if not dk_games and not fd_games:
        return [], errors
    return merge_odds_prefer_primary(dk_games, fd_games), errors


def _response_sportsbook(games: list[WnbaOddsGame]) -> str:
    for book in ("pinnacle", "prophetx", "novig", "fanduel", "draftkings"):
        if any(g.sportsbook == book for g in games):
            return book
    if games and games[0].sportsbook:
        return games[0].sportsbook
    return "draftkings"


def _safe_normalize_source(
    fetch_fn,
    *,
    league: str,
    sportsbook: str,
) -> list[WnbaOddsGame]:
    try:
        rows = fetch_fn(league)
        return normalize_team_odds_rows(rows, sportsbook=sportsbook)
    except Exception:
        logger.warning(
            "WNBA %s team odds unavailable", sportsbook, exc_info=True
        )
        return []


async def get_today_odds() -> WnbaOddsResponse:
    now = time.monotonic()
    cached = _cache.get("response")
    expires_at = float(_cache.get("expires_at") or 0)
    if cached is not None and now < expires_at:
        return cached

    try:
        try:
            pin_rows = fetch_latest_pinnacle_team("wnba")
            pin_games = normalize_pinnacle_team_rows(pin_rows)
        except Exception:
            logger.warning("WNBA pinnacle team odds unavailable", exc_info=True)
            pin_games = []

        px_games = _safe_normalize_source(
            fetch_latest_prophetx_team, league="wnba", sportsbook="prophetx"
        )
        novig_games = _safe_normalize_source(
            fetch_latest_novig_team, league="wnba", sportsbook="novig"
        )

        sharp_games, sharp_errors = await _fetch_sharp_games()
        games = merge_pinnacle_prefer_sharp(pin_games, sharp_games)
        book_boards = collect_book_boards(px_games, novig_games, pin_games)

        error = "; ".join(sharp_errors) if sharp_errors else None
        if not games and sharp_errors:
            error = "; ".join(sharp_errors)

        response = WnbaOddsResponse(
            as_of=_utcnow_iso(),
            sportsbook=_response_sportsbook(games),
            games=games,
            book_boards=book_boards,
            error=error,
        )
        _cache["response"] = response
        _cache["expires_at"] = now + CACHE_TTL_SECONDS
        return response
    except Exception as exc:
        logger.warning("Pinnacle team WNBA odds unavailable: %s", exc)
        if cached is not None:
            return WnbaOddsResponse(
                as_of=cached.as_of,
                sportsbook=cached.sportsbook,
                games=cached.games,
                book_boards=getattr(cached, "book_boards", []) or [],
                error=str(exc),
            )
        return WnbaOddsResponse(
            as_of=_utcnow_iso(),
            games=[],
            book_boards=[],
            error=str(exc),
        )
