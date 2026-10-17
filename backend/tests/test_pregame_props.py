"""Props boards keep lines only until the game starts."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.domains.betting.pregame_props import load_prop_slate, prop_still_upcoming, select_prop_slate

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


def test_unknown_tip_stays_only_when_the_slate_did_not_load():
    assert prop_still_upcoming(start=None, status=None, now=NOW, on_slate=True) is True
    assert prop_still_upcoming(start=None, status="scheduled", now=NOW, on_slate=True) is True


def test_player_off_the_slate_is_removed_when_other_teams_are_playing():
    assert prop_still_upcoming(start=None, status=None, now=NOW, on_slate=False) is False


def _game(status: str, start: datetime) -> SimpleNamespace:
    return SimpleNamespace(status=status, start_time_et=start.isoformat())


def test_keeps_today_when_a_game_is_still_ahead():
    today = [_game("scheduled", FUTURE)]
    nxt = [_game("scheduled", datetime(2026, 10, 17, 19, 30, tzinfo=timezone.utc))]
    assert select_prop_slate(today, nxt, NOW) is today


def test_uses_the_next_slate_when_today_has_no_upcoming_game():
    today = [_game("final", PAST), _game("live", FUTURE)]
    nxt = [_game("scheduled", FUTURE)]
    assert select_prop_slate(today, nxt, NOW) is nxt


def test_uses_the_next_slate_when_today_is_empty():
    nxt = [_game("scheduled", FUTURE)]
    assert select_prop_slate([], nxt, NOW) is nxt


def test_keeps_today_when_the_next_slate_has_no_upcoming_game():
    today = [_game("final", PAST)]
    assert select_prop_slate(today, [], NOW) is today


def test_passed_tip_does_not_block_the_next_slate():
    today = [_game("scheduled", PAST)]
    nxt = [_game("scheduled", FUTURE)]
    assert select_prop_slate(today, nxt, NOW) is nxt


@pytest.mark.asyncio
async def test_load_prop_slate_fetches_the_next_date_when_today_is_done():
    today = SimpleNamespace(date="2026-10-16", games=[_game("final", PAST)])
    nxt = SimpleNamespace(
        date="2026-10-17",
        games=[_game("scheduled", FUTURE)],
    )
    calls: list[str] = []

    async def get_today():
        calls.append("today")
        return today

    async def get_date(date_et: str):
        calls.append(date_et)
        return nxt

    chosen = await load_prop_slate(get_today, get_date, now=NOW)
    assert chosen is nxt
    assert calls == ["today", "2026-10-17"]


@pytest.mark.asyncio
async def test_load_prop_slate_skips_the_next_date_when_today_is_still_ahead():
    today = SimpleNamespace(date="2026-10-16", games=[_game("scheduled", FUTURE)])

    async def get_today():
        return today

    async def get_date(date_et: str):
        raise AssertionError(date_et)

    assert await load_prop_slate(get_today, get_date, now=NOW) is today


@pytest.mark.asyncio
async def test_load_prop_slate_skips_empty_days_until_a_game_is_ahead():
    today = SimpleNamespace(date="2026-10-17", games=[])
    opening = SimpleNamespace(
        date="2026-10-20",
        games=[_game("scheduled", datetime(2026, 10, 20, 23, 0, tzinfo=timezone.utc))],
    )
    calls: list[str] = []

    async def get_today():
        return today

    async def get_date(date_et: str):
        calls.append(date_et)
        if date_et == "2026-10-20":
            return opening
        return SimpleNamespace(date=date_et, games=[])

    chosen = await load_prop_slate(get_today, get_date, now=NOW)
    assert chosen is opening
    assert calls == ["2026-10-18", "2026-10-19", "2026-10-20"]
