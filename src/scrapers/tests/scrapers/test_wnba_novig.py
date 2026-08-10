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
    assert q["stake"] == 32.0


def test_outcome_quote_skips_missing_available() -> None:
    nv = _load_scraper()
    assert nv.outcome_quote({"available": None, "last": 0.5, "orders": []}, None) is None


def test_normalize_event() -> None:
    nv = _load_scraper()
    event = {
        "id": "evt-1",
        "description": "New York Liberty @ Las Vegas Aces",
        "status": "OPEN_PREGAME",
        "game": {
            "scheduled_start": "2026-08-10T00:00:00+00:00",
            "homeTeam": {"id": "home-1", "name": "Las Vegas Aces"},
            "awayTeam": {"id": "away-1", "name": "New York Liberty"},
        },
    }
    out = nv.normalize_event(event)
    assert out["event_id"] == "evt-1"
    assert out["name"] == "New York Liberty @ Las Vegas Aces"
    assert out["scheduled"] == "2026-08-10T00:00:00+00:00"
    assert out["status"] == "not_started"
    assert out["competitors"][0]["name"] == "Las Vegas Aces"
    assert out["competitors"][0]["seq"] == 0
    assert out["competitors"][1]["name"] == "New York Liberty"
    assert out["competitors"][1]["seq"] == 1


def test_extract_team_markets_money_spread_total() -> None:
    nv = _load_scraper()
    markets = [
        {
            "id": "m-money",
            "type": "MONEY",
            "strike": 0.0,
            "description": "LV",
            "outcomes": [
                {"description": "NY", "available": 0.44, "orders": []},
                {
                    "description": "LV",
                    "available": 0.57,
                    "orders": [{"qty": 10000, "status": "OPEN"}],
                },
            ],
        },
        {
            "id": "m-sp",
            "type": "SPREAD",
            "strike": -4.5,
            "description": "LV -4.5",
            "outcomes": [
                {"description": "NY +4.5", "available": 0.51, "orders": []},
                {"description": "LV -4.5", "available": 0.505, "orders": []},
            ],
        },
        {
            "id": "m-sp-alt",
            "type": "SPREAD",
            "strike": -12.5,
            "description": "LV -12.5",
            "outcomes": [
                {"description": "NY +12.5", "available": 0.90, "orders": []},
                {"description": "LV -12.5", "available": 0.12, "orders": []},
            ],
        },
        {
            "id": "m-tot",
            "type": "TOTAL",
            "strike": 162.5,
            "description": "NY @ LV t162.5",
            "outcomes": [
                {"description": "Over 162.5", "available": 0.505, "orders": []},
                {"description": "Under 162.5", "available": 0.5, "orders": []},
            ],
        },
        {
            "id": "m-tot-alt",
            "type": "TOTAL",
            "strike": 140.5,
            "description": "NY @ LV t140.5",
            "outcomes": [
                {"description": "Over 140.5", "available": 0.93, "orders": []},
                {"description": "Under 140.5", "available": 0.11, "orders": []},
            ],
        },
    ]
    tm = nv.extract_team_markets(markets)
    assert "moneyline" in tm and len(tm["moneyline"]) == 2
    assert "spread" in tm and len(tm["spread"]) == 2
    assert "run_line" not in tm
    assert tm["spread"][0]["line"] in (4.5, -4.5, 4.5) or abs(
        float(tm["spread"][0]["line"])
    ) == 4.5
    assert tm["total"][0]["line"] == 162.5


def test_extract_props_allowlist_and_is_main() -> None:
    nv = _load_scraper()
    markets = [
        {
            "id": "p1",
            "type": "POINTS",
            "strike": 18.5,
            "player": {"id": "pl1", "name": "A'ja Wilson"},
            "outcomes": [
                {"description": "Over 18.5", "available": 0.73, "orders": []},
                {"description": "Under 18.5", "available": 0.27, "orders": []},
            ],
        },
        {
            "id": "p2",
            "type": "POINTS",
            "strike": 22.5,
            "player": {"id": "pl1", "name": "A'ja Wilson"},
            "outcomes": [
                {"description": "Over 22.5", "available": 0.51, "orders": []},
                {"description": "Under 22.5", "available": 0.505, "orders": []},
            ],
        },
        {
            "id": "extra",
            "type": "STEALS",
            "strike": 1.5,
            "player": {"id": "pl1", "name": "A'ja Wilson"},
            "outcomes": [
                {"description": "Over 1.5", "available": 0.48, "orders": []},
                {"description": "Under 1.5", "available": 0.52, "orders": []},
            ],
        },
        {
            "id": "skip",
            "type": "FIRST_BASKET",
            "strike": 0.5,
            "player": {"id": "pl1", "name": "A'ja Wilson"},
            "outcomes": [
                {"description": "Over 0.5", "available": 0.5, "orders": []},
                {"description": "Under 0.5", "available": 0.5, "orders": []},
            ],
        },
    ]
    rows = nv.extract_props(markets)
    assert len(rows) == 3
    points = [r for r in rows if r["stat"] == "points"]
    by_line = {r["line"]: r for r in points}
    assert by_line[22.5]["is_main"] is True
    assert by_line[18.5]["is_main"] is False
    assert by_line[22.5]["player"] == "A'ja Wilson"
    assert by_line[22.5]["sub_type"] == "points"
    steals = [r for r in rows if r["stat"] == "steals"]
    assert len(steals) == 1 and steals[0]["is_main"] is True


def test_extract_props_skips_both_sides_empty() -> None:
    nv = _load_scraper()
    markets = [
        {
            "id": "empty",
            "type": "POINTS",
            "strike": 20.5,
            "player": {"id": "pl1", "name": "A"},
            "outcomes": [
                {"description": "Over 20.5", "available": None, "last": 0.5, "orders": []},
                {"description": "Under 20.5", "available": None, "last": 0.5, "orders": []},
            ],
        }
    ]
    assert nv.extract_props(markets) == []
