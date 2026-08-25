"""Tests for odds/props scraper runner job selection."""

from __future__ import annotations

import pytest

from src.scrapers.run_all_odds import KNOWN_NAMES, resolve_jobs


def test_resolve_jobs_default_includes_prizepicks():
    jobs = resolve_jobs()
    names = [j.name for j in jobs]
    assert names == [
        "wnba_novig",
        "wnba_prophetx",
        "wnba_underdog",
        "bball_pinnacle",
        "wnba_prizepick",
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_pinnacle",
        "mlb_prizepick",
    ]
    by_name = {j.name: j for j in jobs}
    assert by_name["wnba_prizepick"].module == "src.scrapers.wnba_prizepick"
    assert by_name["wnba_prizepick"].league == "wnba"
    assert by_name["mlb_prizepick"].module == "src.scrapers.mlb_prizepick"
    assert by_name["mlb_prizepick"].league == "mlb"


def test_resolve_jobs_league_wnba():
    jobs = resolve_jobs(league="wnba")
    assert all(j.league == "wnba" for j in jobs)
    assert [j.name for j in jobs] == [
        "wnba_novig",
        "wnba_prophetx",
        "wnba_underdog",
        "bball_pinnacle",
        "wnba_prizepick",
    ]
    pinnacle = next(j for j in jobs if j.name == "bball_pinnacle")
    assert pinnacle.env == {"PINNACLE_LEAGUES": "wnba"}


def test_resolve_jobs_league_mlb():
    assert [j.name for j in resolve_jobs(league="mlb")] == [
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_pinnacle",
        "mlb_prizepick",
    ]


def test_resolve_jobs_only_subset():
    jobs = resolve_jobs(only=["mlb_underdog", "wnba_novig"])
    assert [j.name for j in jobs] == ["wnba_novig", "mlb_underdog"]


def test_resolve_jobs_only_unknown_raises():
    with pytest.raises(ValueError, match="Unknown scraper"):
        resolve_jobs(only=["not_a_scraper"])
    assert "wnba_novig" in KNOWN_NAMES
    assert "wnba_prizepick" in KNOWN_NAMES
    assert "mlb_prizepick" in KNOWN_NAMES
