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


def test_pick_main_market_line_favourite() -> None:
    px = _load_scraper()
    market = {
        "marketLines": [
            {"name": "Fixed total 0.5", "favourite": True, "selections": []},
            {"name": "Fixed total 1.5", "selections": []},
        ]
    }
    main = px.pick_main_market_line(market)
    assert main is not None
    assert main["name"] == "Fixed total 0.5"


def test_pick_main_market_line_sole() -> None:
    px = _load_scraper()
    market = {"marketLines": [{"name": "Fixed total 0.5", "selections": []}]}
    assert px.pick_main_market_line(market)["name"] == "Fixed total 0.5"


def test_pick_main_market_line_skips_ambiguous() -> None:
    px = _load_scraper()
    market = {
        "marketLines": [
            {"name": "Fixed total 0.5", "selections": []},
            {"name": "Fixed total 1.5", "selections": []},
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


_MONEYLINE_MARKET = {
    "id": 251,
    "name": "Moneyline",
    "type": "moneyline",
    "subType": "moneyline",
    "status": "active",
    "selections": [
        [
            {
                "name": "Baltimore Orioles",
                "competitorId": 1,
                "odds": -134,
                "displayOdds": "-134",
                "line": 0,
                "stake": 100.0,
            }
        ],
        [
            {
                "name": "Los Angeles Angels",
                "competitorId": 2,
                "odds": 130,
                "displayOdds": "+130",
                "line": 0,
                "stake": 50.0,
            }
        ],
    ],
}

_RUN_LINE_MARKET = {
    "id": 252,
    "name": "Run Line",
    "type": "spread",
    "subType": "spread",
    "marketLines": [
        {
            "name": "Fixed home -1.5",
            "favourite": True,
            "selections": [
                [
                    {
                        "name": "Baltimore Orioles",
                        "odds": -110,
                        "line": -1.5,
                        "stake": 80.0,
                    }
                ],
                [
                    {
                        "name": "Los Angeles Angels",
                        "odds": -110,
                        "line": 1.5,
                        "stake": 80.0,
                    }
                ],
            ],
        },
        {
            "name": "Fixed home -2.5",
            "selections": [[], []],
        },
    ],
}


def test_extract_team_markets_moneyline_and_main_run_line() -> None:
    px = _load_scraper()
    out = px.extract_team_markets([_MONEYLINE_MARKET, _RUN_LINE_MARKET])
    assert "moneyline" in out
    assert out["moneyline"][0]["american"] == -134
    assert out["moneyline"][0]["stake"] == 100.0
    assert out["moneyline"][1]["american"] == 130
    assert "run_line" in out
    assert out["run_line"][0]["line"] == -1.5
    assert out["run_line"][0]["american"] == -110


def test_normalize_event() -> None:
    px = _load_scraper()
    event = {
        "id": 10079004,
        "name": "Los Angeles Angels at Baltimore Orioles",
        "scheduled": "2026-08-05T22:35:00Z",
        "status": "not_started",
        "competitors": [
            {"id": 1, "name": "Baltimore Orioles", "abbreviation": "BAL", "seq": 0},
            {"id": 2, "name": "Los Angeles Angels", "abbreviation": "LAA", "seq": 1},
        ],
    }
    norm = px.normalize_event(event)
    assert norm["event_id"] == 10079004
    assert norm["status"] == "not_started"
    assert len(norm["competitors"]) == 2
