"""Repo-root lookup used by nested odds scrapers at import time."""

from __future__ import annotations

from pathlib import Path

from src.scrapers.mlb.paths import repo_root as mlb_repo_root
from src.scrapers.nba.paths import repo_root as nba_repo_root

REPO = Path(__file__).resolve().parents[4]


def test_nba_repo_root_from_scraper_module():
    start = REPO / "src" / "scrapers" / "nba" / "nba_novig.py"
    assert nba_repo_root(start) == REPO


def test_mlb_repo_root_from_scraper_module():
    start = REPO / "src" / "scrapers" / "mlb" / "mlb_novig.py"
    assert mlb_repo_root(start) == REPO
