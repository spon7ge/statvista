"""L5 / L10 / L15 hit rates from MLB Stats API game-log splits."""

from __future__ import annotations

from typing import Any

from app.domains.mlb.prop_board_ranks import is_pitcher_stat
from app.domains.mlb.schemas_prop_board import Side
from app.domains.mlb.team_names import abbrev_from_team_name, canonical_mlb_abbrev

# Stats API gameLog splits are oldest-first. Sort by date descending so
# L5/L10/L15 are the most recent qualifying games. Missing dates sort last.
_WINDOWS: tuple[int, int, int] = (5, 10, 15)

_DIRECT_FIELDS: dict[str, str] = {
    "hits": "hits",
    "hits_allowed": "hits",
    "home_runs": "homeRuns",
    "rbis": "rbi",
    "runs": "runs",
    "runs_allowed": "runs",
    "stolen_bases": "stolenBases",
    "walks": "baseOnBalls",
    "walks_allowed": "baseOnBalls",
    "batter_strikeouts": "strikeOuts",
    "pitcher_strikeouts": "strikeOuts",
    "plate_appearances": "plateAppearances",
    "doubles": "doubles",
    "triples": "triples",
    "total_bases": "totalBases",
    "earned_runs_allowed": "earnedRuns",
}


def _stat_blob(split: dict[str, Any]) -> dict[str, Any]:
    stat = split.get("stat")
    return stat if isinstance(stat, dict) else split


def _num(raw: Any) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def _ip_to_outs(raw: Any) -> float | None:
    """Parse baseball IP notation: ``1.2`` is 1 inning + 2 outs = 5 outs."""
    if raw is None or isinstance(raw, bool):
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        if "." in text:
            innings, leftover = text.split(".", 1)
            return float(int(innings) * 3 + int(leftover))
        return float(int(text) * 3)
    except (TypeError, ValueError):
        return None


def actual_for_stat(stat: str, split: dict[str, Any]) -> float | None:
    blob = _stat_blob(split)
    if stat == "hits_runs_rbis":
        parts = (_num(blob.get("hits")), _num(blob.get("runs")), _num(blob.get("rbi")))
        if any(part is None for part in parts):
            return None
        return parts[0] + parts[1] + parts[2]
    if stat == "singles":
        hits = _num(blob.get("hits"))
        if hits is None:
            return None
        extras = (
            (_num(blob.get("doubles")) or 0.0)
            + (_num(blob.get("triples")) or 0.0)
            + (_num(blob.get("homeRuns")) or 0.0)
        )
        return hits - extras
    if stat == "pitching_outs":
        outs = _num(blob.get("outs"))
        if outs is not None:
            return outs
        return _ip_to_outs(blob.get("inningsPitched"))
    if stat == "pitches_thrown":
        pitches = _num(blob.get("numberOfPitches"))
        if pitches is not None:
            return pitches
        return _num(blob.get("pitchesThrown"))
    field = _DIRECT_FIELDS.get(stat)
    if field is None:
        return None
    return _num(blob.get(field))


def _pitcher_appeared(blob: dict[str, Any]) -> bool:
    for key in ("outs", "battersFaced"):
        value = _num(blob.get(key))
        if value is not None and value > 0:
            return True
    outs = _ip_to_outs(blob.get("inningsPitched"))
    return outs is not None and outs > 0


def qualifying_splits(stat: str, splits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for split in splits:
        blob = _stat_blob(split)
        if is_pitcher_stat(stat):
            if _pitcher_appeared(blob):
                kept.append(split)
            continue
        pa = _num(blob.get("plateAppearances"))
        if pa is not None and pa > 0:
            kept.append(split)
    return kept


def _window_pct(
    stat: str,
    side: Side,
    line: float,
    window: list[dict[str, Any]],
) -> int | None:
    if not window:
        return None
    hits = 0
    for split in window:
        actual = actual_for_stat(stat, split)
        if actual is None:
            return None
        if side == "over" and actual > line:
            hits += 1
        elif side == "under" and actual < line:
            hits += 1
    return int(round(hits / len(window) * 100))


def _date_key(split: dict[str, Any]) -> str:
    raw = split.get("date")
    return raw if isinstance(raw, str) else ""


def hit_rates(
    stat: str,
    side: Side,
    line: float,
    splits: list[dict[str, Any]],
) -> tuple[int | None, int | None, int | None]:
    qualifying = qualifying_splits(stat, splits)
    if not qualifying:
        return None, None, None
    newest_first = sorted(qualifying, key=_date_key, reverse=True)
    l5, l10, l15 = (_window_pct(stat, side, line, newest_first[:n]) for n in _WINDOWS)
    return l5, l10, l15


def opponent_abbrev_from_split(
    split: dict[str, Any],
    id_to_abbrev: dict[int, str] | None = None,
) -> str | None:
    stamped = canonical_mlb_abbrev(split.get("opponent_abbrev"))
    if stamped:
        return stamped
    opponent = split.get("opponent")
    if not isinstance(opponent, dict):
        return None
    from_label = canonical_mlb_abbrev(opponent.get("abbreviation"))
    if from_label:
        return from_label
    team_id = opponent.get("id")
    if team_id is not None and id_to_abbrev:
        try:
            mapped = id_to_abbrev.get(int(team_id))
        except (TypeError, ValueError):
            mapped = None
        if mapped:
            return canonical_mlb_abbrev(mapped)
    return abbrev_from_team_name(opponent.get("name"))


def h2h_rate(
    stat: str,
    side: Side,
    line: float,
    splits: list[dict[str, Any]],
    opponent_abbrev: str | None,
    id_to_abbrev: dict[int, str] | None = None,
) -> int | None:
    """Hit rate of this side vs this line against opponent across the given games."""
    opp = canonical_mlb_abbrev(opponent_abbrev)
    if not opp:
        return None
    vs_opp = [
        split
        for split in qualifying_splits(stat, splits)
        if opponent_abbrev_from_split(split, id_to_abbrev) == opp
    ]
    return _window_pct(stat, side, line, vs_opp)
