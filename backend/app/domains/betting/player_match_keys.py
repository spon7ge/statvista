"""Shared prop-board player join keys (DFS ↔ Parlay / scrapers)."""

from __future__ import annotations

import re
import unicodedata

# Alternate strong-normed spellings → canonical strong-normed (prefer DFS shape).
PLAYER_NAME_ALIASES: dict[str, str] = {
    "jessica lynn shepard": "jessica shepard",
}

_WS = re.compile(r"\s+")


def strong_norm_player_name(name: str) -> str:
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = _WS.sub(" ", s.casefold().strip())
    return s


def match_player_key(name: str) -> str:
    key = strong_norm_player_name(name)
    if not key:
        return ""
    return PLAYER_NAME_ALIASES.get(key, key)
