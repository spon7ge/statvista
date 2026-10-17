"""Assemble GET /api/wnba/props/board from sportsbook mains + DFS lines."""

from __future__ import annotations

import inspect
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.odds_snapshots import (
    fetch_latest_novig,
    fetch_latest_parlay_api_odds,
    fetch_latest_pinnacle,
    fetch_latest_prizepicks,
    fetch_latest_prophetx,
    fetch_latest_underdog,
)
from app.core.wnba_abbrevs import canonical_abbrev
from app.domains.betting.player_match_keys import match_player_key
from app.domains.betting.season_log_cache import (
    h2h_splits,
    load_season_logs,
    player_base_splits,
)
from app.domains.betting.pregame_props import (
    load_prop_slate,
    player_on_slate,
    prop_still_upcoming,
    slate_loaded,
)
from app.domains.betting.prop_stat_keys import (
    canonical_stat_key_from_pp,
    canonical_stat_key_from_ud,
    display_stat_label,
)
from app.domains.wnba.prop_board_cluster import (
    BOOK_CHIP_ORDER,
    BoardQuote,
    Cluster,
    cluster_quotes,
    consensus_ip_pct,
    round_line,
)
from app.domains.wnba.prop_board_form import h2h_rate, hit_rates, opponent_abbrev_from_split
from app.domains.wnba.props import (
    MainLineIndex,
    _as_datetime,
    _main_from_side_index,
    _main_from_snapshot_rows,
    _parse_american,
    index_parlay_api_odds_by_book,
)
from app.domains.wnba.schemas_prop_board import (
    WnbaPropBoardBookChip,
    WnbaPropBoardResponse,
    WnbaPropBoardRow,
    Side,
)
from app.domains.wnba.scoreboard import get_scoreboard_for_date, get_today_scoreboard
from app.providers.espn.wnba_roster import get_wnba_player_index, norm_player_name

logger = logging.getLogger(__name__)


class UnknownBoardBookError(ValueError):
    """`book` is not a board book id."""


PRIZEPICKS_AMERICAN = -137

_VALID_SIDES: tuple[str, ...] = ("over", "under")
_PARLAY_BOOKS: tuple[str, ...] = (
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "kalshi",
    "fliff",
    "bet365",
)
PlayerCtx = dict[str, Any]
Enrichment = tuple[dict[str, PlayerCtx], list[str], set[str]]


def collect_board_quotes() -> list[BoardQuote]:
    """Load sportsbook mains + DFS mains as ``BoardQuote``s.

    Parlay snapshot miss appends ``parlay_unavailable`` on
    ``collect_board_quotes.warnings`` (never raises).
    """
    warnings: list[str] = []
    names: dict[str, str] = {}
    quotes: list[BoardQuote] = []

    px_rows = fetch_latest_prophetx("wnba", mains_only=True)
    _remember_names(names, px_rows)
    quotes.extend(
        _quotes_from_mains(
            "prophetx",
            _main_from_snapshot_rows(
                px_rows, player_field="player_name", stat_field="stat_name"
            ),
            names,
        )
    )

    novig_rows = fetch_latest_novig("wnba", mains_only=True)
    _remember_names(names, novig_rows)
    quotes.extend(
        _quotes_from_mains(
            "novig",
            _main_from_snapshot_rows(
                novig_rows, player_field="player_name", stat_field="stat_name"
            ),
            names,
        )
    )

    pin_rows = fetch_latest_pinnacle("wnba")
    _remember_names(names, pin_rows)
    quotes.extend(
        _quotes_from_mains(
            "pinnacle",
            _main_from_snapshot_rows(
                pin_rows, player_field="player_name", stat_field="market_type"
            ),
            names,
        )
    )

    try:
        snap_rows = fetch_latest_parlay_api_odds("wnba")
    except Exception:
        snap_rows = []
    if not snap_rows:
        warnings.append("parlay_unavailable")
    else:
        _remember_names(names, snap_rows)
        indexes = index_parlay_api_odds_by_book(snap_rows)
        for book in _PARLAY_BOOKS:
            quotes.extend(
                _quotes_from_mains(
                    book, _main_from_side_index(indexes.get(book, {})), names
                )
            )

    quotes.extend(_prizepicks_quotes(fetch_latest_prizepicks("wnba")))
    quotes.extend(_underdog_quotes(fetch_latest_underdog("wnba")))

    collect_board_quotes.warnings = warnings
    return quotes


collect_board_quotes.warnings = []  # type: ignore[attr-defined]


async def load_enrichment(clusters: list[Cluster] | None = None) -> Enrichment:
    """Roster, scoreboard, and the daily season-log cache for clustered players.

    Soft-fails logs independently. A player missing from that cache is
    recorded in the returned set so L# stay null for that player only.
    """
    clusters = clusters or []
    if not clusters:
        return {}, [], set()
    warnings: list[str] = []
    missing_person: set[str] = set()
    players: dict[str, str] = {}
    for cluster in clusters:
        players[cluster.player_key] = cluster.player_name

    roster: dict[str, Any] = {}
    try:
        roster = await get_wnba_player_index()
    except Exception as exc:
        logger.warning("WNBA board roster enrichment skipped: %s", exc)

    game_by_team: dict[str, dict[str, Any]] = {}
    try:
        game_by_team = _game_index_from_scoreboard(
            await load_prop_slate(get_today_scoreboard, get_scoreboard_for_date)
        )
    except Exception as exc:
        logger.warning("WNBA board scoreboard enrichment skipped: %s", exc)

    player_ctx = _player_context(players, roster, game_by_team)

    try:
        logs_failed = await _attach_game_logs(
            player_ctx, players, missing_person
        )
        if logs_failed:
            warnings.append("gamelogs_unavailable")
    except Exception as exc:
        logger.warning("WNBA board game logs unavailable: %s", exc)
        if "gamelogs_unavailable" not in warnings:
            warnings.append("gamelogs_unavailable")

    return player_ctx, warnings, missing_person


def resolve_board_book(book: str | None) -> str:
    if book is None:
        return "prizepicks"
    if book not in BOOK_CHIP_ORDER:
        raise UnknownBoardBookError(book)
    return book


async def get_wnba_prop_board(book: str | None = None) -> WnbaPropBoardResponse:
    anchor_book = resolve_board_book(book)
    warnings: list[str] = []
    quotes = collect_board_quotes()
    warnings.extend(getattr(collect_board_quotes, "warnings", []) or [])

    clusters = [
        cluster
        for cluster in cluster_quotes(quotes)
        if any(quote.book == anchor_book for quote in cluster.quotes)
    ]
    loaded = load_enrichment(clusters)
    if inspect.isawaitable(loaded):
        loaded = await loaded
    player_ctx, extra_warnings, missing_person = loaded
    warnings.extend(extra_warnings)

    now = datetime.now(timezone.utc)
    known_slate = slate_loaded(player_ctx.values())
    rows: list[WnbaPropBoardRow] = []
    for cluster in clusters:
        ctx = player_ctx.get(cluster.player_key) or {}
        if not prop_still_upcoming(
            start=ctx.get("game_start_at"),
            status=ctx.get("game_status"),
            now=now,
            on_slate=True if not known_slate else player_on_slate(ctx),
        ):
            continue
        opponent = ctx.get("opponent_abbrev")
        splits = ctx.get("splits") or []
        splits_prev = ctx.get("splits_prev") or []
        skip_hits = cluster.player_key in missing_person
        for side in ("over", "under"):
            if skip_hits:
                l5 = l10 = l15 = h2h = None
            else:
                l5, l10, l15 = hit_rates(cluster.stat, side, cluster.line, splits)
                h2h = h2h_rate(
                    cluster.stat,
                    side,
                    cluster.line,
                    _h2h_games(ctx, splits, splits_prev),
                    opponent,
                )
            anchor, book_chips = _anchor_and_matches(cluster, side, anchor_book)
            if anchor is None:
                continue
            rows.append(
                WnbaPropBoardRow(
                    player_name=cluster.player_name,
                    headshot_url=ctx.get("headshot_url"),
                    team_abbrev=ctx.get("team_abbrev"),
                    opponent_abbrev=opponent,
                    home_away=ctx.get("home_away"),
                    stat=cluster.stat,
                    market_label=_market_label(side, cluster.line, cluster.stat),
                    side=side,
                    line=cluster.line,
                    game_id=ctx.get("game_id"),
                    game_start_at=ctx.get("game_start_at"),
                    anchor=anchor,
                    books=book_chips,
                    ip_pct=consensus_ip_pct(
                        [anchor.american, *[chip.american for chip in book_chips]]
                    ),
                    hit_l5=l5,
                    hit_l10=l10,
                    hit_l15=l15,
                    hit_h2h=h2h,
                )
            )

    rows.sort(key=_row_sort_key)
    return WnbaPropBoardResponse(
        as_of=datetime.now(timezone.utc),
        warnings=warnings,
        rows=rows,
    )


def _market_label(side: str, line: float, stat: str) -> str:
    return f"{side.title()} {line} {display_stat_label(stat)}"


def _remember_names(names: dict[str, str], rows: list[dict[str, Any]]) -> None:
    for row in rows:
        player = str(row.get("player_name") or "").strip()
        if not player:
            continue
        names.setdefault(match_player_key(player), player)


def _quotes_from_mains(
    book: str,
    mains: MainLineIndex,
    names: dict[str, str],
) -> list[BoardQuote]:
    quotes: list[BoardQuote] = []
    for (player_key, stat), main in mains.items():
        if not player_key or not stat:
            continue
        name = names.get(player_key)
        if not name:
            continue
        quotes.append(
            BoardQuote(
                player_name=name,
                player_key=player_key,
                stat=stat,
                line=round_line(main.line),
                book=book,
                over_american=main.over_american,
                under_american=main.under_american,
            )
        )
    return quotes


def _prizepicks_quotes(rows: list[dict[str, Any]]) -> list[BoardQuote]:
    quotes: list[BoardQuote] = []
    for row in rows:
        if str(row.get("odds_type") or "").lower() != "standard":
            continue
        player = str(row.get("player_name") or "").strip()
        stat_raw = str(row.get("stat_type") or "").strip()
        if not player or not stat_raw:
            continue
        stat = canonical_stat_key_from_pp(stat_raw)
        if stat is None:
            continue
        line = _parse_line(row.get("line_score"))
        if line is None:
            continue
        player_key = match_player_key(player)
        if not player_key:
            continue
        quotes.append(
            BoardQuote(
                player_name=player,
                player_key=player_key,
                stat=stat,
                line=round_line(line),
                book="prizepicks",
                over_american=None,
                under_american=None,
            )
        )
    return quotes


def _underdog_quotes(rows: list[dict[str, Any]]) -> list[BoardQuote]:
    merged: dict[tuple[str, str, float], BoardQuote] = {}
    for row in rows:
        player = str(row.get("player_name") or "").strip()
        stat_raw = str(row.get("stat_name") or "").strip()
        side = str(row.get("side") or "").lower()
        if not player or not stat_raw or side not in _VALID_SIDES:
            continue
        stat = canonical_stat_key_from_ud(stat_raw)
        if stat is None:
            continue
        line = _parse_line(row.get("line_score"))
        if line is None:
            continue
        player_key = match_player_key(player)
        if not player_key:
            continue
        line = round_line(line)
        key = (player_key, stat, line)
        existing = merged.get(key)
        over = existing.over_american if existing else None
        under = existing.under_american if existing else None
        american = _parse_american(row.get("american_price"))
        if side == "over":
            over = american
        else:
            under = american
        merged[key] = BoardQuote(
            player_name=existing.player_name if existing else player,
            player_key=player_key,
            stat=stat,
            line=line,
            book="underdog",
            over_american=over,
            under_american=under,
        )
    return list(merged.values())


def _parse_line(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _side_american(quote: BoardQuote, side: Side) -> int | None:
    raw = quote.over_american if side == "over" else quote.under_american
    if raw is None and quote.book == "prizepicks":
        return PRIZEPICKS_AMERICAN
    return raw


def _chip_for_quote(quote: BoardQuote, side: Side) -> WnbaPropBoardBookChip | None:
    american = _side_american(quote, side)
    if american is None:
        return None
    return WnbaPropBoardBookChip(
        book=quote.book,
        american=american,
        url=quote.url,
        line=quote.line,
        over_american=_side_american(quote, "over"),
        under_american=_side_american(quote, "under"),
        devig_pct=None,
    )


def _anchor_and_matches(
    cluster: Cluster,
    side: Side,
    anchor_book: str,
) -> tuple[WnbaPropBoardBookChip | None, list[WnbaPropBoardBookChip]]:
    by_book = {quote.book: quote for quote in cluster.quotes}
    anchor_quote = by_book.get(anchor_book)
    if anchor_quote is None:
        return None, []
    anchor = _chip_for_quote(anchor_quote, side)
    if anchor is None:
        return None, []
    books: list[WnbaPropBoardBookChip] = []
    for book in BOOK_CHIP_ORDER:
        if book == anchor_book:
            continue
        quote = by_book.get(book)
        if quote is None:
            continue
        chip = _chip_for_quote(quote, side)
        if chip is not None:
            books.append(chip)
    return anchor, books


def _row_sort_key(row: WnbaPropBoardRow) -> tuple:
    start = row.game_start_at
    start_key = (
        (1, datetime.max.replace(tzinfo=timezone.utc))
        if start is None
        else (0, start)
    )
    return (
        start_key,
        (row.player_name or "").casefold(),
        row.stat,
        0 if row.side == "over" else 1,
        row.line,
    )


def _player_context(
    players: dict[str, str],
    roster: dict[str, Any],
    game_by_team: dict[str, dict[str, Any]],
) -> dict[str, PlayerCtx]:
    out: dict[str, PlayerCtx] = {}
    for player_key, player_name in players.items():
        entry = roster.get(norm_player_name(player_name)) or roster.get(player_key)
        team = None
        headshot = None
        if entry:
            team = canonical_abbrev(entry.get("team_abbrev") or "")
            headshot = entry.get("headshot_url")
        game = game_by_team.get(team) if team else None
        out[player_key] = {
            "team_abbrev": team or None,
            "headshot_url": headshot,
            "opponent_abbrev": None if game is None else game.get("opponent_abbrev"),
            "home_away": None if game is None else game.get("home_away"),
            "game_id": None if game is None else game.get("game_id"),
            "game_start_at": None if game is None else game.get("game_start_at"),
            "game_status": None if game is None else game.get("game_status"),
            "splits": [],
            "splits_prev": [],
        }
    return out


def _game_index_from_scoreboard(board: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for game in getattr(board, "games", []) or []:
        home = canonical_abbrev(
            getattr(getattr(game, "home", None), "abbrev", None) or ""
        )
        away = canonical_abbrev(
            getattr(getattr(game, "away", None), "abbrev", None) or ""
        )
        start = _as_datetime(getattr(game, "start_time_et", None))
        status = getattr(game, "status", None)
        game_id = str(
            getattr(game, "espn_event_id", None) or getattr(game, "id", None) or ""
        ).strip() or None
        if home:
            out[home] = {
                "opponent_abbrev": away or None,
                "game_id": game_id,
                "game_start_at": start,
                "game_status": status,
                "home_away": "home",
            }
        if away:
            out[away] = {
                "opponent_abbrev": home or None,
                "game_id": game_id,
                "game_start_at": start,
                "game_status": status,
                "home_away": "away",
            }
    return out


def _stamp_opponent_abbrev(splits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stamped: list[dict[str, Any]] = []
    for split in splits:
        row = dict(split)
        abbrev = opponent_abbrev_from_split(row)
        if abbrev:
            row["opponent_abbrev"] = abbrev
        stamped.append(row)
    return stamped


def stats_player_id_index(rows: list[dict[str, Any]]) -> dict[str, str]:
    """Map match_player_key → stats.wnba.com id from dash or commonallplayers rows."""
    out: dict[str, str] = {}
    for row in rows:
        name = str(
            row.get("PLAYER_NAME")
            or row.get("DISPLAY_FIRST_LAST")
            or row.get("PLAYER")
            or ""
        ).strip()
        player_id = str(row.get("PLAYER_ID") or row.get("PERSON_ID") or "").strip()
        if not name or not player_id:
            continue
        out.setdefault(match_player_key(name), player_id)
    return out


async def _attach_game_logs(
    player_ctx: dict[str, PlayerCtx],
    players: dict[str, str],
    missing_person: set[str],
) -> bool:
    """Fill splits from the daily season-log cache. True when that cache is empty."""
    try:
        logs = await load_season_logs("wnba")
    except Exception as exc:
        logger.warning("WNBA board season logs unavailable: %s", exc)
        return True
    if not logs.get("player_base"):
        return True
    for player_key, player_name in players.items():
        splits = player_base_splits(logs, player_name)
        if not splits:
            missing_person.add(player_key)
            continue
        ctx = player_ctx.setdefault(player_key, {})
        ctx["splits"] = _stamp_opponent_abbrev(splits)
        ctx["h2h_splits"] = _stamp_opponent_abbrev(h2h_splits(logs, player_name))
        ctx["splits_prev"] = []
    return False


def _h2h_games(
    ctx: PlayerCtx,
    splits: list[dict[str, Any]],
    splits_prev: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if "h2h_splits" in ctx:
        return list(ctx["h2h_splits"] or [])
    return [
        row for row in splits if row.get("SEASON_TYPE") != "Pre Season"
    ] + splits_prev
