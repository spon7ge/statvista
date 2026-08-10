# WNBA Novig Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/scrapers/wnba_novig.py` that scrapes Novig WNBA (main-line team markets + allowlisted player props) via public GraphQL, writes `*_props.json` + `*_team.json` under `data/props/novig/wnba/`, and upserts into `odds.wnba_novig` / `odds.wnba_novig_team`.

**Architecture:** Dedicated MLB twin module (no shared client refactor). Primary transport is unauthenticated `POST https://api.novig.us/v1/graphql` (WNBA events → per-event markets). Normalize `available` → American + opposite-side order `qty` → `stake`. League-routed loaders write WNBA tables. Env-gated Selenium stub matches MLB.

**Tech Stack:** Python 3, `requests`, pytest, Supabase via existing `upsert_df` / `load_snapshots`

**Spec:** `docs/superpowers/specs/2026-08-09-wnba-novig-scraper-design.md`

## Global Constraints

- League is `wnba` only; GraphQL filter `game: { league: { _eq: "WNBA" } }`
- GraphQL host: `https://api.novig.us/v1/graphql` (no trading API key)
- Quote = bettable `available` probability → American; never use `last` as primary
- `stake` from opposite outcome open CASH order `qty` (cents → dollars); else `null`
- Team markets: `MONEY` → `moneyline`; main `SPREAD` → `spread` (not `run_line`); main `TOTAL` → `total`
- Prop allowlist by Novig `type` only (Task 4); unmapped types skipped
- Output: `novig_wnba_{YYYY-MM-DD}_{HHMMSS}_props.json` + `_team.json` (America/Los_Angeles)
- Supabase upsert unless `NOVIG_SKIP_DB`; migrations `035` / `036` mirror MLB Novig schemas
- No frontend / Odds API UI replacement in this plan
- No live Novig calls in CI tests
- Follow `md/claude.md` (small focused changes, typing, tests with code)
- Product name **statvista** in any user-facing copy

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scrapers/wnba_novig.py` | Full WNBA Novig scraper (fetch, extract, save, DB upsert, Selenium stub) |
| `src/scrapers/tests/scrapers/test_wnba_novig.py` | Unit tests with fixtures (no network) |
| `db/migrations/035_odds_wnba_novig.sql` | `odds.wnba_novig` props table |
| `db/migrations/036_odds_wnba_novig_team.sql` | `odds.wnba_novig_team` team table |
| `src/odds/load_snapshots.py` | Route Novig upserts by `league` to MLB vs WNBA tables |
| `src/scrapers/tests/odds/test_load_snapshots.py` | League → table routing tests |
| `md/system-design.md` | Note WNBA Novig snapshot paths / tables if odds scrapers are documented |

---

### Task 1: Output path helpers (TDD)

**Files:**
- Create: `src/scrapers/tests/scrapers/test_wnba_novig.py`
- Create: `src/scrapers/wnba_novig.py` (minimal helpers only)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `output_filename(league: str, now: datetime, *, kind: str) -> str`
  - `team_output_path(props_path: str) -> str`
  - `resolve_props_output_path(*, now: datetime | None = None) -> str`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py::test_output_filenames -v`  
Expected: FAIL (module / attributes missing)

- [ ] **Step 3: Write minimal implementation**

In `src/scrapers/wnba_novig.py`:

```python
"""Novig WNBA scraper — public GraphQL (team markets + player props).

After writing JSON snapshots, upserts to odds.wnba_novig / odds.wnba_novig_team
unless NOVIG_SKIP_DB is set.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "novig", "wnba")
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
    name = output_filename("wnba", when, kind="props")
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

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "output or team_path or resolve"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py
git commit -m "feat(novig): add WNBA scraper output path helpers"
```

---

### Task 2: Probability → American + stake from opposite bids (TDD)

**Files:**
- Modify: `src/scrapers/wnba_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_novig.py`

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
    assert q["stake"] == 32.0


def test_outcome_quote_skips_missing_available() -> None:
    nv = _load_scraper()
    assert nv.outcome_quote({"available": None, "last": 0.5, "orders": []}, None) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "probability or outcome_quote"`  
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

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "probability or outcome_quote"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py
git commit -m "feat(novig): WNBA available prob to American and stake"
```

---

### Task 3: Normalize event + team market extraction (TDD)

**Files:**
- Modify: `src/scrapers/wnba_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_novig.py`

**Interfaces:**
- Consumes: `outcome_quote`
- Produces:
  - `normalize_event(event: dict[str, Any]) -> dict[str, Any]`
  - `pick_main_spread(markets: list[dict]) -> dict | None` — among `type == "SPREAD"` with both sides `available`, minimize evenness score (no 1.5 bias)
  - `pick_main_total(markets: list[dict]) -> dict | None` — same evenness among `TOTAL`
  - `extract_team_markets(markets: list[dict[str, Any]]) -> dict[str, Any]` — keys `moneyline`, `spread`, `total` only

Status map: `OPEN_INGAME` → `"live"`; `OPEN_PREGAME` → `"not_started"`; else lowercased status string.

Competitors: home `seq=0`, away `seq=1`. Novig `description` is `"Away @ Home"`.

Copy helper structure from `src/scrapers/mlb_novig.py` (`_both_sides_available`, `_evenness_score`, `_side_row`, `_spread_rows`, `_total_rows`, `_moneyline_rows`) but emit `spread` instead of `run_line`, and omit the `|strike| == 1.5` preference in `pick_main_spread`.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "normalize_event or extract_team"`  
Expected: FAIL

- [ ] **Step 3: Implement normalize + extract_team_markets**

Port from `mlb_novig.py` with these deltas:

1. `pick_main_spread`: only evenness among SPREAD with both sides available (no `abs(strike) == 1.5` branch).
2. `extract_team_markets`: assign `out["spread"] = rows` (never `run_line`).
3. `competitor_id`: leave null unless outcome description equals a competitor `name`; still set `name` from outcome description.

Include `_SPREAD_LINE_RE`, `_line_from_spread_outcome`, `_rows_from_outcomes`, `_moneyline_rows`, `_spread_rows`, `_total_rows` as in MLB.

- [ ] **Step 4: Run tests — PASS**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "normalize_event or extract_team"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py
git commit -m "feat(novig): normalize WNBA events and extract team markets"
```

---

### Task 4: Player prop extraction (TDD)

**Files:**
- Modify: `src/scrapers/wnba_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_novig.py`

**Interfaces:**
- Consumes: `outcome_quote`
- Produces:
  - `PROP_TYPE_TO_STAT: dict[str, str]`
  - `extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]`

Allowlist (Novig `type` → `stat`). Start with these keys; if live smoke (Task 7) shows different type strings for the same markets, update the map keys to match observed types while keeping canonical `stat` values:

| Novig `type` | `stat` |
| --- | --- |
| `POINTS` | `points` |
| `REBOUNDS` | `rebounds` |
| `ASSISTS` | `assists` |
| `POINTS_REBOUNDS_ASSISTS` | `points_rebounds_assists` |
| `POINTS_REBOUNDS` | `points_rebounds` |
| `POINTS_ASSISTS` | `points_assists` |
| `REBOUNDS_ASSISTS` | `rebounds_assists` |
| `THREES` | `threes` |
| `THREE_POINTERS` | `threes` |
| `STEALS` | `steals` |
| `BLOCKS` | `blocks` |
| `STEALS_BLOCKS` | `steals_blocks` |
| `TURNOVERS` | `turnovers` |

Skip when `player` is null. Skip types not in map.

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
  "sub_type": str,  # lowercased market type e.g. "points"
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
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "extract_props"`  
Expected: FAIL

- [ ] **Step 3: Implement `PROP_TYPE_TO_STAT` + `extract_props`**

Port logic from `mlb_novig.py` `extract_props` / `_prop_evenness_score` / `_outcome_side`. Identify over/under by outcome description starting with `Over` / `Under` (case-insensitive).

```python
PROP_TYPE_TO_STAT: dict[str, str] = {
    "POINTS": "points",
    "REBOUNDS": "rebounds",
    "ASSISTS": "assists",
    "POINTS_REBOUNDS_ASSISTS": "points_rebounds_assists",
    "POINTS_REBOUNDS": "points_rebounds",
    "POINTS_ASSISTS": "points_assists",
    "REBOUNDS_ASSISTS": "rebounds_assists",
    "THREES": "threes",
    "THREE_POINTERS": "threes",
    "STEALS": "steals",
    "BLOCKS": "blocks",
    "STEALS_BLOCKS": "steals_blocks",
    "TURNOVERS": "turnovers",
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "extract_props"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py
git commit -m "feat(novig): extract allowlisted WNBA player props"
```

---

### Task 5: GraphQL fetch (TDD with mocks)

**Files:**
- Modify: `src/scrapers/wnba_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_novig.py`

**Interfaces:**
- Consumes: `requests.Session`
- Produces:
  - `GRAPHQL_URL = "https://api.novig.us/v1/graphql"`
  - `graphql(session, query: str, variables: dict | None = None, *, retries: int = 3) -> Any`
  - `fetch_wnba_events(session) -> list[dict]` — `OPEN_PREGAME` + `OPEN_INGAME`, league WNBA; honor `NOVIG_MAX_EVENTS`
  - `fetch_event_markets(session, event_id: str) -> list[dict]` — markets with player, outcomes, orders

Query shapes (same as MLB with league filter changed):

**Events:**

```graphql
query GetWnbaEvents($limit: Int!, $offset: Int!) {
  event(
    where: {
      status: { _in: ["OPEN_PREGAME", "OPEN_INGAME"] }
      game: { league: { _eq: "WNBA" } }
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

Also keep an inline fallback query (limit 500, no variables) if limit/offset variables fail — same pattern as `fetch_mlb_events` in `mlb_novig.py`.

**Markets for one event:** reuse MLB `_GET_EVENT_MARKETS_QUERY` exactly (event id filter; markets payload is league-agnostic). Prefer `id: uuid!` if that is what live MLB uses successfully; match `mlb_novig.py` current query variable typing.

- [ ] **Step 1: Write failing tests with unittest.mock**

```python
from unittest.mock import MagicMock


def test_fetch_wnba_events_parses_data(monkeypatch) -> None:
    nv = _load_scraper()
    session = MagicMock()
    payload = {
        "data": {
            "event": [
                {
                    "id": "e1",
                    "description": "NY @ LV",
                    "status": "OPEN_PREGAME",
                    "game": {"league": "WNBA"},
                },
            ]
        }
    }
    monkeypatch.setattr(nv, "graphql", lambda *_a, **_k: payload)
    events = nv.fetch_wnba_events(session)
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
                        {"id": "m1", "type": "POINTS", "strike": 20.5, "outcomes": []}
                    ]
                }
            ]
        }
    }
    monkeypatch.setattr(nv, "graphql", lambda *_a, **_k: payload)
    markets = nv.fetch_event_markets(session, "e1")
    assert markets[0]["id"] == "m1"
```

- [ ] **Step 2: Run — FAIL**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "fetch_wnba or fetch_event"`  
Expected: FAIL

- [ ] **Step 3: Implement `graphql`, `fetch_wnba_events`, `fetch_event_markets`**

Port `_graphql_post`, `graphql`, `_events_from_graphql_payload`, pagination + inline fallback from `mlb_novig.py`, renaming to WNBA queries/`fetch_wnba_events`. Headers:

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

Retries: up to 3 on 429/5xx with `time.sleep(0.5 * (attempt + 1))`.

- [ ] **Step 4: Run — PASS**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v -k "fetch_wnba or fetch_event"`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py
git commit -m "feat(novig): fetch WNBA events and markets via GraphQL"
```

---

### Task 6: Snapshots, orchestrator, Selenium stub, Supabase hook

**Files:**
- Modify: `src/scrapers/wnba_novig.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_novig.py`

**Interfaces:**
- Consumes: Tasks 1–5
- Produces:
  - `build_game_snapshots(events, markets_by_event_id) -> tuple[list, list]`
  - `write_snapshots(props_games, team_games, *, props_path) -> tuple[str, str]`
  - `load_supabase_snapshots(props_games, team_games, *, scraped_at=None, props_path=None, team_path=None) -> None`
  - `fetch_via_selenium() -> tuple[list, dict[str, list]]` — raises clear RuntimeError (stub)
  - `run() -> None`

Envelope:

```python
{
  "source": "novig",
  "fetched_at": "<iso America/Los_Angeles>",
  "league": "wnba",
  "snapshot_kind": "props" | "team",
  "games": [...],
}
```

`run()` logic (match `mlb_novig.run`):
1. `session = requests.Session()`
2. Try GraphQL: events → for each event fetch markets → build snapshots
3. Count usable props + team markets
4. If GraphQL exception **or** (events non-empty but zero usable quotes):
   - if `NOVIG_ALLOW_SELENIUM` truthy → Selenium stub path
   - else log error and `sys.exit(1)`
5. `write_snapshots(...)` always writing both files
6. `load_supabase_snapshots(..., league="wnba")` via `load_novig_props_snapshot` / `load_novig_team_snapshot`
7. Log paths + counts; DB failures log and keep JSON

- [ ] **Step 1: Write failing tests**

```python
import json


def test_write_snapshots_roundtrip(tmp_path) -> None:
    nv = _load_scraper()
    props_path = str(tmp_path / "novig_wnba_2026-08-09_120000_props.json")
    props_games = [{"event_id": "e1", "name": "A @ B", "props": []}]
    team_games = [{"event_id": "e1", "name": "A @ B", "team_markets": {}}]
    p, t = nv.write_snapshots(props_games, team_games, props_path=props_path)
    assert p.endswith("_props.json")
    assert t.endswith("_team.json")
    props_payload = json.loads(Path(p).read_text())
    assert props_payload["source"] == "novig"
    assert props_payload["snapshot_kind"] == "props"
    assert props_payload["league"] == "wnba"
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
    assert "spread" not in team_games[0]["team_markets"] or True  # money only OK
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement build/write/run/load_supabase_snapshots**

```python
def load_supabase_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    scraped_at: datetime | None = None,
    props_path: str | None = None,
    team_path: str | None = None,
) -> None:
    """Upsert snapshot games to odds.wnba_novig / odds.wnba_novig_team."""
    try:
        from src.odds.load_snapshots import (
            load_novig_props_snapshot,
            load_novig_team_snapshot,
        )

        when = scraped_at or datetime.now(timezone.utc)
        n_props = load_novig_props_snapshot(
            props_games, league="wnba", scraped_at=when
        )
        n_team = load_novig_team_snapshot(
            team_games, league="wnba", scraped_at=when
        )
        logger.info(
            "Supabase Novig upserted props=%s team=%s%s%s",
            n_props,
            n_team,
            f" props_path={props_path}" if props_path else "",
            f" team_path={team_path}" if team_path else "",
        )
    except Exception as exc:
        logger.error("Supabase Novig load failed (JSON kept): %s", exc)
```

Selenium stub identical message to MLB but mention WNBA in log lines where helpful.

Entry:

```python
if __name__ == "__main__":
    run()
```

- [ ] **Step 4: Run unit tests — PASS**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py
git commit -m "feat(novig): wire WNBA snapshot writer and run orchestrator"
```

---

### Task 7: Migrations + league-routed loaders

**Files:**
- Create: `db/migrations/035_odds_wnba_novig.sql`
- Create: `db/migrations/036_odds_wnba_novig_team.sql`
- Modify: `src/odds/load_snapshots.py` (`load_novig_props_snapshot`, `load_novig_team_snapshot`)
- Modify: `src/scrapers/tests/odds/test_load_snapshots.py`
- Modify: `md/system-design.md` only if it documents odds scrape tables / paths (add WNBA Novig rows beside MLB Novig if present; otherwise skip)

**Interfaces:**
- Consumes: existing `novig_props_to_rows` / `novig_team_to_rows`
- Produces:
  - tables `odds.wnba_novig`, `odds.wnba_novig_team`
  - `_novig_props_table(league: str) -> str` and `_novig_team_table(league: str) -> str` (or inline routing)
  - loaders upsert to the table for the given league

- [ ] **Step 1: Write failing loader routing tests**

Append to `src/scrapers/tests/odds/test_load_snapshots.py`:

```python
def test_load_novig_props_routes_wnba_table(monkeypatch, mock_upsert):
    monkeypatch.delenv("NOVIG_SKIP_DB", raising=False)
    games = [
        {
            "event_id": "uuid-1",
            "competitors": [
                {"name": "Home", "seq": 0},
                {"name": "Away", "seq": 1},
            ],
            "props": [
                {
                    "player": "A",
                    "stat": "points",
                    "line": 20.5,
                    "over": {"american": -110, "stake": 10.0},
                    "under": None,
                    "market_id": "m1",
                    "sub_type": "points",
                    "is_main": True,
                }
            ],
        }
    ]
    count = load_snapshots.load_novig_props_snapshot(games, league="wnba")
    assert count >= 1
    assert mock_upsert.call_args.kwargs.get("schema") == "odds" or (
        mock_upsert.call_args[0][0] if mock_upsert.call_args.args else None
    )
    table = mock_upsert.call_args.args[0]
    assert table == "wnba_novig"


def test_load_novig_team_routes_wnba_table(monkeypatch, mock_upsert):
    monkeypatch.delenv("NOVIG_SKIP_DB", raising=False)
    games = [
        {
            "event_id": "uuid-1",
            "competitors": [
                {"name": "Home", "seq": 0},
                {"name": "Away", "seq": 1},
            ],
            "team_markets": {
                "moneyline": [
                    {"name": "Away", "american": 130, "line": None, "stake": None},
                    {"name": "Home", "american": -150, "line": None, "stake": None},
                ]
            },
        }
    ]
    count = load_snapshots.load_novig_team_snapshot(games, league="wnba")
    assert count >= 1
    table = mock_upsert.call_args.args[0]
    assert table == "wnba_novig_team"


def test_load_novig_props_still_routes_mlb(monkeypatch, mock_upsert):
    monkeypatch.delenv("NOVIG_SKIP_DB", raising=False)
    games = [
        {
            "event_id": "uuid-1",
            "competitors": [
                {"name": "Home", "seq": 0},
                {"name": "Away", "seq": 1},
            ],
            "props": [
                {
                    "player": "A",
                    "stat": "hits",
                    "line": 0.5,
                    "over": {"american": -110, "stake": None},
                    "under": None,
                    "market_id": "m1",
                    "sub_type": "hits",
                    "is_main": True,
                }
            ],
        }
    ]
    load_snapshots.load_novig_props_snapshot(games, league="mlb")
    assert mock_upsert.call_args.args[0] == "mlb_novig"
```

Adapt assertions to how `mock_upsert` is defined in that test file (positional vs kwargs) — inspect existing Novig/ProphetX upsert tests in the same file and match their call-shape checks.

- [ ] **Step 2: Run — expect FAIL** (WNBA still hits `mlb_novig`)

Run: `pytest src/scrapers/tests/odds/test_load_snapshots.py -v -k "novig_props_routes or novig_team_routes or novig_props_still"`  
Expected: FAIL on WNBA routing

- [ ] **Step 3: Add migrations**

`db/migrations/035_odds_wnba_novig.sql` — copy `033_odds_mlb_novig.sql` renaming table/indexes to `wnba_novig` / `odds_wnba_novig_*`.

`db/migrations/036_odds_wnba_novig_team.sql` — copy `034_odds_mlb_novig_team.sql` renaming to `wnba_novig_team` / `odds_wnba_novig_team_*`.

- [ ] **Step 4: Route loaders**

In `src/odds/load_snapshots.py`:

```python
def _novig_props_table(league: str) -> str:
    key = league.strip().lower()
    if key == "wnba":
        return "wnba_novig"
    return "mlb_novig"


def _novig_team_table(league: str) -> str:
    key = league.strip().lower()
    if key == "wnba":
        return "wnba_novig_team"
    return "mlb_novig_team"
```

Replace hardcoded `"mlb_novig"` / `"mlb_novig_team"` in `load_novig_props_snapshot` / `load_novig_team_snapshot` with `_novig_props_table(league)` / `_novig_team_table(league)`.

- [ ] **Step 5: Run loader + scraper tests — PASS**

Run:

```bash
pytest src/scrapers/tests/odds/test_load_snapshots.py -v -k "novig"
pytest src/scrapers/tests/scrapers/test_wnba_novig.py -v
```

Expected: PASS

- [ ] **Step 6: Manual smoke (not CI)**

```bash
NOVIG_SKIP_DB=1 python -m src.scrapers.wnba_novig
```

Expected: writes under `data/props/novig/wnba/novig_wnba_*_props.json` and `*_team.json`. Inspect one event’s market `type` values; if basketball props use different type strings than Task 4, update `PROP_TYPE_TO_STAT` and re-run unit tests + smoke.

Apply migrations to the target DB using the project’s usual migration process (do not invent a new runner).

- [ ] **Step 7: Commit**

```bash
git add db/migrations/035_odds_wnba_novig.sql db/migrations/036_odds_wnba_novig_team.sql \
  src/odds/load_snapshots.py src/scrapers/tests/odds/test_load_snapshots.py \
  src/scrapers/wnba_novig.py src/scrapers/tests/scrapers/test_wnba_novig.py \
  md/system-design.md
git commit -m "feat(novig): add WNBA tables and league-routed loaders"
```

(Omit `md/system-design.md` from the commit if unchanged.)

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Dedicated `wnba_novig.py` | 1–6 |
| GraphQL first + Selenium stub | 5–6 |
| props + team JSON under `data/props/novig/wnba/` | 1, 6 |
| best `available` + stake | 2 |
| moneyline / spread / total (not run_line) | 3 |
| broader prop allowlist + `is_main` | 4 |
| `odds.wnba_novig` / `odds.wnba_novig_team` | 7 |
| league-routed loaders | 7 |
| `NOVIG_*` / `NOVIG_SKIP_DB` env knobs | 1, 5, 6, 7 |
| unit tests, no live network in CI | 1–7 |
| live type-string confirmation | 7 smoke |

## Self-review notes

- Spec out-of-scope items (shared client, frontend, CDP implementation) have no tasks.
- No TBD placeholders; prop type keys may be adjusted after smoke but canonical stats are fixed.
- Loader table names and scraper `league="wnba"` are consistent across Tasks 6–7.
