from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.domains.nba.schemas_scoreboard import GameStatus, NbaGame, NbaTeam

ET = ZoneInfo("America/New_York")

ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"

# States that look "post" to ESPN's generic state field but are not results.
_ESPN_NON_RESULT_LABELS = {
    "STATUS_POSTPONED": "Postponed",
    "STATUS_CANCELED": "Canceled",
    "STATUS_CANCELLED": "Canceled",
    "STATUS_SUSPENDED": "Suspended",
    "STATUS_DELAYED": "Delayed",
}

# The slate should flip at midnight Pacific, not midnight Eastern. That keeps
# late-evening West Coast users on the same slate until their local day ends.
SLATE_ROLLOVER_HOUR_ET = 3


def _parse_start(start: str) -> datetime | None:
    raw = str(start or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ET)
    return parsed


def format_tip_label(start: str) -> str | None:
    """Render a scheduled tip time as an ET wall-clock label, e.g. ``7:00 PM ET``."""
    parsed = _parse_start(start)
    if parsed is None:
        return None
    local = parsed.astimezone(ET)
    return f"{local.strftime('%I:%M %p').lstrip('0')} ET"


def _espn_status(status_block: dict, start: str) -> tuple[GameStatus, str]:
    typ = status_block.get("type") or {}
    name = str(typ.get("name") or "").upper()
    state = str(typ.get("state") or "")
    short = str(typ.get("shortDetail") or typ.get("detail") or "")
    period = status_block.get("period")
    clock = str(status_block.get("displayClock") or "").strip()

    # Checked before the generic post/completed branch: a postponed game has no
    # result and must never be labelled "Final".
    if name in _ESPN_NON_RESULT_LABELS:
        return "scheduled", _ESPN_NON_RESULT_LABELS[name]
    if typ.get("completed") or name == "STATUS_FINAL" or state == "post":
        return "final", "Final"
    if "HALFTIME" in name or short.lower() == "halftime":
        return "halftime", "Halftime"
    if state == "in" or name == "STATUS_IN_PROGRESS":
        # Prefer compact Qn clock when period + clock present
        if isinstance(period, int) and period > 0 and clock:
            return "live", f"Q{period} {clock}"
        return "live", short or "Live"
    return "scheduled", format_tip_label(start) or short or "Scheduled"


def _espn_team_record(competitor: dict) -> str | None:
    for rec in competitor.get("records") or []:
        if not isinstance(rec, dict):
            continue
        if rec.get("type") == "total" or str(rec.get("name") or "").lower() in {
            "total",
            "overall",
            "ytd",
        }:
            summary = rec.get("summary")
            if summary:
                return str(summary)
    for rec in competitor.get("records") or []:
        if isinstance(rec, dict) and rec.get("summary"):
            return str(rec["summary"])
    return None


def _espn_venue(comps: dict) -> tuple[str | None, str | None]:
    venue = comps.get("venue") or {}
    if not isinstance(venue, dict):
        return None, None
    name = venue.get("fullName") or venue.get("name")
    city = (venue.get("address") or {}).get("city") if isinstance(
        venue.get("address"), dict
    ) else None
    return (str(name) if name else None, str(city) if city else None)


def _team_logo_from_espn(team: dict) -> str | None:
    logo = str(team.get("logo") or "").strip()
    return logo or None


def normalize_espn_scoreboard(payload: dict, *, date_et: str) -> list[NbaGame]:
    games: list[NbaGame] = []
    for event in payload.get("events") or []:
        comps = (event.get("competitions") or [{}])[0]
        teams = {c.get("homeAway"): c for c in (comps.get("competitors") or [])}
        away_c, home_c = teams.get("away") or {}, teams.get("home") or {}
        start = str(event.get("date") or "")
        status, label = _espn_status(event.get("status") or {}, start)
        venue, venue_city = _espn_venue(comps)

        def team(c: dict) -> NbaTeam:
            t = c.get("team") or {}
            raw = c.get("score")
            score = int(raw) if raw not in (None, "") else None
            return NbaTeam(
                abbrev=str(t.get("abbreviation") or "").strip().upper(),
                name=str(t.get("displayName") or ""),
                score=score if status != "scheduled" else None,
                record=_espn_team_record(c),
                logo_url=_team_logo_from_espn(t),
            )

        raw_id = str(event.get("id") or "").strip()
        games.append(
            NbaGame(
                id=f"espn-{raw_id}" if raw_id else "espn-unknown",
                espn_event_id=raw_id or None,
                status=status,
                status_label=label,
                away=team(away_c),
                home=team(home_c),
                start_time_et=start,
                venue=venue,
                venue_city=venue_city,
            )
        )
    return games


MatchKey = tuple[str, str]


def _match_key(game: NbaGame) -> MatchKey:
    return (game.away.abbrev, game.home.abbrev)


def slate_et_date(*, now: datetime | None = None) -> str:
    """ET calendar date used for ``/scoreboard/today`` (lags until 3:00 AM ET)."""
    current = now.astimezone(ET) if now is not None else datetime.now(ET)
    if current.hour < SLATE_ROLLOVER_HOUR_ET:
        return (current.date() - timedelta(days=1)).isoformat()
    return current.date().isoformat()


def previous_et_date(date_et: str) -> str:
    return (date.fromisoformat(date_et) - timedelta(days=1)).isoformat()


def combine_with_overnight_carryover(
    today_games: list[NbaGame],
    yesterday_games: list[NbaGame],
) -> list[NbaGame]:
    """Keep yesterday's still-in-progress games after the ET date rolls over.

    Late West Coast tips often finish after midnight ET. Without carryover they
    vanish from ``/scoreboard/today`` the moment the calendar flips.
    """
    today_keys = {_match_key(g) for g in today_games}
    today_espn_ids = {g.espn_event_id for g in today_games if g.espn_event_id}
    carryover: list[NbaGame] = []
    for game in yesterday_games:
        if game.status not in ("live", "halftime"):
            continue
        if _match_key(game) in today_keys:
            continue
        if game.espn_event_id and game.espn_event_id in today_espn_ids:
            continue
        carryover.append(game)
    return sorted(
        carryover + today_games, key=lambda g: g.start_time_et or g.id
    )
