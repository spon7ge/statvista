from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.odds_snapshots import (
    fetch_latest_novig,
    fetch_latest_pinnacle,
    fetch_latest_prophetx,
    fetch_latest_underdog,
)
from app.domains.mlb.game_detail import get_mlb_game_detail, is_valid_mlb_game_pk
from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label
from app.domains.mlb.props import (
    FETCH_TIMEOUT_SECONDS,
    _build_board,
    _index_snapshot_rows,
)
from app.domains.mlb.schemas_game_props import (
    MlbGamePropBestQuote,
    MlbGamePropCategory,
    MlbGamePropPlayer,
    MlbGamePropsResponse,
)
from app.providers.espn.mlb_roster import get_mlb_player_index
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.parlay.mlb_props import (
    ParlayMlbNormalized,
    fetch_mlb_parlay_props_normalized,
)

logger = logging.getLogger(__name__)

SideIndex = dict[tuple[str, str, str, float], dict[str, Any]]

BOOK_PRIORITY: tuple[str, ...] = (
    "prophetx",
    "novig",
    "draftkings",
    "fanduel",
    "pinnacle",
)

_PRIORITY_RANK = {book: i for i, book in enumerate(BOOK_PRIORITY)}


def _line_key(line: float) -> float:
    return round(float(line), 2)


def _iso_now(now: datetime) -> str:
    return now.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _compose_error(existing: str | None, new: str) -> str:
    """Append soft-fail codes without duplicating (e.g. parlay + roster)."""
    if not existing:
        return new
    parts = existing.split(",")
    if new in parts:
        return existing
    return f"{existing},{new}"


def _empty_parlay(*, unavailable: bool = True) -> ParlayMlbNormalized:
    return ParlayMlbNormalized(
        prizepicks_board=[], book_indexes={}, as_of=None, unavailable=unavailable
    )


def pick_best_quote(candidates: list[tuple[str, int]]) -> MlbGamePropBestQuote | None:
    """Pick highest American odds; ties break by BOOK_PRIORITY order."""
    if not candidates:
        return None
    best_book, best_american = max(
        candidates,
        key=lambda item: (item[1], -_PRIORITY_RANK.get(item[0], 999)),
    )
    return MlbGamePropBestQuote(american=best_american, book=best_book)


def best_side_quote(
    indexes: dict[str, SideIndex],
    *,
    norm_player: str,
    stat_key: str,
    side: str,
    line: float,
) -> MlbGamePropBestQuote | None:
    side_key = (norm_player, stat_key, side, _line_key(line))
    candidates: list[tuple[str, int]] = []
    for book in BOOK_PRIORITY:
        hit = indexes.get(book, {}).get(side_key)
        if not hit:
            continue
        american = hit.get("american")
        if american is None:
            continue
        try:
            candidates.append((book, int(american)))
        except (TypeError, ValueError):
            continue
    return pick_best_quote(candidates)


def group_game_prop_categories(
    players_by_stat: dict[str, list[MlbGamePropPlayer]],
) -> list[MlbGamePropCategory]:
    ordered: list[MlbGamePropCategory] = []
    seen: set[str] = set()
    for stat in GAME_PROP_CATEGORY_ORDER:
        players = players_by_stat.get(stat)
        if not players:
            continue
        ordered.append(
            MlbGamePropCategory(
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
            MlbGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
    return ordered


async def get_mlb_props_for_game(*, game_pk: str, app: str) -> MlbGamePropsResponse:
    """Assemble PrizePicks/Underdog board filtered to one game's two teams."""
    if app not in ("prizepicks", "underdog"):
        raise ValueError(f"unsupported app {app!r}")
    if not is_valid_mlb_game_pk(game_pk):
        raise LookupError(game_pk)

    detail = await get_mlb_game_detail(game_pk)
    away = detail.away.abbrev.upper()
    home = detail.home.abbrev.upper()
    now = datetime.now(timezone.utc)
    error: str | None = None

    try:
        parlay = await fetch_mlb_parlay_props_normalized(timeout=FETCH_TIMEOUT_SECONDS)
    except Exception as exc:
        logger.warning("Parlay MLB props unavailable: %s", exc)
        error = "parlay_unavailable"
        parlay = _empty_parlay()
    else:
        if parlay.unavailable:
            error = "parlay_unavailable"

    if app == "prizepicks":
        dfs_rows = parlay.prizepicks_board
    else:
        dfs_rows = fetch_latest_underdog("mlb")
    board = _build_board(app, dfs_rows)

    prophetx_idx = _index_snapshot_rows(
        fetch_latest_prophetx("mlb"), player_field="player_name", stat_field="stat_name"
    )
    novig_idx = _index_snapshot_rows(
        fetch_latest_novig("mlb"), player_field="player_name", stat_field="stat_name"
    )
    pinnacle_idx = _index_snapshot_rows(
        fetch_latest_pinnacle("mlb"), player_field="player_name", stat_field="market_type"
    )
    indexes: dict[str, SideIndex] = {
        "prophetx": prophetx_idx,
        "novig": novig_idx,
        "pinnacle": pinnacle_idx,
        **parlay.book_indexes,
    }

    try:
        roster_index = await get_mlb_player_index()
    except Exception as exc:
        logger.warning("MLB game props roster index unavailable: %s", exc)
        roster_index = {}
        # Empty categories after a roster failure should not look like a
        # silent no-props success — surface the soft error to the client.
        error = _compose_error(error, "roster_unavailable")

    game_teams = {away, home}
    players_by_stat: dict[str, list[MlbGamePropPlayer]] = {}
    for (norm_player, stat_key, line), bucket in board.items():
        entry = roster_index.get(norm_player_name(bucket["player_name"])) or {}
        team = (entry.get("team_abbrev") or "").upper()
        if team not in game_teams:
            continue
        over = best_side_quote(
            indexes,
            norm_player=norm_player,
            stat_key=stat_key,
            side="over",
            line=line,
        )
        under = best_side_quote(
            indexes,
            norm_player=norm_player,
            stat_key=stat_key,
            side="under",
            line=line,
        )
        player = MlbGamePropPlayer(
            player_name=bucket["player_name"],
            team_abbrev=entry.get("team_abbrev"),
            headshot_url=entry.get("headshot_url"),
            line=float(line),
            over=over,
            under=under,
        )
        players_by_stat.setdefault(stat_key, []).append(player)

    for lst in players_by_stat.values():
        lst.sort(key=lambda p: p.player_name.casefold())

    return MlbGamePropsResponse(
        as_of=_iso_now(now),
        app=app,
        game_pk=str(game_pk),
        away_abbrev=detail.away.abbrev,
        home_abbrev=detail.home.abbrev,
        categories=group_game_prop_categories(players_by_stat),
        error=error,
    )
