"""Tests for odds/props scraper runner job selection and execution waves."""

from __future__ import annotations

import threading

import pytest

from src.scrapers.run_all_odds import KNOWN_NAMES, resolve_jobs, run_all


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


def test_http_books_run_together_and_browser_books_start_after():
    """Novig, Underdog, and FanDuel overlap. Pinnacle and PrizePicks wait, in that order."""
    lock = threading.Lock()
    http_running = 0
    peak_http = 0
    late_started_during_http = False
    events: list[tuple[str, str]] = []
    http_names = {"nba_novig", "nba_underdog", "wnba_fanduel"}
    started_together = threading.Barrier(len(http_names))

    def fake_run(job, *, python=None):
        del python
        nonlocal http_running, peak_http, late_started_during_http
        late = "pinnacle" in job.name or "prizepick" in job.name
        with lock:
            events.append(("start", job.name))
            if late and http_running > 0:
                late_started_during_http = True
            if not late:
                http_running += 1
                peak_http = max(peak_http, http_running)
        if not late:
            started_together.wait(timeout=2)
            with lock:
                http_running -= 1
                events.append(("end", job.name))
            return 0
        with lock:
            events.append(("end", job.name))
        return 0

    code = run_all(
        only=["nba_novig", "nba_underdog", "nba_pinnacle", "nba_prizepick", "wnba_fanduel"],
        run_job_fn=fake_run,
    )

    assert code == 0
    assert peak_http == 3
    assert late_started_during_http is False
    http_end = max(i for i, (kind, name) in enumerate(events) if kind == "end" and name in http_names)
    pinnacle_start = next(i for i, (kind, name) in enumerate(events) if kind == "start" and name == "nba_pinnacle")
    prizepick_start = next(i for i, (kind, name) in enumerate(events) if kind == "start" and name == "nba_prizepick")
    pinnacle_end = next(i for i, (kind, name) in enumerate(events) if kind == "end" and name == "nba_pinnacle")
    assert pinnacle_start > http_end
    assert prizepick_start > pinnacle_end


def test_fail_fast_skips_browser_books_after_an_http_failure():
    started: list[str] = []

    def fake_run(job, *, python=None):
        del python
        started.append(job.name)
        return 1 if job.name == "nba_novig" else 0

    code = run_all(
        only=["nba_novig", "nba_underdog", "nba_pinnacle", "nba_prizepick"],
        fail_fast=True,
        run_job_fn=fake_run,
    )

    assert code == 1
    assert "nba_underdog" in started
    assert "nba_pinnacle" not in started
    assert "nba_prizepick" not in started
