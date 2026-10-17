"""Daily nba_api season logs that feed prop-board L5–H2H."""

from __future__ import annotations

import time

import pytest

from app.domains.betting import season_log_cache as cache
from app.domains.wnba.prop_board_form import h2h_rate, hit_rates


def _row(name: str, date: str, pts: float, matchup: str = "LVA vs. TOR") -> dict:
    return {
        "PLAYER_NAME": name,
        "GAME_DATE": date,
        "MATCHUP": matchup,
        "MIN": 30,
        "PTS": pts,
        "REB": 5,
        "AST": 4,
        "FG3M": 1,
    }


@pytest.mark.asyncio
async def test_season_logs_fetch_once_per_day_and_feed_hit_rates(monkeypatch, tmp_path):
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    calls: list[tuple] = []

    def fake_frame(kind, measure, season, season_type, league_id):
        calls.append((kind, measure, season, season_type, league_id))
        if kind == "player" and measure == "Base" and season_type == "Regular Season":
            return [
                _row("A'ja Wilson", "2026-09-01", 20),
                _row("A'ja Wilson", "2026-09-03", 22),
                _row("A'ja Wilson", "2026-09-05", 18),
                _row("A'ja Wilson", "2026-09-07", 30),
                _row("A'ja Wilson", "2026-09-09", 12),
            ]
        if kind == "player" and measure == "Base" and season_type == "Playoffs":
            return [_row("A'ja Wilson", "2026-10-10", 28, "LVA vs. ATL")]
        return [{"ok": True}]

    monkeypatch.setattr(cache, "fetch_logs_frame", fake_frame)
    monkeypatch.setattr(cache.time, "time", lambda: 1_000_000.0)

    first = await cache.load_season_logs("wnba")
    second = await cache.load_season_logs("wnba")

    assert second == first
    assert len(calls) == 14
    assert ("player", "Base", "2026", "Regular Season", "10") in calls
    assert ("player", "Advanced", "2026", "Playoffs", "10") in calls
    assert ("player", "Base", "2026", "Pre Season", "10") in calls
    assert ("player", "Base", "2025", "Regular Season", "10") in calls
    assert ("player", "Base", "2025", "Playoffs", "10") in calls
    assert ("player", "Base", "2025", "Pre Season", "10") not in calls
    assert ("team", "Base", "2026", "Regular Season", "10") in calls
    assert ("team", "Advanced", "2026", "Playoffs", "10") in calls

    splits = cache.player_base_splits(first, "A'ja Wilson")
    l5, l10, l15 = hit_rates("points", "over", 19.5, splits)
    # Newest five: 28, 12, 30, 18, 22 → three overs.
    assert (l5, l10, l15) == (60, 67, 67)


@pytest.mark.asyncio
async def test_nba_season_logs_use_the_nba_season_and_omit_league_id(monkeypatch, tmp_path):
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    calls: list[tuple] = []

    def fake_frame(kind, measure, season, season_type, league_id):
        calls.append((kind, measure, season, season_type, league_id))
        return []

    monkeypatch.setattr(cache, "fetch_logs_frame", fake_frame)
    monkeypatch.setattr(cache, "season_label", lambda league: "2026-27")
    monkeypatch.setattr(cache.time, "time", lambda: 1_000_000.0)

    await cache.load_season_logs("nba")
    assert ("player", "Base", "2026-27", "Regular Season", None) in calls
    assert ("player", "Base", "2025-26", "Regular Season", None) in calls
    assert ("player", "Base", "2025-26", "Playoffs", None) in calls
    assert all(league_id is None for *_, league_id in calls)


def test_preseason_games_fill_hit_rates_only_before_the_regular_season():
    preseason = {
        "PLAYER_NAME": "Cooper Flagg",
        "GAME_DATE": "2026-10-16T00:00:00",
        "SEASON_TYPE": "Pre Season",
        "MIN": 28,
        "PTS": 18,
    }
    regular = {
        "PLAYER_NAME": "Cooper Flagg",
        "GAME_DATE": "2026-10-24T00:00:00",
        "SEASON_TYPE": "Regular Season",
        "MIN": 32,
        "PTS": 24,
    }
    only_preseason = cache.player_base_splits({"player_base": [preseason]}, "Cooper Flagg")
    assert [row["PTS"] for row in only_preseason] == [18]
    both = cache.player_base_splits(
        {"player_base": [preseason, regular]}, "Cooper Flagg"
    )
    assert [row["PTS"] for row in both] == [24]


def test_h2h_uses_the_last_two_seasons_and_skips_preseason():
    logs = {
        "player_base": [
            _row("A'ja Wilson", "2026-10-10", 30, "LVA vs. ATL"),
            _row("A'ja Wilson", "2026-10-08", 8, "LVA vs. ATL"),
        ],
        "player_base_prev": [
            _row("A'ja Wilson", "2025-09-12", 22, "LVA @ ATL"),
            _row("A'ja Wilson", "2025-06-01", 40, "LVA vs. NYL"),
            _row("A'ja Wilson", "2025-10-01", 0, "LVA vs. ATL"),
        ],
    }
    logs["player_base"][1]["SEASON_TYPE"] = "Pre Season"
    logs["player_base"][0]["SEASON_TYPE"] = "Regular Season"
    logs["player_base_prev"][0]["SEASON_TYPE"] = "Regular Season"
    logs["player_base_prev"][1]["SEASON_TYPE"] = "Regular Season"
    logs["player_base_prev"][2]["SEASON_TYPE"] = "Playoffs"
    recent = cache.player_base_splits(logs, "A'ja Wilson")
    assert [row["PTS"] for row in recent] == [30]
    versus = cache.h2h_splits(logs, "A'ja Wilson")
    assert sorted(row["PTS"] for row in versus) == [22, 30, 40]
    assert h2h_rate("points", "over", 19.5, versus, "ATL") == 100


@pytest.mark.asyncio
async def test_failed_refresh_keeps_yesterdays_logs(monkeypatch, tmp_path):
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(cache.time, "time", lambda: 1_000_000.0)
    monkeypatch.setattr(
        cache,
        "fetch_logs_frame",
        lambda *a: [_row("Breanna Stewart", "2026-10-01", 25)],
    )
    saved = await cache.load_season_logs("wnba")

    def boom(*_a):
        raise TimeoutError()

    monkeypatch.setattr(cache, "fetch_logs_frame", boom)
    monkeypatch.setattr(cache.time, "time", lambda: 1_000_000.0 + cache.TTL_SECONDS + 5)
    stale = await cache.load_season_logs("wnba")
    assert stale == saved
    assert cache.player_base_splits(stale, "Breanna Stewart")[0]["PTS"] == 25
