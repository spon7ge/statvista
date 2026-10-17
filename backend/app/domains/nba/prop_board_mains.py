"""Select one main NBA prop line per player and stat."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.domains.betting.player_match_keys import match_player_key
from app.domains.betting.prop_stat_keys import canonical_stat_key_from_exchange
from src.odds.parlay_main_lines import balance_score

MainLineKey = tuple[str, str]


@dataclass(frozen=True)
class MainLine:
    line: float
    over_american: int | None = None
    under_american: int | None = None
    changed_at: str | None = None


MainLineIndex = dict[MainLineKey, MainLine]

_VALID_SIDES: tuple[str, ...] = ("over", "under")


def _parse_american(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _line_key(line: float) -> float:
    return round(float(line), 2)


def _as_datetime(raw: Any) -> datetime | None:
    """Coerce scraper datetimes or ISO strings to aware UTC datetimes."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        if raw.tzinfo is None:
            return raw.replace(tzinfo=timezone.utc)
        return raw.astimezone(timezone.utc)
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _row_is_main_flag(row: dict[str, Any]) -> bool | None:
    """Return the normalized main flag, or None when the key is absent."""
    if "is_main" not in row:
        return None
    value = row["is_main"]
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "t", "1", "yes"):
            return True
        if lowered in ("false", "f", "0", "no", ""):
            return False
    if value is None:
        return False
    return bool(value)


def _balance_for_sides(sides: dict[str, dict[str, Any]]) -> float:
    over_american = (sides.get("over") or {}).get("american")
    under_american = (sides.get("under") or {}).get("american")
    over_score = over_american if over_american is not None else -110
    under_score = under_american if under_american is not None else -110
    return balance_score(int(over_score), int(under_score))


def _iso(raw: Any) -> str | None:
    parsed = _as_datetime(raw)
    if parsed is None:
        return None
    return parsed.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _pick_main_line(
    lines: dict[float, dict[str, dict[str, Any]]],
) -> MainLine | None:
    if not lines:
        return None
    line, sides = min(
        lines.items(),
        key=lambda item: (_balance_for_sides(item[1]), abs(item[0])),
    )
    over = sides.get("over")
    under = sides.get("under")
    changed_ats = [
        changed_at
        for hit in (over, under)
        if hit is not None
        for changed_at in (_as_datetime(hit.get("changed_at")),)
        if changed_at is not None
    ]
    return MainLine(
        line=line,
        over_american=None if over is None else over.get("american"),
        under_american=None if under is None else under.get("american"),
        changed_at=_iso(max(changed_ats) if changed_ats else None),
    )


def _main_from_snapshot_rows(
    rows: list[dict[str, Any]],
    *,
    player_field: str,
    stat_field: str,
) -> MainLineIndex:
    """Build main O/U quotes per player and stat, preferring flagged mains."""
    groups: dict[MainLineKey, dict[float, dict[str, Any]]] = {}
    has_flag: dict[MainLineKey, bool] = {}
    any_true: dict[MainLineKey, bool] = {}

    for row in rows:
        player = str(row.get(player_field) or "").strip()
        stat_raw = str(row.get(stat_field) or "").strip()
        side = str(row.get("side") or "").lower()
        line_raw = row.get("line_score")
        if not player or not stat_raw or side not in _VALID_SIDES or line_raw is None:
            continue
        stat_key = canonical_stat_key_from_exchange(stat_raw)
        if stat_key is None:
            continue
        american = _parse_american(row.get("american_price"))
        if american is None:
            continue
        try:
            line = _line_key(float(line_raw))
        except (TypeError, ValueError):
            continue
        key: MainLineKey = (match_player_key(player), stat_key)
        line_map = groups.setdefault(key, {})
        bucket = line_map.setdefault(line, {"sides": {}, "is_main": False})
        bucket["sides"][side] = {
            "american": american,
            "changed_at": _as_datetime(row.get("scraped_at")),
        }
        flag = _row_is_main_flag(row)
        if flag is not None:
            has_flag[key] = True
        if flag is True:
            bucket["is_main"] = True
            any_true[key] = True

    mains: MainLineIndex = {}
    for key, line_map in groups.items():
        if has_flag.get(key) and not any_true.get(key):
            continue
        candidates = line_map
        if any_true.get(key):
            candidates = {
                line: bucket
                for line, bucket in line_map.items()
                if bucket["is_main"]
            }
        picked = _pick_main_line(
            {line: bucket["sides"] for line, bucket in candidates.items()}
        )
        if picked is not None:
            mains[key] = picked
    return mains
