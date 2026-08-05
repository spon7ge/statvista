"""WNBA matchup odds: Selenium Pinnacle team lines with Sharp fallback."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.schemas.wnba_odds import WnbaOddsGame, WnbaOddsResponse
from app.providers.sharp.odds import (
    fetch_sharp_odds_rows,
    merge_odds_prefer_primary,
    normalize_sharp_odds,
)
from app.services.odds_snapshots import fetch_latest_pinnacle_team
from app.services.wnba_scoreboard import canonical_abbrev
from app.services.wnba_team_names import abbrev_from_team_name

logger = logging.getLogger(__name__)

LA = ZoneInfo("America/Los_Angeles")
CACHE_TTL_SECONDS = 45.0

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


def normalize_pinnacle_team_rows(rows: list[dict[str, Any]]) -> list[WnbaOddsGame]:
    """Collapse Pinnacle team snapshot rows into one game with favorite spread + total."""
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
            },
        )

        market = str(row.get("market_type") or "").lower()
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

        games.append(
            WnbaOddsGame(
                home_abbrev=bucket["home_abbrev"],
                away_abbrev=bucket["away_abbrev"],
                spread_team_abbrev=spread_team,
                spread_line=spread_line,
                total=total,
                game_date=bucket.get("game_date"),
                sportsbook="pinnacle",
            )
        )

    games.sort(key=lambda g: (g.game_date or "", g.home_abbrev, g.away_abbrev))
    return games


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
    if any(g.sportsbook == "pinnacle" for g in games):
        return "pinnacle"
    if any(g.sportsbook == "draftkings" for g in games):
        return "draftkings"
    if games and games[0].sportsbook:
        return games[0].sportsbook
    return "draftkings"


async def get_today_odds() -> WnbaOddsResponse:
    now = time.monotonic()
    cached = _cache.get("response")
    expires_at = float(_cache.get("expires_at") or 0)
    if cached is not None and now < expires_at:
        return cached

    try:
        pin_rows = fetch_latest_pinnacle_team("wnba")
        pin_games = normalize_pinnacle_team_rows(pin_rows)
        sharp_games, sharp_errors = await _fetch_sharp_games()
        games = merge_pinnacle_prefer_sharp(pin_games, sharp_games)

        error = "; ".join(sharp_errors) if sharp_errors else None
        if not games and sharp_errors:
            error = "; ".join(sharp_errors)

        response = WnbaOddsResponse(
            as_of=_utcnow_iso(),
            sportsbook=_response_sportsbook(games),
            games=games,
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
                error=str(exc),
            )
        return WnbaOddsResponse(
            as_of=_utcnow_iso(),
            games=[],
            error=str(exc),
        )
