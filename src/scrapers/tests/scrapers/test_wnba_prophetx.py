"""Unit tests for WNBA ProphetX scraper helpers (no live network)."""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "wnba_prophetx.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("wnba_prophetx", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["wnba_prophetx"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_output_filenames() -> None:
    px = _load_scraper()
    now = datetime(2026, 8, 8, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert (
        px.output_filename("wnba", now, kind="props")
        == "prophetx_wnba_2026-08-08_143000_props.json"
    )
    assert (
        px.output_filename("wnba", now, kind="team")
        == "prophetx_wnba_2026-08-08_143000_team.json"
    )


def test_team_path_from_props() -> None:
    px = _load_scraper()
    assert (
        px.team_output_path("/tmp/prophetx_wnba_2026-08-08_143000_props.json")
        == "/tmp/prophetx_wnba_2026-08-08_143000_team.json"
    )


def test_resolve_props_output_path_default(tmp_path, monkeypatch) -> None:
    px = _load_scraper()
    monkeypatch.delenv("PROPHETX_OUTPUT", raising=False)
    monkeypatch.delenv("PROPHETX_OUTPUT_DIR", raising=False)
    monkeypatch.setattr(px, "_DEFAULT_OUTPUT_DIR", str(tmp_path))
    now = datetime(2026, 8, 8, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    path = px.resolve_props_output_path(now=now)
    assert path == str(tmp_path / "prophetx_wnba_2026-08-08_143000_props.json")


def test_pick_main_market_line_favourite() -> None:
    px = _load_scraper()
    market = {
        "marketLines": [
            {"name": "Fixed total 18.5", "favourite": True, "selections": []},
            {"name": "Fixed total 19.5", "selections": []},
        ]
    }
    main = px.pick_main_market_line(market)
    assert main is not None
    assert main["name"] == "Fixed total 18.5"


def test_pick_main_market_line_sole() -> None:
    px = _load_scraper()
    market = {"marketLines": [{"name": "Fixed total 18.5", "selections": []}]}
    assert px.pick_main_market_line(market)["name"] == "Fixed total 18.5"


def test_pick_main_market_line_skips_ambiguous() -> None:
    px = _load_scraper()
    market = {
        "marketLines": [
            {"name": "Fixed total 18.5", "selections": []},
            {"name": "Fixed total 19.5", "selections": []},
        ]
    }
    assert px.pick_main_market_line(market) is None


def test_best_selection_takes_first() -> None:
    px = _load_scraper()
    side = [
        {"odds": -110, "stake": 50.0, "displayOdds": "-110"},
        {"odds": -120, "stake": 10.0, "displayOdds": "-120"},
    ]
    best = px.best_selection(side)
    assert best is not None
    assert best["odds"] == -110
    assert px.american_and_stake(best) == (-110, 50.0)
