"""Unit tests for MLB ProphetX scraper helpers (no live network)."""

from __future__ import annotations

import importlib.util
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "mlb_prophetx.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("mlb_prophetx", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mlb_prophetx"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_output_filenames() -> None:
    px = _load_scraper()
    now = datetime(2026, 8, 5, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert (
        px.output_filename("mlb", now, kind="props")
        == "prophetx_mlb_2026-08-05_143000_props.json"
    )
    assert (
        px.output_filename("mlb", now, kind="team")
        == "prophetx_mlb_2026-08-05_143000_team.json"
    )


def test_team_path_from_props() -> None:
    px = _load_scraper()
    assert (
        px.team_output_path("/tmp/prophetx_mlb_2026-08-05_143000_props.json")
        == "/tmp/prophetx_mlb_2026-08-05_143000_team.json"
    )


def test_resolve_props_output_path_default(tmp_path, monkeypatch) -> None:
    px = _load_scraper()
    monkeypatch.delenv("PROPHETX_OUTPUT", raising=False)
    monkeypatch.delenv("PROPHETX_OUTPUT_DIR", raising=False)
    monkeypatch.setattr(px, "_DEFAULT_OUTPUT_DIR", str(tmp_path))
    now = datetime(2026, 8, 5, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    path = px.resolve_props_output_path(now=now)
    assert path == str(tmp_path / "prophetx_mlb_2026-08-05_143000_props.json")
