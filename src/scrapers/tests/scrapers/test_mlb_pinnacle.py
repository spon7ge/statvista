"""Unit tests for MLB Pinnacle scraper helpers (no live browser)."""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

_SCRAPER_PATH = Path(__file__).resolve().parents[2] / "mlb_pinnacle.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("mlb_pinnacle", _SCRAPER_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["mlb_pinnacle"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_output_filenames() -> None:
    pin = _load_scraper()
    now = datetime(2026, 8, 3, 12, 0, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    assert (
        pin._pinnacle_output_filename("mlb", now, kind="props")
        == "pinnacle_mlb_2026-08-03_120000_props.json"
    )
    assert (
        pin._pinnacle_output_filename("mlb", now, kind="team")
        == "pinnacle_mlb_2026-08-03_120000_team.json"
    )


def test_team_path_from_props() -> None:
    pin = _load_scraper()
    assert (
        pin._pinnacle_team_output_path("/tmp/pinnacle_mlb_2026-08-03_120000_props.json")
        == "/tmp/pinnacle_mlb_2026-08-03_120000_team.json"
    )


def test_normalize_game_url_baseball() -> None:
    pin = _load_scraper()
    raw = "https://www.pinnacle.com/en/baseball/mlb/yankees-vs-red-sox/12345/"
    assert pin._normalize_game_url(raw, "mlb") == (
        "https://www.pinnacle.com/en/baseball/mlb/yankees-vs-red-sox/12345/#all"
    )


def test_rejects_basketball_urls() -> None:
    pin = _load_scraper()
    raw = "https://www.pinnacle.com/en/basketball/wnba/aces-vs-dream/1/"
    assert pin._normalize_game_url(raw, "mlb") is None


def test_game_urls_from_league_matchups() -> None:
    pin = _load_scraper()
    rows = [
        {
            "type": "matchup",
            "id": 99,
            "parentId": None,
            "participants": [
                {"alignment": "away", "name": "New York Yankees"},
                {"alignment": "home", "name": "Boston Red Sox"},
            ],
        },
        {
            "type": "special",
            "id": 100,
            "parentId": None,
            "participants": [],
        },
    ]
    urls = pin.game_urls_from_league_matchups(rows, "mlb")
    assert urls == [
        "https://www.pinnacle.com/en/baseball/mlb/"
        "new-york-yankees-vs-boston-red-sox/99/#all",
    ]


def test_player_prop_units_include_baseball_stats() -> None:
    pin = _load_scraper()
    assert pin.PLAYER_PROP_UNITS["Hits"] == "hits"
    assert pin.PLAYER_PROP_UNITS["Home Runs"] == "home_runs"
    assert pin.PLAYER_PROP_UNITS["Strikeouts"] == "strikeouts"
    assert pin.PLAYER_PROP_UNITS["Total Bases"] == "total_bases"
    assert "Points" not in pin.PLAYER_PROP_UNITS


def test_league_constants() -> None:
    pin = _load_scraper()
    assert pin.LEAGUE_ARCADIA_IDS["mlb"] == 246
    assert "mlb" in pin.LEAGUE_MATCHUPS_URL["mlb"]
    assert "/baseball/" in pin.LEAGUE_MATCHUPS_URL["mlb"]


def test_props_team_payload_split() -> None:
    pin = _load_scraper()
    base = {"league": "mlb", "sport": "baseball"}
    games = [
        {
            "matchup_id": 1,
            "props": [{"stat": "hits", "player": "A", "line": 1.5}],
            "team_markets": {"moneyline": [{"period": 0}]},
        },
    ]
    props = pin._pinnacle_props_payload(base, games)
    team = pin._pinnacle_team_payload(base, games)
    assert props["snapshot_kind"] == "props"
    assert "team_markets" not in props["games"][0]
    assert "props" in props["games"][0]
    assert team["snapshot_kind"] == "team"
    assert "props" not in team["games"][0]
    assert "team_markets" in team["games"][0]
