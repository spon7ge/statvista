"""WNBA Pinnacle scraper stays on WNBA."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "wnba" / "wnba_pinnacle.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("wnba_pinnacle", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["wnba_pinnacle"] = mod
    spec.loader.exec_module(mod)
    return mod


pin = _load_scraper()


def test_supported_leagues_are_wnba_only() -> None:
    assert pin.SUPPORTED_LEAGUES == ("wnba",)
    assert "nba" not in pin.LEAGUE_MATCHUPS_URL
    assert "nba" not in pin.LEAGUE_ARCADIA_IDS


def test_requested_leagues_default_wnba(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PINNACLE_LEAGUES", raising=False)
    assert pin._requested_leagues() == ["wnba"]


def test_requested_leagues_rejects_nba(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PINNACLE_LEAGUES", "nba,wnba")
    with pytest.raises(ValueError, match="nba"):
        pin._requested_leagues()


def test_collect_game_urls_drops_nba_links() -> None:
    hrefs = [
        "https://www.pinnacle.com/en/basketball/nba/bos-vs-nyk/12345/",
        "https://www.pinnacle.com/en/basketball/wnba/lv-vs-ny/67890/",
    ]
    urls = pin.collect_game_urls(hrefs, "", "wnba")
    assert urls == [
        "https://www.pinnacle.com/en/basketball/wnba/lv-vs-ny/67890/#all",
    ]
