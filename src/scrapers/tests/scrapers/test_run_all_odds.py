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
        "wnba_draftking",
        "wnba_fanduel",
        "bball_pinnacle",
        "wnba_prizepick",
        "nba_novig",
        "nba_prophetx",
        "nba_underdog",
        "nba_draftking",
        "nba_fanduel",
        "nba_pinnacle",
        "nba_prizepick",
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_draftking",
        "mlb_fanduel",
        "mlb_pinnacle",
        "mlb_prizepick",
    ]
    by_name = {j.name: j for j in jobs}
    assert by_name["wnba_prizepick"].module == "src.scrapers.wnba.wnba_prizepick"
    assert by_name["wnba_prizepick"].league == "wnba"
    assert by_name["wnba_draftking"].module == "src.scrapers.wnba.wnba_draftking"
    assert by_name["wnba_fanduel"].module == "src.scrapers.wnba.wnba_fanduel"
    assert by_name["nba_draftking"].module == "src.scrapers.nba.nba_draftking"
    assert by_name["nba_fanduel"].module == "src.scrapers.nba.nba_fanduel"
    assert by_name["nba_prizepick"].module == "src.scrapers.nba.nba_prizepick"
    assert by_name["nba_prizepick"].league == "nba"
    assert by_name["mlb_draftking"].module == "src.scrapers.mlb.mlb_draftking"
    assert by_name["mlb_fanduel"].module == "src.scrapers.mlb.mlb_fanduel"
    assert by_name["mlb_prizepick"].module == "src.scrapers.mlb.mlb_prizepick"
    assert by_name["mlb_prizepick"].league == "mlb"


def test_resolve_jobs_league_wnba():
    jobs = resolve_jobs(league="wnba")
    assert all(j.league == "wnba" for j in jobs)
    assert [j.name for j in jobs] == [
        "wnba_novig",
        "wnba_prophetx",
        "wnba_underdog",
        "wnba_draftking",
        "wnba_fanduel",
        "bball_pinnacle",
        "wnba_prizepick",
    ]
    pinnacle = next(j for j in jobs if j.name == "bball_pinnacle")
    assert pinnacle.module == "src.scrapers.wnba.wnba_pinnacle"
    assert pinnacle.env == {"PINNACLE_LEAGUES": "wnba"}


def test_resolve_jobs_league_nba():
    jobs = resolve_jobs(league="nba")
    assert all(j.league == "nba" for j in jobs)
    assert [j.name for j in jobs] == [
        "nba_novig",
        "nba_prophetx",
        "nba_underdog",
        "nba_draftking",
        "nba_fanduel",
        "nba_pinnacle",
        "nba_prizepick",
    ]
    by_name = {j.name: j for j in jobs}
    assert by_name["nba_novig"].module == "src.scrapers.nba.nba_novig"
    assert by_name["nba_pinnacle"].module == "src.scrapers.nba.nba_pinnacle"
    assert by_name["nba_draftking"].module == "src.scrapers.nba.nba_draftking"
    assert by_name["nba_fanduel"].module == "src.scrapers.nba.nba_fanduel"


def test_resolve_jobs_league_mlb():
    jobs = resolve_jobs(league="mlb")
    assert [j.name for j in jobs] == [
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_draftking",
        "mlb_fanduel",
        "mlb_pinnacle",
        "mlb_prizepick",
    ]
    by_name = {j.name: j for j in jobs}
    assert by_name["mlb_draftking"].module == "src.scrapers.mlb.mlb_draftking"
    assert by_name["mlb_fanduel"].module == "src.scrapers.mlb.mlb_fanduel"


def test_resolve_jobs_only_subset():
    jobs = resolve_jobs(only=["mlb_underdog", "wnba_novig"])
    assert [j.name for j in jobs] == ["wnba_novig", "mlb_underdog"]


def test_resolve_jobs_only_unknown_raises():
    with pytest.raises(ValueError, match="Unknown scraper"):
        resolve_jobs(only=["not_a_scraper"])
    assert "wnba_novig" in KNOWN_NAMES
    assert "wnba_draftking" in KNOWN_NAMES
    assert "wnba_fanduel" in KNOWN_NAMES
    assert "wnba_prizepick" in KNOWN_NAMES
    assert "nba_draftking" in KNOWN_NAMES
    assert "nba_fanduel" in KNOWN_NAMES
    assert "mlb_draftking" in KNOWN_NAMES
    assert "mlb_fanduel" in KNOWN_NAMES
    assert "mlb_prizepick" in KNOWN_NAMES


def test_resolve_jobs_exclude_prizepicks():
    jobs = resolve_jobs(exclude=["wnba_prizepick", "nba_prizepick", "mlb_prizepick"])
    names = [j.name for j in jobs]
    assert "wnba_prizepick" not in names
    assert "nba_prizepick" not in names
    assert "mlb_prizepick" not in names
    assert names == [
        "wnba_novig",
        "wnba_prophetx",
        "wnba_underdog",
        "wnba_draftking",
        "wnba_fanduel",
        "bball_pinnacle",
        "nba_novig",
        "nba_prophetx",
        "nba_underdog",
        "nba_draftking",
        "nba_fanduel",
        "nba_pinnacle",
        "mlb_novig",
        "mlb_prophetx",
        "mlb_underdog",
        "mlb_draftking",
        "mlb_fanduel",
        "mlb_pinnacle",
    ]


def test_resolve_jobs_exclude_unknown_raises():
    with pytest.raises(ValueError, match="Unknown scraper"):
        resolve_jobs(exclude=["not_a_scraper"])


def test_resolve_jobs_exclude_after_only():
    jobs = resolve_jobs(only=["wnba_novig", "wnba_prizepick"], exclude=["wnba_prizepick"])
    assert [j.name for j in jobs] == ["wnba_novig"]
