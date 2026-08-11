from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.wnba_abbrevs import canonical_abbrev
from app.domains.betting.parlay_props import get_today_props
from app.domains.betting.prop_stat_keys import (
    GAME_PROP_CATEGORY_ORDER,
    canonical_stat_key_from_parlay_market,
    display_stat_label,
)
from app.domains.betting.schemas_props import WnbaPropLine
from app.domains.wnba.game_detail import get_game_detail, is_valid_espn_event_id
from app.domains.wnba.schemas_game_props import (
    WnbaGamePropBestQuote,
    WnbaGamePropCategory,
    WnbaGamePropPlayer,
    WnbaGamePropsResponse,
)
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.espn.wnba_team_player_stats import fetch_team_roster_athletes

logger = logging.getLogger(__name__)

BOOK_PRIORITY: tuple[str, ...] = (
    "novig",
    "draftkings",
    "fanduel",
    "pinnacle",
    "betmgm",
    "caesars",
    "betrivers",
    "bet365",
)

_PRIORITY_RANK = {book: i for i, book in enumerate(BOOK_PRIORITY)}


def _line_key(line: float) -> float:
    return round(float(line), 2)


def pick_best_quote(candidates: list[tuple[str, int]]) -> WnbaGamePropBestQuote | None:
    if not candidates:
        return None
    best_book, best_american = max(
        candidates,
        key=lambda item: (item[1], -_PRIORITY_RANK.get(item[0], 999)),
    )
    return WnbaGamePropBestQuote(american=best_american, book=best_book)


def group_game_prop_categories(
    players_by_stat: dict[str, list[WnbaGamePropPlayer]],
) -> list[WnbaGamePropCategory]:
    ordered: list[WnbaGamePropCategory] = []
    seen: set[str] = set()
    for stat in GAME_PROP_CATEGORY_ORDER:
        players = players_by_stat.get(stat)
        if not players:
            continue
        ordered.append(
            WnbaGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
        seen.add(stat)
    for stat, players in sorted(players_by_stat.items()):
        if stat in seen or not players:
            continue
        ordered.append(
            WnbaGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
    return ordered


def _compose_error(existing: str | None, new: str) -> str:
    if not existing:
        return new
    parts = existing.split(",")
    if new in parts:
        return existing
    return f"{existing},{new}"


def _iso_now(now: datetime) -> str:
    return now.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _stat_key_for_row(row: WnbaPropLine) -> str:
    from_market = canonical_stat_key_from_parlay_market(row.market_type or "")
    if from_market:
        return from_market
    # Fallback: slug of display stat
    return (row.stat or "unknown").strip().lower().replace(" ", "_").replace("-", "_")


def _dfs_line(row: WnbaPropLine, app: str) -> float | None:
    quote = getattr(row, app, None)
    if quote is None:
        return None
    try:
        return float(quote.line)
    except (TypeError, ValueError):
        return None


def _side_candidates(
    rows: list[WnbaPropLine],
    *,
    side: str,
    line: float,
) -> list[tuple[str, int]]:
    target = _line_key(line)
    side_l = side.lower()
    candidates: list[tuple[str, int]] = []
    for row in rows:
        if (row.side or "").lower() != side_l:
            continue
        for book in BOOK_PRIORITY:
            quote = getattr(row, book, None)
            if quote is None or quote.odds_american is None:
                continue
            try:
                if _line_key(float(quote.line)) != target:
                    continue
                candidates.append((book, int(quote.odds_american)))
            except (TypeError, ValueError):
                continue
    return candidates


async def get_wnba_props_for_game(*, espn_event_id: str, app: str) -> WnbaGamePropsResponse:
    if app not in ("prizepicks", "underdog"):
        raise ValueError(f"unsupported app {app!r}")
    if not is_valid_espn_event_id(espn_event_id):
        raise LookupError(espn_event_id)

    detail = await get_game_detail(espn_event_id)
    away = canonical_abbrev(detail.away.abbrev)
    home = canonical_abbrev(detail.home.abbrev)
    game_teams = {away, home}
    now = datetime.now(timezone.utc)
    error: str | None = None

    today = await get_today_props()
    if today.error:
        error = _compose_error(error, today.error)

    # Headshot index: normalized name -> url (soft-fail)
    headshots: dict[str, str | None] = {}
    try:
        for team_id in (detail.away.id, detail.home.id):
            athletes = await fetch_team_roster_athletes(team_id)
            for athlete in athletes:
                # RosterAthlete.name is the display name field
                headshots[norm_player_name(athlete.name)] = athlete.headshot_url
    except Exception as exc:
        logger.warning("WNBA game props roster unavailable: %s", exc)
        error = _compose_error(error, "roster_unavailable")

    # Bucket DFS slots: (norm_player, stat_key, line) -> display fields + sibling rows
    buckets: dict[tuple[str, str, float], dict[str, Any]] = {}
    rows_by_player_stat: dict[tuple[str, str], list[WnbaPropLine]] = {}

    for row in today.props:
        team = canonical_abbrev(row.team_abbrev or "")
        if team not in game_teams:
            continue
        line = _dfs_line(row, app)
        if line is None:
            continue
        stat_key = _stat_key_for_row(row)
        norm = norm_player_name(row.player_name)
        key = (norm, stat_key, _line_key(line))
        if key not in buckets:
            buckets[key] = {
                "player_name": row.player_name,
                "team_abbrev": row.team_abbrev,
                "line": float(line),
                "stat_key": stat_key,
            }
        rows_by_player_stat.setdefault((norm, stat_key), []).append(row)

    players_by_stat: dict[str, list[WnbaGamePropPlayer]] = {}
    for (norm, stat_key, _lk), bucket in buckets.items():
        sibling_rows = rows_by_player_stat.get((norm, stat_key), [])
        line = float(bucket["line"])
        over = pick_best_quote(
            _side_candidates(sibling_rows, side="over", line=line)
        )
        under = pick_best_quote(
            _side_candidates(sibling_rows, side="under", line=line)
        )
        player = WnbaGamePropPlayer(
            player_name=bucket["player_name"],
            team_abbrev=bucket["team_abbrev"],
            headshot_url=headshots.get(norm),
            line=line,
            over=over,
            under=under,
        )
        players_by_stat.setdefault(stat_key, []).append(player)

    for lst in players_by_stat.values():
        lst.sort(key=lambda p: p.player_name.casefold())

    return WnbaGamePropsResponse(
        as_of=_iso_now(now),
        app=app,
        espn_event_id=str(espn_event_id),
        away_abbrev=detail.away.abbrev,
        home_abbrev=detail.home.abbrev,
        categories=group_game_prop_categories(players_by_stat),
        error=error,
    )
