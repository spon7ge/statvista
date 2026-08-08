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


_MONEYLINE_MARKET = {
    "id": 251,
    "name": "Moneyline",
    "type": "moneyline",
    "subType": "moneyline",
    "status": "active",
    "selections": [
        [
            {
                "name": "Chicago Sky",
                "competitorId": 1,
                "odds": -134,
                "displayOdds": "-134",
                "line": 0,
                "stake": 100.0,
            }
        ],
        [
            {
                "name": "Indiana Fever",
                "competitorId": 2,
                "odds": 130,
                "displayOdds": "+130",
                "line": 0,
                "stake": 50.0,
            }
        ],
    ],
}

_SPREAD_MARKET = {
    "id": 252,
    "name": "Spread",
    "type": "spread",
    "subType": "spread",
    "marketLines": [
        {
            "name": "Fixed home -3.5",
            "favourite": True,
            "selections": [
                [
                    {
                        "name": "Chicago Sky",
                        "odds": -110,
                        "line": -3.5,
                        "stake": 80.0,
                    }
                ],
                [
                    {
                        "name": "Indiana Fever",
                        "odds": -110,
                        "line": 3.5,
                        "stake": 80.0,
                    }
                ],
            ],
        },
        {
            "name": "Fixed home -4.5",
            "selections": [[], []],
        },
    ],
}


def test_extract_team_markets_moneyline_and_main_spread() -> None:
    px = _load_scraper()
    out = px.extract_team_markets([_MONEYLINE_MARKET, _SPREAD_MARKET])
    assert "moneyline" in out
    assert out["moneyline"][0]["american"] == -134
    assert out["moneyline"][0]["stake"] == 100.0
    assert out["moneyline"][1]["american"] == 130
    assert "spread" in out
    assert "run_line" not in out
    assert out["spread"][0]["line"] == -3.5
    assert out["spread"][0]["american"] == -110


def test_extract_team_markets_ignores_first_half() -> None:
    px = _load_scraper()
    first_half = {
        "id": 999,
        "name": "First Half Moneyline",
        "type": "moneyline",
        "subType": "first_half_moneyline",
        "selections": [[{"name": "Chicago Sky", "odds": -105, "line": 0, "stake": 1}]],
    }
    out = px.extract_team_markets([_MONEYLINE_MARKET, first_half])
    assert "moneyline" in out
    assert "first_half_moneyline" not in out


def test_normalize_event() -> None:
    px = _load_scraper()
    event = {
        "id": 13002464,
        "name": "Indiana Fever at Chicago Sky",
        "scheduled": "2026-08-08T23:00:00Z",
        "status": "not_started",
        "competitors": [
            {"id": 1, "name": "Chicago Sky", "abbreviation": "CHI", "seq": 0},
            {"id": 2, "name": "Indiana Fever", "abbreviation": "IND", "seq": 1},
        ],
    }
    norm = px.normalize_event(event)
    assert norm["event_id"] == 13002464
    assert norm["status"] == "not_started"
    assert len(norm["competitors"]) == 2
