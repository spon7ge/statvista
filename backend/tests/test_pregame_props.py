"""Props boards keep lines only until the game starts."""

from datetime import datetime, timezone

from app.domains.betting.pregame_props import prop_still_upcoming

NOW = datetime(2026, 10, 16, 20, 0, tzinfo=timezone.utc)
FUTURE = datetime(2026, 10, 16, 23, 0, tzinfo=timezone.utc)
PAST = datetime(2026, 10, 16, 19, 0, tzinfo=timezone.utc)


def test_future_tip_stays_on_the_board():
    assert prop_still_upcoming(start=FUTURE, status="scheduled", now=NOW) is True


def test_listed_tip_that_has_passed_is_removed():
    assert prop_still_upcoming(start=PAST, status="scheduled", now=NOW) is False
    assert prop_still_upcoming(start=NOW, status=None, now=NOW) is False


def test_live_or_final_game_is_removed_even_before_the_listed_tip():
    assert prop_still_upcoming(start=FUTURE, status="live", now=NOW) is False
    assert prop_still_upcoming(start=FUTURE, status="halftime", now=NOW) is False
    assert prop_still_upcoming(start=FUTURE, status="final", now=NOW) is False


def test_unknown_tip_stays_when_the_game_is_not_marked_started():
    assert prop_still_upcoming(start=None, status=None, now=NOW) is True
    assert prop_still_upcoming(start=None, status="scheduled", now=NOW) is True
