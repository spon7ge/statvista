from __future__ import annotations

import logging
import re
import time
from datetime import date, datetime, timezone
from typing import Any, Literal
from zoneinfo import ZoneInfo

import httpx

from app.domains.mlb.schemas import (
    MlbBatterRow,
    MlbBoxNoteLine,
    MlbBoxScore,
    MlbDecisions,
    MlbGameDetail,
    MlbGameDetailTeam,
    MlbGameUmpires,
    MlbGameWeather,
    MlbHitPoint,
    MlbInjuries,
    MlbInjury,
    MlbLinescore,
    MlbLinescoreInning,
    MlbLinescoreTotals,
    MlbGameLeaders,
    MlbMatchupPrediction,
    MlbPitch,
    MlbPitcherRow,
    MlbPitchingTotals,
    MlbPlay,
    MlbPlayerCard,
    MlbPlayerOfTheGame,
    MlbRunners,
    MlbSeasonTeamStatsPair,
    MlbSituation,
    MlbTeamStatLine,
    MlbTeamStatsPair,
    MlbWinProbability,
    MlbWinProbabilityPoint,
    MlbWinProbabilityStakes,
)
from app.domains.mlb.schemas import GameStatus
from app.domains.mlb.team_colors import team_color as palette_team_color
from app.providers.espn.mlb_bridge import (
    ESPN_TIMEOUT_SECONDS,
    EspnInjuries,
    EspnMatchupPrediction,
    EspnWinProbability,
    normalize_espn_mlb_injuries,
    normalize_espn_mlb_matchup_prediction,
    normalize_espn_mlb_win_probability,
    resolve_espn_event_id,
)
from app.providers.mlb_stats.game_leaders import fetch_game_leaders
from app.providers.mlb_stats.team_season import fetch_season_team_stats_pair
from app.providers.mlb_play.player_of_the_game import fetch_player_of_the_game
from app.domains.mlb.scoreboard import format_tip_label

logger = logging.getLogger(__name__)

TEAM_LOGO = "https://www.mlbstatic.com/team-logos/{id}.svg"
HEADSHOT = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:67:current.png/w_213,q_auto:best/"
    "v1/people/{id}/headshot/67/current"
)
FALLBACK_AWAY_COLOR = "#BD3039"
FALLBACK_HOME_COLOR = "#1D4ED8"

LIVE_FEED_URL = "https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
ESPN_SUMMARY_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary"
)
STANDINGS_URL = "https://statsapi.mlb.com/api/v1/standings"
STATS_TIMEOUT_SECONDS = 12.0
LIVE_TTL_SECONDS = 15
NOT_LIVE_TTL_SECONDS = 60
STANDINGS_TTL_SECONDS = 600

_GAME_PK_PATTERN = re.compile(r"^\d{4,10}$")
_cache: dict[str, dict] = {}
_standings_cache: dict[str, Any] = {"expires_at": 0.0, "payload": None}

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


def _headshot_url(person_id: int | None) -> str | None:
    if person_id is None:
        return None
    return HEADSHOT.format(id=person_id)


def _team_color(team: dict, *, side: Literal["away", "home"]) -> str:
    # Stats API feed/live usually omits colors; prefer our primary palette.
    mapped = palette_team_color(str(team.get("abbreviation") or ""))
    if mapped:
        return mapped
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


def _team_record(team: dict) -> str | None:
    record_container = _as_dict(team.get("record"))
    record = (
        _as_dict(record_container.get("leagueRecord"))
        or record_container
        or _as_dict(team.get("leagueRecord"))
    )
    wins = _int_or_none(record.get("wins"))
    losses = _int_or_none(record.get("losses"))
    if wins is None or losses is None:
        return None
    return f"{wins}-{losses}"


def _official_game_date(game_data: dict) -> str | None:
    datetime_block = _as_dict(game_data.get("datetime"))
    official_date = datetime_block.get("officialDate")
    if not isinstance(official_date, str):
        return None
    try:
        date.fromisoformat(official_date)
    except ValueError:
        return None
    return official_date


def _game_date_label(game_data: dict, *, now: date | None = None) -> str | None:
    official_date = _official_game_date(game_data)
    if official_date is None:
        return None
    game_date = date.fromisoformat(official_date)

    today = now or datetime.now(ZoneInfo("America/New_York")).date()
    if game_date == today:
        return "Today"
    if game_date == today.fromordinal(today.toordinal() - 1):
        return "Yesterday"
    return f"{game_date.strftime('%b')} {game_date.day}"


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


def _decisions(live_data: dict) -> MlbDecisions | None:
    raw = _as_dict(live_data.get("decisions"))
    if not raw:
        return None

    def name(key: str) -> str | None:
        full_name = _as_dict(raw.get(key)).get("fullName")
        return str(full_name) if full_name else None

    winner, loser, save = name("winner"), name("loser"), name("save")
    if not any((winner, loser, save)):
        return None
    return MlbDecisions(winner=winner, loser=loser, save=save)


def _hit_metrics(play: dict) -> tuple[float | None, float | None, float | None]:
    for event in reversed(_as_list(play.get("playEvents"))):
        if not isinstance(event, dict):
            continue
        hit_data = _as_dict(event.get("hitData"))
        if not hit_data:
            continue
        exit_velo = hit_data.get("launchSpeed", hit_data.get("exitVelocity"))
        return (
            _float_or_none(exit_velo),
            _float_or_none(hit_data.get("launchAngle")),
            _float_or_none(hit_data.get("totalDistance")),
        )
    return None, None, None


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
        return code.strip().upper()
    return None


def _hand_label(code: str | None, *, role: Literal["batter", "pitcher"]) -> str | None:
    if not code:
        return None
    suffix = "HB" if role == "batter" else "HP"
    if code in {"R", "L", "S"}:
        return f"{code}{suffix}"
    return code


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
    person_id = _person_id(person)
    return MlbPlayerCard(
        name=str(name),
        hand=hand,
        summary=summary,
        id=person_id,
        headshot_url=_headshot_url(person_id),
    )


def _boxscore_players(boxscore: dict) -> dict[int, dict]:
    teams = _as_dict(boxscore.get("teams"))
    out: dict[int, dict] = {}
    for side_key in ("away", "home"):
        out.update(_player_map(_as_dict(teams.get(side_key))))
    return out


def _person_id(person: dict | None) -> int | None:
    if not isinstance(person, dict):
        return None
    return _int_or_none(person.get("id"))


def _season_avg(player: dict | None) -> str | None:
    if not player:
        return None
    batting = _as_dict(_as_dict(player.get("seasonStats")).get("batting"))
    avg = batting.get("avg")
    if isinstance(avg, str) and avg.strip():
        return avg.strip()
    if isinstance(avg, (int, float)):
        return f"{avg:.3f}".lstrip("0") if avg < 1 else f"{avg:.3f}"
    return None


def _batter_card_summary(player: dict | None) -> str | None:
    if not player:
        return None
    batting = _as_dict(_as_dict(player.get("stats")).get("batting"))
    today = batting.get("summary")
    today_text = None
    if isinstance(today, str) and today.strip():
        today_text = today.strip()
        if not today_text.lower().endswith("today"):
            today_text = f"{today_text} today"
    avg = _season_avg(player)
    parts = [p for p in (avg, today_text) if p]
    return " · ".join(parts) if parts else None


def _batting_game_summary(player: dict | None) -> str | None:
    if not player:
        return None
    batting = _as_dict(_as_dict(player.get("stats")).get("batting"))
    summary = batting.get("summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()
    return None


def _pitcher_card_summary(player: dict | None) -> str | None:
    if not player:
        return None
    pitching = _as_dict(_as_dict(player.get("stats")).get("pitching"))
    pitches = pitching.get("numberOfPitches")
    if pitches is None:
        pitches = pitching.get("pitchesThrown")
    pitch_count = _int_or_none(pitches)
    line = pitching.get("summary")
    line_text = str(line).strip() if isinstance(line, str) and line.strip() else None
    if line_text is None:
        fragments: list[str] = []
        ip = pitching.get("inningsPitched")
        if ip is not None and str(ip).strip():
            fragments.append(f"{ip} IP")
        er = _int_or_none(pitching.get("earnedRuns"))
        if er is not None:
            fragments.append("ER" if er == 1 else f"{er} ER")
        k = _int_or_none(pitching.get("strikeOuts"))
        if k is not None:
            fragments.append(f"{k} K")
        bb = _int_or_none(pitching.get("baseOnBalls"))
        if bb is not None:
            fragments.append(f"{bb} BB")
        line_text = ", ".join(fragments) if fragments else None
    parts: list[str] = []
    if pitch_count is not None:
        parts.append(f"{pitch_count} P")
    if line_text:
        parts.append(line_text)
    return " · ".join(parts) if parts else None


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
        breaks = _as_dict(pitch_data.get("breaks"))
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
                spin_rate=_float_or_none(breaks.get("spinRate")),
                spin_direction=_float_or_none(breaks.get("spinDirection")),
            )
        )
    return pitches


def _runners_from_offense(offense: dict) -> MlbRunners:
    return MlbRunners(
        first=bool(offense.get("first")),
        second=bool(offense.get("second")),
        third=bool(offense.get("third")),
    )


def _situation(
    live_linescore: dict,
    plays: dict,
    boxscore: dict | None = None,
) -> MlbSituation | None:
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

    box_players = _boxscore_players(boxscore or {})
    batter_person = _as_dict(matchup.get("batter")) or _as_dict(offense.get("batter"))
    on_deck_person = _as_dict(offense.get("onDeck"))
    pitcher_person = _as_dict(matchup.get("pitcher")) or _as_dict(
        _as_dict(live_linescore.get("defense")).get("pitcher")
    ) or _as_dict(offense.get("pitcher"))

    batter_id = _person_id(batter_person)
    on_deck_id = _person_id(on_deck_person)
    pitcher_id = _person_id(pitcher_person)
    batter_box = box_players.get(batter_id) if batter_id is not None else None
    on_deck_box = box_players.get(on_deck_id) if on_deck_id is not None else None
    pitcher_box = box_players.get(pitcher_id) if pitcher_id is not None else None

    on_deck_hand = _hand_code(
        on_deck_person.get("batSide")
        or _as_dict(_as_dict(on_deck_box).get("person")).get("batSide")
    )

    return MlbSituation(
        balls=balls,
        strikes=strikes,
        outs=outs,
        runners=_runners_from_offense(offense),
        at_bat=_player_card(
            batter_person,
            hand=_hand_label(_hand_code(matchup.get("batSide")), role="batter"),
            summary=_batter_card_summary(batter_box),
        ),
        on_deck=_player_card(
            on_deck_person,
            hand=_hand_label(on_deck_hand, role="batter"),
            summary=_batter_card_summary(on_deck_box),
        ),
        pitching=_player_card(
            pitcher_person,
            hand=_hand_label(_hand_code(matchup.get("pitchHand")), role="pitcher"),
            summary=_pitcher_card_summary(pitcher_box),
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


def _plays(
    all_plays: list, box_players: dict[int, dict]
) -> tuple[list[MlbPlay], list[MlbPlay]]:
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
        exit_velo, launch_angle, total_distance = _hit_metrics(raw)
        matchup = _as_dict(raw.get("matchup"))
        batter_id = _person_id(_as_dict(matchup.get("batter")))
        batter_box = (
            box_players.get(batter_id) if batter_id is not None else None
        )
        play = MlbPlay(
            id=_play_id(raw, index),
            inning=inning,
            half=half,
            text=str(text),
            scoring=is_scoring,
            away_score=int(result.get("awayScore") or 0),
            home_score=int(result.get("homeScore") or 0),
            event=str(event) if event else None,
            exit_velo=exit_velo,
            launch_angle=launch_angle,
            total_distance=total_distance,
            scoring_team=("away" if half == "top" else "home")
            if is_scoring
            else None,
            batter_summary=_batting_game_summary(batter_box),
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
        hr=_int_or_none(batting.get("homeRuns")),
        sb=_int_or_none(batting.get("stolenBases")),
    )


def _pitcher_era(player: dict, pitching: dict) -> str | None:
    season = _as_dict(_as_dict(player.get("seasonStats")).get("pitching"))
    raw = season.get("era")
    if raw is None:
        raw = pitching.get("era")
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


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
    note = pitching.get("note")
    decision = str(note).strip() if note is not None and str(note).strip() else None
    return MlbPitcherRow(
        name=str(name),
        ip=str(ip) if ip is not None else None,
        h=_int_or_none(pitching.get("hits")),
        r=_int_or_none(pitching.get("runs")),
        er=_int_or_none(pitching.get("earnedRuns")),
        bb=_int_or_none(pitching.get("baseOnBalls")),
        k=_int_or_none(pitching.get("strikeOuts")),
        pitches=_int_or_none(pitches),
        hr=_int_or_none(pitching.get("homeRuns")),
        era=_pitcher_era(player, pitching),
        decision=decision,
        strikes=_int_or_none(pitching.get("strikes")),
        ground_outs=_int_or_none(pitching.get("groundOuts")),
        fly_outs=_int_or_none(pitching.get("flyOuts")),
        batters_faced=_int_or_none(pitching.get("battersFaced")),
        inherited_runners=_int_or_none(pitching.get("inheritedRunners")),
        inherited_runners_scored=_int_or_none(
            pitching.get("inheritedRunnersScored")
        ),
    )


def _info_notes(side: dict, title: str) -> list[MlbBoxNoteLine]:
    notes: list[MlbBoxNoteLine] = []
    wanted = title.upper()
    for block in _as_list(side.get("info")):
        if not isinstance(block, dict):
            continue
        if str(block.get("title") or "").upper() != wanted:
            continue
        for field in _as_list(block.get("fieldList")):
            if not isinstance(field, dict):
                continue
            label = str(field.get("label") or "").strip()
            value = str(field.get("value") or "").strip()
            if label and value:
                notes.append(MlbBoxNoteLine(label=label, value=value))
    return notes


def _pitching_totals(side: dict) -> MlbPitchingTotals | None:
    pitching = _as_dict(_as_dict(side.get("teamStats")).get("pitching"))
    if not pitching:
        return None
    ip = pitching.get("inningsPitched")
    era = pitching.get("era")
    era_text = str(era).strip() if era is not None else ""
    return MlbPitchingTotals(
        ip=str(ip) if ip is not None else None,
        h=_int_or_none(pitching.get("hits")),
        r=_int_or_none(pitching.get("runs")),
        er=_int_or_none(pitching.get("earnedRuns")),
        bb=_int_or_none(pitching.get("baseOnBalls")),
        k=_int_or_none(pitching.get("strikeOuts")),
        hr=_int_or_none(pitching.get("homeRuns")),
        era=era_text or None,
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
        away_batting_notes=_info_notes(away, "BATTING"),
        home_batting_notes=_info_notes(home, "BATTING"),
        away_baserunning_notes=_info_notes(away, "BASERUNNING"),
        home_baserunning_notes=_info_notes(home, "BASERUNNING"),
        away_fielding_notes=_info_notes(away, "FIELDING"),
        home_fielding_notes=_info_notes(home, "FIELDING"),
        away_pitching_totals=_pitching_totals(away),
        home_pitching_totals=_pitching_totals(home),
    )


def _team_stat_line(team: dict) -> MlbTeamStatLine:
    stats = _as_dict(team.get("teamStats"))
    batting = _as_dict(stats.get("batting"))
    pitching = _as_dict(stats.get("pitching"))

    def text(value: Any) -> str | None:
        if isinstance(value, str):
            return value.strip() or None
        return str(value) if value is not None else None

    return MlbTeamStatLine(
        hr=_int_or_none(batting.get("homeRuns")),
        r=_int_or_none(batting.get("runs")),
        h=_int_or_none(batting.get("hits")),
        sb=_int_or_none(batting.get("stolenBases")),
        lob=_int_or_none(batting.get("leftOnBase")),
        avg=text(batting.get("avg")),
        obp=text(batting.get("obp")),
        slg=text(batting.get("slg")),
        era=text(pitching.get("era")),
        k=_int_or_none(pitching.get("strikeOuts")),
        bb=_int_or_none(pitching.get("baseOnBalls")),
    )


def _team_stats(boxscore: dict) -> MlbTeamStatsPair | None:
    teams = _as_dict(boxscore.get("teams"))
    away = _as_dict(teams.get("away"))
    home = _as_dict(teams.get("home"))
    if not _as_dict(away.get("teamStats")) and not _as_dict(home.get("teamStats")):
        return None
    return MlbTeamStatsPair(
        away=_team_stat_line(away),
        home=_team_stat_line(home),
    )


def _hit_result(event_type: str | None) -> Literal["hr", "hit", "out"]:
    if event_type == "home_run":
        return "hr"
    if event_type in _HIT_EVENT_TYPES:
        return "hit"
    return "out"


_OUTCOME_BY_EVENT_TYPE = {
    "single": "Single",
    "double": "Double",
    "triple": "Triple",
    "home_run": "HR",
}


def _hit_outcome(event_type: str | None, event: object | None) -> str | None:
    if event_type in _OUTCOME_BY_EVENT_TYPE:
        return _OUTCOME_BY_EVENT_TYPE[event_type]
    if isinstance(event, str) and event.strip():
        return event.strip()
    if event_type:
        return event_type.replace("_", " ").title()
    return None


def _normalize_hit_coords(coord_x: float, coord_y: float) -> tuple[float, float]:
    # Preserve MLBAM Gameday spray-chart pixels as fractions of the 250×250 board.
    # Frontend maps these through the standard home-origin feet transform onto the
    # polar field diagram (do not treat as already-aligned SVG fractions).
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
        outcome = _hit_outcome(event_type_str, result.get("event"))
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
                    outcome=outcome,
                )
            )
    return points


def _venue_location(game_data: dict) -> tuple[str | None, str | None]:
    loc = _as_dict(_as_dict(game_data.get("venue")).get("location"))
    city = str(loc.get("city") or "").strip() or None
    state = str(loc.get("state") or "").strip() or None
    return city, state


def _weather(game_data: dict) -> MlbGameWeather | None:
    raw = _as_dict(game_data.get("weather"))
    if not raw:
        return None
    condition = str(raw.get("condition") or "").strip() or None
    temp_f = str(raw.get("temp") or "").strip() or None
    wind = str(raw.get("wind") or "").strip() or None
    if not condition and not temp_f and not wind:
        return None
    return MlbGameWeather(condition=condition, temp_f=temp_f, wind=wind)


_UMPIRE_TYPE_MAP = {
    "home plate": "home_plate",
    "first base": "first_base",
    "second base": "second_base",
    "third base": "third_base",
}


def _umpires(boxscore: dict) -> MlbGameUmpires | None:
    slots: dict[str, str | None] = {
        "home_plate": None,
        "first_base": None,
        "second_base": None,
        "third_base": None,
    }
    for entry in _as_list(boxscore.get("officials")):
        item = _as_dict(entry)
        key = _UMPIRE_TYPE_MAP.get(str(item.get("officialType") or "").strip().lower())
        if not key:
            continue
        name = str(_as_dict(item.get("official")).get("fullName") or "").strip()
        if name:
            slots[key] = name
    if not any(slots.values()):
        return None
    return MlbGameUmpires(**slots)


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
        record=_team_record(team),
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
    if status == "scheduled":
        datetime_block = _as_dict(game_data.get("datetime"))
        date_time = datetime_block.get("dateTime") or datetime_block.get(
            "dateTimeUTC"
        )
        if isinstance(date_time, str):
            tip = format_tip_label(date_time)
            if tip:
                status_label = tip
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
    venue_city, venue_state = _venue_location(game_data)
    weather = _weather(game_data)
    boxscore = _as_dict(live_data.get("boxscore"))
    plays, scoring_plays = _plays(all_plays, _boxscore_players(boxscore))
    umpires = _umpires(boxscore)

    return MlbGameDetail(
        mlb_game_pk=str(game_pk),
        league="mlb",
        status=status,
        status_label=status_label,
        venue=str(venue) if venue else None,
        venue_city=venue_city,
        venue_state=venue_state,
        weather=weather,
        umpires=umpires,
        away=_detail_team(away_team, side="away", score=away_score),
        home=_detail_team(home_team, side="home", score=home_score),
        linescore=linescore,
        situation=_situation(live_linescore, plays_raw, boxscore),
        plays=plays,
        scoring_plays=scoring_plays,
        box_score=_box(boxscore),
        hit_chart=_hits(all_plays),
        win_probability=None,
        game_date=_official_game_date(game_data),
        game_date_label=_game_date_label(game_data),
        decisions=_decisions(live_data),
        team_stats=_team_stats(boxscore),
        sources=["mlb_stats_api"],
        fetched_at=fetched_at,
    )


def _to_mlb_win_probability(
    wp: EspnWinProbability | None,
) -> MlbWinProbability | None:
    """Map the ESPN provider's lean win-probability shape onto the domain schema."""
    if wp is None:
        return None
    return MlbWinProbability(
        home_abbrev=wp.home_abbrev,
        away_abbrev=wp.away_abbrev,
        points=[
            MlbWinProbabilityPoint(
                play_id=p.play_id, label=p.label, home_win_pct=p.home_win_pct
            )
            for p in wp.points
        ],
        stakes=(
            MlbWinProbabilityStakes(
                home_win_delta=wp.stakes.home_win_delta, label=wp.stakes.label
            )
            if wp.stakes is not None
            else None
        ),
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


def attach_matchup_prediction(
    detail: MlbGameDetail,
    prediction: MlbMatchupPrediction | None,
) -> MlbGameDetail:
    """Attach ESPN matchup prediction onto a Stats-normalized detail payload."""
    if prediction is None:
        return detail
    sources = list(detail.sources)
    if "espn" not in sources:
        sources.append("espn")
    return detail.model_copy(
        update={"matchup_prediction": prediction, "sources": sources}
    )


def _to_mlb_matchup_prediction(
    pred: EspnMatchupPrediction | None,
) -> MlbMatchupPrediction | None:
    if pred is None:
        return None
    return MlbMatchupPrediction(
        away_win_pct=pred.away_win_pct,
        home_win_pct=pred.home_win_pct,
        source_label=pred.source_label,
    )


def attach_season_team_stats(
    detail: MlbGameDetail,
    pair: MlbSeasonTeamStatsPair | None,
) -> MlbGameDetail:
    """Attach season-to-date team stats onto a Stats-normalized detail payload."""
    if pair is None:
        return detail
    return detail.model_copy(update={"season_team_stats": pair})


def attach_game_leaders(
    detail: MlbGameDetail,
    leaders: MlbGameLeaders | None,
) -> MlbGameDetail:
    """Attach Preview Game Leaders onto a Stats-normalized detail payload."""
    if leaders is None:
        return detail
    return detail.model_copy(update={"game_leaders": leaders})


def attach_injuries(
    detail: MlbGameDetail,
    injuries: MlbInjuries | None,
) -> MlbGameDetail:
    """Attach ESPN injuries onto a Stats-normalized detail payload."""
    if injuries is None:
        return detail
    sources = list(detail.sources)
    if "espn" not in sources:
        sources.append("espn")
    return detail.model_copy(update={"injuries": injuries, "sources": sources})


def attach_player_of_the_game(
    detail: MlbGameDetail,
    potg: MlbPlayerOfTheGame | None,
) -> MlbGameDetail:
    """Attach MLB Play Player of the Game onto a Stats-normalized detail payload."""
    if potg is None:
        return detail
    sources = list(detail.sources)
    if "mlb_player_of_the_game" not in sources:
        sources.append("mlb_player_of_the_game")
    return detail.model_copy(
        update={"player_of_the_game": potg, "sources": sources}
    )


def _to_mlb_injuries(injuries: EspnInjuries | None) -> MlbInjuries | None:
    """Map the ESPN provider's lean injuries shape onto the domain schema."""
    if injuries is None:
        return None
    return MlbInjuries(
        away=[
            MlbInjury(
                name=row.name,
                position=row.position,
                status=row.status,
                detail=row.detail,
            )
            for row in injuries.away
        ],
        home=[
            MlbInjury(
                name=row.name,
                position=row.position,
                status=row.status,
                detail=row.detail,
            )
            for row in injuries.home
        ],
    )


def _espn_competitor_team_ids(summary: dict) -> tuple[str, str]:
    """Extract ESPN away/home team ids from a summary header."""
    competitions = _as_list(_as_dict(summary.get("header")).get("competitions"))
    competition = _as_dict(competitions[0]) if competitions else {}
    by_side: dict[str, dict] = {}
    for competitor in _as_list(competition.get("competitors")):
        row = _as_dict(competitor)
        side = str(row.get("homeAway") or "")
        if side:
            by_side[side] = row
    away = _as_dict(by_side.get("away"))
    home = _as_dict(by_side.get("home"))
    away_id = str(_as_dict(away.get("team")).get("id") or "")
    home_id = str(_as_dict(home.get("team")).get("id") or "")
    return away_id, home_id


def _season_year(detail: MlbGameDetail, payload: dict) -> int | None:
    raw = detail.game_date or _game_date_et(payload)
    if not raw or len(raw) < 4:
        return None
    try:
        return int(raw[:4])
    except ValueError:
        return None


def parse_standings_last10(payload: dict) -> dict[str, str]:
    """Parse a Stats API ``standings`` payload into ``team_id -> "W-L"`` for the last-10 split."""
    mapping: dict[str, str] = {}
    for block in _as_list(payload.get("records")):
        for team_record in _as_list(_as_dict(block).get("teamRecords")):
            team = _as_dict(_as_dict(team_record).get("team"))
            team_id = team.get("id")
            if team_id is None:
                continue
            splits = _as_list(
                _as_dict(_as_dict(team_record).get("records")).get("splitRecords")
            )
            for split in splits:
                split_dict = _as_dict(split)
                if str(split_dict.get("type") or "") != "lastTen":
                    continue
                wins = _int_or_none(split_dict.get("wins"))
                losses = _int_or_none(split_dict.get("losses"))
                if wins is None or losses is None:
                    break
                mapping[str(team_id)] = f"{wins}-{losses}"
                break
    return mapping


def attach_last10(
    detail: MlbGameDetail, last10_by_team_id: dict[str, str]
) -> MlbGameDetail:
    """Soft-merge last-10 standings splits onto a Stats-normalized game detail."""
    away_l10 = last10_by_team_id.get(detail.away.id)
    home_l10 = last10_by_team_id.get(detail.home.id)
    if away_l10 is None and home_l10 is None:
        return detail
    return detail.model_copy(
        update={
            "away": detail.away.model_copy(update={"last_10": away_l10}),
            "home": detail.home.model_copy(update={"last_10": home_l10}),
        }
    )


def clear_mlb_game_detail_cache() -> None:
    _cache.clear()
    _standings_cache["payload"] = None
    _standings_cache["expires_at"] = 0.0


def cache_ttl_seconds(detail: MlbGameDetail) -> int:
    if detail.status == "live":
        return LIVE_TTL_SECONDS
    return NOT_LIVE_TTL_SECONDS


def is_valid_mlb_game_pk(game_pk: str) -> bool:
    return bool(_GAME_PK_PATTERN.fullmatch(game_pk))


def _is_missing_live_feed(payload: dict) -> bool:
    game_data = _as_dict(payload.get("gameData"))
    if not game_data:
        return True
    teams = _as_dict(game_data.get("teams"))
    away = _as_dict(teams.get("away"))
    home = _as_dict(teams.get("home"))
    if not away or not home:
        return True
    for side in (away, home):
        if not any(side.get(field) for field in ("id", "abbreviation", "name")):
            return True
    return False


def _game_date_et(payload: dict) -> str | None:
    datetime_block = _as_dict(_as_dict(payload.get("gameData")).get("datetime"))
    for key in ("officialDate", "originalDate"):
        raw = datetime_block.get(key)
        if isinstance(raw, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            return raw
    return None


async def fetch_mlb_live_feed(game_pk: str) -> dict:
    url = LIVE_FEED_URL.format(game_pk=game_pk)
    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def fetch_mlb_standings() -> dict:
    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        response = await client.get(
            STANDINGS_URL,
            params={"leagueId": "103,104"},
        )
        response.raise_for_status()
        return response.json()


async def _standings_last10_map() -> dict[str, str]:
    now = time.time()
    if float(_standings_cache.get("expires_at") or 0) > now:
        cached = _standings_cache.get("payload")
        return parse_standings_last10(cached) if cached else {}
    try:
        payload = await fetch_mlb_standings()
    except Exception:
        # Negative-cache the failure (keep any prior payload) so a hang or
        # error upstream isn't retried on every scheduled-detail request
        # within the TTL window.
        _standings_cache["expires_at"] = now + STANDINGS_TTL_SECONDS
        raise
    _standings_cache["payload"] = payload
    _standings_cache["expires_at"] = now + STANDINGS_TTL_SECONDS
    return parse_standings_last10(payload)


async def fetch_espn_mlb_summary(
    espn_event_id: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict:
    owns_client = client is None
    http_client = client or httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS)
    try:
        response = await http_client.get(
            ESPN_SUMMARY_URL, params={"event": espn_event_id}
        )
        response.raise_for_status()
        return response.json()
    finally:
        if owns_client:
            await http_client.aclose()


async def _attach_season_team_stats(detail: MlbGameDetail, payload: dict) -> MlbGameDetail:
    """Soft-fetch season YTD hitting/pitching for scheduled games only."""
    season = _season_year(detail, payload)
    if season is None:
        return detail
    try:
        away_id = int(detail.away.id)
        home_id = int(detail.home.id)
    except (TypeError, ValueError):
        return detail

    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        pair = await fetch_season_team_stats_pair(
            client,
            away_team_id=away_id,
            home_team_id=home_id,
            season=season,
        )
    return attach_season_team_stats(detail, pair)


async def _attach_game_leaders(detail: MlbGameDetail, payload: dict) -> MlbGameDetail:
    """Soft-fetch depth-100 hitting boards and pick first roster hit per category."""
    season = _season_year(detail, payload)
    if season is None:
        return detail
    try:
        away_id = int(detail.away.id)
        home_id = int(detail.home.id)
    except (TypeError, ValueError):
        return detail

    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        leaders = await fetch_game_leaders(
            client,
            away_team_id=away_id,
            home_team_id=home_id,
            away_abbrev=detail.away.abbrev,
            home_abbrev=detail.home.abbrev,
            season=season,
        )
    return attach_game_leaders(detail, leaders)


async def _attach_player_of_the_game(detail: MlbGameDetail) -> MlbGameDetail:
    """Soft-fetch MLB Play Player of the Game for final games only."""
    if detail.status != "final":
        return detail
    try:
        async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
            potg = await fetch_player_of_the_game(client, game_pk=detail.mlb_game_pk)
    except Exception as exc:
        logger.warning(
            "player of the game unavailable for %s: %s",
            detail.mlb_game_pk,
            exc,
        )
        return detail
    return attach_player_of_the_game(detail, potg)


async def _attach_espn_summary_enrichment(
    detail: MlbGameDetail,
    payload: dict,
    *,
    cached_espn_event_id: str | None,
) -> tuple[MlbGameDetail, str | None]:
    """Soft-merge ESPN win probability, matchup prediction, and injuries from one summary fetch."""
    espn_event_id = cached_espn_event_id
    try:
        if not espn_event_id:
            date_et = _game_date_et(payload)
            if not date_et:
                return detail, None
            espn_event_id = await resolve_espn_event_id(
                date_et=date_et,
                away_abbrev=detail.away.abbrev,
                home_abbrev=detail.home.abbrev,
            )
        if not espn_event_id:
            return detail, None

        summary = await fetch_espn_mlb_summary(espn_event_id)
        wp = _to_mlb_win_probability(
            normalize_espn_mlb_win_probability(
                summary,
                home_abbrev=detail.home.abbrev,
                away_abbrev=detail.away.abbrev,
            )
        )
        detail = attach_win_probability(detail, wp)

        detail = attach_matchup_prediction(
            detail,
            _to_mlb_matchup_prediction(normalize_espn_mlb_matchup_prediction(summary)),
        )

        away_espn_id, home_espn_id = _espn_competitor_team_ids(summary)
        if away_espn_id and home_espn_id:
            detail = attach_injuries(
                detail,
                _to_mlb_injuries(
                    normalize_espn_mlb_injuries(
                        summary,
                        away_espn_team_id=away_espn_id,
                        home_espn_team_id=home_espn_id,
                    )
                ),
            )
        return detail, espn_event_id
    except Exception as exc:
        logger.warning(
            "ESPN summary enrichment unavailable for MLB game %s: %s",
            detail.mlb_game_pk,
            exc,
        )
        return detail, espn_event_id


async def get_mlb_game_detail(game_pk: str) -> MlbGameDetail:
    now = time.time()
    cached = _cache.get(game_pk)
    if cached and cached["expires_at"] > now:
        return cached["detail"]

    # Stale positive cache is usable as stale-while-error if Stats fails later.
    stale_fallback = cached if cached and cached.get("detail") is not None else None

    if not is_valid_mlb_game_pk(game_pk):
        raise LookupError(game_pk)

    try:
        payload = await fetch_mlb_live_feed(game_pk)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 404):
            raise LookupError(game_pk) from exc
        if stale_fallback:
            return stale_fallback["detail"]
        raise
    except Exception:
        if stale_fallback:
            return stale_fallback["detail"]
        raise

    if _is_missing_live_feed(payload):
        raise LookupError(game_pk)

    try:
        detail = normalize_mlb_live_feed(
            payload,
            game_pk=game_pk,
            fetched_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception:
        if stale_fallback:
            return stale_fallback["detail"]
        raise

    if detail.status == "scheduled":
        # Only the pregame header surfaces last-10 splits; skip the extra
        # standings round-trip (and its cache churn) for live/final games.
        try:
            detail = attach_last10(detail, await _standings_last10_map())
        except Exception as exc:
            logger.warning(
                "MLB standings last10 unavailable for game %s: %s",
                detail.mlb_game_pk,
                exc,
            )
        try:
            detail = await _attach_season_team_stats(detail, payload)
        except Exception as exc:
            logger.warning(
                "season team stats unavailable for %s: %s",
                detail.mlb_game_pk,
                exc,
            )
        try:
            detail = await _attach_game_leaders(detail, payload)
        except Exception as exc:
            logger.warning(
                "game leaders unavailable for %s: %s",
                detail.mlb_game_pk,
                exc,
            )

    try:
        detail = await _attach_player_of_the_game(detail)
    except Exception as exc:
        logger.warning(
            "player of the game unavailable for %s: %s",
            detail.mlb_game_pk,
            exc,
        )

    cached_espn_event_id = None
    if cached and isinstance(cached.get("espn_event_id"), str):
        cached_espn_event_id = cached["espn_event_id"]
    elif stale_fallback and isinstance(stale_fallback.get("espn_event_id"), str):
        cached_espn_event_id = stale_fallback["espn_event_id"]

    detail, espn_event_id = await _attach_espn_summary_enrichment(
        detail,
        payload,
        cached_espn_event_id=cached_espn_event_id,
    )

    entry: dict[str, Any] = {
        "detail": detail,
        "expires_at": now + cache_ttl_seconds(detail),
    }
    if espn_event_id:
        entry["espn_event_id"] = espn_event_id
    _cache[game_pk] = entry
    return detail

