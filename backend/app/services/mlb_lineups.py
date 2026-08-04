"""Dated MLB projected lineups service (RotoWire).

Backs `GET /api/mlb/lineups?date=`. RotoWire only publishes today's and
tomorrow's slate, so any other ET date resolves to an empty response.
Scrape failures soft-fail to a stale cached slate when available, else to
an empty slate, so the Preview UI never surfaces a hard error.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from app.schemas.mlb_lineups import (
    MlbLineupBatter,
    MlbLineupGame,
    MlbLineupPitcher,
    MlbLineupSide,
    MlbLineupsResponse,
)
from src.scrapers.mlb_rotowire_lineups import scrape_mlb_lineups

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")
ROTOWIRE_TTL_SECONDS = 180

DateToken = Literal["tomorrow"] | None

_cache: dict[str, dict] = {}  # keyed by date_et: {"response": ..., "expires_at": ...}


def clear_mlb_lineups_cache() -> None:
    _cache.clear()


def rotowire_date_token(
    date_et: str, *, now_et: date | None = None
) -> DateToken | Literal["unsupported"]:
    """Map an ET calendar date to the RotoWire slate token it corresponds to.

    Returns `None` for today's slate, `"tomorrow"` for tomorrow's slate (the
    only other slate RotoWire publishes), or `"unsupported"` for any other
    date.
    """
    today = now_et or datetime.now(ET).date()
    target = date.fromisoformat(date_et)
    if target == today:
        return None
    if target == today + timedelta(days=1):
        return "tomorrow"
    return "unsupported"


def _to_pitcher(raw: dict) -> MlbLineupPitcher:
    return MlbLineupPitcher(
        name=raw.get("name"),
        hand=raw.get("hand"),
        record=raw.get("record"),
        era=raw.get("era"),
    )


def _to_batters(raw: list[dict]) -> list[MlbLineupBatter]:
    return [
        MlbLineupBatter(
            order=b["order"],
            position=b.get("position"),
            name=b.get("name"),
            hand=b.get("hand"),
        )
        for b in raw
    ]


def _to_side(raw: dict) -> MlbLineupSide:
    return MlbLineupSide(
        pitcher=_to_pitcher(raw.get("pitcher") or {}),
        batters=_to_batters(raw.get("batters") or []),
    )


def normalize_mlb_lineups(raw_games: list[dict]) -> list[MlbLineupGame]:
    games: list[MlbLineupGame] = []
    for raw in raw_games:
        games.append(
            MlbLineupGame(
                away_abbrev=raw["away_abbrev"],
                home_abbrev=raw["home_abbrev"],
                status=raw.get("status"),
                away=_to_side(raw.get("away") or {}),
                home=_to_side(raw.get("home") or {}),
            )
        )
    return games


def _empty_response(date_et: str) -> MlbLineupsResponse:
    return MlbLineupsResponse(
        date=date_et,
        games=[],
        source="rotowire",
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )


def _cached(date_et: str) -> MlbLineupsResponse | None:
    entry = _cache.get(date_et)
    if entry is None:
        return None
    if time.time() >= float(entry.get("expires_at") or 0):
        return None
    return entry["response"]


def _stale(date_et: str) -> MlbLineupsResponse | None:
    entry = _cache.get(date_et)
    return entry["response"] if entry is not None else None


async def get_mlb_lineups(date_et: str) -> MlbLineupsResponse:
    """Fetch the RotoWire projected lineups slate for one ET calendar date."""
    token = rotowire_date_token(date_et)
    if token == "unsupported":
        return _empty_response(date_et)

    cached = _cached(date_et)
    if cached is not None:
        return cached

    try:
        raw_games = await asyncio.to_thread(scrape_mlb_lineups, date_token=token)
        games = normalize_mlb_lineups(raw_games)
    except Exception as exc:
        stale = _stale(date_et)
        if stale is not None:
            logger.warning(
                "MLB lineups refresh failed; serving stale cache (%s): %s",
                date_et,
                exc,
            )
            return stale
        logger.warning("MLB lineups unavailable for %s: %s", date_et, exc)
        return _empty_response(date_et)

    response = MlbLineupsResponse(
        date=date_et,
        games=games,
        source="rotowire",
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )
    _cache[date_et] = {
        "response": response,
        "expires_at": time.time() + ROTOWIRE_TTL_SECONDS,
    }
    return response
