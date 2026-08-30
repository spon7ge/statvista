"""Assemble GET /api/wnba/legs: DFS seed → exact-line two-ways → pricer."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.core import odds_snapshots
from app.core.wnba_abbrevs import canonical_abbrev
from app.domains.betting.legs_pack import PackablePlay, pack_entries
from app.domains.betting.legs_payouts import (
    base_break_even,
    base_required_margin_pts,
    validate_legs_query,
)
from app.domains.betting.legs_pricer import (
    EXCHANGES,
    HOLD_MAX,
    HOLD_MULT_MAX,
    SHARP,
    SHARP_MAX_AGE,
    SUPPORT_MAX_AGE,
    WEIGHTS,
    BookQuote,
    PlayResult,
    RejectResult,
    american_to_prob,
    devig_over,
    price_line,
)
from app.domains.betting.player_match_keys import match_player_key
from app.domains.betting.prop_stat_keys import (
    canonical_stat_key_from_exchange,
    canonical_stat_key_from_pp,
    canonical_stat_key_from_ud,
    display_stat_label,
)
from app.domains.wnba import scoreboard as scoreboard_mod
from app.domains.wnba.props import (
    SideIndex,
    _as_datetime,
    _index_snapshot_rows,
    index_parlay_api_odds_by_book,
)
from app.domains.wnba.schemas_legs import (
    WnbaLegsBookExcluded,
    WnbaLegsBookUsed,
    WnbaLegsEntry,
    WnbaLegsPlay,
    WnbaLegsRejectedSummary,
    WnbaLegsResponse,
)
from app.domains.wnba.schemas_scoreboard import WnbaGame
from app.providers.espn import wnba_roster
from app.providers.espn.wnba_roster import norm_player_name

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 300
_PARLAY_BOOKS = ("draftkings", "fanduel", "betmgm", "caesars")
_LOCKED = frozenset({"live", "halftime", "final"})

# Spec research copy: not a tipster feed; no locks / guaranteed EV; not a parlay.
LEGS_DISCLAIMERS = (
    "statvista research only. No locks or guaranteed EV.",
    "This is not a tipster feed and not a ranked copy of Props.",
    "Ranked legs are not an entry. This list is not a parlay.",
)

_cache: dict[tuple[str, str, int], dict[str, Any]] = {}


def clear_wnba_legs_cache() -> None:
    _cache.clear()


def _empty_rejected_summary() -> WnbaLegsRejectedSummary:
    return WnbaLegsRejectedSummary(
        insufficient_coverage=0,
        insufficient_sharp=0,
        below_threshold=0,
        unpriceable_payout=0,
        unpacked_remainder=0,
    )


def _parse_stake(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _line_key(line: float) -> float:
    return round(float(line), 2)


def _index_with_stake(
    rows: list[dict[str, Any]],
    *,
    player_field: str,
    stat_field: str,
) -> SideIndex:
    """Reuse Props SideIndex matching, then attach exchange stake when present."""
    index = _index_snapshot_rows(
        rows, player_field=player_field, stat_field=stat_field
    )
    for row in rows:
        player = str(row.get(player_field) or "").strip()
        stat_raw = str(row.get(stat_field) or "").strip()
        side = str(row.get("side") or "").lower()
        if not player or side not in ("over", "under"):
            continue
        stat_key = canonical_stat_key_from_exchange(stat_raw)
        if stat_key is None:
            continue
        try:
            line_f = _line_key(float(row["line_score"]))
        except (TypeError, ValueError, KeyError):
            continue
        key = (match_player_key(player), stat_key, side, line_f)
        hit = index.get(key)
        if hit is not None:
            hit["stake"] = _parse_stake(row.get("stake"))
    return index


def _two_way_at_line(
    index: SideIndex,
    *,
    player_key: str,
    stat: str,
    line: float,
    book: str,
    now: datetime,
) -> BookQuote | None:
    """Pair over+under at the exact DFS line. Missing either side is not a quote."""
    line_k = _line_key(line)
    over = index.get((player_key, stat, "over", line_k))
    under = index.get((player_key, stat, "under", line_k))
    if over is None or under is None:
        return None
    over_am = over.get("american")
    under_am = under.get("american")
    if over_am is None or under_am is None:
        return None
    ages: list[float] = []
    for hit in (over, under):
        dt = hit.get("changed_at")
        if not isinstance(dt, datetime):
            dt = _as_datetime(dt)
        if dt is None:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        ages.append((now - dt.astimezone(timezone.utc)).total_seconds() / 60.0)
    return BookQuote(
        book=book,
        line=line_k,
        over=int(over_am),
        under=int(under_am),
        stake_over=_parse_stake(over.get("stake")),
        stake_under=_parse_stake(under.get("stake")),
        age_minutes=max(ages) if ages else 0.0,
    )


def _seed_lines(app: str, rows: list[dict[str, Any]]) -> dict[tuple[str, str, float], dict[str, Any]]:
    """One candidate per (player_key, stat, line). PP: odds_type standard only."""
    buckets: dict[tuple[str, str, float], dict[str, Any]] = {}
    for row in rows:
        player = str(row.get("player_name") or "").strip()
        line_raw = row.get("line_score")
        if not player or line_raw is None:
            continue
        try:
            line_f = _line_key(float(line_raw))
        except (TypeError, ValueError):
            continue

        if app == "prizepicks":
            if str(row.get("odds_type") or "").lower() != "standard":
                continue
            stat_type = str(row.get("stat_type") or "").strip()
            if not stat_type:
                continue
            stat_key = canonical_stat_key_from_pp(stat_type)
            if stat_key is None:
                continue
            multiplier = 1.0
            stat_label = display_stat_label(stat_key, fallback=stat_type)
        else:
            stat_name = str(row.get("stat_name") or "").strip()
            if not stat_name:
                continue
            stat_key = canonical_stat_key_from_ud(stat_name)
            if stat_key is None:
                continue
            raw_m = row.get("payout_multiplier")
            if raw_m is None:
                multiplier = 1.0
            else:
                try:
                    multiplier = float(raw_m)
                except (TypeError, ValueError):
                    continue
            if multiplier <= 0:
                continue
            stat_label = display_stat_label(stat_key, fallback=stat_name)

        key = (match_player_key(player), stat_key, line_f)
        scraped = _as_datetime(row.get("scraped_at"))
        bucket = buckets.setdefault(
            key,
            {
                "player": player,
                "stat_key": stat_key,
                "stat_label": stat_label,
                "line": line_f,
                "payout_multiplier": multiplier,
                "scraped_at": scraped,
            },
        )
        if scraped is not None:
            prev = bucket.get("scraped_at")
            if prev is None or scraped > prev:
                bucket["scraped_at"] = scraped
    return buckets


def _quotes_for_line(
    book_indexes: dict[str, SideIndex],
    *,
    player_key: str,
    stat: str,
    line: float,
    now: datetime,
) -> list[BookQuote]:
    # Coverage counts books, not duplicate snapshot rows.
    quotes: list[BookQuote] = []
    seen: set[str] = set()
    for book, index in book_indexes.items():
        if book in seen:
            continue
        quote = _two_way_at_line(
            index,
            player_key=player_key,
            stat=stat,
            line=line,
            book=book,
            now=now,
        )
        if quote is None:
            continue
        quotes.append(quote)
        seen.add(book)
    return quotes


def _exclude_reason(quote: BookQuote, dfs_line: float) -> str:
    if quote.line != dfs_line or quote.book not in WEIGHTS:
        return "excluded"
    max_age = SHARP_MAX_AGE if quote.book in SHARP else SUPPORT_MAX_AGE
    if quote.age_minutes > max_age:
        return "stale_quote"
    if quote.book in EXCHANGES:
        so, su = quote.stake_over, quote.stake_under
        if so is None or su is None or so <= 0 or su <= 0:
            return "thin_or_one_sided"
    p_over = american_to_prob(quote.over)
    p_under = american_to_prob(quote.under)
    if p_over + p_under - 1.0 > HOLD_MAX:
        return "hold_too_high"
    if devig_over(p_over, p_under) is None:
        return "power_devig_unsolved"
    return "excluded"


def _book_used(quote: BookQuote, side: str) -> WnbaLegsBookUsed:
    p_over = american_to_prob(quote.over)
    p_under = american_to_prob(quote.under)
    hold = p_over + p_under - 1.0
    fair_over = devig_over(p_over, p_under) or p_over / (p_over + p_under)
    return WnbaLegsBookUsed(
        book=quote.book,
        line=quote.line,
        over=quote.over,
        under=quote.under,
        hold=hold,
        devig="multiplicative" if hold <= HOLD_MULT_MAX else "power",
        weight=WEIGHTS[quote.book],
        devigged_prob=fair_over if side == "over" else 1.0 - fair_over,
    )


def _team_game_index(games: list[WnbaGame]) -> dict[str, WnbaGame]:
    # ESPN roster stores raw tricodes (LV); scoreboard is usually canonical (LVA).
    by_team: dict[str, WnbaGame] = {}
    for game in games:
        by_team[canonical_abbrev(game.away.abbrev)] = game
        by_team[canonical_abbrev(game.home.abbrev)] = game
    return by_team


def _envelope(
    *,
    now: datetime,
    app: str,
    format: str,
    legs: int,
    dfs_age: float | None,
    lines_seeded: int,
    legs_evaluated: int,
    entries: list[WnbaLegsEntry],
    rejected: WnbaLegsRejectedSummary,
    warnings: list[str],
) -> WnbaLegsResponse:
    reject_dump = rejected.model_dump()
    packed_plays = [play for entry in entries for play in entry.legs]
    surfaced = sum(len(e.legs) for e in entries)
    assert legs_evaluated == surfaced + sum(reject_dump.values())
    ratio = None
    if legs_evaluated > 0:
        ratio = (
            rejected.insufficient_coverage + rejected.insufficient_sharp
        ) / legs_evaluated
        if legs_evaluated >= 20 and ratio >= 0.95:
            warnings.append("coverage_funnel_collapsed")
    be_values = [play.break_even for play in packed_plays]
    return WnbaLegsResponse(
        generated_at=now,
        slate=f"WNBA {now.date().isoformat()}",
        app=app,
        format=format,
        payouts_assumed=True,
        base_break_even=base_break_even(app, format, legs),
        break_even_min=min(be_values) if be_values else None,
        break_even_max=max(be_values) if be_values else None,
        base_required_margin_pts=base_required_margin_pts(app, format, legs),
        dfs_snapshot_age_minutes=dfs_age,
        lines_seeded=lines_seeded,
        legs_evaluated=legs_evaluated,
        legs_surfaced=surfaced,
        coverage_funnel_ratio=ratio,
        flex_same_game_warning=False,
        entries=entries,
        rejected_summary=rejected,
        warnings=warnings,
        disclaimers=list(LEGS_DISCLAIMERS),
    )


async def get_wnba_legs(*, app: str, format: str, legs: int) -> WnbaLegsResponse:
    validate_legs_query(app, format, legs)

    cache_key = (app, format, legs)
    now_mono = time.monotonic()
    cached = _cache.get(cache_key)
    if cached is not None and now_mono < cached["expires_at"]:
        return cached["response"]

    now = datetime.now(timezone.utc)
    warnings: list[str] = []

    if app == "prizepicks":
        dfs_rows = odds_snapshots.fetch_latest_prizepicks("wnba")
        empty_warning = "prizepicks_unavailable"
    else:
        dfs_rows = odds_snapshots.fetch_latest_underdog("wnba")
        empty_warning = "underdog_unavailable"

    seeded = _seed_lines(app, dfs_rows)
    lines_seeded = len(seeded)
    latest_seed = max(
        (bucket["scraped_at"] for bucket in seeded.values() if bucket.get("scraped_at")),
        default=None,
    )
    dfs_age = (
        (now - latest_seed).total_seconds() / 60.0 if latest_seed is not None else None
    )

    if lines_seeded == 0:
        warnings.append(empty_warning)
        response = _envelope(
            now=now,
            app=app,
            format=format,
            legs=legs,
            dfs_age=dfs_age,
            lines_seeded=0,
            legs_evaluated=0,
            entries=[],
            rejected=_empty_rejected_summary(),
            warnings=warnings,
        )
        _cache[cache_key] = {
            "response": response,
            "expires_at": now_mono + CACHE_TTL_SECONDS,
        }
        return response

    # Stale DFS: keep lines_seeded so a stale board is not an empty seed.
    if dfs_age is not None and dfs_age > 60:
        warnings.append("dfs_snapshot_stale")
        response = _envelope(
            now=now,
            app=app,
            format=format,
            legs=legs,
            dfs_age=dfs_age,
            lines_seeded=lines_seeded,
            legs_evaluated=0,
            entries=[],
            rejected=_empty_rejected_summary(),
            warnings=warnings,
        )
        _cache[cache_key] = {
            "response": response,
            "expires_at": now_mono + CACHE_TTL_SECONDS,
        }
        return response

    px_idx = _index_with_stake(
        odds_snapshots.fetch_latest_prophetx("wnba", mains_only=False),
        player_field="player_name",
        stat_field="stat_name",
    )
    novig_idx = _index_with_stake(
        odds_snapshots.fetch_latest_novig("wnba", mains_only=False),
        player_field="player_name",
        stat_field="stat_name",
    )
    pin_idx = _index_with_stake(
        odds_snapshots.fetch_latest_pinnacle("wnba"),
        player_field="player_name",
        stat_field="market_type",
    )
    parlay_rows = odds_snapshots.fetch_latest_parlay_api_odds("wnba")
    if not parlay_rows:
        warnings.append("parlay_unavailable")
    parlay_indexes = index_parlay_api_odds_by_book(parlay_rows)

    book_indexes: dict[str, SideIndex] = {
        "prophetx": px_idx,
        "novig": novig_idx,
        "pinnacle": pin_idx,
    }
    for book in _PARLAY_BOOKS:
        if book in parlay_indexes:
            book_indexes[book] = parlay_indexes[book]

    try:
        board = await scoreboard_mod.get_today_scoreboard()
        team_games = _team_game_index(board.games)
    except Exception as exc:
        logger.warning("WNBA legs scoreboard unavailable: %s", exc)
        team_games = {}

    try:
        roster = await wnba_roster.get_wnba_player_index()
    except Exception as exc:
        logger.warning("WNBA legs roster unavailable: %s", exc)
        roster = {}

    rejected_counts = {
        "insufficient_coverage": 0,
        "insufficient_sharp": 0,
        "below_threshold": 0,
        "unpriceable_payout": 0,
    }
    packable: list[PackablePlay] = []
    evaluated = 0

    for (player_key, stat_key, line_f), bucket in seeded.items():
        player = str(bucket["player"])
        entry = roster.get(norm_player_name(player)) or roster.get(player_key) or {}
        team = canonical_abbrev(str(entry.get("team_abbrev") or ""))
        game = team_games.get(team) if team else None
        if game is not None and game.status in _LOCKED:
            continue
        evaluated += 1
        game_id = None
        if game is not None:
            game_id = game.espn_event_id or game.id
        matchup = (
            f"{game.away.abbrev} @ {game.home.abbrev}" if game is not None else ""
        )
        quotes = _quotes_for_line(
            book_indexes,
            player_key=player_key,
            stat=stat_key,
            line=line_f,
            now=now,
        )
        result = price_line(
            quotes=quotes,
            dfs_line=line_f,
            app=app,
            format=format,
            legs=legs,
            payout_multiplier=bucket["payout_multiplier"],
        )
        if isinstance(result, RejectResult):
            rejected_counts[result.reason] += 1
            continue
        assert isinstance(result, PlayResult)
        by_book = {quote.book: quote for quote in quotes}
        packable.append(
            PackablePlay(
                player_key=player_key,
                play=WnbaLegsPlay(
                    rank=0,
                    player=player,
                    team=team,
                    matchup=matchup,
                    market=str(bucket["stat_label"]),
                    dfs_line=float(bucket["line"]),
                    side=result.side,
                    variant="standard",
                    game_id=game_id,
                    sharp_anchor=result.sharp_anchor,
                    fair_prob=result.fair_prob,
                    break_even=result.break_even,
                    required_margin_pts=result.required_margin_pts,
                    margin_pts=result.margin_pts,
                    book_disagreement_pts=result.book_disagreement_pts,
                    payout_multiplier=(
                        1.0
                        if result.payout_multiplier is None
                        else float(result.payout_multiplier)
                    ),
                    books_used=[
                        _book_used(by_book[name], result.side)
                        for name in result.books_used
                        if name in by_book
                    ],
                    books_excluded=[
                        WnbaLegsBookExcluded(
                            book=name,
                            reason=_exclude_reason(by_book[name], line_f)
                            if name in by_book
                            else "excluded",
                        )
                        for name in result.books_excluded
                    ],
                ),
            )
        )

    packable.sort(
        key=lambda item: (
            -item.play.margin_pts,
            -item.play.fair_prob,
            item.play.player.casefold(),
        )
    )
    packed, unpacked = pack_entries(packable, n=legs, format=format)
    rejected_counts["unpacked_remainder"] = unpacked
    entries = [WnbaLegsEntry(rank=pe.rank, legs=pe.legs) for pe in packed]

    response = _envelope(
        now=now,
        app=app,
        format=format,
        legs=legs,
        dfs_age=dfs_age,
        lines_seeded=lines_seeded,
        legs_evaluated=evaluated,
        entries=entries,
        rejected=WnbaLegsRejectedSummary(**rejected_counts),
        warnings=warnings,
    )
    _cache[cache_key] = {
        "response": response,
        "expires_at": now_mono + CACHE_TTL_SECONDS,
    }
    return response
