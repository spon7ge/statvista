"""Tests for odds/props scraper runner job selection."""

from __future__ import annotations

import pytest

from src.scrapers.run_all_odds import KNOWN_NAMES, resolve_jobs


def test_resolve_jobs_default_excludes_prizepicks():
    names = [j.name for j in resolve_jobs()]
    assert "wnba_prizepick" not in names
    assert "mlb_prizepick" not in names
    assert names == [
        "wnba_novig",
        "wnba_prophetx",
        "wnba_underdog",
        "bball_pinnacle",
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_pinnacle",
    ]


def test_resolve_jobs_league_wnba():
    jobs = resolve_jobs(league="wnba")
    assert all(j.league == "wnba" for j in jobs)
    assert [j.name for j in jobs] == [
        "wnba_novig",
        "wnba_prophetx",
        "wnba_underdog",
        "bball_pinnacle",
    ]
    pinnacle = next(j for j in jobs if j.name == "bball_pinnacle")
    assert pinnacle.env == {"PINNACLE_LEAGUES": "wnba"}


def test_resolve_jobs_league_mlb():
    assert [j.name for j in resolve_jobs(league="mlb")] == [
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_pinnacle",
    ]


def test_resolve_jobs_only_subset():
    jobs = resolve_jobs(only=["mlb_underdog", "wnba_novig"])
    assert [j.name for j in jobs] == ["wnba_novig", "mlb_underdog"]


def test_resolve_jobs_only_unknown_raises():
    with pytest.raises(ValueError, match="Unknown scraper"):
        resolve_jobs(only=["not_a_scraper"])
    assert "wnba_novig" in KNOWN_NAMES
