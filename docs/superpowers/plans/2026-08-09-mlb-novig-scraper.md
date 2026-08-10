# MLB Novig Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/scrapers/mlb_novig.py` that scrapes Novig MLB (main-line team markets + allowlisted player props) via public GraphQL and writes `*_props.json` + `*_team.json` under `data/props/novig/mlb/`.

**Architecture:** Single ProphetX-twin module. Primary transport is unauthenticated `POST https://api.novig.us/v1/graphql` (events → per-event markets). Normalize `available` probability → American + opposite-side order `qty` → `stake`. Env-gated Selenium CDP fallback only if GraphQL fails or yields zero usable markets. JSON only — no Supabase.

**Tech Stack:** Python 3, `requests`, pytest; optional Selenium only behind `NOVIG_ALLOW_SELENIUM=1`

**Spec:** `docs/superpowers/specs/2026-08-09-mlb-novig-scraper-design.md`

## Global Constraints

- League is `mlb` only
- GraphQL host: `https://api.novig.us/v1/graphql` (no trading API key)
- Quote = bettable `available` probability → American; never use `last` as primary
- `stake` from opposite outcome open CASH order `qty` (cents → dollars); else `null`
- Team markets: `MONEY` → moneyline; main `SPREAD` → run_line; main `TOTAL` → total
- Prop allowlist by Novig `type` only (see Task 4); unmapped types skipped
- Output: `novig_mlb_{YYYY-MM-DD}_{HHMMSS}_props.json` + `_team.json` (America/Los_Angeles)
- No Supabase / backend / frontend / Odds API wiring
- No live Novig calls in CI tests
- Follow `md/claude.md` (small focused changes, typing, tests with code)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scrapers/mlb_novig.py` | Full MLB Novig scraper (fetch, extract, save, optional Selenium fallback) |
| `src/scrapers/tests/scrapers/test_mlb_novig.py` | Unit tests with inline fixtures (no network) |

---

### Task 1: Output path helpers (TDD)

**Files:**
- Create: `src/scrapers/tests/scrapers/test_mlb_novig.py`
- Create: `src/scrapers/mlb_novig.py` (minimal helpers only)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `output_filename(league: str, now: datetime, *, kind: str) -> str`
  - `team_output_path(props_path: str) -> str`
  - `resolve_props_output_path(*, now: datetime | None = None) -> str`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_novig.py::test_output_filenames -v`  
Expected: FAIL (module / attributes missing)

- [ ] **Step 3: Write minimal implementation**

In `src/scrapers/mlb_novig.py`:

```python
"""Novig MLB scraper — public GraphQL (team markets + player props)."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "novig", "mlb")
_OUTPUT_TZ = ZoneInfo("America/Los_Angeles")


def output_filename(league: str, now: datetime, *, kind: str) -> str:
    if kind not in ("props", "team"):
        raise ValueError(f"kind must be 'props' or 'team', got {kind!r}")
    stamp = now.astimezone(_OUTPUT_TZ).strftime("%Y-%m-%d_%H%M%S")
    return f"novig_{league.strip().lower()}_{stamp}_{kind}.json"


def team_output_path(props_path: str) -> str:
    if props_path.endswith("_props.json"):
        return props_path[: -len("_props.json")] + "_team.json"
    root, ext = os.path.splitext(props_path)
    return f"{root}_team{ext or '.json'}"


def resolve_props_output_path(*, now: datetime | None = None) -> str:
    when = now or datetime.now(_OUTPUT_TZ)
    env_file = os.environ.get("NOVIG_OUTPUT", "").strip()
    env_dir = os.environ.get("NOVIG_OUTPUT_DIR", "").strip()
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

Run: `pytest src/scrapers/tests/scrapers/test_mlb_novig.py -v -k "output or team_path or resolve"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_novig.py src/scrapers/tests/scrapers/test_mlb_novig.py
git commit -m "feat(novig): add MLB scraper output path helpers"
```

---

### Task 2: Probability → American + stake from opposite bids (TDD)

**Files:**
- Modify: `src/scrapers/mlb_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_novig.py`

**Interfaces:**
- Consumes: Task 1 module
- Produces:
  - `probability_to_american(prob: float) -> int | None`
  - `qty_cents_to_stake_dollars(qty: float | int | None) -> float | None`
  - `outcome_quote(outcome: dict, opposite: dict | None) -> dict[str, int | float | None] | None`  
    Returns `{"american": int, "stake": float | None}` using `available` only; `stake` = sum of opposite open order qtys / 100

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_novig.py -v -k "probability or outcome_quote"`  
Expected: FAIL (functions missing)

- [ ] **Step 3: Write minimal implementation**

```python
from typing import Any


def probability_to_american(prob: float) -> int | None:
    if prob <= 0.0 or prob >= 1.0:
        return None
    if abs(prob - 0.5) < 1e-12:
        return -100
    if prob > 0.5:
        return int(round(-100.0 * prob / (1.0 - prob)))
    return int(round(100.0 * (1.0 - prob) / prob))


def qty_cents_to_stake_dollars(qty: float | int | None) -> float | None:
    if qty is None:
        return None
    try:
        cents = float(qty)
    except (TypeError, ValueError):
        return None
    if cents <= 0:
        return None
    return cents / 100.0


def outcome_quote(
    outcome: dict[str, Any],
    opposite: dict[str, Any] | None,
) -> dict[str, int | float | None] | None:
    raw = outcome.get("available")
    if raw is None:
        return None
    try:
        prob = float(raw)
    except (TypeError, ValueError):
        return None
    american = probability_to_american(prob)
    if american is None:
        return None
    stake: float | None = None
    if opposite:
        total = 0.0
        for order in opposite.get("orders") or []:
            if not isinstance(order, dict):
                continue
            if str(order.get("status") or "OPEN").upper() != "OPEN":
                continue
            part = qty_cents_to_stake_dollars(order.get("qty"))
            if part is not None:
                total += part
        if total > 0:
            stake = total
    return {"american": american, "stake": stake}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_novig.py -v -k "probability or outcome_quote"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_novig.py src/scrapers/tests/scrapers/test_mlb_novig.py
git commit -m "feat(novig): convert available prob to American and stake"
```

---

### Task 3: Normalize event + team market extraction (TDD)

**Files:**
- Modify: `src/scrapers/mlb_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_novig.py`

**Interfaces:**
- Consumes: `outcome_quote`
- Produces:
  - `normalize_event(event: dict[str, Any]) -> dict[str, Any]`
  - `pick_main_spread(markets: list[dict]) -> dict | None` — prefer `|strike| == 1.5` with both sides `available`; else closest-to-even among SPREAD with both sides available
  - `pick_main_total(markets: list[dict]) -> dict | None` — among `type == "TOTAL"`, pick market minimizing `|over.available-0.5|+|under.available-0.5|` when both present
  - `extract_team_markets(markets: list[dict[str, Any]]) -> dict[str, Any]` — keys `moneyline`, `run_line`, `total`

Status map: `OPEN_INGAME` → `"live"`; `OPEN_PREGAME` → `"not_started"`; else lowercased status string.

Competitors: away `seq=1`, home `seq=0` (match ProphetX home-first seq convention: home seq 0, away seq 1 — ProphetX uses home as seq 0). Novig `description` is `"Away @ Home"`.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_novig.py -v -k "normalize_event or extract_team"`  
Expected: FAIL

- [ ] **Step 3: Implement normalize + extract_team_markets**

Implement helpers that:
1. Build competitor list from `game.homeTeam` / `game.awayTeam`
2. For `MONEY`: two side rows with `name`, `competitor_id` (match outcome description to team name/abbrev substring — use outcome description as `name`; set `competitor_id` when outcome description matches home/away `name` or known short code from description), `american`, `line: null`, `stake`
3. For main `SPREAD`: prefer markets with `abs(strike) == 1.5` and both outcomes having `available`; emit sides with `line` from outcome description or ±strike
4. For main `TOTAL`: minimize distance-to-even among markets with both sides available; sides named over/under with `line` = strike

Match competitor_id loosely: if outcome description equals team name or is contained in team name initials — for tests, match exact `"San Diego Padres"` vs short `"SD"` by checking whether outcome description is substring of name words or equals known home/away short tokens from market description. Practical rule for v1: leave `competitor_id` null unless outcome description equals a competitor `name`; still set `name` from outcome description.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_novig.py src/scrapers/tests/scrapers/test_mlb_novig.py
git commit -m "feat(novig): normalize events and extract team markets"
```

---

### Task 4: Player prop extraction (TDD)

**Files:**
- Modify: `src/scrapers/mlb_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_novig.py`

**Interfaces:**
- Consumes: `outcome_quote`
- Produces:
  - `PROP_TYPE_TO_STAT: dict[str, str]`
  - `extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]`

Allowlist (Novig `type` → `stat`):

| Novig `type` | `stat` |
| --- | --- |
| `HITS` | `hits` |
| `HOME_RUNS` | `home_runs` |
| `RBIS` | `rbis` |
| `RUNS` | `runs` |
| `TOTAL_BASES` | `total_bases` |
| `STOLEN_BASES` | `stolen_bases` |
| `SINGLES` | `singles` |
| `DOUBLES` | `doubles` |
| `HITS_ALLOWED` | `hits_allowed` |
| `PITCHER_STRIKEOUTS` | `strikeouts` |

Skip when `player` is null. Skip types not in map (e.g. `BATTING_WALKS`, `HITS_RUNS_RBIS`, `PITCHER_OUTS`).

`is_main`: group by `(player_id or player name, stat)`. Among markets in a group that have ≥1 quoted side, mark the market minimizing `|over_avail-0.5|+|under_avail-0.5|` (missing side counts as 1.0) as `is_main: true`; others `false`. Sole market → `true`.

Prop row shape:

```python
{
  "player": str,
  "stat": str,
  "line": float,  # market.strike
  "over": {"american": int, "stake": float | None} | None,
  "under": {"american": int, "stake": float | None} | None,
  "market_id": str,
  "sub_type": str,  # lowercased market type e.g. "hits"
  "is_main": bool,
}
```

Skip row if both over and under quotes are missing.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `PROP_TYPE_TO_STAT` + `extract_props`**

Identify over/under by outcome description starting with `Over` / `Under` (case-insensitive).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_novig.py src/scrapers/tests/scrapers/test_mlb_novig.py
git commit -m "feat(novig): extract allowlisted MLB player props"
```

---

### Task 5: GraphQL fetch (TDD with mocks)

**Files:**
- Modify: `src/scrapers/mlb_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_novig.py`

**Interfaces:**
- Consumes: `requests.Session`
- Produces:
  - `GRAPHQL_URL = "https://api.novig.us/v1/graphql"`
  - `graphql(session, query: str, variables: dict | None = None) -> Any`
  - `fetch_mlb_events(session) -> list[dict]` — `OPEN_PREGAME` + `OPEN_INGAME`, league MLB; honor `NOVIG_MAX_EVENTS`
  - `fetch_event_markets(session, event_id: str) -> list[dict]` — markets with player, outcomes, orders

Confirmed working query shapes (live probe 2026-08-09):

**Events:**

```graphql
query GetMlbEvents($limit: Int!, $offset: Int!) {
  event(
    where: {
      status: { _in: ["OPEN_PREGAME", "OPEN_INGAME"] }
      game: { league: { _eq: "MLB" } }
    }
    limit: $limit
    offset: $offset
  ) {
    id
    description
    status
    game {
      scheduled_start
      league
      homeTeam { id name }
      awayTeam { id name }
    }
  }
}
```

**Markets for one event:**

```graphql
query GetEventMarkets($id: String!) {
  event(where: { id: { _eq: $id } }) {
    markets {
      id
      description
      type
      strike
      player { id name }
      outcomes {
        id
        description
        available
        last
        orders(where: { status: { _eq: "OPEN" }, currency: { _eq: "CASH" } }) {
          qty
          price
          status
        }
      }
    }
  }
}
```

If `limit`/`offset` variables are rejected by the API, fall back to inline limit and client-side slice via `NOVIG_MAX_EVENTS`.

- [ ] **Step 1: Write failing tests with `responses`-style monkeypatch or unittest.mock**

```python
from unittest.mock import MagicMock


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
```

Also test `graphql` raises after retries when HTTP 500, and raises when GraphQL `errors` key present with empty data.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `graphql`, `fetch_mlb_events`, `fetch_event_markets`**

Use browser-like headers:

```python
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Content-Type": "application/json",
}
```

Retries: up to 3 on 429/5xx with `time.sleep(0.5 * attempt)`.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/mlb_novig.py src/scrapers/tests/scrapers/test_mlb_novig.py
git commit -m "feat(novig): fetch MLB events and markets via GraphQL"
```

---

### Task 6: Snapshots, orchestrator, Selenium fallback stub

**Files:**
- Modify: `src/scrapers/mlb_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_mlb_novig.py`

**Interfaces:**
- Consumes: Tasks 1–5
- Produces:
  - `build_game_snapshots(events, markets_by_event_id) -> tuple[list, list]`
  - `write_snapshots(props_games, team_games, *, props_path) -> tuple[str, str]`
  - `fetch_via_selenium() -> tuple[list, dict[str, list]]` — raises `NotImplementedError` or returns events+markets only when `NOVIG_ALLOW_SELENIUM=1`; minimal stub OK if GraphQL works (log + raise clear error instructing to capture SPA)
  - `run() -> None`

Envelope:

```python
{
  "source": "novig",
  "fetched_at": "<iso America/Los_Angeles>",
  "league": "mlb",
  "snapshot_kind": "props" | "team",
  "games": [...],
}
```

`run()` logic:
1. `session = requests.Session()`
2. Try GraphQL: events → for each event fetch markets → build snapshots
3. Count usable props + team markets across games
4. If GraphQL exception **or** (events non-empty but zero usable quotes across all games):
   - if `NOVIG_ALLOW_SELENIUM` truthy → call Selenium path then rebuild
   - else log error and `sys.exit(1)`
5. `write_snapshots(...)` always writing both files
6. Log paths + counts

- [ ] **Step 1: Write failing tests**

```python
def test_write_snapshots_roundtrip(tmp_path) -> None:
    nv = _load_scraper()
    props_path = str(tmp_path / "novig_mlb_2026-08-09_120000_props.json")
    props_games = [{"event_id": "e1", "name": "A @ B", "props": []}]
    team_games = [{"event_id": "e1", "name": "A @ B", "team_markets": {}}]
    p, t = nv.write_snapshots(props_games, team_games, props_path=props_path)
    assert p.endswith("_props.json")
    assert t.endswith("_team.json")
    import json
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
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement build/write/run**

Selenium stub:

```python
def selenium_fallback_enabled() -> bool:
    return os.environ.get("NOVIG_ALLOW_SELENIUM", "").strip().lower() in {
        "1", "true", "yes", "on",
    }


def fetch_via_selenium() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    raise RuntimeError(
        "Novig Selenium fallback is not implemented yet; "
        "GraphQL at api.novig.us/v1/graphql should work without auth. "
        "Set NOVIG_ALLOW_SELENIUM only after implementing CDP capture."
    )
```

Entry:

```python
if __name__ == "__main__":
    run()
```

- [ ] **Step 4: Run unit tests — PASS**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_novig.py -v`  
Expected: all PASS

- [ ] **Step 5: Manual smoke (not CI)**

Run: `python src/scrapers/mlb_novig.py`  
Expected: writes under `data/props/novig/mlb/novig_mlb_*_props.json` and `*_team.json` with non-empty games when slate is open.

- [ ] **Step 6: Commit**

```bash
git add src/scrapers/mlb_novig.py src/scrapers/tests/scrapers/test_mlb_novig.py
git commit -m "feat(novig): wire MLB snapshot writer and run orchestrator"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `mlb_novig.py` ProphetX twin | 1–6 |
| requests / GraphQL first | 5–6 |
| Selenium env-gated fallback | 6 (stub + exit path) |
| props + team JSON under `data/props/novig/mlb/` | 1, 6 |
| best `available` + stake | 2 |
| moneyline / run_line / total | 3 |
| prop allowlist + `is_main` | 4 |
| no Supabase | 6 (omitted) |
| unit tests, no live network in CI | 1–6 |
| `NOVIG_*` env knobs | 1, 5, 6 |

## Self-review notes

- Endpoint and field names confirmed live against GraphQL (no auth) on 2026-08-09.
- Selenium is a stub that fails clearly — matches “fallback only if needed” without blocking v1 while GraphQL works.
- `tournament_id` intentionally omitted.
- Opposite-order stake follows Novig docs (bids → liquidity on opposite side).
