"""MLB Stats API helpers for person search and matchup stats."""

from __future__ import annotations

import logging
import unicodedata
from typing import Any

import httpx

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
STATS_TIMEOUT_SECONDS = 10.0


def _norm_name(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(ascii_only.lower().split())


def pick_best_person(people: list[dict], query: str) -> dict | None:
    if not people:
        return None
    q = _norm_name(query)

    def score(p: dict) -> tuple:
        name = _norm_name(str(p.get("fullName") or ""))
        exact = 0 if name == q else 1
        active = 0 if p.get("active") else 1
        return (exact, active, name)

    return sorted(people, key=score)[0]


async def search_person_id(client: httpx.AsyncClient, name: str) -> int | None:
    if not name or not name.strip():
        return None
    try:
        res = await client.get(
            f"{STATS_BASE}/people/search",
            params={"names": name.strip(), "sportIds": 1},
        )
        res.raise_for_status()
        people = res.json().get("people") or []
        best = pick_best_person(people, name)
        return int(best["id"]) if best and best.get("id") is not None else None
    except Exception as exc:
        logger.warning("people search failed for %r: %s", name, exc)
        return None


async def fetch_season_pitching(
    client: httpx.AsyncClient, person_id: int, season: int
) -> dict[str, Any]:
    empty = {
        "wins": None,
        "losses": None,
        "era": None,
        "innings_pitched": None,
        "strikeouts": None,
        "whip": None,
        "k_per_9": None,
        "bb_per_9": None,
        "strikeout_walk_ratio": None,
    }
    try:
        res = await client.get(
            f"{STATS_BASE}/people/{person_id}/stats",
            params={
                "stats": "season",
                "group": "pitching",
                "season": season,
                "sportId": 1,
            },
        )
        res.raise_for_status()
        splits = (res.json().get("stats") or [{}])[0].get("splits") or []
        if not splits:
            return empty
        st = splits[0].get("stat") or {}
        return {
            "wins": st.get("wins"),
            "losses": st.get("losses"),
            "era": st.get("era"),
            "innings_pitched": st.get("inningsPitched"),
            "strikeouts": st.get("strikeOuts"),
            "whip": st.get("whip"),
            "k_per_9": st.get("strikeoutsPer9Inn"),
            "bb_per_9": st.get("walksPer9Inn"),
            "strikeout_walk_ratio": st.get("strikeoutWalkRatio"),
        }
    except Exception as exc:
        logger.warning("season pitching failed for %s: %s", person_id, exc)
        return empty


async def fetch_vs_pitcher_total(
    client: httpx.AsyncClient, batter_id: int, pitcher_id: int
) -> dict[str, Any] | None:
    try:
        res = await client.get(
            f"{STATS_BASE}/people/{batter_id}/stats",
            params={
                "stats": "vsPlayerTotal",
                "group": "hitting",
                "opposingPlayerId": pitcher_id,
                "sportId": 1,
            },
        )
        res.raise_for_status()
        splits = (res.json().get("stats") or [{}])[0].get("splits") or []
        if not splits:
            return None
        st = splits[0].get("stat") or {}
        return {
            "ab": st.get("atBats"),
            "h": st.get("hits"),
            "hr": st.get("homeRuns"),
            "avg": st.get("avg"),
        }
    except Exception as exc:
        logger.warning(
            "vsPlayerTotal failed batter=%s pitcher=%s: %s",
            batter_id,
            pitcher_id,
            exc,
        )
        return None
