"""Build PPG / RPG / APG game-leader cards from an ESPN WNBA summary."""

from __future__ import annotations

from typing import Literal, cast

from app.domains.wnba.schemas_game_detail import (
    GameDetailTeam,
    WnbaGameLeaderCard,
    WnbaGameLeaders,
)

GameLeaderKey = Literal["ppg", "rpg", "apg"]

GAME_LEADER_KEYS: tuple[GameLeaderKey, ...] = ("ppg", "rpg", "apg")

_LABEL: dict[GameLeaderKey, str] = {"ppg": "PPG", "rpg": "RPG", "apg": "APG"}

# ESPN category name → card key
_ESPN_STAT_TO_KEY: dict[str, GameLeaderKey] = {
    "pointsPerGame": "ppg",
    "reboundsPerGame": "rpg",
    "assistsPerGame": "apg",
}


def last_name_from_full(full_name: str) -> str:
    parts = full_name.strip().split()
    return parts[-1] if parts else full_name


def _parse_value(raw: str) -> float | None:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _headshot_url(athlete: dict) -> str | None:
    headshot = athlete.get("headshot")
    if isinstance(headshot, dict):
        href = str(headshot.get("href") or "").strip()
        return href or None
    if isinstance(headshot, str):
        return headshot.strip() or None
    return None


def _candidate_for_team(
    blocks: list,
    *,
    team_id: str,
    team_abbrev: str,
    side: Literal["away", "home"],
    key: GameLeaderKey,
) -> WnbaGameLeaderCard | None:
    espn_names = {name for name, k in _ESPN_STAT_TO_KEY.items() if k == key}
    for block in blocks:
        if str((block.get("team") or {}).get("id") or "") != team_id:
            continue
        for cat in block.get("leaders") or []:
            if str(cat.get("name") or "") not in espn_names:
                continue
            entry = (cat.get("leaders") or [None])[0] or {}
            athlete = entry.get("athlete") or {}
            name = str(athlete.get("displayName") or "").strip()
            value = str(entry.get("displayValue") or "").strip()
            if not name or not value:
                return None
            player_id = str(athlete.get("id") or "").strip()
            rank_raw = entry.get("rank")
            rank: int | None
            try:
                rank = int(rank_raw) if rank_raw is not None else None
            except (TypeError, ValueError):
                rank = None
            return WnbaGameLeaderCard(
                key=key,
                label=_LABEL[key],
                rank=rank,
                value=value,
                player_id=player_id,
                last_name=last_name_from_full(name),
                team_abbrev=team_abbrev,
                side=side,
                headshot_url=_headshot_url(athlete),
            )
    return None


def _pick_better(
    away_card: WnbaGameLeaderCard | None,
    home_card: WnbaGameLeaderCard | None,
) -> WnbaGameLeaderCard | None:
    if away_card is None:
        return home_card
    if home_card is None:
        return away_card
    away_val = _parse_value(away_card.value)
    home_val = _parse_value(home_card.value)
    if away_val is None and home_val is None:
        return away_card
    if away_val is None:
        return home_card
    if home_val is None:
        return away_card
    # Higher average wins; away wins ties for stable selection.
    return away_card if away_val >= home_val else home_card


def build_game_leaders_from_summary(
    payload: dict,
    away: GameDetailTeam,
    home: GameDetailTeam,
) -> WnbaGameLeaders | None:
    """Pick the better of away vs home season leaders for PPG / RPG / APG."""
    blocks = payload.get("leaders")
    if not isinstance(blocks, list) or not blocks:
        return None

    cards: list[WnbaGameLeaderCard] = []
    for key in GAME_LEADER_KEYS:
        away_card = _candidate_for_team(
            blocks,
            team_id=away.id,
            team_abbrev=away.abbrev,
            side="away",
            key=key,
        )
        home_card = _candidate_for_team(
            blocks,
            team_id=home.id,
            team_abbrev=home.abbrev,
            side="home",
            key=key,
        )
        winner = _pick_better(away_card, home_card)
        if winner is not None:
            cards.append(cast(WnbaGameLeaderCard, winner))

    if not cards:
        return None
    return WnbaGameLeaders(leaders=cards)
