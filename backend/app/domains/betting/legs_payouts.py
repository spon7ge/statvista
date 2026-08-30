from __future__ import annotations

PP_POWER_M = {2: 3.0, 3: 5.0, 4: 10.0, 5: 20.0, 6: 37.5}
UD_STANDARD_M = {2: 3.0, 3: 6.0, 4: 10.0, 5: 20.0, 6: 40.0}
FLEX6_BE = 0.542


def validate_legs_query(app: str, format: str, legs: int) -> None:
    if app == "prizepicks":
        if format == "power" and legs in PP_POWER_M:
            return
        if format == "flex" and legs == 6:
            return
    if app == "underdog" and format == "standard" and legs in UD_STANDARD_M:
        return
    raise ValueError(f"unsupported legs query {app!r}/{format!r}/{legs}")


def base_break_even(app: str, format: str, legs: int) -> float:
    validate_legs_query(app, format, legs)
    if app == "prizepicks" and format == "flex":
        return FLEX6_BE
    table = PP_POWER_M if app == "prizepicks" else UD_STANDARD_M
    m = table[legs]
    return float(m ** (-1.0 / legs))


def base_required_margin_pts(app: str, format: str, legs: int) -> float:
    validate_legs_query(app, format, legs)
    if app == "prizepicks" and format == "flex":
        return 3.0
    return 4.0


def leg_break_even(base_p_be: float, payout_multiplier: float | None) -> float:
    m = 1.0 if payout_multiplier is None else float(payout_multiplier)
    if m <= 0:
        raise ValueError("payout_multiplier must be > 0")
    return base_p_be / min(m, 1.0)


def flex3_ev(p: float) -> float:
    return 2.25 * p**3 + 1.25 * 3 * p**2 * (1.0 - p)
