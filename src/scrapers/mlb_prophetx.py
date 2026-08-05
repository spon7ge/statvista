"""ProphetX MLB scraper — public API (team markets + player props)."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "prophetx", "mlb")
_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")


def output_filename(league: str, now: datetime, *, kind: str) -> str:
    stamp = now.astimezone(_OUTPUT_TZ).strftime("%Y-%m-%d_%H%M%S")
    return f"prophetx_{league.strip().lower()}_{stamp}_{kind}.json"


def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return props_path[: -len("_props.json")] + "_team.json"
    root, ext = os.path.splitext(props_path)
    return f"{root}_team{ext or '.json'}"


def resolve_props_output_path(*, now: datetime | None = None) -> str:
    when = now or datetime.now(_OUTPUT_TZ)
    env_file = os.environ.get("PROPHETX_OUTPUT", "").strip()
    env_dir = os.environ.get("PROPHETX_OUTPUT_DIR", "").strip()
    name = output_filename("mlb", when, kind="props")
    if env_file:
        expanded = os.path.expanduser(env_file)
        if expanded.lower().endswith(".json") and not os.path.isdir(expanded):
            return expanded
        os.makedirs(expanded, exist_ok=True)
        return os.path.join(expanded, name)
    base = env_dir or _DEFAULT_OUTPUT_DIR
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, name)


def pick_main_market_line(market: dict[str, Any]) -> dict[str, Any] | None:
    lines = [ln for ln in (market.get("marketLines") or []) if isinstance(ln, dict)]
    if not lines:
        return None
    favourites = [ln for ln in lines if ln.get("favourite") is True]
    if len(favourites) == 1:
        return favourites[0]
    if len(favourites) > 1:
        return favourites[0]
    if len(lines) == 1:
        return lines[0]
    return None


def best_selection(side: list[dict[str, Any]]) -> dict[str, Any] | None:
    for sel in side:
        if isinstance(sel, dict):
            return sel
    return None


def american_and_stake(sel: dict[str, Any]) -> tuple[int | None, float | None]:
    raw = sel.get("odds")
    american: int | None
    try:
        american = int(raw) if raw is not None else None
    except (TypeError, ValueError):
        american = None
    stake_raw = sel.get("stake")
    try:
        stake = float(stake_raw) if stake_raw is not None else None
    except (TypeError, ValueError):
        stake = None
    return american, stake
