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


_AMBIGUOUS_SPREAD_WITH_TOP_SELECTIONS = {
    "id": 253,
    "name": "Run Line",
    "type": "spread",
    "subType": "spread",
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
    "marketLines": [
        {"name": "Fixed home -1.5", "selections": [[], []]},
        {"name": "Fixed home -2.5", "selections": [[], []]},
    ],
}


def test_extract_team_markets_skips_ambiguous_spread_with_top_selections() -> None:
    px = _load_scraper()
    out = px.extract_team_markets(
        [_AMBIGUOUS_SPREAD_WITH_TOP_SELECTIONS, _MONEYLINE_MARKET]
    )
    assert "run_line" not in out
    assert "moneyline" in out


_HITS_PROP = {
    "id": 460000600,
    "name": "Mike Trout Total Hits",
    "subType": "player_total_hits",
    "type": "total",
    "status": "active",
    "marketLines": [
        {
            "name": "Fixed total 0.5",
            "favourite": True,
            "selections": [
                [
                    {
                        "id": 12,
                        "name": "over 0.5",
                        "odds": -200,
                        "line": 0.5,
                        "stake": 134.33,
                    }
                ],
                [
                    {
                        "id": 13,
                        "name": "under 0.5",
                        "odds": 150,
                        "line": 0.5,
                        "stake": 90.0,
                    }
                ],
            ],
        },
        {
            "name": "Fixed total 1.5",
            "selections": [[], []],
        },
    ],
}


def test_extract_props_main_hits_only() -> None:
    px = _load_scraper()
    props = px.extract_props([_HITS_PROP, {"subType": "unknown_stat", "name": "X"}])
    assert len(props) == 1
    row = props[0]
    assert row["player"] == "Mike Trout"
    assert row["stat"] == "hits"
    assert row["line"] == 0.5
    assert row["over"]["american"] == -200
    assert row["under"]["american"] == 150
    assert row["sub_type"] == "player_total_hits"
    assert row["market_id"] == 460000600


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


class _FakeResp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")

    def json(self):
        return self._payload


class _FakeSession:
    def __init__(self, routes: dict[str, list]):
        self.routes = routes
        self.calls: list[tuple[str, dict | None]] = []

    def get(self, url, params=None, timeout=60, headers=None):
        self.calls.append((url, params))
        key = url
        queue = self.routes.get(key) or self.routes.get(url.split("?")[0])
        assert queue, f"unexpected url {url}"
        return _FakeResp(queue.pop(0))


def test_fetch_mlb_events_paginates() -> None:
    px = _load_scraper()
    base = f"{px.BASE_URL}/trade/public/api/v1/tournaments/109/events"
    session = _FakeSession(
        {
            base: [
                {"next": "cursor1", "data": [{"id": 1, "name": "A"}]},
                {"next": None, "data": [{"id": 2, "name": "B"}]},
            ]
        }
    )
    events = px.fetch_mlb_events(session)
    assert [e["id"] for e in events] == [1, 2]
    assert len(session.calls) == 2


def test_fetch_markets_batches() -> None:
    px = _load_scraper()
    url = f"{px.BASE_URL}/partner/v3/public/get_multiple_markets"
    session = _FakeSession(
        {
            url: [
                {"data": [{"eventId": 1, "markets": [{"id": 1}]}]},
                {"data": [{"eventId": 2, "markets": [{"id": 2}]}]},
            ]
        }
    )
    monkey_size = 1
    out = px.fetch_markets_for_events(
        session,
        [1, 2],
        market_types="moneyline,spread,total",
        batch_size=monkey_size,
    )
    by_event = {row["eventId"]: row["markets"] for row in out}
    assert by_event[1][0]["id"] == 1
    assert by_event[2][0]["id"] == 2


def test_build_game_snapshots_splits_props_and_team() -> None:
    px = _load_scraper()
    events = [
        {
            "id": 10079004,
            "name": "Los Angeles Angels at Baltimore Orioles",
            "scheduled": "2026-08-05T22:35:00Z",
            "status": "not_started",
            "competitors": [],
        }
    ]
    team_rows = [
        {"eventId": 10079004, "markets": [_MONEYLINE_MARKET, _RUN_LINE_MARKET]}
    ]
    prop_rows = [{"eventId": 10079004, "markets": [_HITS_PROP]}]
    props_games, team_games = px.build_game_snapshots(
        events, team_rows, prop_rows
    )
    assert len(props_games) == 1
    assert len(team_games) == 1
    assert props_games[0]["props"][0]["stat"] == "hits"
    assert "moneyline" in team_games[0]["team_markets"]
    assert "props" not in team_games[0]
    assert "team_markets" not in props_games[0]


def test_write_snapshots(tmp_path) -> None:
    px = _load_scraper()
    props_path = str(tmp_path / "prophetx_mlb_2026-08-05_143000_props.json")
    props_games = [{"event_id": 1, "props": []}]
    team_games = [{"event_id": 1, "team_markets": {}}]
    p_path, t_path = px.write_snapshots(
        props_games, team_games, props_path=props_path
    )
    assert p_path.endswith("_props.json")
    assert t_path.endswith("_team.json")
    import json

    props_payload = json.loads(Path(p_path).read_text())
    team_payload = json.loads(Path(t_path).read_text())
    assert props_payload["snapshot_kind"] == "props"
    assert team_payload["snapshot_kind"] == "team"
    assert props_payload["league"] == "mlb"
    assert props_payload["tournament_id"] == 109
    assert props_payload["source"] == "prophetx"


def test_load_supabase_snapshots_calls_loaders(monkeypatch, caplog) -> None:
    px = _load_scraper()
    calls: list[tuple[str, list, str]] = []

    def fake_props(games, *, league, scraped_at):
        calls.append(("props", games, league))
        return 3

    def fake_team(games, *, league, scraped_at):
        calls.append(("team", games, league))
        return 5

    import src.odds.load_snapshots as load_snapshots

    monkeypatch.setattr(
        load_snapshots, "load_prophetx_props_snapshot", fake_props
    )
    monkeypatch.setattr(
        load_snapshots, "load_prophetx_team_snapshot", fake_team
    )

    props_games = [{"event_id": 1, "props": []}]
    team_games = [{"event_id": 1, "team_markets": {}}]
    with caplog.at_level("INFO"):
        px.load_supabase_snapshots(
            props_games,
            team_games,
            props_path="/tmp/props.json",
            team_path="/tmp/team.json",
        )

    assert calls == [
        ("props", props_games, "mlb"),
        ("team", team_games, "mlb"),
    ]
    assert "Supabase ProphetX upserted props=3 team=5" in caplog.text
    assert "props_path=/tmp/props.json" in caplog.text
    assert "team_path=/tmp/team.json" in caplog.text


def test_load_supabase_snapshots_logs_error_on_failure(
    monkeypatch, caplog
) -> None:
    px = _load_scraper()
    import src.odds.load_snapshots as load_snapshots

    def fail_props(*_args, **_kwargs):
        raise RuntimeError("db down")

    monkeypatch.setattr(
        load_snapshots, "load_prophetx_props_snapshot", fail_props
    )

    with caplog.at_level("ERROR"):
        px.load_supabase_snapshots([], [])

    assert "Supabase ProphetX load failed (JSON kept)" in caplog.text
    assert "db down" in caplog.text
