"""Unit tests for WNBA Novig scraper helpers (no live network)."""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "wnba_novig.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("wnba_novig", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["wnba_novig"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_output_filenames() -> None:
    nv = _load_scraper()
    now = datetime(2026, 8, 9, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert (
        nv.output_filename("wnba", now, kind="props")
        == "novig_wnba_2026-08-09_143000_props.json"
    )
    assert (
        nv.output_filename("wnba", now, kind="team")
        == "novig_wnba_2026-08-09_143000_team.json"
    )


def test_team_path_from_props() -> None:
    nv = _load_scraper()
    assert (
        nv.team_output_path("/tmp/novig_wnba_2026-08-09_143000_props.json")
        == "/tmp/novig_wnba_2026-08-09_143000_team.json"
    )


def test_resolve_props_output_path_default(tmp_path, monkeypatch) -> None:
    nv = _load_scraper()
    monkeypatch.delenv("NOVIG_OUTPUT", raising=False)
    monkeypatch.delenv("NOVIG_OUTPUT_DIR", raising=False)
    monkeypatch.setattr(nv, "_DEFAULT_OUTPUT_DIR", str(tmp_path))
    now = datetime(2026, 8, 9, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    path = nv.resolve_props_output_path(now=now)
    assert path == str(tmp_path / "novig_wnba_2026-08-09_143000_props.json")
