"""Props boards list a game only until it starts."""

from datetime import datetime, timezone

# Scoreboard statuses that mean the game is no longer pregame.
_STARTED_STATUSES = frozenset({"live", "halftime", "final"})


def prop_still_upcoming(
    *,
    start: datetime | None,
    status: str | None,
    now: datetime,
) -> bool:
    """Return whether a prop row should stay on the board.

    A listed tip at or before ``now`` has started. Live, halftime, and final
    override a tip that is still in the future, so an early start is removed
    too. A row with no tip and no started status stays: we cannot tell that
    its game has begun.
    """
    if status in _STARTED_STATUSES:
        return False
    if start is None:
        return True
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return start > now
