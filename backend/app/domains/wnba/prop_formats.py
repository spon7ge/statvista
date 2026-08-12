"""DFS format breakeven helpers for WNBA prop picks.

Assumed payout multipliers (adjust later if product confirms):

| App        | Format   | Legs → M              |
| ---------- | -------- | --------------------- |
| prizepicks | power    | 2→3, 3→5, 4→10, 5→20, 6→25 |
| underdog   | standard | 2→3, 3→6, 4→10, 5→20, 6→40 |
"""

from __future__ import annotations

from typing import Literal

POWER_MULTIPLIERS: dict[int, float] = {2: 3.0, 3: 5.0, 4: 10.0, 5: 20.0, 6: 25.0}
UNDERDOG_MULTIPLIERS: dict[int, float] = {2: 3.0, 3: 6.0, 4: 10.0, 5: 20.0, 6: 40.0}

AppName = Literal["prizepicks", "underdog"]


def breakeven_pct(app: str, format: str, legs: int) -> float:
    """Per-leg breakeven % for an all-must-hit parlay: p_be = M^(-1/n) * 100."""
    if app == "prizepicks":
        if format != "power":
            raise ValueError(f"prizepicks requires format 'power', got {format!r}")
        table = POWER_MULTIPLIERS
    elif app == "underdog":
        if format != "standard":
            raise ValueError(f"underdog requires format 'standard', got {format!r}")
        table = UNDERDOG_MULTIPLIERS
    else:
        raise ValueError(f"unsupported app {app!r}")

    if legs not in table:
        raise ValueError(f"unsupported legs {legs} for {app}/{format}")

    m = table[legs]
    return round((m ** (-1.0 / legs)) * 100.0, 3)
