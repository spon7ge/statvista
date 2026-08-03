# MLB Pinnacle Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/scrapers/mlb_pinnacle.py` that scrapes Pinnacle MLB (props + team markets) via Selenium and writes two JSON files under `data/props/pinnacle/mlb/`.

**Architecture:** Clone `wnba_pinnacle.py` into a dedicated MLB module. Change sport path to `baseball`, league to `mlb`, Arcadia id `246`, baseball `PLAYER_PROP_UNITS`, and `sport: "baseball"` in payloads. Omit Supabase upsert (out of scope). Add focused unit tests for URL helpers and prop-unit mapping.

**Tech Stack:** Python 3, Selenium, Chrome DevTools Arcadia capture, pytest

## Global Constraints

- League is `mlb` only (no NBA/WNBA in this file)
- Sport URL segment is `baseball` (not `basketball`)
- Arcadia league id for MLB is `246` (confirmed via `/sports/3/leagues`)
- Output: `pinnacle_mlb_{ts}_props.json` + `pinnacle_mlb_{ts}_team.json`
- Broad `PLAYER_PROP_UNITS`; unknown units skipped
- No Supabase / DB / frontend changes
- Do not modify `wnba_pinnacle.py`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scrapers/mlb_pinnacle.py` | Full MLB Selenium scraper (clone + MLB deltas) |
| `src/scrapers/tests/scrapers/test_mlb_pinnacle.py` | Unit tests: filenames, URL canonicalize, prop units, payload split |

---

### Task 1: Unit tests for MLB helpers (TDD)

**Files:**
- Create: `src/scrapers/tests/scrapers/test_mlb_pinnacle.py`
- Create (minimal stub only if needed to import): none yet — tests will fail until Task 2

**Interfaces:**
- Consumes: nothing yet
- Produces: failing tests that expect module `mlb_pinnacle` with helpers below

- [ ] **Step 1: Write the failing test file**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_pinnacle.py -v`

Expected: FAIL (module / file not found or import error)

- [ ] **Step 3: Commit tests**

```bash
git add src/scrapers/tests/scrapers/test_mlb_pinnacle.py
git commit -m "test: add failing MLB Pinnacle scraper helper tests"
```

---

### Task 2: Create `mlb_pinnacle.py` from WNBA clone

**Files:**
- Create: `src/scrapers/mlb_pinnacle.py` (copy of `src/scrapers/wnba_pinnacle.py` with deltas below)
- Test: `src/scrapers/tests/scrapers/test_mlb_pinnacle.py`

**Interfaces:**
- Consumes: same Selenium/env patterns as WNBA scraper
- Produces: `PinnacleScraper("mlb")`, `run_all()`, dual JSON writers; no Supabase calls

- [ ] **Step 1: Copy WNBA scraper to MLB path**

```bash
cp src/scrapers/wnba_pinnacle.py src/scrapers/mlb_pinnacle.py
```

- [ ] **Step 2: Apply MLB-specific edits**

Replace module docstring to describe MLB / baseball only (drop NBA/WNBA / `PINNACLE_LEAGUES` multi-league wording).

Replace league constants:

```python
LEAGUE_MATCHUPS_URL: dict[str, str] = {
    "mlb": "https://www.pinnacle.com/en/baseball/mlb/matchups/#all",
}
LEAGUE_ARCADIA_IDS: dict[str, int] = {
    "mlb": 246,
}
SUPPORTED_LEAGUES = tuple(LEAGUE_MATCHUPS_URL.keys())

PLAYER_PROP_UNITS = {
    "Hits": "hits",
    "Home Runs": "home_runs",
    "Total Bases": "total_bases",
    "RBIs": "rbis",
    "Runs Batted In": "rbis",
    "Runs": "runs",
    "Stolen Bases": "stolen_bases",
    "Strikeouts": "strikeouts",
    "Hits Allowed": "hits_allowed",
    "Walks": "walks",
    "Earned Runs": "earned_runs",
    "Outs Recorded": "outs_recorded",
    "Pitcher Outs": "pitcher_outs",
}
```

Replace `_GAME_PATH_RE`:

```python
_GAME_PATH_RE = re.compile(
    r"/en/baseball/(?P<league>mlb)/(?P<slug>[\w.-]+)/(?P<mid>\d+)/?",
    re.IGNORECASE,
)
```

In `_normalize_game_url` and `game_urls_from_league_matchups` / `collect_game_urls`:
- Require `"baseball/"` in hrefs (not `"basketball/"`)
- Build canonical URLs as `f"/en/baseball/{league}/{slug}/{mid}/#all"`

In `PinnacleScraper` docstring: MLB only.

In `run()` payload_base:
- `"sport": "baseball"`
- Keep `"league": self.league`

**Remove** the entire Supabase upsert block in `run()` (the `try: from src.odds.load_snapshots import ...` through the warning). Keep JSON writes. `run()` should return `(props_payload, True)` always (or `(props_payload, True)` with no db flag meaning — keep signature `tuple[dict, bool]` and always `True` for db_ok since DB is out of scope).

Simplify entrypoint:

```python
def _requested_leagues() -> list[str]:
    return ["mlb"]


def run_all() -> tuple[dict[str, dict[str, Any]], bool]:
    print("=== Starting Pinnacle MLB scraper (Selenium)... ===")
    try:
        payload, db_ok = PinnacleScraper("mlb").run()
        return {"mlb": payload}, db_ok
    except Exception as e:
        print(f"✗ [mlb] Error: {e}")
        import traceback
        traceback.print_exc()
        return {}, False


if __name__ == "__main__":
    _, db_ok = run_all()
    if not db_ok:
        sys.exit(1)
```

(Optional: still honor `PINNACLE_LEAGUES` if set to only `mlb`, and error on anything else — preferred for parity.)

```python
def _requested_leagues() -> list[str]:
    raw = os.environ.get("PINNACLE_LEAGUES", "mlb")
    leagues = [x.strip().lower() for x in raw.split(",") if x.strip()]
    unknown = [x for x in leagues if x not in SUPPORTED_LEAGUES]
    if unknown:
        raise ValueError(
            f"Unknown league(s) in PINNACLE_LEAGUES: {unknown}; "
            f"choose from {SUPPORTED_LEAGUES}",
        )
    seen: set[str] = set()
    ordered: list[str] = []
    for lg in leagues:
        if lg not in seen:
            seen.add(lg)
            ordered.append(lg)
    return ordered or ["mlb"]
```

- [ ] **Step 3: Run unit tests**

Run: `pytest src/scrapers/tests/scrapers/test_mlb_pinnacle.py -v`

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/scrapers/mlb_pinnacle.py src/scrapers/tests/scrapers/test_mlb_pinnacle.py
git commit -m "feat: add MLB Pinnacle Selenium scraper with props/team JSON split"
```

---

### Task 3: Smoke-check module import (no live Chrome required)

**Files:**
- Verify only: `src/scrapers/mlb_pinnacle.py`

**Interfaces:**
- Consumes: Task 2 module
- Produces: confirmation constructors work

- [ ] **Step 1: Construct scraper without browser**

Run:

```bash
PYTHONPATH=. python -c "
from src.scrapers.mlb_pinnacle import PinnacleScraper, LEAGUE_ARCADIA_IDS
s = PinnacleScraper('mlb')
assert s.league == 'mlb'
assert LEAGUE_ARCADIA_IDS['mlb'] == 246
assert 'baseball' in s.matchups_url
assert s.output_path.endswith('_props.json')
print('ok', s.output_path)
"
```

Expected: prints `ok` and a path under `data/props/pinnacle/mlb/`

- [ ] **Step 2: Commit only if smoke edits were needed; otherwise skip**

No commit if unchanged.

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| `mlb_pinnacle.py` clone | Task 2 |
| `/en/baseball/mlb/...` URLs | Task 1 tests + Task 2 |
| Arcadia id 246 | Task 1 + Task 2 |
| Broad prop units, skip unknown | Task 1 + Task 2 |
| Team ML/spread/total | inherited from clone (same methods) |
| Dual JSON output | Task 1 payload split + Task 2 writers |
| Same `PINNACLE_*` env | inherited |
| No Supabase | Task 2 remove upsert |
| No WNBA file changes | Global constraint |

## Placeholder scan

None remaining. League id fixed to 246.
