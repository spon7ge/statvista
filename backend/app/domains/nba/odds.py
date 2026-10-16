"""NBA matchup odds for Preview and matchups (Sharp DK/FD; no snapshot books yet)."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from app.core.config import SHARP_API_KEY
from app.providers.sharp.odds import (
    fetch_sharp_odds_rows,
    merge_odds_prefer_primary,
    normalize_sharp_odds,
)
from app.schemas.odds import WnbaOddsResponse

logger = logging.getLogger(__name__)

# Same response envelope as WNBA odds/today.
NbaOddsResponse = WnbaOddsResponse

CACHE_TTL_SECONDS = 45.0
_NBA_MARKETS = "point_spread,total_points"

_cache: dict[str, object] = {}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


async def get_today_odds() -> NbaOddsResponse:
    now = time.monotonic()
    cached = _cache.get("response")
    expires_at = float(_cache.get("expires_at") or 0)
    if isinstance(cached, NbaOddsResponse) and now < expires_at:
        return cached

    if not SHARP_API_KEY:
        return NbaOddsResponse(
            as_of=_utcnow_iso(),
            sportsbook="",
            games=[],
            book_boards=[],
            error="SHARP_API_KEY is not configured",
        )

    try:
        dk_result, fd_result = await asyncio.gather(
            fetch_sharp_odds_rows(
                "draftkings", league="nba", market=_NBA_MARKETS
            ),
            fetch_sharp_odds_rows(
                "fanduel", league="nba", market=_NBA_MARKETS
            ),
            return_exceptions=True,
        )
        errors: list[str] = []
        dk_games = []
        fd_games = []
        if isinstance(dk_result, BaseException):
            errors.append(f"draftkings: {dk_result}")
        else:
            dk_games = normalize_sharp_odds(
                dk_result, sportsbook="draftkings", wnba_aliases=False
            )
        if isinstance(fd_result, BaseException):
            errors.append(f"fanduel: {fd_result}")
        else:
            fd_games = normalize_sharp_odds(
                fd_result, sportsbook="fanduel", wnba_aliases=False
            )

        if not dk_games and not fd_games:
            games = []
        else:
            games = merge_odds_prefer_primary(dk_games, fd_games)

        response = NbaOddsResponse(
            as_of=_utcnow_iso(),
            sportsbook="draftkings" if dk_games else "fanduel" if fd_games else "",
            games=games,
            book_boards=[],
            error="; ".join(errors) if errors else None,
        )
        _cache["response"] = response
        _cache["expires_at"] = now + CACHE_TTL_SECONDS
        return response
    except Exception as exc:
        logger.warning("NBA Sharp odds unavailable: %s", exc)
        if isinstance(cached, NbaOddsResponse):
            return NbaOddsResponse(
                as_of=cached.as_of,
                sportsbook=cached.sportsbook,
                games=cached.games,
                book_boards=cached.book_boards,
                error=str(exc),
            )
        return NbaOddsResponse(
            as_of=_utcnow_iso(),
            sportsbook="",
            games=[],
            book_boards=[],
            error=str(exc),
        )
