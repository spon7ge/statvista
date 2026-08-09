# MLB Prop Picks Odds API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ParlayAPI + Supabase PrizePicks on MLB `/api/mlb/props/today` with The Odds API (`us` / `us_ex` / `us_dfs`), while keeping Underdog / ProphetX / Pinnacle scrapers and the new fair tiers (equal PX+Novig+Kalshi → DK+FD → Soft Consensus of BetMGM+BetOnline+Pinnacle).

**Architecture:** Add a thin Odds API client + MLB normalizer that returns DFS board seeds (PrizePicks) and book side indexes (Novig, Kalshi, DK, FD, BetMGM, BetOnline). Rewire `props.py` assemble to use those instead of Parlay/`fetch_latest_prizepicks`. Update `prop_fair.py` Tier 1 equal-avg and Soft Consensus book list. Shrink `MlbPropBooks` / OpenAPI / frontend expand labels to the new book set.

**Tech Stack:** FastAPI, httpx, Pydantic, pytest, React/TypeScript, existing `prop_fair` / `prop_stat_keys` patterns.

**Spec:** `docs/superpowers/specs/2026-08-09-mlb-prop-picks-odds-api-design.md`

## Global Constraints

- Product name: **statvista**
- Env key: `THE_ODDS_API_KEY` (already in `.env`; soft-fail if missing)
- Regions v1: `us`, `us_ex`, `us_dfs` only — **no `eu`**
- US books: `betonlineag`, `betmgm`, `draftkings`, `fanduel`
- US_EX: `novig`, `kalshi`
- DFS board: Odds API `us_dfs` / `prizepicks` only (stop reading `odds.mlb_prizepicks` for this endpoint)
- Keep scrapers: Underdog, ProphetX, Pinnacle
- Drop from response: caesars, bet365, fanatics, hardrock, fliff
- Add: `betonline` (Odds API key `betonlineag`)
- Exact line only; no closest-line fallback
- Do not commit `.env` or scraper cache JSON
- Follow `md/claude.md`; update `md/system-design.md` page ↔ API notes when wiring changes
- Prefer small commits; only commit when the user asks (or when executing this plan with explicit commit steps)

---

## File structure

| Path | Responsibility |
| --- | --- |
| `backend/app/core/config.py` | Load `THE_ODDS_API_KEY` |
| `backend/app/providers/odds_api/client.py` | HTTP GET to The Odds API |
| `backend/app/providers/odds_api/mlb_props.py` | Fetch + normalize MLB player props → board + side indexes |
| `backend/app/domains/mlb/prop_stat_keys.py` | `canonical_stat_key_from_odds_api_mlb` |
| `backend/app/domains/mlb/prop_fair.py` | Tier 1 equal avg; Soft Consensus books |
| `backend/app/domains/mlb/schemas_props.py` | `MlbPropBooks` fields |
| `backend/app/domains/mlb/props.py` | Assemble: Odds API instead of Parlay/PP snapshot |
| `backend/tests/test_odds_api_mlb_props.py` | Normalizer + client mapping tests |
| `backend/tests/test_mlb_prop_fair.py` | Updated Tier 1 / Soft Consensus |
| `backend/tests/test_mlb_props.py` | Assemble mocks without Parlay |
| `frontend/src/api/generated/schema.ts` | Regen from OpenAPI |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Expand book chips |
| `md/system-design.md` | Prop picks source note |

---

### Task 1: Config + Odds API HTTP client

**Files:**
- Modify: `backend/app/core/config.py`
- Create: `backend/app/providers/odds_api/__init__.py`
- Create: `backend/app/providers/odds_api/client.py`
- Test: `backend/tests/test_odds_api_client.py`

**Interfaces:**
- Produces: `THE_ODDS_API_KEY: str | None`; `async def odds_api_get(path: str, *, params: dict[str, Any] | None = None, timeout: float = 12.0) -> Any`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_odds_api_client.py
import pytest
from unittest.mock import AsyncMock, patch

from app.providers.odds_api.client import odds_api_get


@pytest.mark.asyncio
async def test_odds_api_get_requires_key(monkeypatch):
    monkeypatch.setattr("app.providers.odds_api.client.THE_ODDS_API_KEY", None)
    with pytest.raises(RuntimeError, match="THE_ODDS_API_KEY"):
        await odds_api_get("/v4/sports/baseball_mlb/odds")


@pytest.mark.asyncio
async def test_odds_api_get_passes_api_key_query(monkeypatch):
    monkeypatch.setattr("app.providers.odds_api.client.THE_ODDS_API_KEY", "test-key")
    mock_res = AsyncMock()
    mock_res.raise_for_status = lambda: None
    mock_res.json = lambda: [{"id": "evt1"}]
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.get = AsyncMock(return_value=mock_res)
    with patch("app.providers.odds_api.client.httpx.AsyncClient", return_value=mock_client):
        data = await odds_api_get(
            "/v4/sports/baseball_mlb/events/evt1/odds",
            params={"regions": "us", "markets": "batter_hits"},
        )
    assert data == [{"id": "evt1"}]
    args, kwargs = mock_client.get.call_args
    assert kwargs["params"]["apiKey"] == "test-key"
    assert "regions" in kwargs["params"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_odds_api_client.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement config + client**

Add to `backend/app/core/config.py` after Parlay block:

```python
# The Odds API — MLB prop picks board + books (optional; empty → soft-fail)
THE_ODDS_API_KEY: str | None = os.environ.get("THE_ODDS_API_KEY") or None
if THE_ODDS_API_KEY:
    THE_ODDS_API_KEY = THE_ODDS_API_KEY.strip().strip("'").strip('"') or None
```

Create `backend/app/providers/odds_api/__init__.py` (empty).

Create `backend/app/providers/odds_api/client.py`:

```python
"""Thin HTTP client for The Odds API (https://the-odds-api.com/)."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import THE_ODDS_API_KEY

ODDS_API_BASE_URL = "https://api.the-odds-api.com"
DEFAULT_TIMEOUT_SECONDS = 12.0


def require_odds_api_key() -> str:
    if not THE_ODDS_API_KEY:
        raise RuntimeError("THE_ODDS_API_KEY is not configured")
    return THE_ODDS_API_KEY


async def odds_api_get(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Any:
    """GET an Odds API path (e.g. ``/v4/sports/baseball_mlb/events``)."""
    api_key = require_odds_api_key()
    query = dict(params or {})
    query["apiKey"] = api_key
    headers = {"Accept": "application/json"}
    url = f"{ODDS_API_BASE_URL}{path}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.get(url, headers=headers, params=query)
        try:
            res.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = (exc.response.text or "")[:500]
            raise httpx.HTTPStatusError(
                f"{exc} body={body!r}",
                request=exc.request,
                response=exc.response,
            ) from None
        return res.json()
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python -m pytest tests/test_odds_api_client.py -v`

- [ ] **Step 5: Commit** (when user asks / plan execution allows)

```bash
git add backend/app/core/config.py backend/app/providers/odds_api/ backend/tests/test_odds_api_client.py
git commit -m "feat(mlb): add The Odds API HTTP client and config"
```

---

### Task 2: Odds API → canonical MLB stat keys

**Files:**
- Modify: `backend/app/domains/mlb/prop_stat_keys.py`
- Modify: `backend/tests/test_mlb_prop_stat_keys.py`

**Interfaces:**
- Produces: `canonical_stat_key_from_odds_api_mlb(market_key: str) -> str | None`

Odds API market keys (allowlist for v1) map as:

| Odds API `market` | Canonical |
| --- | --- |
| `batter_hits` | `hits` |
| `batter_home_runs` | `home_runs` |
| `batter_total_bases` | `total_bases` |
| `batter_rbis` | `rbis` |
| `batter_runs_scored` | `runs` |
| `batter_singles` | `singles` |
| `batter_doubles` | `doubles` |
| `batter_triples` | `triples` |
| `batter_walks` | `walks` |
| `batter_strikeouts` | `batter_strikeouts` |
| `batter_stolen_bases` | `stolen_bases` |
| `batter_hits_runs_rbis` | `hits_runs_rbis` |
| `pitcher_strikeouts` | `pitcher_strikeouts` |
| `pitcher_hits_allowed` | `hits_allowed` |
| `pitcher_walks` | `walks_allowed` |
| `pitcher_earned_runs` | `earned_runs_allowed` |
| `pitcher_outs` | `pitching_outs` |

- [ ] **Step 1: Write failing tests**

```python
from app.domains.mlb.prop_stat_keys import canonical_stat_key_from_odds_api_mlb

def test_odds_api_batter_hits():
    assert canonical_stat_key_from_odds_api_mlb("batter_hits") == "hits"

def test_odds_api_pitcher_strikeouts():
    assert canonical_stat_key_from_odds_api_mlb("pitcher_strikeouts") == "pitcher_strikeouts"

def test_odds_api_unknown_returns_none():
    assert canonical_stat_key_from_odds_api_mlb("h2h") is None
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `prop_stat_keys.py`, add `_ODDS_API_ALIASES` dict with the table above and:

```python
def canonical_stat_key_from_odds_api_mlb(market_key: str) -> str | None:
    return _ODDS_API_ALIASES.get(_norm(market_key))
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && python -m pytest tests/test_mlb_prop_stat_keys.py -v`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mlb): map Odds API market keys to canonical MLB stats"
```

---

### Task 3: Rewrite Tier 1 fair + Soft Consensus books

**Files:**
- Modify: `backend/app/domains/mlb/prop_fair.py`
- Modify: `backend/tests/test_mlb_prop_fair.py`

**Interfaces:**
- Consumes: `SideBooks` still `dict[str, float | None]`
- Produces: Tier 1 = equal average of present among `prophetx`, `novig`, `kalshi`; Soft Consensus books = `betmgm`, `betonline`, `pinnacle` only

- [ ] **Step 1: Update / add failing tests**

Replace consensus blend tests:

```python
def test_tier1_equal_avg_three_sources():
    r = compute_fair({
        "prophetx": 60.0, "novig": 54.0, "kalshi": 57.0,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "sharp_consensus"
    assert r.fair_pct == 57.0  # (60+54+57)/3
    assert "equal avg" in r.fair_explain.lower() or "equal" in r.fair_explain.lower()


def test_tier1_equal_avg_two_sources():
    r = compute_fair({
        "prophetx": 60.0, "novig": 50.0, "kalshi": None,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "sharp_consensus"
    assert r.fair_pct == 55.0


def test_tier1_single_prophetx():
    r = compute_fair({
        "prophetx": 54.0, "novig": None, "kalshi": None,
        "draftkings": 53.5, "fanduel": None,
    })
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 54.0
    assert "prophetx_only" in r.sample_chips


def test_tier1_single_kalshi():
    r = compute_fair({
        "prophetx": None, "novig": None, "kalshi": 52.0,
        "draftkings": None, "fanduel": None,
    })
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 52.0
    assert "kalshi_only" in r.sample_chips


def test_soft_consensus_betmgm_betonline_pinnacle():
    r = compute_fair({
        "prophetx": None, "novig": None, "kalshi": None,
        "draftkings": None, "fanduel": None,
        "betmgm": 50.0, "betonline": 52.0, "pinnacle": 54.0,
    })
    assert r.source_tier == "soft_consensus"
    assert r.fair_pct == 52.0


def test_soft_ignores_removed_books():
    r = compute_fair({
        "prophetx": None, "novig": None, "kalshi": None,
        "draftkings": None, "fanduel": None,
        "caesars": 99.0,  # must not count even if passed
    })
    assert r.source_tier == "no_sharp_read"
```

Remove or rewrite old `test_consensus_blend_60_40` / `test_disagreement_uses_prophetx` (disagreement path is gone).

Keep mid-tier DK/FD tests unchanged.

- [ ] **Step 2: Run — expect FAIL** on new Tier 1 behavior

- [ ] **Step 3: Implement `_tier1` and `SOFT_FAIR_BOOKS`**

In `prop_fair.py`:

```python
SOFT_FAIR_BOOKS: tuple[str, ...] = ("betmgm", "betonline", "pinnacle")
_TIER1_BOOKS: tuple[str, ...] = ("prophetx", "novig", "kalshi")


def _tier1(side_books: SideBooks) -> FairResult | None:
    present = [
        (book, side_books[book])
        for book in _TIER1_BOOKS
        if side_books.get(book) is not None
    ]
    if not present:
        return None
    if len(present) >= 2:
        fair = round(sum(v for _, v in present) / len(present), 1)
        names = "+".join(b for b, _ in present)
        return FairResult(
            fair_pct=fair,
            source_tier="sharp_consensus",
            confidence_chips=[],
            sample_chips=[],
            fair_explain=f"{names} equal avg ({len(present)} sources).",
        )
    book, fair = present[0]
    confidence: list[str] = []
    if _dk_fd_agrees_with(fair, side_books):
        confidence.append("dk_fd_agrees")
    return FairResult(
        fair_pct=fair,
        source_tier="sharp_single_source",
        confidence_chips=confidence,
        sample_chips=[f"{book}_only"],
        fair_explain=f"{book} only (single sharp source).",
    )
```

Delete `_agrees` usage from Tier 1 (keep `_agrees` if still used by Tier 2 / `dk_fd`).

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && python -m pytest tests/test_mlb_prop_fair.py -v`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mlb): equal-avg Tier 1 and Soft Consensus book set"
```

---

### Task 4: Normalize Odds API event odds → board + side indexes

**Files:**
- Create: `backend/app/providers/odds_api/mlb_props.py`
- Test: `backend/tests/test_odds_api_mlb_props.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class OddsApiMlbNormalized:
    prizepicks_board: list[dict[str, Any]]  # same shape props.py board builder expects
    book_indexes: dict[str, SideIndex]  # book_key -> SideKey -> quote dict
    as_of: str | None

async def fetch_mlb_props_normalized(*, timeout: float = 12.0) -> OddsApiMlbNormalized:
    ...
```

Internal book mapping (Odds API `bookmakers[].key` → our schema key):

```python
_BOOK_KEY_MAP = {
    "prizepicks": "prizepicks",  # DFS only — board, not books.*
    "novig": "novig",
    "kalshi": "kalshi",
    "draftkings": "draftkings",
    "fanduel": "fanduel",
    "betmgm": "betmgm",
    "betonlineag": "betonline",
}
_REGIONS = "us,us_ex,us_dfs"
_BOOKMAKERS = "prizepicks,novig,kalshi,draftkings,fanduel,betmgm,betonlineag"
# Comma-join allowlisted markets from Task 2
```

Quote dict shape (match existing Parlay indexing in `props.py`):

```python
{
    "american": int,
    "fair_pct": float,  # from american_to_fair_pct
    "changed_at": str | None,  # bookmaker last_update ISO
}
```

PrizePicks board row seed shape (compatible with `_index_prizepicks` / board builder — inspect current `props.py` and mirror fields: `player_name`, `stat`, `line`, `side` if present, `changed_at`, `american`/`payout_multiplier` if available).

Fetch strategy (quota-conscious):

1. `GET /v4/sports/baseball_mlb/events` → list event ids for today.
2. For each event (cap concurrent with `asyncio.Semaphore(3)`):  
   `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us,us_ex,us_dfs&bookmakers=...&markets=...&oddsFormat=american`
3. Parse `bookmakers[].markets[].outcomes[]` — outcomes have `name` (Over/Under), `description` (player), `point` (line), `price` (american).

Soft-fail: if key missing or any top-level fetch fails, return empty `OddsApiMlbNormalized` and let `props.py` set `error` (same pattern as Parlay today).

- [ ] **Step 1: Write failing unit tests with fixture JSON** (no live network)

```python
# Minimal fixture: one event, prizepicks + novig + betonlineag on batter_hits

def test_normalize_maps_betonlineag_to_betonline():
    raw_events_odds = [...fixture...]
    out = normalize_event_odds(raw_events_odds)
    assert "betonline" in out.book_indexes
    key = ("shohei ohtani", "hits", "over", 1.5)  # after norm
    assert out.book_indexes["betonline"][key]["american"] == -115


def test_normalize_builds_prizepicks_board_rows():
    ...
    assert any(r["player_name"] == "Shohei Ohtani" for r in out.prizepicks_board)


def test_skips_unknown_markets():
    ...
```

Export `normalize_event_odds` for pure testing; `fetch_mlb_props_normalized` calls client then normalize.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `mlb_props.py`**

Use `american_to_fair_pct` from `prop_fair`, `canonical_stat_key_from_odds_api_mlb`, `norm_player_name` / same `_norm_player` convention as `props.py` (`strip().casefold()` for keys; keep display name from description).

Player key for SideKey: `(norm_player, stat, side, line)` with `side in {"over","under"}` and `line = round(point, 2)`.

- [ ] **Step 4: Run — PASS**

Run: `cd backend && python -m pytest tests/test_odds_api_mlb_props.py -v`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mlb): normalize Odds API MLB props into board and book indexes"
```

---

### Task 5: Schema — add `betonline`, drop removed books

**Files:**
- Modify: `backend/app/domains/mlb/schemas_props.py`
- Modify: any OpenAPI export script the repo uses (check `backend/README.md` / Makefile)

**Interfaces:**
- Produces: `MlbPropBooks` with: `prophetx`, `novig`, `kalshi`, `draftkings`, `fanduel`, `pinnacle`, `betmgm`, `betonline` only

- [ ] **Step 1: Change schema**

```python
class MlbPropBooks(BaseModel):
    model_config = _RESPONSE_CONFIG

    prophetx: MlbPropBookQuote | None = None
    novig: MlbPropBookQuote | None = None
    kalshi: MlbPropBookQuote | None = None
    draftkings: MlbPropBookQuote | None = None
    fanduel: MlbPropBookQuote | None = None
    pinnacle: MlbPropBookQuote | None = None
    betmgm: MlbPropBookQuote | None = None
    betonline: MlbPropBookQuote | None = None
```

- [ ] **Step 2: Regenerate OpenAPI / `frontend/src/api/generated/schema.ts`**

Follow existing project command (search README for `openapi` / `generate`). If manual, update TypeScript `MlbPropBooks` fields to match.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mlb): shrink MlbPropBooks to Odds API + scraper set"
```

---

### Task 6: Rewire `props.py` assemble

**Files:**
- Modify: `backend/app/domains/mlb/props.py`
- Modify: `backend/tests/test_mlb_props.py`

**Interfaces:**
- Consumes: `fetch_mlb_props_normalized`, scraper fetches for UD/PX/Pinnacle
- Stops using: `parlay_get`, `fetch_latest_prizepicks` for this path
- Produces: same `MlbPropsResponse`

- [ ] **Step 1: Update tests** to mock `fetch_mlb_props_normalized` instead of Parlay; assert `betonline` quote appears; assert caesars absent from schema dump.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement assemble changes**

Docstring pipeline update:

1. Load DFS board from Odds API PrizePicks (app=prizepicks) **or** Underdog snapshot (app=underdog).
2. Index ProphetX + Pinnacle scrapers; merge Odds API book indexes (novig, kalshi, dk, fd, betmgm, betonline).
3. `compute_fair` / edge / sort unchanged API.

Remove `_PARLAY_*` constants. Build `MlbPropBooks` only with remaining fields. Soft books for expand: `betmgm`, `betonline`, `pinnacle` with `role="comparison"` when not driving fair (same pattern as today).

Pass `kalshi` into `side_books` for `compute_fair` (was comparison-only before).

Error string when Odds API unavailable: e.g. `"odds_api_unavailable"` or reuse existing soft error field.

- [ ] **Step 4: Run full related suite**

```bash
cd backend && python -m pytest tests/test_mlb_props.py tests/test_mlb_prop_fair.py tests/test_odds_api_mlb_props.py tests/test_odds_api_client.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mlb): serve prop picks from Odds API instead of Parlay"
```

---

### Task 7: Frontend expand labels

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.tsx`
- Modify: `frontend/src/api/generated/schema.ts` (if not done in Task 5)

- [ ] **Step 1: Update `BOOK_LABELS` and expand row chips**

Keep: ProphetX, Novig, Kalshi, DraftKings, FanDuel, Pinnacle, BetMGM  
Add: BetOnline  
Remove: Caesars, bet365, Fanatics, Hard Rock, Fliff  

Order suggestion (fair-relevant first): PX, Novig, Kalshi, DK, FD, BetMGM, BetOnline, Pinnacle.

- [ ] **Step 2: Typecheck / lint if available**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mlb): update prop picks book expand for Odds API set"
```

---

### Task 8: Docs

**Files:**
- Modify: `md/system-design.md` (MLB prop picks / `/api/mlb/props/today` row)
- Spec already approved: `docs/superpowers/specs/2026-08-09-mlb-prop-picks-odds-api-design.md`

- [ ] **Step 1: Note** that MLB prop picks board+books come from The Odds API (`us`/`us_ex`/`us_dfs`); scrapers remain for UD/PX/Pinnacle; Parlay not used on this path.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: MLB prop picks Odds API wiring in system-design"
```

---

### Task 9: Manual smoke (local)

- [ ] Ensure `THE_ODDS_API_KEY` set in `.env` (do not commit).
- [ ] Start backend; open `/mlb/prop_picks`.
- [ ] PrizePicks app: rows load; expand shows new books; no Caesars/etc.
- [ ] Underdog app: still scraper board + Odds books overlay.
- [ ] Spot-check remaining quota on Odds API dashboard after one page load.

---

## Self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| Odds API client + key | 1 |
| Regions us/us_ex/us_dfs; book set | 4 |
| PrizePicks from Odds API DFS | 4, 6 |
| Keep UD/PX/Pinnacle scrapers | 6 |
| Drop Parlay on this path | 6 |
| Tier 1 equal PX+Novig+Kalshi | 3 |
| Tier 2 DK+FD unchanged | 3 |
| Soft BetMGM+BetOnline+Pinnacle | 3 |
| Schema + FE books | 5, 7 |
| Soft-fail missing key | 4, 6 |
| system-design note | 8 |
| No eu / no persist Odds to DB | out of scope (not in tasks) |

**Placeholder scan:** none intentional.  
**Type consistency:** `betonline` schema key ↔ Odds `betonlineag` mapped in Task 4.  
**Kalshi** is Tier 1 fair input and still appears in `books.kalshi` expand.
