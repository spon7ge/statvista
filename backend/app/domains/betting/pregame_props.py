"""Props boards list only games on the current slate that have not started."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Iterable, Mapping, Sequence
from datetime import date, datetime, timedelta, timezone
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

ScoreboardT = TypeVar("ScoreboardT")

# Scoreboard statuses that mean the game is no longer pregame.
_STARTED_STATUSES = frozenset({"live", "halftime", "final"})


def player_on_slate(ctx: Mapping[str, Any]) -> bool:
    """True when this player's team was matched to a scoreboard game."""
    if ctx.get("game_start_at") is not None:
        return True
    if ctx.get("game_status") in _STARTED_STATUSES or ctx.get("game_status") == "scheduled":
        return True
    game_id = ctx.get("game_id")
    if isinstance(game_id, str) and game_id.strip():
        return True
    game_pk = ctx.get("game_pk")
    return game_pk not in (None, "")


def slate_loaded(contexts: Iterable[Mapping[str, Any]]) -> bool:
    """True when at least one player matched a scoreboard game.

    An empty result means the scoreboard did not load. In that case the board
    keeps unmatched rows instead of going blank.
    """
    return any(player_on_slate(ctx) for ctx in contexts)


def prop_still_upcoming(
    *,
    start: datetime | None,
    status: str | None,
    now: datetime,
    on_slate: bool = True,
) -> bool:
    """Return whether a prop row should stay on the board.

    ``on_slate`` is false when the scoreboard loaded and this player's team
    is not on it, as in a Finals slate that only includes two clubs. A listed
    tip at or before ``now`` has started. Live, halftime, and final override a
    tip that is still in the future.
    """
    if not on_slate:
        return False
    if status in _STARTED_STATUSES:
        return False
    if start is None:
        return True
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return start > now


def _parse_start(raw: Any) -> datetime | None:
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
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def game_is_upcoming(game: Any, now: datetime) -> bool:
    status = getattr(game, "status", None)
    if not isinstance(status, str):
        status = None
    return prop_still_upcoming(
        start=_parse_start(getattr(game, "start_time_et", None)),
        status=status,
        now=now,
        on_slate=True,
    )


def any_game_upcoming(games: Iterable[Any], now: datetime) -> bool:
    return any(game_is_upcoming(game, now) for game in games)


def next_slate_date(date_et: str) -> str:
    return (date.fromisoformat(date_et) + timedelta(days=1)).isoformat()


# Empty days between slates (NBA has two off days before opening night).
SLATE_LOOKAHEAD_DAYS = 7


def select_prop_slate(
    today_games: Sequence[Any],
    next_games: Sequence[Any],
    now: datetime,
) -> Sequence[Any]:
    """Use the next slate when today has no game still ahead.

    A finished or empty today stays in place when the next slate also has
    nothing upcoming, so the board does not fall open to every historical line.
    """
    if any_game_upcoming(today_games, now):
        return today_games
    if any_game_upcoming(next_games, now):
        return next_games
    return today_games


async def load_prop_slate(
    get_today: Callable[[], Awaitable[ScoreboardT]],
    get_for_date: Callable[[str], Awaitable[ScoreboardT]],
    *,
    now: datetime | None = None,
) -> ScoreboardT:
    """Return today's scoreboard, or the next date that still has a game ahead.

    Looks up to ``SLATE_LOOKAHEAD_DAYS`` ahead so an off day does not leave
    the board without opponents. Stops at the first date with an upcoming game.
    """
    clock = now if now is not None else datetime.now(timezone.utc)
    today = await get_today()
    today_games = list(getattr(today, "games", []) or [])
    if any_game_upcoming(today_games, clock):
        return today
    date_et = getattr(today, "date", None)
    if not isinstance(date_et, str) or not date_et:
        return today
    cursor = date_et
    for _ in range(SLATE_LOOKAHEAD_DAYS):
        cursor = next_slate_date(cursor)
        try:
            nxt = await get_for_date(cursor)
        except Exception as exc:
            logger.warning("Next prop slate %s unavailable: %s", cursor, exc)
            return today
        next_games = list(getattr(nxt, "games", []) or [])
        if any_game_upcoming(next_games, clock):
            return nxt
    return today
