"""Enrich one RotoWire matchup with Stats API season SP + career BvP."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

from app.schemas.mlb_lineups import (
    MlbLineupBatter,
    MlbLineupGame,
    MlbLineupMatchupBatter,
    MlbLineupMatchupPitcher,
    MlbLineupMatchupResponse,
    MlbLineupMatchupSide,
    MlbLineupPitcher,
    MlbVsPitcherStats,
)
from app.services.mlb_lineups import get_mlb_lineups
from app.services.mlb_stats_people import (
    STATS_TIMEOUT_SECONDS,
    fetch_season_pitching,
    fetch_vs_pitcher_total,
    search_person_id,
)

logger = logging.getLogger(__name__)

MATCHUP_TTL_SECONDS = 180
_cache: dict[str, dict] = {}


def clear_mlb_lineup_matchup_cache() -> None:
    _cache.clear()


def _cache_key(date_et: str, away: str, home: str) -> str:
    return f"{date_et}|{away.upper()}|{home.upper()}"


def _find_game(
    games: list[MlbLineupGame], away: str, home: str
) -> MlbLineupGame | None:
    a, h = away.upper(), home.upper()
    for game in games:
        if game.away_abbrev.upper() == a and game.home_abbrev.upper() == h:
            return game
    return None


async def _enrich_pitcher(
    client: httpx.AsyncClient, pitcher: MlbLineupPitcher, season: int
) -> MlbLineupMatchupPitcher:
    mlbam_id = await search_person_id(client, pitcher.name or "")
    season_stats = (
        await fetch_season_pitching(client, mlbam_id, season)
        if mlbam_id is not None
        else {}
    )
    return MlbLineupMatchupPitcher(
        name=pitcher.name,
        hand=pitcher.hand,
        mlbam_id=mlbam_id,
        wins=season_stats.get("wins"),
        losses=season_stats.get("losses"),
        era=season_stats.get("era"),
        innings_pitched=season_stats.get("innings_pitched"),
        strikeouts=season_stats.get("strikeouts"),
        whip=season_stats.get("whip"),
    )


async def _enrich_batter(
    client: httpx.AsyncClient,
    batter: MlbLineupBatter,
    opposing_pitcher_id: int | None,
) -> MlbLineupMatchupBatter:
    mlbam_id = await search_person_id(client, batter.name or "")
    vs = None
    if mlbam_id is not None and opposing_pitcher_id is not None:
        raw = await fetch_vs_pitcher_total(client, mlbam_id, opposing_pitcher_id)
        if raw is not None:
            vs = MlbVsPitcherStats(
                ab=raw.get("ab"),
                h=raw.get("h"),
                hr=raw.get("hr"),
                avg=raw.get("avg"),
            )
    return MlbLineupMatchupBatter(
        order=batter.order,
        position=batter.position,
        name=batter.name,
        hand=batter.hand,
        mlbam_id=mlbam_id,
        vs_pitcher=vs,
    )


async def _enrich_side(
    client: httpx.AsyncClient,
    side_pitcher: MlbLineupPitcher,
    side_batters: list[MlbLineupBatter],
    opposing_pitcher_id: int | None,
    season: int,
) -> MlbLineupMatchupSide:
    pitcher = await _enrich_pitcher(client, side_pitcher, season)
    batters = await asyncio.gather(
        *[
            _enrich_batter(client, batter, opposing_pitcher_id)
            for batter in side_batters
        ]
    )
    return MlbLineupMatchupSide(pitcher=pitcher, batters=list(batters))


async def get_mlb_lineup_matchup(
    date_et: str, away: str, home: str
) -> MlbLineupMatchupResponse:
    key = _cache_key(date_et, away, home)
    entry = _cache.get(key)
    if entry and time.time() < float(entry.get("expires_at") or 0):
        return entry["response"]

    fetched_at = datetime.now(timezone.utc).isoformat()
    season = int(date_et[:4])
    empty = MlbLineupMatchupResponse(
        date=date_et,
        away_abbrev=away.upper(),
        home_abbrev=home.upper(),
        status=None,
        away=None,
        home=None,
        fetched_at=fetched_at,
    )

    try:
        slate = await get_mlb_lineups(date_et)
    except Exception as exc:
        logger.warning("matchup slate fetch failed: %s", exc)
        return empty

    game = _find_game(slate.games, away, home)
    if game is None:
        return empty

    try:
        async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
            away_sp_id = await search_person_id(
                client, game.away.pitcher.name or ""
            )
            home_sp_id = await search_person_id(
                client, game.home.pitcher.name or ""
            )
            away_side, home_side = await asyncio.gather(
                _enrich_side(
                    client,
                    game.away.pitcher,
                    game.away.batters,
                    home_sp_id,
                    season,
                ),
                _enrich_side(
                    client,
                    game.home.pitcher,
                    game.home.batters,
                    away_sp_id,
                    season,
                ),
            )
            response = MlbLineupMatchupResponse(
                date=date_et,
                away_abbrev=game.away_abbrev,
                home_abbrev=game.home_abbrev,
                status=game.status,
                away=away_side,
                home=home_side,
                fetched_at=fetched_at,
            )
    except Exception as exc:
        logger.warning("matchup enrichment failed: %s", exc)
        return empty

    _cache[key] = {
        "response": response,
        "expires_at": time.time() + MATCHUP_TTL_SECONDS,
    }
    return response
