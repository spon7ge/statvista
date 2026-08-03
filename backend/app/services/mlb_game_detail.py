from __future__ import annotations

from typing import Any, Literal

from app.schemas.mlb_game_detail import (
    MlbBatterRow,
    MlbBoxScore,
    MlbGameDetail,
    MlbGameDetailTeam,
    MlbHitPoint,
    MlbLinescore,
    MlbLinescoreInning,
    MlbLinescoreTotals,
    MlbPitch,
    MlbPitcherRow,
    MlbPlay,
    MlbPlayerCard,
    MlbRunners,
    MlbSituation,
    MlbWinProbability,
)
from app.schemas.mlb_scoreboard import GameStatus

TEAM_LOGO = "https://www.mlbstatic.com/team-logos/{id}.svg"
FALLBACK_AWAY_COLOR = "#BD3039"
FALLBACK_HOME_COLOR = "#1D4ED8"

# Stats Gameday pitch plot coords are roughly 0–250 px. Map to a stable
# center-origin space in [-1, 1] (x right, y up) for the strike-zone UI.
_ZONE_CENTER_X = 125.0
_ZONE_CENTER_Y = 150.0
_ZONE_HALF = 125.0

_HIT_EVENT_TYPES = frozenset({"single", "double", "triple", "home_run"})


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _team_logo_url(team_id: Any) -> str | None:
    if team_id is None:
        return None
    return TEAM_LOGO.format(id=team_id)


def _team_color(team: dict, *, side: Literal["away", "home"]) -> str:
    for key in ("primaryColor", "color", "teamColor"):
        raw = team.get(key)
        if isinstance(raw, str) and raw.strip():
            color = raw.strip()
            return color if color.startswith("#") else f"#{color}"
    colors = team.get("teamColors")
    if isinstance(colors, dict):
        primary = colors.get("primary") or colors.get("primaryColor")
        if isinstance(primary, str) and primary.strip():
            color = primary.strip()
            return color if color.startswith("#") else f"#{color}"
    return FALLBACK_AWAY_COLOR if side == "away" else FALLBACK_HOME_COLOR


_NON_LIVE_KEYWORDS = (
    "warmup",
    "delayed",
    "suspended",
    "postponed",
    "cancelled",
    "canceled",
)


def _map_status(status: dict, linescore: dict | None) -> tuple[GameStatus, str]:
    """Map Stats abstract/detailed state → scheduled | live | final."""
    abstract = str(status.get("abstractGameState") or "").strip()
    detailed = str(status.get("detailedState") or "").strip()
    detailed_lower = detailed.lower()

    # Thin page for non-started / interrupted states (never treat as live center).
    if any(keyword in detailed_lower for keyword in _NON_LIVE_KEYWORDS):
        return "scheduled", detailed or "Scheduled"

    if abstract == "Final" or "final" in detailed_lower or "game over" in detailed_lower:
        return "final", "Final" if abstract == "Final" else (detailed or "Final")

    if abstract == "Live" or "in progress" in detailed_lower:
        if isinstance(linescore, dict):
            inning_state = str(linescore.get("inningState") or "").strip()
            inning_ordinal = str(linescore.get("currentInningOrdinal") or "").strip()
            if inning_state and inning_ordinal:
                return "live", f"{inning_state} {inning_ordinal}"
        return "live", detailed or "Live"

    return "scheduled", detailed or "Scheduled"


def _half(value: Any) -> Literal["top", "bottom"] | None:
    text = str(value or "").strip().lower()
    if text in ("top", "bottom"):
        return text  # type: ignore[return-value]
    return None


def _int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float_or_none(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _zone_coords(pitch_data: dict) -> tuple[float | None, float | None]:
    coords = _as_dict(pitch_data.get("coordinates"))
    x = _float_or_none(coords.get("x"))
    y = _float_or_none(coords.get("y"))
    if x is None or y is None:
        return None, None
    zone_x = (x - _ZONE_CENTER_X) / _ZONE_HALF
    zone_y = (_ZONE_CENTER_Y - y) / _ZONE_HALF
    return zone_x, zone_y


def _linescore_totals(side: dict) -> MlbLinescoreTotals:
    return MlbLinescoreTotals(
        runs=int(side.get("runs") or 0),
        hits=int(side.get("hits") or 0),
        errors=int(side.get("errors") or 0),
    )


def _linescore(live_linescore: dict) -> MlbLinescore | None:
    if not live_linescore:
        return None
    innings: list[MlbLinescoreInning] = []
    for inn in _as_list(live_linescore.get("innings")):
        if not isinstance(inn, dict):
            continue
        num = _int_or_none(inn.get("num"))
        if num is None:
            continue
        away = _as_dict(inn.get("away"))
        home = _as_dict(inn.get("home"))
        innings.append(
            MlbLinescoreInning(
                num=num,
                away_runs=_int_or_none(away.get("runs")),
                home_runs=_int_or_none(home.get("runs")),
            )
        )
    teams = _as_dict(live_linescore.get("teams"))
    inning_half = _half(live_linescore.get("inningHalf"))
    return MlbLinescore(
        innings=innings,
        away=_linescore_totals(_as_dict(teams.get("away"))),
        home=_linescore_totals(_as_dict(teams.get("home"))),
        current_inning=_int_or_none(live_linescore.get("currentInning")),
        inning_half=inning_half,
    )


def _hand_code(side: Any) -> str | None:
    data = _as_dict(side)
    code = data.get("code")
    if isinstance(code, str) and code.strip():
        return code.strip()
    return None


def _player_card(
    person: dict | None,
    *,
    hand: str | None = None,
    summary: str | None = None,
) -> MlbPlayerCard | None:
    if not isinstance(person, dict):
        return None
    name = person.get("fullName") or person.get("name")
    if not name:
        return None
    return MlbPlayerCard(name=str(name), hand=hand, summary=summary)


def _is_strike_pitch(details: dict) -> bool:
    if details.get("isStrike") is True:
        return True
    call = _as_dict(details.get("call"))
    code = str(call.get("code") or details.get("code") or "").upper()
    # Common Gameday strike/foul call codes.
    return code in {"C", "S", "F", "T", "W", "Q", "M"}


def _pitches_from_events(events: list) -> list[MlbPitch]:
    pitches: list[MlbPitch] = []
    for event in events:
        if not isinstance(event, dict) or not event.get("isPitch"):
            continue
        details = _as_dict(event.get("details"))
        pitch_data = _as_dict(event.get("pitchData"))
        pitch_type = _as_dict(details.get("type"))
        zone_x, zone_y = _zone_coords(pitch_data)
        number = _int_or_none(event.get("pitchNumber")) or (len(pitches) + 1)
        pitches.append(
            MlbPitch(
                number=number,
                type=(
                    str(pitch_type["description"])
                    if pitch_type.get("description")
                    else None
                ),
                mph=_float_or_none(pitch_data.get("startSpeed")),
                result=(
                    str(details["description"])
                    if details.get("description")
                    else None
                ),
                is_strike=_is_strike_pitch(details),
                zone_x=zone_x,
                zone_y=zone_y,
            )
        )
    return pitches


def _runners_from_offense(offense: dict) -> MlbRunners:
    return MlbRunners(
        first=bool(offense.get("first")),
        second=bool(offense.get("second")),
        third=bool(offense.get("third")),
    )


def _situation(live_linescore: dict, plays: dict) -> MlbSituation | None:
    if not live_linescore and not plays:
        return None
    current = _as_dict(plays.get("currentPlay"))
    matchup = _as_dict(current.get("matchup"))
    offense = _as_dict(live_linescore.get("offense"))
    events = _as_list(current.get("playEvents"))
    pitches = _pitches_from_events(events)
    latest = None
    if pitches:
        latest = pitches[-1].result
    elif events:
        last = _as_dict(events[-1])
        latest = (_as_dict(last.get("details")).get("description")) or None
        if latest is not None:
            latest = str(latest)

    count = _as_dict(current.get("count"))
    balls = _int_or_none(live_linescore.get("balls"))
    if balls is None:
        balls = _int_or_none(count.get("balls")) or 0
    strikes = _int_or_none(live_linescore.get("strikes"))
    if strikes is None:
        strikes = _int_or_none(count.get("strikes")) or 0
    outs = _int_or_none(live_linescore.get("outs"))
    if outs is None:
        outs = _int_or_none(count.get("outs")) or 0

    return MlbSituation(
        balls=balls,
        strikes=strikes,
        outs=outs,
        runners=_runners_from_offense(offense),
        at_bat=_player_card(
            _as_dict(matchup.get("batter")) or _as_dict(offense.get("batter")),
            hand=_hand_code(matchup.get("batSide")),
        ),
        on_deck=_player_card(_as_dict(offense.get("onDeck"))),
        pitching=_player_card(
            _as_dict(matchup.get("pitcher")) or _as_dict(offense.get("pitcher")),
            hand=_hand_code(matchup.get("pitchHand")),
        ),
        pitches=pitches,
        latest_play_text=latest,
    )


def _play_id(play: dict, index: int) -> str:
    about = _as_dict(play.get("about"))
    at_bat = about.get("atBatIndex")
    if at_bat is not None:
        return f"play-{at_bat}"
    return f"play-{index}"


def _plays(all_plays: list) -> tuple[list[MlbPlay], list[MlbPlay]]:
    plays: list[MlbPlay] = []
    scoring: list[MlbPlay] = []
    for index, raw in enumerate(all_plays):
        if not isinstance(raw, dict):
            continue
        about = _as_dict(raw.get("about"))
        result = _as_dict(raw.get("result"))
        half = _half(about.get("halfInning"))
        inning = _int_or_none(about.get("inning"))
        text = result.get("description")
        if half is None or inning is None or not text:
            continue
        is_scoring = bool(about.get("isScoringPlay"))
        event = result.get("eventType") or result.get("event")
        play = MlbPlay(
            id=_play_id(raw, index),
            inning=inning,
            half=half,
            text=str(text),
            scoring=is_scoring,
            away_score=int(result.get("awayScore") or 0),
            home_score=int(result.get("homeScore") or 0),
            event=str(event) if event else None,
        )
        plays.append(play)
        if is_scoring:
            scoring.append(play)
    return plays, scoring


def _player_map(side: dict) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for key, player in _as_dict(side.get("players")).items():
        if not isinstance(player, dict):
            continue
        person = _as_dict(player.get("person"))
        pid = person.get("id")
        if pid is None:
            # Keys are typically "ID123456"
            text = str(key)
            if text.startswith("ID"):
                try:
                    pid = int(text[2:])
                except ValueError:
                    continue
            else:
                continue
        out[int(pid)] = player
    return out


def _batting_order(player: dict) -> int | None:
    raw = player.get("battingOrder")
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    # Stats uses 100, 200, … for lineup slots (and 101+ for substitutions).
    return value // 100 if value >= 100 else value


def _batter_row(order_hint: int | None, player: dict) -> MlbBatterRow | None:
    person = _as_dict(player.get("person"))
    name = person.get("fullName")
    if not name:
        return None
    batting = _as_dict(_as_dict(player.get("stats")).get("batting"))
    position = _as_dict(player.get("position")).get("abbreviation")
    return MlbBatterRow(
        order=_batting_order(player) if player.get("battingOrder") is not None else order_hint,
        name=str(name),
        position=str(position) if position else None,
        ab=_int_or_none(batting.get("atBats")),
        r=_int_or_none(batting.get("runs")),
        h=_int_or_none(batting.get("hits")),
        rbi=_int_or_none(batting.get("rbi")),
        bb=_int_or_none(batting.get("baseOnBalls")),
        so=_int_or_none(batting.get("strikeOuts")),
    )


def _pitcher_row(player: dict) -> MlbPitcherRow | None:
    person = _as_dict(player.get("person"))
    name = person.get("fullName")
    if not name:
        return None
    pitching = _as_dict(_as_dict(player.get("stats")).get("pitching"))
    ip = pitching.get("inningsPitched")
    pitches = pitching.get("numberOfPitches")
    if pitches is None:
        pitches = pitching.get("pitchesThrown")
    return MlbPitcherRow(
        name=str(name),
        ip=str(ip) if ip is not None else None,
        h=_int_or_none(pitching.get("hits")),
        r=_int_or_none(pitching.get("runs")),
        er=_int_or_none(pitching.get("earnedRuns")),
        bb=_int_or_none(pitching.get("baseOnBalls")),
        k=_int_or_none(pitching.get("strikeOuts")),
        pitches=_int_or_none(pitches),
    )


def _box_side_batters(side: dict) -> list[MlbBatterRow]:
    players = _player_map(side)
    rows: list[MlbBatterRow] = []
    for index, pid in enumerate(_as_list(side.get("batters"))):
        try:
            player = players.get(int(pid))
        except (TypeError, ValueError):
            continue
        if not player:
            continue
        row = _batter_row(index + 1, player)
        if row is not None:
            rows.append(row)
    return rows


def _box_side_pitchers(side: dict) -> list[MlbPitcherRow]:
    players = _player_map(side)
    rows: list[MlbPitcherRow] = []
    for pid in _as_list(side.get("pitchers")):
        try:
            player = players.get(int(pid))
        except (TypeError, ValueError):
            continue
        if not player:
            continue
        row = _pitcher_row(player)
        if row is not None:
            rows.append(row)
    return rows


def _box(boxscore: dict) -> MlbBoxScore | None:
    teams = _as_dict(boxscore.get("teams"))
    away = _as_dict(teams.get("away"))
    home = _as_dict(teams.get("home"))
    if not away and not home:
        return None
    return MlbBoxScore(
        away_batters=_box_side_batters(away),
        home_batters=_box_side_batters(home),
        away_pitchers=_box_side_pitchers(away),
        home_pitchers=_box_side_pitchers(home),
    )


def _hit_result(event_type: str | None) -> Literal["hr", "hit", "out"]:
    if event_type == "home_run":
        return "hr"
    if event_type in _HIT_EVENT_TYPES:
        return "hit"
    return "out"


def _normalize_hit_coords(coord_x: float, coord_y: float) -> tuple[float, float]:
    # Field diagram is typically ~250×250 with home near the bottom center.
    return coord_x / 250.0, coord_y / 250.0


def _hits(all_plays: list) -> list[MlbHitPoint]:
    points: list[MlbHitPoint] = []
    for index, play in enumerate(all_plays):
        if not isinstance(play, dict):
            continue
        about = _as_dict(play.get("about"))
        result = _as_dict(play.get("result"))
        half = _half(about.get("halfInning"))
        if half is None:
            continue
        team: Literal["away", "home"] = "away" if half == "top" else "home"
        event_type = result.get("eventType")
        event_type_str = str(event_type) if event_type else None
        batter_name = _as_dict(_as_dict(play.get("matchup")).get("batter")).get(
            "fullName"
        )
        for event_index, event in enumerate(_as_list(play.get("playEvents"))):
            if not isinstance(event, dict):
                continue
            hit_data = _as_dict(event.get("hitData"))
            coords = _as_dict(hit_data.get("coordinates"))
            coord_x = _float_or_none(coords.get("coordX"))
            coord_y = _float_or_none(coords.get("coordY"))
            if coord_x is None or coord_y is None:
                continue
            x, y = _normalize_hit_coords(coord_x, coord_y)
            points.append(
                MlbHitPoint(
                    id=f"{_play_id(play, index)}-hit-{event_index}",
                    team=team,
                    result=_hit_result(event_type_str),
                    x=x,
                    y=y,
                    player_name=str(batter_name) if batter_name else None,
                )
            )
    return points


def _detail_team(
    team: dict,
    *,
    side: Literal["away", "home"],
    score: int | None,
) -> MlbGameDetailTeam:
    team_id = team.get("id")
    return MlbGameDetailTeam(
        id=str(team_id) if team_id is not None else "",
        abbrev=str(team.get("abbreviation") or ""),
        name=str(team.get("name") or ""),
        score=score,
        color=_team_color(team, side=side),
        logo_url=_team_logo_url(team_id),
    )


def normalize_mlb_live_feed(
    payload: dict,
    *,
    game_pk: str,
    fetched_at: str,
) -> MlbGameDetail:
    """Normalize an MLB Stats API ``feed/live`` payload into ``MlbGameDetail``."""
    game_data = _as_dict(payload.get("gameData"))
    live_data = _as_dict(payload.get("liveData"))
    status_raw = _as_dict(game_data.get("status"))
    live_linescore = _as_dict(live_data.get("linescore"))
    plays_raw = _as_dict(live_data.get("plays"))
    all_plays = _as_list(plays_raw.get("allPlays"))

    status, status_label = _map_status(status_raw, live_linescore)
    linescore = _linescore(live_linescore)
    teams = _as_dict(game_data.get("teams"))
    away_team = _as_dict(teams.get("away"))
    home_team = _as_dict(teams.get("home"))

    away_score = linescore.away.runs if linescore is not None else None
    home_score = linescore.home.runs if linescore is not None else None
    if status == "scheduled":
        away_score = None
        home_score = None

    venue = _as_dict(game_data.get("venue")).get("name")
    plays, scoring_plays = _plays(all_plays)

    return MlbGameDetail(
        mlb_game_pk=str(game_pk),
        league="mlb",
        status=status,
        status_label=status_label,
        venue=str(venue) if venue else None,
        away=_detail_team(away_team, side="away", score=away_score),
        home=_detail_team(home_team, side="home", score=home_score),
        linescore=linescore,
        situation=_situation(live_linescore, plays_raw),
        plays=plays,
        scoring_plays=scoring_plays,
        box_score=_box(_as_dict(live_data.get("boxscore"))),
        hit_chart=_hits(all_plays),
        win_probability=None,
        sources=["mlb_stats_api"],
        fetched_at=fetched_at,
    )


def attach_win_probability(
    detail: MlbGameDetail,
    wp: MlbWinProbability | None,
) -> MlbGameDetail:
    """Attach ESPN win probability onto a Stats-normalized detail payload."""
    if wp is None:
        return detail
    sources = list(detail.sources)
    if "espn" not in sources:
        sources.append("espn")
    return detail.model_copy(update={"win_probability": wp, "sources": sources})

