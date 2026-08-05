# MLB ProphetX Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/scrapers/mlb_prophetx.py` that scrapes ProphetX MLB (main-line team markets + allowlisted player props) via public HTTP APIs and writes `*_props.json` + `*_team.json` under `data/props/prophetx/mlb/`.

**Architecture:** Single `requests`-based module (Underdog-style). Paginate tournament `109` events, batch-fetch `/partner/v3/public/get_multiple_markets`, keep favourite/main lines only with best American odds + stake, split into two snapshot files. No Selenium, no partner key, no real Supabase load (stub hook only).

**Tech Stack:** Python 3, `requests`, pytest, dataclass/dict JSON export

## Global Constraints

- League is `mlb` only; tournament id is `109`
- Base host: `https://www.prophetx.co`
- Main lines only (`favourite` marketLine, or sole line, or moneyline top-level `selections`)
- Best (top-of-book) American odds + `stake` — no full order book, no alts
- Output: `prophetx_mlb_{YYYY-MM-DD}_{HHMMSS}_props.json` + `_team.json` (America/Los_Angeles)
- Prop allowlist only (see spec); unknown subtypes skipped
- No Supabase / backend / frontend changes; stub hook only
- No live ProphetX calls in CI tests
- Follow `md/claude.md` (small focused changes, typing, tests with code)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scrapers/mlb_prophetx.py` | Full MLB ProphetX scraper (fetch, extract, save) |
| `src/scrapers/tests/scrapers/test_mlb_prophetx.py` | Unit tests with inline fixtures (no network) |

---

### Task 1: Output path helpers (TDD)

**Files:**
- Create: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`
- Create: `src/scrapers/mlb_prophetx.py` (minimal helpers only)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `output_filename(league: str, now: datetime, *, kind: str) -> str`
  - `team_output_path(props_path: str) -> str`
  - `resolve_props_output_path(*, now: datetime | None = None) -> str`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_output_filenames src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_team_path_from_props src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_resolve_props_output_path_default -v`

Expected: FAIL (module / attributes missing)

- [ ] **Step 3: Implement minimal helpers in `mlb_prophetx.py`**

```python
"""ProphetX MLB scraper — public API (team markets + player props)."""

from __future__ import annotations

import os
from datetime import datetime
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "prophetx", "mlb")
_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")


def output_filename(league: str, now: datetime, *, kind: str) -> str:
    stamp = now.astimezone(_OUTPUT_TZ).strftime("%Y-%m-%d_%H%M%S")
    return f"prophetx_{league.strip().lower()}_{stamp}_{kind}.json"


def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return props_path[: -len("_props.json")] + "_team.json"
    root, ext = os.path.splitext(props_path)
    return f"{root}_team{ext or '.json'}"


def resolve_props_output_path(*, now: datetime | None = None) -> str:
    when = now or datetime.now(_OUTPUT_TZ)
    env_file = os.environ.get("PROPHETX_OUTPUT", "").strip()
    env_dir = os.environ.get("PROPHETX_OUTPUT_DIR", "").strip()
    name = output_filename("mlb", when, kind="props")
    if env_file:
        expanded = os.path.expanduser(env_file)
        if expanded.lower().endswith(".json") and not os.path.isdir(expanded):
            return expanded
        os.makedirs(expanded, exist_ok=True)
        return os.path.join(expanded, name)
    base = env_dir or _DEFAULT_OUTPUT_DIR
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, name)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_output_filenames src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_team_path_from_props src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_resolve_props_output_path_default -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): add ProphetX MLB output path helpers"
```

---

### Task 2: Main-line + best-price selection (TDD)

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`

**Interfaces:**
- Consumes: Task 1 module
- Produces:
  - `pick_main_market_line(market: dict[str, Any]) -> dict[str, Any] | None`
  - `best_selection(side: list[dict[str, Any]]) -> dict[str, Any] | None`
  - `american_and_stake(sel: dict[str, Any]) -> tuple[int | None, float | None]`

- [ ] **Step 1: Append failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_pick_main_market_line_favourite src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_pick_main_market_line_sole src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_pick_main_market_line_skips_ambiguous src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_best_selection_takes_first -v`

Expected: FAIL (functions missing)

- [ ] **Step 3: Implement selection helpers**

```python
from typing import Any


def pick_main_market_line(market: dict[str, Any]) -> dict[str, Any] | None:
    lines = [ln for ln in (market.get("marketLines") or []) if isinstance(ln, dict)]
    if not lines:
        return None
    favourites = [ln for ln in lines if ln.get("favourite") is True]
    if len(favourites) == 1:
        return favourites[0]
    if len(favourites) > 1:
        return favourites[0]
    if len(lines) == 1:
        return lines[0]
    return None


def best_selection(side: list[dict[str, Any]]) -> dict[str, Any] | None:
    for sel in side:
        if isinstance(sel, dict):
            return sel
    return None


def american_and_stake(sel: dict[str, Any]) -> tuple[int | None, float | None]:
    raw = sel.get("odds")
    american: int | None
    try:
        american = int(raw) if raw is not None else None
    except (TypeError, ValueError):
        american = None
    stake_raw = sel.get("stake")
    try:
        stake = float(stake_raw) if stake_raw is not None else None
    except (TypeError, ValueError):
        stake = None
    return american, stake
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py -k "pick_main or best_selection" -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): add ProphetX main-line and best-price helpers"
```

---

### Task 3: Team market extraction (TDD)

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`

**Interfaces:**
- Consumes: `pick_main_market_line`, `best_selection`, `american_and_stake`
- Produces:
  - `TEAM_MARKET_KEYS: dict[str, str]` mapping API `type`/`subType` → JSON key (`moneyline`, `run_line`, `total`, `1st_inning_moneyline`, `1st_5th_inning_moneyline`)
  - `extract_team_markets(markets: list[dict[str, Any]]) -> dict[str, Any]`
  - `normalize_event(event: dict[str, Any]) -> dict[str, Any]`

- [ ] **Step 1: Append failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_team_markets_moneyline_and_main_run_line src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_normalize_event -v`

Expected: FAIL

- [ ] **Step 3: Implement extraction**

```python
TEAM_SUBTYPE_TO_KEY: dict[str, str] = {
    "moneyline": "moneyline",
    "spread": "run_line",
    "total": "total",
    "1st_inning_moneyline": "1st_inning_moneyline",
    "1st_5th_inning_moneyline": "1st_5th_inning_moneyline",
}


def normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    competitors = []
    for c in event.get("competitors") or []:
        if not isinstance(c, dict):
            continue
        competitors.append(
            {
                "id": c.get("id"),
                "name": c.get("name") or c.get("displayName"),
                "abbreviation": c.get("abbreviation"),
                "seq": c.get("seq"),
            }
        )
    return {
        "event_id": event.get("id"),
        "name": event.get("name") or event.get("displayName"),
        "scheduled": event.get("scheduled"),
        "status": event.get("status"),
        "competitors": competitors,
    }


def _sides_from_book(book: dict[str, Any]) -> list[list[dict[str, Any]]]:
    sels = book.get("selections")
    if isinstance(sels, list) and sels:
        return [s for s in sels if isinstance(s, list)]
    return []


def _side_rows(sides: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for side in sides:
        best = best_selection(side)
        if not best:
            continue
        american, stake = american_and_stake(best)
        line = best.get("line")
        rows.append(
            {
                "name": best.get("name") or best.get("displayName"),
                "competitor_id": best.get("competitorId"),
                "american": american,
                "line": None if line in (0, 0.0, None) and "over" not in str(best.get("name", "")).lower() else line,
                "stake": stake,
            }
        )
    return rows


def extract_team_markets(markets: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or market.get("type") or "")
        key = TEAM_SUBTYPE_TO_KEY.get(sub)
        if not key:
            continue
        book: dict[str, Any] | None
        if key == "moneyline" and market.get("selections"):
            book = market
        else:
            book = pick_main_market_line(market) or (
                market if market.get("selections") else None
            )
        if not book:
            continue
        rows = _side_rows(_sides_from_book(book))
        if rows:
            out[key] = rows
    return out
```

Note: for moneyline, treat `line: 0` as `null` in output. For totals/spreads, preserve the numeric line from the selection.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_team_markets_moneyline_and_main_run_line src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_normalize_event -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): extract ProphetX MLB team markets"
```

---

### Task 4: Player prop extraction (TDD)

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`

**Interfaces:**
- Consumes: main-line + best-price helpers
- Produces:
  - `PROP_SUBTYPE_TO_STAT: dict[str, str]` (exact map from spec)
  - `player_name_from_market(market: dict[str, Any]) -> str`
  - `extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]`

- [ ] **Step 1: Append failing tests**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_props_main_hits_only -v`

Expected: FAIL

- [ ] **Step 3: Implement prop extraction**

```python
PROP_SUBTYPE_TO_STAT: dict[str, str] = {
    "player_total_hits": "hits",
    "player_total_home_runs": "home_runs",
    "player_total_rbis": "rbis",
    "player_total_runs": "runs",
    "player_total_bases": "total_bases",
    "player_stolen_bases": "stolen_bases",
    "player_singles": "singles",
    "player_doubles": "doubles",
    "player_hits_allowed": "hits_allowed",
}

_PROP_NAME_SUFFIXES = (
    " Total Hits",
    " Total Home Runs",
    " Total RBIs",
    " Total Runs",
    " Total Bases",
    " Stolen Bases",
    " Singles",
    " Doubles",
    " Hits Allowed",
)


def player_name_from_market(market: dict[str, Any]) -> str:
    name = str(market.get("name") or "").strip()
    for suffix in _PROP_NAME_SUFFIXES:
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name


def extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or "")
        stat = PROP_SUBTYPE_TO_STAT.get(sub)
        if not stat:
            continue
        book = pick_main_market_line(market)
        if not book:
            continue
        sides = _sides_from_book(book)
        over = under = None
        line: float | None = None
        for side in sides:
            best = best_selection(side)
            if not best:
                continue
            american, stake = american_and_stake(best)
            side_name = str(best.get("name") or "").lower()
            payload = {"american": american, "stake": stake}
            if best.get("line") is not None:
                try:
                    line = float(best["line"])
                except (TypeError, ValueError):
                    pass
            if side_name.startswith("over"):
                over = payload
            elif side_name.startswith("under"):
                under = payload
        if over is None and under is None:
            continue
        rows.append(
            {
                "player": player_name_from_market(market),
                "stat": stat,
                "line": line,
                "over": over,
                "under": under,
                "market_id": market.get("id"),
                "sub_type": sub,
            }
        )
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_extract_props_main_hits_only -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): extract ProphetX MLB player props"
```

---

### Task 5: HTTP fetch + event pagination (TDD with mocks)

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`

**Interfaces:**
- Consumes: `requests`
- Produces:
  - `BASE_URL = "https://www.prophetx.co"`
  - `MLB_TOURNAMENT_ID = 109`
  - `MARKET_BATCH_SIZE = 20`
  - `fetch_json(session, path: str, *, params: dict | None = None) -> Any`
  - `fetch_mlb_events(session) -> list[dict[str, Any]]`
  - `fetch_markets_for_events(session, event_ids: list[int], *, market_types: str | None = None, market_sub_types: str | None = None) -> list[dict[str, Any]]`
  - `chunked(items: list[T], size: int) -> list[list[T]]`

- [ ] **Step 1: Append failing tests using monkeypatched session**

```python
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
    # force tiny batch
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_fetch_mlb_events_paginates src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_fetch_markets_batches -v`

Expected: FAIL

- [ ] **Step 3: Implement HTTP layer**

```python
import logging
import time
from typing import Any, TypeVar

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://www.prophetx.co"
MLB_TOURNAMENT_ID = 109
MARKET_BATCH_SIZE = 20
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "X-Currency": "cash",
}

T = TypeVar("T")


def chunked(items: list[T], size: int) -> list[list[T]]:
    if size <= 0:
        raise ValueError("size must be positive")
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_json(
    session: requests.Session,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    retries: int = 3,
) -> Any:
    url = path if path.startswith("http") else f"{BASE_URL}{path}"
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session.get(url, params=params, timeout=60, headers=DEFAULT_HEADERS)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt + 1 < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last_err = exc
            if attempt + 1 >= retries:
                break
            time.sleep(0.5 * (attempt + 1))
    assert last_err is not None
    raise last_err


def fetch_mlb_events(session: requests.Session) -> list[dict[str, Any]]:
    path = f"/trade/public/api/v1/tournaments/{MLB_TOURNAMENT_ID}/events"
    events: list[dict[str, Any]] = []
    nxt: str | int | None = None
    while True:
        params = {"next": nxt} if nxt is not None else None
        payload = fetch_json(session, path, params=params)
        chunk = payload.get("data") or []
        if isinstance(chunk, list):
            events.extend([e for e in chunk if isinstance(e, dict)])
        nxt = payload.get("next")
        if not nxt or not chunk:
            break
    max_events = os.environ.get("PROPHETX_MAX_EVENTS", "").strip()
    if max_events.isdigit():
        events = events[: int(max_events)]
    return events


def fetch_markets_for_events(
    session: requests.Session,
    event_ids: list[int],
    *,
    market_types: str | None = None,
    market_sub_types: str | None = None,
    batch_size: int = MARKET_BATCH_SIZE,
) -> list[dict[str, Any]]:
    path = "/partner/v3/public/get_multiple_markets"
    out: list[dict[str, Any]] = []
    for batch in chunked(event_ids, batch_size):
        params: dict[str, Any] = {"event_ids": ",".join(str(i) for i in batch)}
        if market_types:
            params["market_types"] = market_types
        if market_sub_types:
            params["market_sub_types"] = market_sub_types
        payload = fetch_json(session, path, params=params)
        data = payload.get("data") or []
        if isinstance(data, list):
            out.extend([row for row in data if isinstance(row, dict)])
    return out
```

Adapt `test_fetch_mlb_events_paginates` so `_FakeSession.get` matches how `fetch_json` builds the URL (full `BASE_URL + path`). If `session.get` receives `headers=` / `timeout=`, accept those kwargs in the fake.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_fetch_mlb_events_paginates src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_fetch_markets_batches -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): add ProphetX event pagination and market fetch"
```

---

### Task 6: Snapshot builder, save, orchestrator, stub hook

**Files:**
- Modify: `src/scrapers/mlb_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_prophetx.py`

**Interfaces:**
- Consumes: all prior helpers
- Produces:
  - `build_game_snapshots(events, team_market_rows, prop_market_rows) -> tuple[list[dict], list[dict]]`
  - `write_snapshots(props_games, team_games, *, props_path: str) -> tuple[str, str]`
  - `maybe_load_supabase_stub(props_games, team_games) -> None` (no-op log)
  - `run() -> None` / `if __name__ == "__main__"`

- [ ] **Step 1: Append failing tests**

```python
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
    team_rows = [{"eventId": 10079004, "markets": [_MONEYLINE_MARKET, _RUN_LINE_MARKET]}]
    prop_rows = [{"eventId": 10079004, "markets": [_HITS_PROP]}]
    props_games, team_games = px.build_game_snapshots(events, team_rows, prop_rows)
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
    p_path, t_path = px.write_snapshots(props_games, team_games, props_path=props_path)
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_build_game_snapshots_splits_props_and_team src/scrapers/tests/scrapers/test_mlb_prophetx.py::test_write_snapshots -v`

Expected: FAIL

- [ ] **Step 3: Implement builder + run()**

```python
import json
from datetime import datetime, timezone


def build_game_snapshots(
    events: list[dict[str, Any]],
    team_market_rows: list[dict[str, Any]],
    prop_market_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    team_by_id = {
        int(row["eventId"]): row.get("markets") or []
        for row in team_market_rows
        if row.get("eventId") is not None
    }
    props_by_id = {
        int(row["eventId"]): row.get("markets") or []
        for row in prop_market_rows
        if row.get("eventId") is not None
    }
    props_games: list[dict[str, Any]] = []
    team_games: list[dict[str, Any]] = []
    for event in events:
        base = normalize_event(event)
        eid = base.get("event_id")
        if eid is None:
            continue
        eid_i = int(eid)
        props_games.append({**base, "props": extract_props(props_by_id.get(eid_i, []))})
        team_games.append(
            {**base, "team_markets": extract_team_markets(team_by_id.get(eid_i, []))}
        )
    return props_games, team_games


def _payload_base(*, fetched_at: str) -> dict[str, Any]:
    return {
        "source": "prophetx",
        "fetched_at": fetched_at,
        "league": "mlb",
        "tournament_id": MLB_TOURNAMENT_ID,
    }


def write_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    props_path: str,
) -> tuple[str, str]:
    fetched_at = datetime.now(_OUTPUT_TZ).isoformat(timespec="seconds")
    base = _payload_base(fetched_at=fetched_at)
    props_payload = {**base, "snapshot_kind": "props", "games": props_games}
    team_payload = {**base, "snapshot_kind": "team", "games": team_games}
    team_path = team_output_path(props_path)
    for path, payload in ((props_path, props_payload), (team_path, team_payload)):
        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    return props_path, team_path


def maybe_load_supabase_stub(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
) -> None:
    """Placeholder for a future load_prophetx_snapshot — intentionally no-op in v1."""
    logger.info(
        "Supabase ProphetX load stub (no-op): props_games=%s team_games=%s",
        len(props_games),
        len(team_games),
    )


def run() -> None:
    logging.basicConfig(
        level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO),
        format="[%(levelname)-8s] %(name)s: %(message)s",
    )
    session = requests.Session()
    events = fetch_mlb_events(session)
    event_ids = [int(e["id"]) for e in events if e.get("id") is not None]
    team_rows = fetch_markets_for_events(
        session,
        event_ids,
        market_types="moneyline,spread,total",
    )
    # period moneylines into team extraction via second fetch merged by event
    period_subs = "1st_inning_moneyline,1st_5th_inning_moneyline"
    period_rows = fetch_markets_for_events(
        session, event_ids, market_sub_types=period_subs
    )
    team_merged = _merge_market_rows(team_rows, period_rows)
    prop_subs = ",".join(PROP_SUBTYPE_TO_STAT.keys())
    prop_rows = fetch_markets_for_events(
        session, event_ids, market_sub_types=prop_subs
    )
    props_games, team_games = build_game_snapshots(events, team_merged, prop_rows)
    props_path = resolve_props_output_path()
    write_snapshots(props_games, team_games, props_path=props_path)
    maybe_load_supabase_stub(props_games, team_games)


def _merge_market_rows(
    primary: list[dict[str, Any]],
    extra: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_id: dict[int, list[dict[str, Any]]] = {}
    for row in primary + extra:
        eid = row.get("eventId")
        if eid is None:
            continue
        by_id.setdefault(int(eid), []).extend(row.get("markets") or [])
    return [{"eventId": eid, "markets": mkts} for eid, mkts in by_id.items()]


if __name__ == "__main__":
    run()
```

Ensure empty `event_ids` still writes empty `games: []` files (call `write_snapshots` with empty lists).

- [ ] **Step 4: Run full unit suite**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_prophetx.py -v`

Expected: all PASS

- [ ] **Step 5: Manual smoke (optional, not CI)**

Run: `python -m src.scrapers.mlb_prophetx`

Expected: two files under `data/props/prophetx/mlb/` with non-empty `games` when MLB slate is live.

- [ ] **Step 6: Commit**

```bash
git add src/scrapers/mlb_prophetx.py src/scrapers/tests/scrapers/test_mlb_prophetx.py
git commit -m "feat(scrapers): wire ProphetX MLB scrape orchestrator"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Public HTTP APIs, no Selenium / partner key | 5, 6 |
| Tournament 109 event pagination | 5 |
| Team moneyline / run line / total + period MLs | 3, 6 |
| Allowlisted player props → snake_case stats | 4 |
| Favourite / main line only | 2, 3, 4 |
| Best american + stake | 2, 3, 4 |
| Split `*_props.json` / `*_team.json` under `data/props/prophetx/mlb/` | 1, 6 |
| Env `PROPHETX_OUTPUT` / `PROPHETX_OUTPUT_DIR` / `PROPHETX_MAX_EVENTS` | 1, 5 |
| Empty slate writes both files | 6 |
| Supabase stub only | 6 |
| Unit tests, no live network in CI | 1–6 |

## Placeholder / consistency notes

- Function names are stable across tasks: `pick_main_market_line`, `extract_team_markets`, `extract_props`, `fetch_mlb_events`, `build_game_snapshots`, `write_snapshots`.
- Moneyline uses top-level `selections`; spreads/totals/props use `marketLines` + favourite (Task 3 / 4).
- Do not add real `load_prophetx_snapshot` — only `maybe_load_supabase_stub`.
