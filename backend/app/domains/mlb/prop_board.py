"""Assemble GET /api/mlb/props/board from sportsbook mains + DFS lines."""

from __future__ import annotations

import asyncio
import inspect
import logging
import time
from datetime import datetime, timezone
from typing import Any, Literal

import httpx

from app.core.odds_snapshots import (
    fetch_latest_novig,
    fetch_latest_parlay_api_odds,
    fetch_latest_pinnacle,
    fetch_latest_prizepicks,
    fetch_latest_prophetx,
    fetch_latest_underdog,
)
from app.domains.betting.player_match_keys import match_player_key
from app.domains.mlb.leaders import current_mlb_season_year
from app.domains.mlb.prop_board_cluster import (
    BOOK_CHIP_ORDER,
    BoardQuote,
    Cluster,
    cluster_quotes,
    ip_pct_for_side,
    round_line,
)
from app.domains.mlb.prop_board_form import hit_rates
from app.domains.mlb.prop_board_ranks import (
    TeamRankRow,
    build_team_rank_index,
    def_and_pace_ranks,
    is_pitcher_stat,
)
from app.domains.mlb.prop_stat_keys import (
    canonical_stat_key_from_pp_mlb,
    canonical_stat_key_from_ud_mlb,
    display_stat_label,
)
from app.domains.mlb.props import (
    MainLineIndex,
    _as_datetime,
    _main_from_side_index,
    _main_from_snapshot_rows,
    _parse_american,
    index_parlay_api_odds_by_book,
)
from app.domains.mlb.schemas_prop_board import (
    MlbPropBoardBookChip,
    MlbPropBoardResponse,
    MlbPropBoardRow,
    Side,
)
from app.domains.mlb.scoreboard import get_today_scoreboard
from app.domains.mlb.standings import fetch_team_abbrev_map
from app.domains.mlb.team_names import canonical_mlb_abbrev
from app.providers.espn.mlb_roster import get_mlb_player_index
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.mlb_stats.people import (
    STATS_TIMEOUT_SECONDS,
    fetch_game_log_splits,
    search_person_id,
)
from app.providers.mlb_stats.team_season import fetch_league_group_splits

logger = logging.getLogger(__name__)

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
_PERSON_LOOKUP_CONCURRENCY = 8
_LOG_TTL_SECONDS = 15 * 60

PlayerCtx = dict[str, Any]
Enrichment = tuple[dict[str, PlayerCtx], dict[str, TeamRankRow], list[str], set[str]]

# (person_id, group, season) -> (monotonic_ts, splits)
_log_cache: dict[tuple[int, str, int], tuple[float, list[dict[str, Any]]]] = {}


def collect_board_quotes() -> list[BoardQuote]:
    """Load sportsbook mains + DFS mains as ``BoardQuote``s.

    Parlay snapshot miss appends ``parlay_unavailable`` on
    ``collect_board_quotes.warnings`` (never raises).
    """
    warnings: list[str] = []
    names: dict[str, str] = {}
    quotes: list[BoardQuote] = []

    px_rows = fetch_latest_prophetx("mlb", mains_only=True)
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

    novig_rows = fetch_latest_novig("mlb", mains_only=True)
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

    # Pinnacle player snapshots have no is_main column; balance-pick mains.
    pin_rows = fetch_latest_pinnacle("mlb")
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
        snap_rows = fetch_latest_parlay_api_odds("mlb")
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

    quotes.extend(_prizepicks_quotes(fetch_latest_prizepicks("mlb")))
    quotes.extend(_underdog_quotes(fetch_latest_underdog("mlb")))

    collect_board_quotes.warnings = warnings
    return quotes


collect_board_quotes.warnings = []  # type: ignore[attr-defined]


async def load_enrichment(clusters: list[Cluster] | None = None) -> Enrichment:
    """Roster, scoreboard, team ranks, and game logs for clustered players.

    Soft-fails ranks and logs independently. Missing Stats API person_id is
    recorded in the returned set so L# stay null for that player only.
    """
    clusters = clusters or []
    if not clusters:
        return {}, {}, [], set()
    warnings: list[str] = []
    missing_person: set[str] = set()
    players: dict[str, str] = {}
    stats_needed: dict[str, set[str]] = {}
    for cluster in clusters:
        players[cluster.player_key] = cluster.player_name
        stats_needed.setdefault(cluster.player_key, set()).add(cluster.stat)

    roster: dict[str, Any] = {}
    try:
        roster = await get_mlb_player_index()
    except Exception as exc:
        logger.warning("MLB board roster enrichment skipped: %s", exc)

    game_by_team: dict[str, dict[str, Any]] = {}
    try:
        game_by_team = _game_index_from_scoreboard(await get_today_scoreboard())
    except Exception as exc:
        logger.warning("MLB board scoreboard enrichment skipped: %s", exc)

    player_ctx = _player_context(players, roster, game_by_team)
    ranks: dict[str, TeamRankRow] = {}

    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        season = current_mlb_season_year()
        try:
            ranks = await _load_team_ranks(client, season)
        except Exception as exc:
            logger.warning("MLB board team ranks unavailable: %s", exc)
            warnings.append("team_ranks_unavailable")

        try:
            await _attach_game_logs(
                client,
                season,
                player_ctx,
                players,
                stats_needed,
                missing_person,
            )
        except Exception as exc:
            logger.warning("MLB board game logs unavailable: %s", exc)
            warnings.append("gamelogs_unavailable")

    return player_ctx, ranks, warnings, missing_person


async def get_mlb_prop_board() -> MlbPropBoardResponse:
    warnings: list[str] = []
    quotes = collect_board_quotes()
    warnings.extend(getattr(collect_board_quotes, "warnings", []) or [])

    clusters = cluster_quotes(quotes)
    loaded = load_enrichment(clusters)
    if inspect.isawaitable(loaded):
        loaded = await loaded
    player_ctx, ranks, extra_warnings, missing_person = loaded
    warnings.extend(extra_warnings)

    rows: list[MlbPropBoardRow] = []
    for cluster in clusters:
        ctx = player_ctx.get(cluster.player_key) or {}
        opponent = ctx.get("opponent_abbrev")
        def_r, def_l, pace_r, pace_l = def_and_pace_ranks(
            cluster.stat, opponent, ranks
        )
        group = "pitching" if is_pitcher_stat(cluster.stat) else "hitting"
        splits = ctx.get(f"splits_{group}") or []
        skip_hits = cluster.player_key in missing_person
        sides: tuple[Side, ...] = ("over", "under")
        for side in sides:
            if skip_hits or not splits:
                l5 = l10 = l15 = None
            else:
                l5, l10, l15 = hit_rates(cluster.stat, side, cluster.line, splits)
            rows.append(
                MlbPropBoardRow(
                    player_name=cluster.player_name,
                    headshot_url=ctx.get("headshot_url"),
                    team_abbrev=ctx.get("team_abbrev"),
                    opponent_abbrev=opponent,
                    home_away=ctx.get("home_away"),
                    stat=cluster.stat,
                    market_label=_market_label(side, cluster.line, cluster.stat),
                    side=side,
                    line=cluster.line,
                    game_pk=ctx.get("game_pk"),
                    game_start_at=ctx.get("game_start_at"),
                    books=_chips_for_side(cluster, side),
                    ip_pct=ip_pct_for_side(cluster, side),
                    opp_def_rank=def_r,
                    opp_def_label=def_l,
                    opp_pace_rank=pace_r,
                    opp_pace_label=pace_l,
                    hit_l5=l5,
                    hit_l10=l10,
                    hit_l15=l15,
                )
            )

    rows.sort(key=_row_sort_key)
    return MlbPropBoardResponse(
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
        stat = canonical_stat_key_from_pp_mlb(stat_raw)
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
        stat = canonical_stat_key_from_ud_mlb(stat_raw)
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


def _chips_for_side(cluster: Cluster, side: Side) -> list[MlbPropBoardBookChip]:
    by_book = {quote.book: quote for quote in cluster.quotes}
    chips: list[MlbPropBoardBookChip] = []
    for book in BOOK_CHIP_ORDER:
        quote = by_book.get(book)
        if quote is None:
            continue
        american = quote.over_american if side == "over" else quote.under_american
        chips.append(
            MlbPropBoardBookChip(book=book, american=american, url=quote.url)
        )
    return chips


def _row_sort_key(row: MlbPropBoardRow) -> tuple:
    # None start times sort last; Over before Under.
    start = row.game_start_at
    start_key = (1, datetime.max.replace(tzinfo=timezone.utc)) if start is None else (0, start)
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
            team = canonical_mlb_abbrev(entry.get("team_abbrev"))
            headshot = entry.get("headshot_url")
        game = game_by_team.get(team) if team else None
        out[player_key] = {
            "team_abbrev": team,
            "headshot_url": headshot,
            "opponent_abbrev": None if game is None else game.get("opponent_abbrev"),
            "home_away": None if game is None else game.get("home_away"),
            "game_pk": None if game is None else game.get("game_pk"),
            "game_start_at": None if game is None else game.get("game_start_at"),
            "splits_hitting": [],
            "splits_pitching": [],
        }
    return out


def _game_index_from_scoreboard(board: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for game in getattr(board, "games", []) or []:
        home = canonical_mlb_abbrev(getattr(getattr(game, "home", None), "abbrev", None))
        away = canonical_mlb_abbrev(getattr(getattr(game, "away", None), "abbrev", None))
        start = _as_datetime(getattr(game, "start_time_et", None))
        try:
            game_pk = int(getattr(game, "mlb_game_pk"))
        except (TypeError, ValueError):
            game_pk = None
        if home:
            out[home] = {
                "opponent_abbrev": away,
                "game_pk": game_pk,
                "game_start_at": start,
                "home_away": "home",
            }
        if away:
            out[away] = {
                "opponent_abbrev": home,
                "game_pk": game_pk,
                "game_start_at": start,
                "home_away": "away",
            }
    return out


def _annotate_splits_with_abbrev(
    splits: list[dict[str, Any]],
    id_to_abbrev: dict[int, str],
) -> list[dict[str, Any]]:
    annotated: list[dict[str, Any]] = []
    for split in splits:
        team = split.get("team") or {}
        team_id = team.get("id") if isinstance(team, dict) else None
        abbrev = None
        if team_id is not None:
            try:
                abbrev = id_to_abbrev.get(int(team_id))
            except (TypeError, ValueError):
                abbrev = None
        if not abbrev and isinstance(team, dict):
            abbrev = canonical_mlb_abbrev(team.get("abbreviation"))
        if not abbrev:
            abbrev = canonical_mlb_abbrev(split.get("abbrev"))
        if not abbrev:
            continue
        row = dict(split)
        row["abbrev"] = abbrev
        annotated.append(row)
    return annotated


async def _load_team_ranks(
    client: httpx.AsyncClient, season: int
) -> dict[str, TeamRankRow]:
    hitting, pitching, id_to_abbrev = await asyncio.gather(
        fetch_league_group_splits(client, group="hitting", season=season),
        fetch_league_group_splits(client, group="pitching", season=season),
        fetch_team_abbrev_map(client, season),
    )
    return build_team_rank_index(
        _annotate_splits_with_abbrev(hitting, id_to_abbrev),
        _annotate_splits_with_abbrev(pitching, id_to_abbrev),
    )


async def _attach_game_logs(
    client: httpx.AsyncClient,
    season: int,
    player_ctx: dict[str, PlayerCtx],
    players: dict[str, str],
    stats_needed: dict[str, set[str]],
    missing_person: set[str],
) -> None:
    sem = asyncio.Semaphore(_PERSON_LOOKUP_CONCURRENCY)

    async def one(player_key: str, player_name: str) -> None:
        async with sem:
            person_id = await search_person_id(client, player_name)
            if person_id is None:
                missing_person.add(player_key)
                return
            groups: set[Literal["hitting", "pitching"]] = set()
            for stat in stats_needed.get(player_key, ()):
                groups.add("pitching" if is_pitcher_stat(stat) else "hitting")
            ctx = player_ctx.setdefault(player_key, {})
            for group in groups:
                ctx[f"splits_{group}"] = await _cached_game_log(
                    client, person_id, season, group
                )

    await asyncio.gather(*(one(key, name) for key, name in players.items()))


async def _cached_game_log(
    client: httpx.AsyncClient,
    person_id: int,
    season: int,
    group: Literal["hitting", "pitching"],
) -> list[dict[str, Any]]:
    cache_key = (person_id, group, season)
    cached = _log_cache.get(cache_key)
    now = time.monotonic()
    if cached is not None and now - cached[0] < _LOG_TTL_SECONDS:
        return cached[1]
    splits = await fetch_game_log_splits(client, person_id, season, group)
    _log_cache[cache_key] = (now, splits)
    return splits
