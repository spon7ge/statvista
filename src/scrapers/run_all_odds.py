"""Run all WNBA/MLB odds/props scrapers.

Usage:
  python -m src.scrapers.run_all_odds
  python -m src.scrapers.run_all_odds --league wnba
  python -m src.scrapers.run_all_odds --only wnba_novig,mlb_underdog
  python -m src.scrapers.run_all_odds --fail-fast
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Literal

League = Literal["wnba", "mlb", "all"]


@dataclass(frozen=True)
class ScraperJob:
    name: str
    league: Literal["wnba", "mlb"]
    module: str
    env: dict[str, str] | None = None


# PrizePicks last per league so DataDome/browser fallback does not block
# the HTTP scrapers if a captcha solve is needed.
SCRAPER_JOBS: tuple[ScraperJob, ...] = (
    ScraperJob("wnba_novig", "wnba", "src.scrapers.wnba_novig"),
    ScraperJob("wnba_prophetx", "wnba", "src.scrapers.wnba_prophetx"),
    ScraperJob("wnba_underdog", "wnba", "src.scrapers.wnba_underdog"),
    ScraperJob(
        "bball_pinnacle",
        "wnba",
        "src.scrapers.bball_pinnacle",
        env={"PINNACLE_LEAGUES": "wnba"},
    ),
    ScraperJob("wnba_prizepick", "wnba", "src.scrapers.wnba_prizepick"),
    ScraperJob("mlb_novig", "mlb", "src.scrapers.mlb_novig"),
    ScraperJob("mlb_prophetx", "mlb", "src.scrapers.mlb_prophetx"),
    ScraperJob("mlb_underdog", "mlb", "src.scrapers.mlb_underdog"),
    ScraperJob("mlb_pinnacle", "mlb", "src.scrapers.mlb_pinnacle"),
    ScraperJob("mlb_prizepick", "mlb", "src.scrapers.mlb_prizepick"),
)

KNOWN_NAMES = {job.name for job in SCRAPER_JOBS}


def resolve_jobs(
    *,
    league: League = "all",
    only: list[str] | None = None,
) -> list[ScraperJob]:
    """Filter the canonical job list by league and optional name allowlist."""
    jobs = list(SCRAPER_JOBS)
    if league != "all":
        jobs = [j for j in jobs if j.league == league]
    if only:
        unknown = [name for name in only if name not in KNOWN_NAMES]
        if unknown:
            raise ValueError(
                f"Unknown scraper name(s): {unknown}; choose from {sorted(KNOWN_NAMES)}"
            )
        allow = set(only)
        jobs = [j for j in jobs if j.name in allow]
    return jobs


def run_job(job: ScraperJob, *, python: str | None = None) -> int:
    """Run one scraper module as a subprocess; return its exit code."""
    cmd = [python or sys.executable, "-m", job.module]
    env = os.environ.copy()
    if job.env:
        env.update(job.env)
    print(f"\n=== {job.name} ({job.module}) ===", flush=True)
    completed = subprocess.run(cmd, env=env, check=False)
    return int(completed.returncode)


def run_all(
    *,
    league: League = "all",
    only: list[str] | None = None,
    fail_fast: bool = False,
    python: str | None = None,
) -> int:
    """Run selected scrapers sequentially. Returns 0 iff all succeeded."""
    jobs = resolve_jobs(league=league, only=only)
    if not jobs:
        print("No scrapers selected.", flush=True)
        return 1

    results: list[tuple[str, int]] = []
    for job in jobs:
        code = run_job(job, python=python)
        results.append((job.name, code))
        if code != 0 and fail_fast:
            print(f"Stopping after failure: {job.name} exited {code}", flush=True)
            break

    print("\n=== Summary ===", flush=True)
    failed = 0
    for name, code in results:
        status = "ok" if code == 0 else f"FAIL ({code})"
        print(f"  {name}: {status}", flush=True)
        if code != 0:
            failed += 1
    print(f"{len(results) - failed}/{len(results)} succeeded", flush=True)
    return 0 if failed == 0 else 1


def _parse_only(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    names = [part.strip() for part in raw.split(",") if part.strip()]
    return names or None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run WNBA/MLB odds/props scrapers.",
    )
    parser.add_argument(
        "--league",
        choices=("wnba", "mlb", "all"),
        default="all",
        help="Which league scrapers to run (default: all)",
    )
    parser.add_argument(
        "--only",
        default=None,
        help=f"Comma-separated scraper names. Known: {', '.join(sorted(KNOWN_NAMES))}",
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
            fail_fast=args.fail_fast,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
