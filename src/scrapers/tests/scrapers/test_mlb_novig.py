"""Unit tests for MLB Novig scraper helpers (no live network)."""

from __future__ import annotations

import importlib.util
import sys
import time
from typing import Any
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest
import requests

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


def test_fetch_mlb_events_parses_data(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    payload = {
        "data": {
            "event": [
                {"id": "e1", "description": "A @ B", "status": "OPEN_PREGAME", "game": {}},
            ]
        }
    }
    monkeypatch.setattr(nv, "graphql", lambda *_a, **_k: payload)
    events = nv.fetch_mlb_events(session)
    assert len(events) == 1
    assert events[0]["id"] == "e1"


def test_fetch_mlb_events_inline_limit_offset_fallback(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    inline_payload = {
        "data": {
            "event": [
                {"id": "e1", "description": "A @ B", "status": "OPEN_PREGAME", "game": {}},
            ]
        }
    }
    calls: list[tuple[str, dict[str, Any] | None]] = []

    def fake_graphql(_session, query, variables=None, **_k):
        calls.append((query, variables))
        if variables is not None:
            raise RuntimeError("GraphQL errors: unknown variable limit")
        return inline_payload

    monkeypatch.setattr(nv, "graphql", fake_graphql)
    events = nv.fetch_mlb_events(session)
    assert len(events) == 1
    assert events[0]["id"] == "e1"
    assert len(calls) == 2
    assert calls[0][1] is not None
    assert calls[1][1] is None


def test_fetch_mlb_events_honors_max_events(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    payload = {
        "data": {
            "event": [
                {"id": "e1", "description": "A @ B", "status": "OPEN_PREGAME", "game": {}},
                {"id": "e2", "description": "C @ D", "status": "OPEN_INGAME", "game": {}},
            ]
        }
    }
    monkeypatch.setattr(nv, "graphql", lambda *_a, **_k: payload)
    monkeypatch.setenv("NOVIG_MAX_EVENTS", "1")
    events = nv.fetch_mlb_events(session)
    assert len(events) == 1
    assert events[0]["id"] == "e1"


def test_event_markets_query_uses_uuid_variable() -> None:
    nv = _load_scraper()
    query = nv._GET_EVENT_MARKETS_QUERY
    assert "$id: uuid!" in query
    assert "$id: String!" not in query
    # Nested orders exceed Novig's 4s GraphQL timeout; odds use `available`.
    assert "orders" not in query


def test_fetch_event_markets_parses_nested(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    payload = {
        "data": {
            "event": [
                {
                    "markets": [
                        {"id": "m1", "type": "HITS", "strike": 0.5, "outcomes": []}
                    ]
                }
            ]
        }
    }
    monkeypatch.setattr(nv, "graphql", lambda *_a, **_k: payload)
    markets = nv.fetch_event_markets(session, "e1")
    assert markets[0]["id"] == "m1"


def test_graphql_raises_after_http_500_retries(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    response = MagicMock()
    response.status_code = 500
    response.raise_for_status.side_effect = requests.HTTPError(response=response)
    session.post.return_value = response
    monkeypatch.setattr(time, "sleep", lambda *_a, **_k: None)
    with pytest.raises(requests.HTTPError):
        nv.graphql(session, "query { event { id } }")
    assert session.post.call_count == 3


def test_graphql_partial_errors_returns_data(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    response = MagicMock()
    response.status_code = 200
    body = {
        "errors": [{"message": "field X unavailable"}],
        "data": {"event": [{"id": "e1"}]},
    }
    response.json.return_value = body
    session.post.return_value = response
    warnings: list[tuple] = []
    monkeypatch.setattr(
        nv.logger,
        "warning",
        lambda *args, **kwargs: warnings.append((args, kwargs)),
    )
    result = nv.graphql(session, "query { event { id } }")
    assert result == body
    assert len(warnings) == 1
    assert "field X unavailable" in str(warnings[0])


def test_graphql_raises_on_graphql_errors(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"errors": [{"message": "bad query"}]}
    session.post.return_value = response
    with pytest.raises(RuntimeError, match="GraphQL"):
        nv.graphql(session, "query { event { id } }")


def test_write_snapshots_roundtrip(tmp_path) -> None:
    import json

    nv = _load_scraper()
    props_path = str(tmp_path / "novig_mlb_2026-08-09_120000_props.json")
    props_games = [{"event_id": "e1", "name": "A @ B", "props": []}]
    team_games = [{"event_id": "e1", "name": "A @ B", "team_markets": {}}]
    p, t = nv.write_snapshots(props_games, team_games, props_path=props_path)
    assert p.endswith("_props.json")
    assert t.endswith("_team.json")
    props_payload = json.loads(Path(p).read_text())
    assert props_payload["source"] == "novig"
    assert props_payload["snapshot_kind"] == "props"
    assert props_payload["league"] == "mlb"
    assert "tournament_id" not in props_payload


def test_build_game_snapshots_merges() -> None:
    nv = _load_scraper()
    events = [
        {
            "id": "e1",
            "description": "A @ B",
            "status": "OPEN_PREGAME",
            "game": {
                "scheduled_start": "2026-08-10T00:00:00+00:00",
                "homeTeam": {"id": "h", "name": "B"},
                "awayTeam": {"id": "a", "name": "A"},
            },
        }
    ]
    markets_by_id = {
        "e1": [
            {
                "id": "m1",
                "type": "MONEY",
                "strike": 0,
                "description": "B",
                "player": None,
                "outcomes": [
                    {"description": "A", "available": 0.45, "orders": []},
                    {"description": "B", "available": 0.55, "orders": []},
                ],
            }
        ]
    }
    props_games, team_games = nv.build_game_snapshots(events, markets_by_id)
    assert props_games[0]["props"] == []
    assert "moneyline" in team_games[0]["team_markets"]


def test_selenium_fallback_enabled(monkeypatch) -> None:
    nv = _load_scraper()
    monkeypatch.setenv("NOVIG_ALLOW_SELENIUM", "1")
    assert nv.selenium_fallback_enabled() is True
    monkeypatch.setenv("NOVIG_ALLOW_SELENIUM", "yes")
    assert nv.selenium_fallback_enabled() is True
    monkeypatch.setenv("NOVIG_ALLOW_SELENIUM", "0")
    assert nv.selenium_fallback_enabled() is False


def test_fetch_via_selenium_raises() -> None:
    nv = _load_scraper()
    with pytest.raises(RuntimeError, match="Selenium fallback is not implemented"):
        nv.fetch_via_selenium()


def test_run_exits_when_events_have_no_usable_quotes(monkeypatch) -> None:
    nv = _load_scraper()
    events = [{"id": "e1", "description": "A @ B", "status": "OPEN_PREGAME", "game": {}}]

    def fake_fetch_events(_session):
        return events

    def fake_fetch_markets(_session, _event_id):
        return []

    monkeypatch.setattr(nv, "fetch_mlb_events", fake_fetch_events)
    monkeypatch.setattr(nv, "fetch_event_markets", fake_fetch_markets)
    monkeypatch.delenv("NOVIG_ALLOW_SELENIUM", raising=False)

    with pytest.raises(SystemExit) as exc:
        nv.run()
    assert exc.value.code == 1


def test_run_exits_when_selenium_fallback_returns_empty(monkeypatch, tmp_path) -> None:
    nv = _load_scraper()

    def fail_graphql(_session):
        raise RuntimeError("GraphQL unavailable")

    monkeypatch.setattr(nv, "_fetch_graphql_snapshots", fail_graphql)
    monkeypatch.setattr(nv, "fetch_via_selenium", lambda: ([], {}))
    monkeypatch.setenv("NOVIG_ALLOW_SELENIUM", "1")
    write_called = False

    def track_write(*_args, **_kwargs):
        nonlocal write_called
        write_called = True
        return ("props.json", "team.json")

    monkeypatch.setattr(nv, "write_snapshots", track_write)
    monkeypatch.setattr(nv, "_DEFAULT_OUTPUT_DIR", str(tmp_path))

    with pytest.raises(SystemExit) as exc:
        nv.run()
    assert exc.value.code == 1
    assert write_called is False
    assert list(tmp_path.iterdir()) == []


def test_run_writes_snapshots_on_success(monkeypatch, tmp_path) -> None:
    import json

    nv = _load_scraper()
    events = [
        {
            "id": "e1",
            "description": "A @ B",
            "status": "OPEN_PREGAME",
            "game": {
                "scheduled_start": "2026-08-10T00:00:00+00:00",
                "homeTeam": {"id": "h", "name": "B"},
                "awayTeam": {"id": "a", "name": "A"},
            },
        }
    ]
    markets = [
        {
            "id": "m1",
            "type": "MONEY",
            "strike": 0,
            "description": "B",
            "player": None,
            "outcomes": [
                {"description": "A", "available": 0.45, "orders": []},
                {"description": "B", "available": 0.55, "orders": []},
            ],
        }
    ]

    monkeypatch.setattr(nv, "fetch_mlb_events", lambda _s: events)
    monkeypatch.setattr(nv, "fetch_event_markets", lambda _s, _e: markets)
    monkeypatch.setattr(nv, "_DEFAULT_OUTPUT_DIR", str(tmp_path))
    monkeypatch.delenv("NOVIG_OUTPUT", raising=False)
    monkeypatch.delenv("NOVIG_OUTPUT_DIR", raising=False)
    now = datetime(2026, 8, 9, 12, 0, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    monkeypatch.setattr(nv, "resolve_props_output_path", lambda: str(tmp_path / nv.output_filename("mlb", now, kind="props")))

    nv.run()

    props_path = tmp_path / "novig_mlb_2026-08-09_120000_props.json"
    team_path = tmp_path / "novig_mlb_2026-08-09_120000_team.json"
    assert props_path.is_file()
    assert team_path.is_file()
    props_payload = json.loads(props_path.read_text())
    assert props_payload["source"] == "novig"
    assert len(props_payload["games"]) == 1
