"""Assemble GET /api/nba/props/board from seven Supabase book snapshots."""

from __future__ import annotations

import asyncio
import inspect
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.core.odds_snapshots import (
    fetch_latest_draftkings,
    fetch_latest_fanduel,
    fetch_latest_novig,
    fetch_latest_pinnacle,
    fetch_latest_prizepicks,
    fetch_latest_prophetx,
    fetch_latest_underdog,
)
from app.domains.betting.player_match_keys import match_player_key
from app.domains.betting.prop_stat_keys import (
    canonical_stat_key_from_pp,
    canonical_stat_key_from_ud,
    display_stat_label,
)
from app.domains.nba.prop_board_cluster import (
    BOOK_CHIP_ORDER,
    BoardQuote,
    Cluster,
    cluster_quotes,
    consensus_ip_pct,
    round_line,
)
from app.domains.nba.prop_board_form import (
    h2h_rate,
    hit_rates,
    opponent_abbrev_from_split,
)
from app.domains.nba.prop_board_logs import (
    current_nba_season,
    fetch_commonallplayers,
    fetch_leaguedashplayerstats,
    fetch_playergamelog,
    rows_as_dicts,
)
from app.domains.nba.prop_board_mains import (
    MainLineIndex,
    _as_datetime,
    _main_from_snapshot_rows,
    _parse_american,
)
from app.domains.nba.schemas_prop_board import (
    NbaPropBoardBookChip,
    NbaPropBoardResponse,
    NbaPropBoardRow,
    Side,
)
from app.domains.nba.scoreboard import get_today_scoreboard
from app.providers.espn.nba_roster import get_nba_player_index, norm_player_name

logger = logging.getLogger(__name__)


class UnknownBoardBookError(ValueError):
    """Raised when ``book`` is not one of the NBA board's seven books."""


PRIZEPICKS_AMERICAN = -137
_VALID_SIDES: tuple[str, ...] = ("over", "under")
_PERSON_LOOKUP_CONCURRENCY = 8
_LOG_TTL_SECONDS = 15 * 60

PlayerCtx = dict[str, Any]
Enrichment = tuple[dict[str, PlayerCtx], list[str], set[str]]

# (player_id, season) -> (monotonic timestamp, game-log rows)
_log_cache: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}


def collect_board_quotes() -> list[BoardQuote]:
    """Load main lines from the seven NBA board books."""
    names: dict[str, str] = {}
    quotes: list[BoardQuote] = []

    exchange_fetchers = (
        ("prophetx", fetch_latest_prophetx),
        ("novig", fetch_latest_novig),
    )
    for book, fetcher in exchange_fetchers:
        rows = fetcher("nba", mains_only=True)
        _remember_names(names, rows)
        quotes.extend(
            _quotes_from_mains(
                book,
                _main_from_snapshot_rows(
                    rows,
                    player_field="player_name",
                    stat_field="stat_name",
                ),
                names,
            )
        )

    sportsbook_fetchers = (
        ("pinnacle", fetch_latest_pinnacle),
        ("draftkings", fetch_latest_draftkings),
        ("fanduel", fetch_latest_fanduel),
    )
    for book, fetcher in sportsbook_fetchers:
        rows = fetcher("nba")
        _remember_names(names, rows)
        quotes.extend(
            _quotes_from_mains(
                book,
                _main_from_snapshot_rows(
                    rows,
                    player_field="player_name",
                    stat_field="market_type",
                ),
                names,
            )
        )

    quotes.extend(_prizepicks_quotes(fetch_latest_prizepicks("nba")))
    quotes.extend(_underdog_quotes(fetch_latest_underdog("nba")))
    return quotes


async def load_enrichment(clusters: list[Cluster] | None = None) -> Enrichment:
    """Attach ESPN roster/scoreboard context and stats.nba.com game logs."""
    clusters = clusters or []
    if not clusters:
        return {}, [], set()

    players = {cluster.player_key: cluster.player_name for cluster in clusters}
    warnings: list[str] = []
    missing_person: set[str] = set()

    roster: dict[str, Any] = {}
    try:
        roster = await get_nba_player_index()
    except Exception as exc:
        logger.warning("NBA board roster enrichment skipped: %s", exc)

    game_by_team: dict[str, dict[str, Any]] = {}
    try:
        game_by_team = _game_index_from_scoreboard(await get_today_scoreboard())
    except Exception as exc:
        logger.warning("NBA board scoreboard enrichment skipped: %s", exc)

    player_ctx = _player_context(players, roster, game_by_team)
    try:
        if await _attach_game_logs(player_ctx, players, missing_person):
            warnings.append("gamelogs_unavailable")
    except Exception as exc:
        logger.warning("NBA board game logs unavailable: %s", exc)
        warnings.append("gamelogs_unavailable")

    return player_ctx, warnings, missing_person


def resolve_board_book(book: str | None) -> str:
    if book is None:
        return "prizepicks"
    if book not in BOOK_CHIP_ORDER:
        raise UnknownBoardBookError(book)
    return book


async def get_nba_prop_board(book: str | None = None) -> NbaPropBoardResponse:
    anchor_book = resolve_board_book(book)
    clusters = [
        cluster
        for cluster in cluster_quotes(collect_board_quotes())
        if any(quote.book == anchor_book for quote in cluster.quotes)
    ]
    loaded = load_enrichment(clusters)
    if inspect.isawaitable(loaded):
        loaded = await loaded
    player_ctx, warnings, missing_person = loaded

    rows: list[NbaPropBoardRow] = []
    for cluster in clusters:
        ctx = player_ctx.get(cluster.player_key) or {}
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
                    splits + splits_prev,
                    opponent,
                )
            anchor, book_chips = _anchor_and_matches(cluster, side, anchor_book)
            if anchor is None:
                continue
            rows.append(
                NbaPropBoardRow(
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
    return NbaPropBoardResponse(
        as_of=datetime.now(timezone.utc),
        warnings=warnings,
        rows=rows,
    )


def _market_label(side: str, line: float, stat: str) -> str:
    return f"{side.title()} {line} {display_stat_label(stat)}"


def _remember_names(names: dict[str, str], rows: list[dict[str, Any]]) -> None:
    for row in rows:
        player = str(row.get("player_name") or "").strip()
        if player:
            names.setdefault(match_player_key(player), player)


def _quotes_from_mains(
    book: str,
    mains: MainLineIndex,
    names: dict[str, str],
) -> list[BoardQuote]:
    quotes: list[BoardQuote] = []
    for (player_key, stat), main in mains.items():
        name = names.get(player_key)
        if not player_key or not stat or not name:
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
        stat = canonical_stat_key_from_pp(str(row.get("stat_type") or "").strip())
        line = _parse_line(row.get("line_score"))
        player_key = match_player_key(player)
        if not player or stat is None or line is None or not player_key:
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
        stat = canonical_stat_key_from_ud(str(row.get("stat_name") or "").strip())
        side = str(row.get("side") or "").lower()
        line = _parse_line(row.get("line_score"))
        player_key = match_player_key(player)
        if (
            not player
            or stat is None
            or side not in _VALID_SIDES
            or line is None
            or not player_key
        ):
            continue
        rounded_line = round_line(line)
        key = (player_key, stat, rounded_line)
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
            line=rounded_line,
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


def _chip_for_quote(
    quote: BoardQuote,
    side: Side,
) -> NbaPropBoardBookChip | None:
    american = _side_american(quote, side)
    if american is None:
        return None
    return NbaPropBoardBookChip(
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
) -> tuple[NbaPropBoardBookChip | None, list[NbaPropBoardBookChip]]:
    by_book = {quote.book: quote for quote in cluster.quotes}
    anchor_quote = by_book.get(anchor_book)
    if anchor_quote is None:
        return None, []
    anchor = _chip_for_quote(anchor_quote, side)
    if anchor is None:
        return None, []
    books: list[NbaPropBoardBookChip] = []
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


def _row_sort_key(row: NbaPropBoardRow) -> tuple:
    start_key = (
        (1, datetime.max.replace(tzinfo=timezone.utc))
        if row.game_start_at is None
        else (0, row.game_start_at)
    )
    return (
        start_key,
        row.player_name.casefold(),
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
        team = (
            str(entry.get("team_abbrev") or "").strip().upper()
            if entry
            else ""
        )
        game = game_by_team.get(team) if team else None
        out[player_key] = {
            "team_abbrev": team or None,
            "headshot_url": None if not entry else entry.get("headshot_url"),
            "opponent_abbrev": None if game is None else game.get("opponent_abbrev"),
            "home_away": None if game is None else game.get("home_away"),
            "game_id": None if game is None else game.get("game_id"),
            "game_start_at": None if game is None else game.get("game_start_at"),
            "splits": [],
            "splits_prev": [],
        }
    return out


def _game_index_from_scoreboard(board: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for game in getattr(board, "games", []) or []:
        home = str(getattr(getattr(game, "home", None), "abbrev", "")).upper()
        away = str(getattr(getattr(game, "away", None), "abbrev", "")).upper()
        start = _as_datetime(getattr(game, "start_time_et", None))
        game_id = str(
            getattr(game, "espn_event_id", None) or getattr(game, "id", None) or ""
        ).strip() or None
        if home:
            out[home] = {
                "opponent_abbrev": away or None,
                "game_id": game_id,
                "game_start_at": start,
                "home_away": "home",
            }
        if away:
            out[away] = {
                "opponent_abbrev": home or None,
                "game_id": game_id,
                "game_start_at": start,
                "home_away": "away",
            }
    return out


def _stamp_opponent_abbrev(
    splits: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    stamped: list[dict[str, Any]] = []
    for split in splits:
        row = dict(split)
        opponent = opponent_abbrev_from_split(row)
        if opponent:
            row["opponent_abbrev"] = opponent
        stamped.append(row)
    return stamped


def stats_player_id_index(rows: list[dict[str, Any]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in rows:
        name = str(
            row.get("PLAYER_NAME")
            or row.get("DISPLAY_FIRST_LAST")
            or row.get("PLAYER")
            or ""
        ).strip()
        player_id = str(row.get("PLAYER_ID") or row.get("PERSON_ID") or "").strip()
        if name and player_id:
            out.setdefault(match_player_key(name), player_id)
    return out


async def _stats_name_to_id(season: str) -> dict[str, str]:
    for fetcher in (fetch_commonallplayers, fetch_leaguedashplayerstats):
        try:
            index = stats_player_id_index(rows_as_dicts(await fetcher(season)))
            if index:
                return index
        except Exception as exc:
            logger.warning(
                "NBA board player-id source %s failed: %s",
                fetcher.__name__,
                exc,
            )
    return {}


async def _attach_game_logs(
    player_ctx: dict[str, PlayerCtx],
    players: dict[str, str],
    missing_person: set[str],
) -> bool:
    sem = asyncio.Semaphore(_PERSON_LOOKUP_CONCURRENCY)
    logs_failed = False
    season = current_nba_season()
    name_to_id = await _stats_name_to_id(season)
    if not name_to_id:
        return True

    async def one(player_key: str, player_name: str) -> None:
        nonlocal logs_failed
        async with sem:
            player_id = name_to_id.get(player_key) or name_to_id.get(
                match_player_key(player_name)
            )
            if not player_id:
                missing_person.add(player_key)
                return
            ctx = player_ctx.setdefault(player_key, {})
            try:
                ctx["splits"] = _stamp_opponent_abbrev(
                    await _cached_game_log(player_id, season)
                )
            except Exception as exc:
                logger.warning(
                    "NBA board gamelog failed %s season=%s: %s",
                    player_id,
                    season,
                    exc,
                )
                logs_failed = True
            ctx["splits_prev"] = []

    await asyncio.gather(*(one(key, name) for key, name in players.items()))
    return logs_failed


async def _cached_game_log(
    player_id: str,
    season: str,
) -> list[dict[str, Any]]:
    cache_key = (player_id, season)
    cached = _log_cache.get(cache_key)
    now = time.monotonic()
    if cached is not None and now - cached[0] < _LOG_TTL_SECONDS:
        return cached[1]
    splits = rows_as_dicts(await fetch_playergamelog(player_id, season))
    _log_cache[cache_key] = (now, splits)
    return splits
