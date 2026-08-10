"""Unit tests for MLB Novig scraper helpers (no live network)."""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "mlb_novig.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("mlb_novig", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mlb_novig"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_output_filenames() -> None:
    nv = _load_scraper()
    now = datetime(2026, 8, 9, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert (
        nv.output_filename("mlb", now, kind="props")
        == "novig_mlb_2026-08-09_143000_props.json"
    )
    assert (
        nv.output_filename("mlb", now, kind="team")
        == "novig_mlb_2026-08-09_143000_team.json"
    )


def test_team_path_from_props() -> None:
    nv = _load_scraper()
    assert (
        nv.team_output_path("/tmp/novig_mlb_2026-08-09_143000_props.json")
        == "/tmp/novig_mlb_2026-08-09_143000_team.json"
    )


def test_resolve_props_output_path_default(tmp_path, monkeypatch) -> None:
    nv = _load_scraper()
    monkeypatch.delenv("NOVIG_OUTPUT", raising=False)
    monkeypatch.delenv("NOVIG_OUTPUT_DIR", raising=False)
    monkeypatch.setattr(nv, "_DEFAULT_OUTPUT_DIR", str(tmp_path))
    now = datetime(2026, 8, 9, 14, 30, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    path = nv.resolve_props_output_path(now=now)
    assert path == str(tmp_path / "novig_mlb_2026-08-09_143000_props.json")


def test_probability_to_american() -> None:
    nv = _load_scraper()
    assert nv.probability_to_american(0.5) == -100
    assert nv.probability_to_american(0.6) == -150
    assert nv.probability_to_american(0.4) == 150
    assert nv.probability_to_american(0.0) is None
    assert nv.probability_to_american(1.0) is None


def test_outcome_quote_uses_available_not_last() -> None:
    nv = _load_scraper()
    over = {"available": 0.51, "last": 0.40, "orders": []}
    under = {
        "available": 0.505,
        "last": 0.60,
        "orders": [{"qty": 3200, "price": 0.495, "status": "OPEN"}],
    }
    q = nv.outcome_quote(over, under)
    assert q is not None
    assert q["american"] == nv.probability_to_american(0.51)
    # opposite bid qty 3200 cents → $32.00 stake on the available side
    assert q["stake"] == 32.0


def test_outcome_quote_skips_missing_available() -> None:
    nv = _load_scraper()
    assert nv.outcome_quote({"available": None, "last": 0.5, "orders": []}, None) is None


def test_normalize_event() -> None:
    nv = _load_scraper()
    event = {
        "id": "evt-1",
        "description": "Houston Astros @ San Diego Padres",
        "status": "OPEN_PREGAME",
        "game": {
            "scheduled_start": "2026-08-10T00:20:00+00:00",
            "homeTeam": {"id": "home-1", "name": "San Diego Padres"},
            "awayTeam": {"id": "away-1", "name": "Houston Astros"},
        },
    }
    out = nv.normalize_event(event)
    assert out["event_id"] == "evt-1"
    assert out["name"] == "Houston Astros @ San Diego Padres"
    assert out["scheduled"] == "2026-08-10T00:20:00+00:00"
    assert out["status"] == "not_started"
    assert out["competitors"][0]["name"] == "San Diego Padres"
    assert out["competitors"][0]["seq"] == 0
    assert out["competitors"][1]["name"] == "Houston Astros"
    assert out["competitors"][1]["seq"] == 1


def test_extract_team_markets_money_spread_total() -> None:
    nv = _load_scraper()
    markets = [
        {
            "id": "m-money",
            "type": "MONEY",
            "strike": 0.0,
            "description": "SD",
            "outcomes": [
                {"description": "HOU", "available": 0.44, "orders": []},
                {
                    "description": "SD",
                    "available": 0.57,
                    "orders": [{"qty": 10000, "status": "OPEN"}],
                },
            ],
        },
        {
            "id": "m-rl",
            "type": "SPREAD",
            "strike": -1.5,
            "description": "SD -1.5",
            "outcomes": [
                {"description": "HOU +1.5", "available": 0.61, "orders": []},
                {"description": "SD -1.5", "available": 0.41, "orders": []},
            ],
        },
        {
            "id": "m-tot",
            "type": "TOTAL",
            "strike": 8.5,
            "description": "HOU @ SD t8.5",
            "outcomes": [
                {"description": "Over 8.5", "available": 0.505, "orders": []},
                {"description": "Under 8.5", "available": 0.5, "orders": []},
            ],
        },
        {
            "id": "m-tot-alt",
            "type": "TOTAL",
            "strike": 3.5,
            "description": "HOU @ SD t3.5",
            "outcomes": [
                {"description": "Over 3.5", "available": 0.93, "orders": []},
                {"description": "Under 3.5", "available": 0.11, "orders": []},
            ],
        },
    ]
    tm = nv.extract_team_markets(markets)
    assert "moneyline" in tm and len(tm["moneyline"]) == 2
    assert "run_line" in tm and len(tm["run_line"]) == 2
    assert tm["total"][0]["line"] == 8.5  # closest to even, not 3.5


def test_extract_props_allowlist_and_is_main() -> None:
    nv = _load_scraper()
    markets = [
        {
            "id": "p1",
            "type": "HITS",
            "strike": 0.5,
            "player": {"id": "pl1", "name": "Yordan Alvarez"},
            "outcomes": [
                {"description": "Over 0.5", "available": 0.73, "orders": []},
                {"description": "Under 0.5", "available": 0.27, "orders": []},
            ],
        },
        {
            "id": "p2",
            "type": "HITS",
            "strike": 1.5,
            "player": {"id": "pl1", "name": "Yordan Alvarez"},
            "outcomes": [
                {"description": "Over 1.5", "available": 0.51, "orders": []},
                {"description": "Under 1.5", "available": 0.505, "orders": []},
            ],
        },
        {
            "id": "skip",
            "type": "BATTING_WALKS",
            "strike": 0.5,
            "player": {"id": "pl1", "name": "Yordan Alvarez"},
            "outcomes": [
                {"description": "Over 0.5", "available": 0.5, "orders": []},
                {"description": "Under 0.5", "available": 0.5, "orders": []},
            ],
        },
    ]
    rows = nv.extract_props(markets)
    assert len(rows) == 2
    by_line = {r["line"]: r for r in rows}
    assert by_line[1.5]["is_main"] is True
    assert by_line[0.5]["is_main"] is False
    assert by_line[1.5]["stat"] == "hits"
    assert by_line[1.5]["player"] == "Yordan Alvarez"
    assert by_line[1.5]["sub_type"] == "hits"


def test_extract_props_skips_both_sides_empty() -> None:
    nv = _load_scraper()
    markets = [
        {
            "id": "empty",
            "type": "HITS",
            "strike": 0.5,
            "player": {"id": "pl1", "name": "A"},
            "outcomes": [
                {"description": "Over 0.5", "available": None, "last": 0.5, "orders": []},
                {"description": "Under 0.5", "available": None, "last": 0.5, "orders": []},
            ],
        }
    ]
    assert nv.extract_props(markets) == []
