"""Underdog pick'em API defaults (no live network)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_SCRAPERS_DIR = Path(__file__).resolve().parents[2]
_V1_PICKEM_URL = "https://api.underdogfantasy.com/v1/over_under_lines"


def _load_scraper(name: str):
    sport = name.split("_", 1)[0]
    path = _SCRAPERS_DIR / sport / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_mlb_underdog_defaults_to_v1_pickem_url() -> None:
    mlb = _load_scraper("mlb_underdog")
    assert mlb._DEFAULT_CONFIG["ud_pickem_url"] == _V1_PICKEM_URL


def test_wnba_underdog_defaults_to_v1_pickem_url() -> None:
    wnba = _load_scraper("wnba_underdog")
    assert wnba._DEFAULT_CONFIG["ud_pickem_url"] == _V1_PICKEM_URL
