"""Run all WNBA/NBA/MLB odds/props scrapers.

Usage:
  python -m src.scrapers.run_all_odds
  python -m src.scrapers.run_all_odds --league nba
  python -m src.scrapers.run_all_odds --only wnba_novig,nba_fanduel,mlb_underdog
  python -m src.scrapers.run_all_odds --exclude wnba_prizepick,nba_prizepick,mlb_prizepick
  python -m src.scrapers.run_all_odds --fail-fast
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Literal

League = Literal["wnba", "nba", "mlb", "all"]
Sport = Literal["wnba", "nba", "mlb"]


@dataclass(frozen=True)
class ScraperJob:
    name: str
    league: Sport
    module: str
    env: dict[str, str] | None = None


# HTTP books run together. Pinnacle and PrizePicks stay after that wave so a
# browser/DataDome fallback does not start until the HTTP scrapers have finished.
_PRINT_LOCK = threading.Lock()
SCRAPER_JOBS: tuple[ScraperJob, ...] = (
    ScraperJob("wnba_novig", "wnba", "src.scrapers.wnba.wnba_novig"),
    ScraperJob("wnba_prophetx", "wnba", "src.scrapers.wnba.wnba_prophetx"),
    ScraperJob("wnba_underdog", "wnba", "src.scrapers.wnba.wnba_underdog"),
    ScraperJob("wnba_draftking", "wnba", "src.scrapers.wnba.wnba_draftking"),
    ScraperJob("wnba_fanduel", "wnba", "src.scrapers.wnba.wnba_fanduel"),
    ScraperJob(
        "bball_pinnacle",
        "wnba",
        "src.scrapers.wnba.wnba_pinnacle",
        env={"PINNACLE_LEAGUES": "wnba"},
    ),
    ScraperJob("wnba_prizepick", "wnba", "src.scrapers.wnba.wnba_prizepick"),
    ScraperJob("nba_novig", "nba", "src.scrapers.nba.nba_novig"),
    ScraperJob("nba_prophetx", "nba", "src.scrapers.nba.nba_prophetx"),
    ScraperJob("nba_underdog", "nba", "src.scrapers.nba.nba_underdog"),
    ScraperJob("nba_draftking", "nba", "src.scrapers.nba.nba_draftking"),
    ScraperJob("nba_fanduel", "nba", "src.scrapers.nba.nba_fanduel"),
    ScraperJob("nba_pinnacle", "nba", "src.scrapers.nba.nba_pinnacle"),
    ScraperJob("nba_prizepick", "nba", "src.scrapers.nba.nba_prizepick"),
    ScraperJob("mlb_novig", "mlb", "src.scrapers.mlb.mlb_novig"),
    ScraperJob("mlb_prophetx", "mlb", "src.scrapers.mlb.mlb_prophetx"),
    ScraperJob("mlb_underdog", "mlb", "src.scrapers.mlb.mlb_underdog"),
    ScraperJob("mlb_draftking", "mlb", "src.scrapers.mlb.mlb_draftking"),
    ScraperJob("mlb_fanduel", "mlb", "src.scrapers.mlb.mlb_fanduel"),
    ScraperJob("mlb_pinnacle", "mlb", "src.scrapers.mlb.mlb_pinnacle"),
    ScraperJob("mlb_prizepick", "mlb", "src.scrapers.mlb.mlb_prizepick"),
)

KNOWN_NAMES = {job.name for job in SCRAPER_JOBS}


def _unknown_names(names: list[str]) -> list[str]:
    return [name for name in names if name not in KNOWN_NAMES]


def resolve_jobs(
    *,
    league: League = "all",
    only: list[str] | None = None,
    exclude: list[str] | None = None,
) -> list[ScraperJob]:
    """Filter the canonical job list by league, optional allowlist, then denylist."""
    jobs = list(SCRAPER_JOBS)
    if league != "all":
        jobs = [j for j in jobs if j.league == league]
    if only:
        unknown = _unknown_names(only)
        if unknown:
            raise ValueError(
                f"Unknown scraper name(s): {unknown}; choose from {sorted(KNOWN_NAMES)}"
            )
        allow = set(only)
        jobs = [j for j in jobs if j.name in allow]
    if exclude:
        unknown = _unknown_names(exclude)
        if unknown:
            raise ValueError(
                f"Unknown scraper name(s): {unknown}; choose from {sorted(KNOWN_NAMES)}"
            )
        deny = set(exclude)
        jobs = [j for j in jobs if j.name not in deny]
    return jobs


def _is_late_job(job: ScraperJob) -> bool:
    """Pinnacle and PrizePicks drive a browser, so they start after the HTTP books."""
    return "pinnacle" in job.name or "prizepick" in job.name


def partition_jobs(jobs: list[ScraperJob]) -> tuple[list[ScraperJob], list[ScraperJob]]:
    """HTTP books first, then Pinnacle and PrizePicks in catalog order."""
    http_jobs = [job for job in jobs if not _is_late_job(job)]
    late_jobs = [job for job in jobs if _is_late_job(job)]
    return http_jobs, late_jobs


def run_job(job: ScraperJob, *, python: str | None = None) -> int:
    """Run one scraper module as a subprocess; return its exit code."""
    cmd = [python or sys.executable, "-m", job.module]
    env = os.environ.copy()
    if job.env:
        env.update(job.env)
    with _PRINT_LOCK:
        print(f"\n=== {job.name} ({job.module}) ===", flush=True)
    completed = subprocess.run(cmd, env=env, check=False)
    return int(completed.returncode)


def _print_summary(results: list[tuple[str, int]]) -> int:
    print("\n=== Summary ===", flush=True)
    failed = 0
    for name, code in results:
        status = "ok" if code == 0 else f"FAIL ({code})"
        print(f"  {name}: {status}", flush=True)
        if code != 0:
            failed += 1
    print(f"{len(results) - failed}/{len(results)} succeeded", flush=True)
    return failed


def run_all(
    *,
    league: League = "all",
    only: list[str] | None = None,
    exclude: list[str] | None = None,
    fail_fast: bool = False,
    python: str | None = None,
    run_job_fn: Callable[..., int] | None = None,
) -> int:
    """Run HTTP books together, then Pinnacle and PrizePicks. Returns 0 iff all succeeded."""
    execute = run_job_fn or run_job
    jobs = resolve_jobs(league=league, only=only, exclude=exclude)
    if not jobs:
        print("No scrapers selected.", flush=True)
        return 1

    http_jobs, late_jobs = partition_jobs(jobs)
    results: dict[str, int] = {}

    if http_jobs:
        with ThreadPoolExecutor(max_workers=len(http_jobs)) as pool:
            futures = {
                pool.submit(execute, job, python=python): job for job in http_jobs
            }
            for future in as_completed(futures):
                job = futures[future]
                results[job.name] = int(future.result())
        if fail_fast and any(code != 0 for code in results.values()):
            failed_name = next(name for name, code in results.items() if code != 0)
            print(
                f"Stopping after failure: {failed_name} exited {results[failed_name]}",
                flush=True,
            )
            completed = [(job.name, results[job.name]) for job in http_jobs]
            _print_summary(completed)
            return 1

    for job in late_jobs:
        code = int(execute(job, python=python))
        results[job.name] = code
        if code != 0 and fail_fast:
            print(f"Stopping after failure: {job.name} exited {code}", flush=True)
            break

    ordered = [(job.name, results[job.name]) for job in jobs if job.name in results]
    failed = _print_summary(ordered)
    return 0 if failed == 0 else 1


def _parse_only(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    names = [part.strip() for part in raw.split(",") if part.strip()]
    return names or None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run WNBA/NBA/MLB odds/props scrapers.",
    )
    parser.add_argument(
        "--league",
        choices=("wnba", "nba", "mlb", "all"),
        default="all",
        help="Which league scrapers to run (default: all)",
    )
    parser.add_argument(
        "--only",
        default=None,
        help=f"Comma-separated scraper names. Known: {', '.join(sorted(KNOWN_NAMES))}",
    )
    parser.add_argument(
        "--exclude",
        default=None,
        help="Comma-separated scraper names to skip (e.g. PrizePicks in Docker)",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop after the first scraper failure (default: continue)",
    )
    args = parser.parse_args(argv)
    try:
        return run_all(
            league=args.league,
            only=_parse_only(args.only),
            exclude=_parse_only(args.exclude),
            fail_fast=args.fail_fast,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
