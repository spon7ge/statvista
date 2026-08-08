# WNBA ProphetX Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/scrapers/wnba_prophetx.py` that scrapes ProphetX WNBA (full-game team markets + allowlisted player props including combos) via public HTTP APIs and writes `*_props.json` + `*_team.json` under `data/props/prophetx/wnba/`.

**Architecture:** Dedicated `requests`-based module mirroring `mlb_prophetx.py`. Paginate tournament `1600000176` events, batch-fetch `/partner/v3/public/get_multiple_markets`, emit prop main+alts with `is_main` and team favourite/main lines only, split into two snapshot files. No Selenium, no partner key, no Supabase upsert (stub/log only).

**Tech Stack:** Python 3, `requests`, pytest, dict JSON export

**Spec:** `docs/superpowers/specs/2026-08-08-wnba-prophetx-scraper-design.md`

## Global Constraints

- League is `wnba` only; tournament id is `1600000176`
- Base host: `https://www.prophetx.co`
- Team markets: full-game `moneyline` / `spread` / `total` only (JSON key `spread`, not `run_line`); no first-half / period markets
- Player props: main + alts with `is_main`; allowlist from spec only
- Best (top-of-book) American odds + `stake` — no full order book
- Output: `prophetx_wnba_{YYYY-MM-DD}_{HHMMSS}_props.json` + `_team.json` (America/Los_Angeles)
- No Supabase / backend / frontend changes; stub hook must not call `load_prophetx_*`
- No live ProphetX calls in CI tests
- Follow `md/claude.md` (small focused changes, typing, tests with code)
- Do not refactor shared logic out of `mlb_prophetx.py` in this plan

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scrapers/wnba_prophetx.py` | Full WNBA ProphetX scraper (fetch, extract, save, stub hook) |
| `src/scrapers/tests/scrapers/test_wnba_prophetx.py` | Unit tests with inline fixtures (no network) |

---

### Task 1: Output path helpers (TDD)

**Files:**
- Create: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`
- Create: `src/scrapers/wnba_prophetx.py` (minimal helpers only)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `output_filename(league: str, now: datetime, *, kind: str) -> str`
  - `team_output_path(props_path: str) -> str`
  - `resolve_props_output_path(*, now: datetime | None = None) -> str`
  - `_DEFAULT_OUTPUT_DIR` ends with `data/props/prophetx/wnba`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_output_filenames src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_team_path_from_props src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_resolve_props_output_path_default -v`

Expected: FAIL (module / attributes missing)

- [ ] **Step 3: Implement minimal helpers in `wnba_prophetx.py`**

```python
"""ProphetX WNBA scraper — public API (team markets + player props)."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_DEFAULT_OUTPUT_DIR = os.path.join(_ROOT, "data", "props", "prophetx", "wnba")
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

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_output_filenames src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_team_path_from_props src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_resolve_props_output_path_default -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_prophetx.py src/scrapers/tests/scrapers/test_wnba_prophetx.py
git commit -m "feat(scrapers): add ProphetX WNBA output path helpers"
```

---

### Task 2: Main-line + best-price selection (TDD)

**Files:**
- Modify: `src/scrapers/wnba_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py -k "pick_main or best_selection" -v`

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

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py -k "pick_main or best_selection" -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_prophetx.py src/scrapers/tests/scrapers/test_wnba_prophetx.py
git commit -m "feat(scrapers): add ProphetX WNBA main-line and best-price helpers"
```

---

### Task 3: Team market extraction (TDD)

**Files:**
- Modify: `src/scrapers/wnba_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`

**Interfaces:**
- Consumes: `pick_main_market_line`, `best_selection`, `american_and_stake`
- Produces:
  - `TEAM_SUBTYPE_TO_KEY: dict[str, str]` → `moneyline` / `spread` / `total` only
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_extract_team_markets_moneyline_and_main_spread src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_extract_team_markets_ignores_first_half src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_normalize_event -v`

Expected: FAIL

- [ ] **Step 3: Implement extraction**

```python
TEAM_SUBTYPE_TO_KEY: dict[str, str] = {
    "moneyline": "moneyline",
    "spread": "spread",
    "total": "total",
}

_MONEYLINE_OUTPUT_KEYS = frozenset({"moneyline"})


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
                "line": None
                if line in (0, 0.0, None)
                and "over" not in str(best.get("name", "")).lower()
                else line,
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
        if key in _MONEYLINE_OUTPUT_KEYS and market.get("selections"):
            book = market
        else:
            book = pick_main_market_line(market)
        if not book:
            continue
        rows = _side_rows(_sides_from_book(book))
        if rows:
            out[key] = rows
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_extract_team_markets_moneyline_and_main_spread src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_extract_team_markets_ignores_first_half src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_normalize_event -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_prophetx.py src/scrapers/tests/scrapers/test_wnba_prophetx.py
git commit -m "feat(scrapers): extract ProphetX WNBA team markets"
```

---

### Task 4: Player prop extraction with main + alts (TDD)

**Files:**
- Modify: `src/scrapers/wnba_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`

**Interfaces:**
- Consumes: selection helpers + `_sides_from_book`
- Produces:
  - `PROP_SUBTYPE_TO_STAT: dict[str, str]` (exact map from spec)
  - `player_name_from_market(market: dict[str, Any]) -> str`
  - `extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]` (includes `is_main`)

- [ ] **Step 1: Append failing tests**

```python
_POINTS_PROP = {
    "id": 460000700,
    "name": "A'ja Wilson Total Points",
    "subType": "player_total_points",
    "type": "total",
    "status": "active",
    "marketLines": [
        {
            "name": "Fixed total 22.5",
            "favourite": True,
            "selections": [
                [
                    {
                        "id": 12,
                        "name": "over 22.5",
                        "odds": -120,
                        "line": 22.5,
                        "stake": 134.33,
                    }
                ],
                [
                    {
                        "id": 13,
                        "name": "under 22.5",
                        "odds": 100,
                        "line": 22.5,
                        "stake": 90.0,
                    }
                ],
            ],
        },
        {
            "name": "Fixed total 24.5",
            "selections": [
                [
                    {
                        "id": 14,
                        "name": "over 24.5",
                        "odds": 140,
                        "line": 24.5,
                        "stake": 40.0,
                    }
                ],
                [
                    {
                        "id": 15,
                        "name": "under 24.5",
                        "odds": -160,
                        "line": 24.5,
                        "stake": 55.0,
                    }
                ],
            ],
        },
    ],
}

_PRA_PROP = {
    "id": 460000701,
    "name": "A'ja Wilson Total Points, Rebounds & Assists",
    "subType": "player_total_points_rebounds_assists",
    "type": "total",
    "status": "active",
    "marketLines": [
        {
            "name": "Fixed total 34.5",
            "favourite": True,
            "selections": [
                [{"name": "over 34.5", "odds": -110, "line": 34.5, "stake": 10.0}],
                [{"name": "under 34.5", "odds": -110, "line": 34.5, "stake": 10.0}],
            ],
        }
    ],
}


def test_extract_props_main_and_alt_points() -> None:
    px = _load_scraper()
    props = px.extract_props([_POINTS_PROP, {"subType": "unknown_stat", "name": "X"}])
    assert len(props) == 2
    by_line = {row["line"]: row for row in props}
    main = by_line[22.5]
    alt = by_line[24.5]
    assert main["player"] == "A'ja Wilson"
    assert main["stat"] == "points"
    assert main["is_main"] is True
    assert main["over"]["american"] == -120
    assert alt["is_main"] is False
    assert alt["over"]["american"] == 140
    assert alt["under"]["american"] == -160


def test_extract_props_combo_pra() -> None:
    px = _load_scraper()
    props = px.extract_props([_PRA_PROP])
    assert len(props) == 1
    assert props[0]["stat"] == "points_rebounds_assists"
    assert props[0]["player"] == "A'ja Wilson"
    assert props[0]["is_main"] is True


def test_extract_props_sole_line_is_main() -> None:
    px = _load_scraper()
    market = {
        "id": 1,
        "name": "Breanna Stewart Total Rebounds",
        "subType": "player_total_rebounds",
        "marketLines": [
            {
                "name": "Fixed total 7.5",
                "selections": [
                    [{"name": "over 7.5", "odds": -110, "line": 7.5, "stake": 1}],
                    [{"name": "under 7.5", "odds": -110, "line": 7.5, "stake": 1}],
                ],
            }
        ],
    }
    props = px.extract_props([market])
    assert len(props) == 1
    assert props[0]["stat"] == "rebounds"
    assert props[0]["is_main"] is True


def test_extract_props_skips_empty_alt_selections() -> None:
    px = _load_scraper()
    market = {
        "id": 2,
        "name": "Breanna Stewart Total Assists",
        "subType": "player_total_assists",
        "marketLines": [
            {
                "name": "Fixed total 4.5",
                "favourite": True,
                "selections": [
                    [{"name": "over 4.5", "odds": -110, "line": 4.5, "stake": 1}],
                    [{"name": "under 4.5", "odds": -110, "line": 4.5, "stake": 1}],
                ],
            },
            {"name": "Fixed total 5.5", "selections": [[], []]},
        ],
    }
    props = px.extract_props([market])
    assert len(props) == 1
    assert props[0]["line"] == 4.5
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py -k "extract_props" -v`

Expected: FAIL

- [ ] **Step 3: Implement prop extraction**

Match the MLB alt-lines behavior in current `mlb_prophetx.py` (`extract_props` emits every usable `marketLine` with `is_main`):

```python
import logging

logger = logging.getLogger(__name__)

PROP_SUBTYPE_TO_STAT: dict[str, str] = {
    "player_total_points": "points",
    "player_total_rebounds": "rebounds",
    "player_total_assists": "assists",
    "player_total_points_rebounds_assists": "points_rebounds_assists",
    "player_total_points_rebounds": "points_rebounds",
    "player_total_points_assists": "points_assists",
    "player_total_rebounds_assists": "rebounds_assists",
}

_PROP_NAME_SUFFIXES = (
    " Total Points, Rebounds & Assists",
    " Total Points & Rebounds",
    " Total Points & Assists",
    " Total Rebounds & Assists",
    " Total Points",
    " Total Rebounds",
    " Total Assists",
)


def player_name_from_market(market: dict[str, Any]) -> str:
    name = str(market.get("name") or "").strip()
    for suffix in _PROP_NAME_SUFFIXES:
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name


def _prop_row_from_book(
    market: dict[str, Any],
    book: dict[str, Any],
    *,
    stat: str,
    sub: str,
    is_main: bool,
) -> dict[str, Any] | None:
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
        return None
    return {
        "player": player_name_from_market(market),
        "stat": stat,
        "line": line,
        "over": over,
        "under": under,
        "market_id": market.get("id"),
        "sub_type": sub,
        "is_main": is_main,
    }


def extract_props(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for market in markets:
        if not isinstance(market, dict):
            continue
        sub = str(market.get("subType") or "")
        stat = PROP_SUBTYPE_TO_STAT.get(sub)
        if not stat:
            continue
        lines = [ln for ln in (market.get("marketLines") or []) if isinstance(ln, dict)]
        if not lines:
            continue
        favourites = [ln for ln in lines if ln.get("favourite") is True]
        if len(favourites) > 1:
            logger.debug(
                "ProphetX prop market %s has %s favourite lines; marking first as is_main",
                market.get("id"),
                len(favourites),
            )
        if favourites:
            main_book = favourites[0]
        elif len(lines) == 1:
            main_book = lines[0]
        else:
            main_book = None
        for book in lines:
            is_main = book is main_book
            row = _prop_row_from_book(
                market, book, stat=stat, sub=sub, is_main=is_main
            )
            if row is not None:
                rows.append(row)
    return rows
```

Suffix order matters: longer combo suffixes must be listed before shorter ones (e.g. ` Total Points, Rebounds & Assists` before ` Total Points`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py -k "extract_props" -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_prophetx.py src/scrapers/tests/scrapers/test_wnba_prophetx.py
git commit -m "feat(scrapers): extract ProphetX WNBA player props"
```

---

### Task 5: HTTP fetch + event pagination (TDD with mocks)

**Files:**
- Modify: `src/scrapers/wnba_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`

**Interfaces:**
- Consumes: `requests`
- Produces:
  - `BASE_URL = "https://www.prophetx.co"`
  - `WNBA_TOURNAMENT_ID = 1600000176`
  - `MARKET_BATCH_SIZE = 20`
  - `fetch_json(session, path: str, *, params: dict | None = None) -> Any`
  - `fetch_wnba_events(session) -> list[dict[str, Any]]`
  - `fetch_markets_for_events(session, event_ids: list[int], *, market_types: str | None = None, market_sub_types: str | None = None, batch_size: int = MARKET_BATCH_SIZE) -> list[dict[str, Any]]`
  - `chunked(items: list[T], size: int) -> list[list[T]]`

- [ ] **Step 1: Append failing tests using fake session**

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


def test_fetch_wnba_events_paginates() -> None:
    px = _load_scraper()
    base = f"{px.BASE_URL}/trade/public/api/v1/tournaments/1600000176/events"
    session = _FakeSession(
        {
            base: [
                {"next": "cursor1", "data": [{"id": 1, "name": "A"}]},
                {"next": None, "data": [{"id": 2, "name": "B"}]},
            ]
        }
    )
    events = px.fetch_wnba_events(session)
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
    out = px.fetch_markets_for_events(
        session,
        [1, 2],
        market_types="moneyline,spread,total",
        batch_size=1,
    )
    by_event = {row["eventId"]: row["markets"] for row in out}
    assert by_event[1][0]["id"] == 1
    assert by_event[2][0]["id"] == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_fetch_wnba_events_paginates src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_fetch_markets_batches -v`

Expected: FAIL

- [ ] **Step 3: Implement HTTP layer**

```python
import time
from typing import TypeVar

import requests

BASE_URL = "https://www.prophetx.co"
WNBA_TOURNAMENT_ID = 1600000176
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


def fetch_wnba_events(session: requests.Session) -> list[dict[str, Any]]:
    path = f"/trade/public/api/v1/tournaments/{WNBA_TOURNAMENT_ID}/events"
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_fetch_wnba_events_paginates src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_fetch_markets_batches -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/wnba_prophetx.py src/scrapers/tests/scrapers/test_wnba_prophetx.py
git commit -m "feat(scrapers): add ProphetX WNBA event pagination and market fetch"
```

---

### Task 6: Snapshot builder, save, orchestrator, stub hook

**Files:**
- Modify: `src/scrapers/wnba_prophetx.py`
- Modify: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`

**Interfaces:**
- Consumes: all prior helpers
- Produces:
  - `build_game_snapshots(events, team_market_rows, prop_market_rows) -> tuple[list, list]`
  - `write_snapshots(props_games, team_games, *, props_path: str) -> tuple[str, str]`
  - `load_supabase_snapshots(...)` — **stub only**: log that Supabase load is skipped for WNBA v1; must **not** import/call `src.odds.load_snapshots.load_prophetx_*`
  - `run() -> None`

- [ ] **Step 1: Append failing tests**

```python
import json
import logging


def test_build_game_snapshots_splits_props_and_team() -> None:
    px = _load_scraper()
    events = [
        {
            "id": 13002464,
            "name": "Indiana Fever at Chicago Sky",
            "scheduled": "2026-08-08T23:00:00Z",
            "status": "not_started",
            "competitors": [],
        }
    ]
    team_rows = [
        {"eventId": 13002464, "markets": [_MONEYLINE_MARKET, _SPREAD_MARKET]}
    ]
    prop_rows = [{"eventId": 13002464, "markets": [_POINTS_PROP, _PRA_PROP]}]
    props_games, team_games = px.build_game_snapshots(
        events, team_rows, prop_rows
    )
    assert len(props_games) == 1
    assert len(team_games) == 1
    stats = {row["stat"] for row in props_games[0]["props"]}
    assert "points" in stats
    assert "points_rebounds_assists" in stats
    assert "spread" in team_games[0]["team_markets"]
    assert "run_line" not in team_games[0]["team_markets"]
    assert "props" not in team_games[0]
    assert "team_markets" not in props_games[0]


def test_write_snapshots(tmp_path) -> None:
    px = _load_scraper()
    props_path = str(tmp_path / "prophetx_wnba_2026-08-08_143000_props.json")
    props_games = [{"event_id": 1, "props": []}]
    team_games = [{"event_id": 1, "team_markets": {}}]
    p_path, t_path = px.write_snapshots(
        props_games, team_games, props_path=props_path
    )
    assert p_path.endswith("_props.json")
    assert t_path.endswith("_team.json")
    props_payload = json.loads(Path(p_path).read_text())
    team_payload = json.loads(Path(t_path).read_text())
    assert props_payload["snapshot_kind"] == "props"
    assert team_payload["snapshot_kind"] == "team"
    assert props_payload["league"] == "wnba"
    assert props_payload["tournament_id"] == 1600000176
    assert props_payload["source"] == "prophetx"


def test_load_supabase_snapshots_is_stub(caplog) -> None:
    px = _load_scraper()
    with caplog.at_level(logging.INFO):
        px.load_supabase_snapshots(
            [{"event_id": 1, "props": []}],
            [{"event_id": 1, "team_markets": {}}],
            props_path="/tmp/props.json",
            team_path="/tmp/team.json",
        )
    assert "Supabase" in caplog.text or "skip" in caplog.text.lower()
    # Ensure stub does not attempt MLB table loaders via import side effects in this call.
    assert "upserted" not in caplog.text.lower()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_build_game_snapshots_splits_props_and_team src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_write_snapshots src/scrapers/tests/scrapers/test_wnba_prophetx.py::test_load_supabase_snapshots_is_stub -v`

Expected: FAIL

- [ ] **Step 3: Implement snapshot + run + stub**

```python
import json


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
        event_id = base.get("event_id")
        if event_id is None:
            continue
        event_id_int = int(event_id)
        props_games.append(
            {**base, "props": extract_props(props_by_id.get(event_id_int, []))}
        )
        team_games.append(
            {
                **base,
                "team_markets": extract_team_markets(
                    team_by_id.get(event_id_int, [])
                ),
            }
        )
    return props_games, team_games


def _payload_base(*, fetched_at: str) -> dict[str, Any]:
    return {
        "source": "prophetx",
        "fetched_at": fetched_at,
        "league": "wnba",
        "tournament_id": WNBA_TOURNAMENT_ID,
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
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as output_file:
            json.dump(payload, output_file, ensure_ascii=False, indent=2)
    return props_path, team_path


def load_supabase_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    scraped_at: datetime | None = None,
    props_path: str | None = None,
    team_path: str | None = None,
) -> None:
    """v1 stub — WNBA ProphetX Supabase tables are out of scope."""
    del props_games, team_games, scraped_at  # unused in stub
    logger.info(
        "Supabase ProphetX WNBA load skipped (v1 JSON-only)%s%s",
        f" props_path={props_path}" if props_path else "",
        f" team_path={team_path}" if team_path else "",
    )


def run() -> None:
    logging.basicConfig(
        level=getattr(
            logging,
            os.environ.get("LOG_LEVEL", "INFO").upper(),
            logging.INFO,
        ),
        format="[%(levelname)-8s] %(name)s: %(message)s",
    )
    session = requests.Session()
    events = fetch_wnba_events(session)
    event_ids = [int(event["id"]) for event in events if event.get("id") is not None]
    team_rows = fetch_markets_for_events(
        session,
        event_ids,
        market_types="moneyline,spread,total",
    )
    prop_rows = fetch_markets_for_events(
        session,
        event_ids,
        market_sub_types=",".join(PROP_SUBTYPE_TO_STAT),
    )
    props_games, team_games = build_game_snapshots(
        events,
        team_rows,
        prop_rows,
    )
    props_path = resolve_props_output_path()
    props_path, team_path = write_snapshots(
        props_games, team_games, props_path=props_path
    )
    logger.info(
        "Wrote ProphetX snapshots: props_games=%s team_games=%s props=%s team=%s",
        len(props_games),
        len(team_games),
        props_path,
        team_path,
    )
    load_supabase_snapshots(
        props_games,
        team_games,
        props_path=props_path,
        team_path=team_path,
    )


if __name__ == "__main__":
    run()
```

Ensure `logging` is imported at module top. Do **not** fetch period market subtypes. Do **not** call `load_prophetx_props_snapshot` / `load_prophetx_team_snapshot`.

- [ ] **Step 4: Run full unit suite**

Run: `pytest src/scrapers/tests/scrapers/test_wnba_prophetx.py -v`

Expected: PASS (all tests)

- [ ] **Step 5: Optional local smoke (not CI)**

```bash
PROPHETX_MAX_EVENTS=2 python -m src.scrapers.wnba_prophetx
```

Expected: writes two JSON files under `data/props/prophetx/wnba/` with `league=wnba` and `tournament_id=1600000176`.

- [ ] **Step 6: Commit**

```bash
git add src/scrapers/wnba_prophetx.py src/scrapers/tests/scrapers/test_wnba_prophetx.py
git commit -m "feat(scrapers): add ProphetX WNBA snapshot scrape and write"
```

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| Dedicated `wnba_prophetx.py` | 1–6 |
| Tournament `1600000176` | 5–6 |
| Team ML / spread / total; key `spread` | 3, 6 |
| No first-half markets | 3 (ignore test), 6 (no period fetch) |
| Prop allowlist + combos | 4 |
| Main + alt props with `is_main` | 4 |
| Output under `data/props/prophetx/wnba/` | 1, 6 |
| Env knobs `PROPHETX_*` | 1, 5 (`MAX_EVENTS`) |
| Stub Supabase (no MLB table upsert) | 6 |
| Unit tests, no network in CI | 1–6 |
| Entry `python -m src.scrapers.wnba_prophetx` | 6 |

No placeholders remaining. Types/names consistent across tasks (`fetch_wnba_events`, `WNBA_TOURNAMENT_ID`, `spread` key, stub `load_supabase_snapshots`).
