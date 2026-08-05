from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx

ESPN_SCOREBOARD_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"
)
ESPN_TIMEOUT_SECONDS = 10.0

# Stats API vs ESPN abbreviation aliases (bidirectional).
_ABBREV_ALIASES: dict[str, str] = {
    "ARI": "AZ",
    "AZ": "ARI",
    "CHW": "CWS",
    "CWS": "CHW",
    "WAS": "WSH",
    "WSH": "WAS",
}


@dataclass(frozen=True)
class EspnWinProbabilityPoint:
    """Lean provider-local shape; mapped to the domain schema at the MLB
    game-detail boundary (``app.domains.mlb.game_detail``)."""

    play_id: str
    label: str
    home_win_pct: float


@dataclass(frozen=True)
class EspnWinProbabilityStakes:
    home_win_delta: float
    label: str


@dataclass(frozen=True)
class EspnWinProbability:
    home_abbrev: str
    away_abbrev: str
    points: list[EspnWinProbabilityPoint] = field(default_factory=list)
    stakes: EspnWinProbabilityStakes | None = None


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _norm_abbrev(abbrev: str) -> str:
    return str(abbrev or "").strip().upper()


def _abbrev_matches(left: str, right: str) -> bool:
    a = _norm_abbrev(left)
    b = _norm_abbrev(right)
    if not a or not b:
        return False
    if a == b:
        return True
    return _ABBREV_ALIASES.get(a) == b or _ABBREV_ALIASES.get(b) == a


def _competitor_abbrev(competitor: dict) -> str:
    team = _as_dict(competitor.get("team"))
    return _norm_abbrev(str(team.get("abbreviation") or ""))


def match_espn_event_id(
    board: dict,
    *,
    away_abbrev: str,
    home_abbrev: str,
) -> str | None:
    """Find an ESPN event id by away/home team abbreviations."""
    for event in _as_list(board.get("events")):
        if not isinstance(event, dict):
            continue
        event_id = event.get("id")
        if event_id is None:
            continue
        for competition in _as_list(event.get("competitions")):
            if not isinstance(competition, dict):
                continue
            away = None
            home = None
            for competitor in _as_list(competition.get("competitors")):
                if not isinstance(competitor, dict):
                    continue
                side = str(competitor.get("homeAway") or "").strip().lower()
                abbrev = _competitor_abbrev(competitor)
                if side == "away":
                    away = abbrev
                elif side == "home":
                    home = abbrev
            if away is None or home is None:
                continue
            if _abbrev_matches(away, away_abbrev) and _abbrev_matches(
                home, home_abbrev
            ):
                return str(event_id)
    return None


def _home_win_pct(raw: Any) -> float | None:
    """Normalize ESPN homeWinPercentage to a 0–1 fraction."""
    if raw is None or raw == "":
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value > 1.0:
        value = value / 100.0
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def _point_label(play: dict | None, play_id: str) -> str:
    if not isinstance(play, dict):
        return play_id
    period = _as_dict(play.get("period"))
    period_type = str(period.get("type") or "").strip()
    number = period.get("number")
    clock = _as_dict(play.get("clock")).get("displayValue")
    parts: list[str] = []
    if period_type and number is not None:
        parts.append(f"{period_type} {number}")
    elif period.get("displayValue"):
        parts.append(str(period["displayValue"]))
    if clock:
        parts.append(str(clock))
    if parts:
        return " · ".join(parts)
    text = play.get("text") or play.get("shortText")
    if text:
        return str(text)
    return play_id


def _stakes_label(delta: float) -> str:
    pts = abs(round(delta * 100))
    return f"≈ {pts} pts win%"


def normalize_espn_mlb_win_probability(
    summary: dict,
    *,
    home_abbrev: str,
    away_abbrev: str,
) -> EspnWinProbability | None:
    """Map ESPN summary ``winprobability`` into ``EspnWinProbability``."""
    plays_by_id = {
        str(play.get("id")): play
        for play in _as_list(summary.get("plays"))
        if isinstance(play, dict) and play.get("id") is not None
    }

    points: list[EspnWinProbabilityPoint] = []
    for index, raw in enumerate(_as_list(summary.get("winprobability"))):
        if not isinstance(raw, dict):
            continue
        pct = _home_win_pct(raw.get("homeWinPercentage"))
        if pct is None:
            continue
        play_id = str(raw.get("playId") or f"wp-{index}")
        play = plays_by_id.get(play_id)
        points.append(
            EspnWinProbabilityPoint(
                play_id=play_id,
                label=_point_label(play, play_id),
                home_win_pct=pct,
            )
        )

    if not points:
        return None

    stakes: EspnWinProbabilityStakes | None = None
    if len(points) >= 2:
        delta = points[-1].home_win_pct - points[-2].home_win_pct
        stakes = EspnWinProbabilityStakes(
            home_win_delta=delta,
            label=_stakes_label(delta),
        )

    return EspnWinProbability(
        home_abbrev=_norm_abbrev(home_abbrev),
        away_abbrev=_norm_abbrev(away_abbrev),
        points=points,
        stakes=stakes,
    )


async def resolve_espn_event_id(
    *,
    date_et: str,
    away_abbrev: str,
    home_abbrev: str,
    client: httpx.AsyncClient | None = None,
) -> str | None:
    """Fetch ESPN MLB scoreboard for ``date_et`` and match away/home abbrevs."""
    dates = date_et.replace("-", "")
    url = f"{ESPN_SCOREBOARD_URL}?dates={dates}"
    owns_client = client is None
    http_client = client or httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS)
    try:
        response = await http_client.get(url)
        response.raise_for_status()
        return match_espn_event_id(
            response.json(),
            away_abbrev=away_abbrev,
            home_abbrev=home_abbrev,
        )
    finally:
        if owns_client:
            await http_client.aclose()
