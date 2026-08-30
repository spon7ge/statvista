# MLB Legs Pricer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `GET /api/mlb/legs` and `/mlb/legs` as a PLAY-only exact-line DFS shortlist (PrizePicks / Underdog) with a new pricer; leave Props and `prop_fair` unchanged; keep `/wnba/legs` as an empty shell.

**Architecture:** Pure `legs_payouts` + `legs_pricer` (no I/O) compute break-even and consensus. `get_mlb_legs()` seeds DFS snapshots, attaches exact-line two-ways (PX/Novig/Pinnacle alts + Parlay DK/FD/MGM/Caesars), drops stale/high-hold quotes, filters locked games, then runs the pricer. React `LeagueLegsPage` fetches only on MLB.

**Tech Stack:** FastAPI, Pydantic, pytest; React 19, TanStack Query, Vitest; existing Supabase snapshots.

**Spec:** `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md`

## Global Constraints

- Product name: **statvista**. Research copy only (no locks / guaranteed EV).
- Do **not** change `prop_fair`, `GET /api/mlb/props/today`, `GET /api/mlb/props/board`, or game-detail Props.
- Do **not** add WNBA `/api/wnba/legs`. `/wnba/legs` must not call the MLB API.
- Never invent book quotes. Never `implied = 1 / payout_multiplier`.
- Never import `mlb.prop_formats` for Legs break-evens.
- Do not use `collect_board_quotes()` (`mains_only=True`).
- Fliff / Kalshi / bet365 are not loaded for Legs.
- Tests with code (TDD). OpenAPI in sync (`REQUIRED_MLB_PATHS` + `export_openapi` + `npm run generate:api`).
- Follow `md/skills.md` (project operating contract). Stack in that guide is TypeScript examples; this repo’s Legs work is **Python FastAPI + React** — match existing backend/frontend tooling (pytest, Pydantic, Vitest), not Zod/`src/shared/result.ts`.
- **§17 Must that apply:** no secrets in logs; validate `app`/`format`/`legs` on the server (422); parameterized snapshot SQL only (no concatenated queries); errors not swallowed (soft-fail with `warnings[]`, never invent books); unit tests for pricer + route tests; UI keyboard/labels/focus for Legs controls.
- **§17 Must that do not apply:** per-handler user authorization — Legs is a **public read** like `/api/mlb/props/board` (no caller identity). e2e Playwright — not in this repo’s Legs path; Vitest + pytest match existing site tests. README/`.env.example` — no new env vars.
- **§07:** mock snapshot/Parlay **I/O** in assembler tests (third-party); do not mock a fake schema for `odds_*` tables. Pricer tests are pure (no network).
- **§09:** use real `assert` / raise, not `console.assert`.
- **§04 “no hardcoded values” vs spec:** assumed payouts, ages, and book weights are **product constants** in `legs_payouts` / `legs_pricer`, labeled `payouts_assumed` — not env config.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/betting/legs_payouts.py` | Query validation, `base_p_be`, clamp `p_be`, Flex-3 EV (tests only), margin bases |
| `backend/app/domains/betting/legs_pricer.py` | Devig, coverage, log-odds consensus, favorite gate, PLAY vs one reject reason |
| `backend/tests/test_legs_payouts.py` | Payout tables + clamp + Flex-3 EV |
| `backend/tests/test_legs_pricer.py` | Hold, power solver, coverage, disagreement, identity helpers |
| `backend/app/core/odds_snapshots.py` | Add `stake` to PX/Novig latest-snapshot SELECT |
| `backend/tests/test_odds_snapshots_legs_stake.py` | Stake column in fetch SQL |
| `backend/app/domains/mlb/schemas_legs.py` | Request-facing Pydantic models |
| `backend/app/domains/mlb/legs.py` | `get_mlb_legs()` assembler + 5-min cache |
| `backend/app/domains/mlb/schemas.py` | Re-export legs schemas |
| `backend/app/domains/mlb/routes.py` | `GET /mlb/legs` |
| `backend/app/openapi_export.py` | `/api/mlb/legs` |
| `backend/tests/test_mlb_legs.py` | Assemble + route |
| `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts` | Regenerated |
| `frontend/src/shared/lib/api.ts` | `fetchMlbLegs` |
| `frontend/src/features/mlb/hooks/useMlbLegs.ts` | Query, `staleTime` 5 min |
| `frontend/src/features/mlb/league/MlbLegsBoard.tsx` | Tabs, format/legs, list, empty states |
| `frontend/src/pages/LeagueLegsPage.tsx` | MLB board vs WNBA shell |
| `frontend/src/pages/LeagueLegsPage.test.tsx` | MLB fetch / WNBA no-fetch |
| `md/system-design.md` | Page ↔ API row |

---

### Task 1: Payout tables (pure)

**Files:**
- Create: `backend/app/domains/betting/legs_payouts.py`
- Create: `backend/tests/test_legs_payouts.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `validate_legs_query(app: str, format: str, legs: int) -> None` raises `ValueError`
  - `base_break_even(app: str, format: str, legs: int) -> float`
  - `base_required_margin_pts(app: str, format: str, legs: int) -> float` → `4.0` Power/UD, `3.0` Flex 6
  - `leg_break_even(base_p_be: float, payout_multiplier: float | None) -> float` → `base / min(m, 1.0)` with missing `m` treated as `1.0`; raises `ValueError` if `m <= 0`
  - `flex3_ev(p: float) -> float` → `2.25 * p**3 + 1.25 * 3 * p**2 * (1 - p)` (not used by the API)

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_legs_payouts.py
import pytest
from app.domains.betting.legs_payouts import (
    base_break_even,
    base_required_margin_pts,
    flex3_ev,
    leg_break_even,
    validate_legs_query,
)

def test_pp_power_peak_is_n3():
    be = {n: base_break_even("prizepicks", "power", n) for n in range(2, 7)}
    assert be[3] == max(be.values())
    assert abs(be[2] - 3 ** (-1 / 2)) < 1e-12
    assert abs(be[6] - 37.5 ** (-1 / 6)) < 1e-12

def test_ud_peak_n2_and_4_harder_than_3():
    be = {n: base_break_even("underdog", "standard", n) for n in range(2, 7)}
    assert be[2] == max(be.values())
    assert be[4] > be[3]
    assert abs(be[6] - 40 ** (-1 / 6)) < 1e-12

def test_flex6_constant():
    assert base_break_even("prizepicks", "flex", 6) == pytest.approx(0.542)

def test_flex3_ev_at_056_is_loss():
    assert flex3_ev(0.560) == pytest.approx(0.913, abs=0.002)

def test_validate_rejects_flex3_and_boosted():
    with pytest.raises(ValueError):
        validate_legs_query("prizepicks", "flex", 3)
    with pytest.raises(ValueError):
        validate_legs_query("underdog", "boosted", 4)
    validate_legs_query("prizepicks", "power", 4)
    validate_legs_query("prizepicks", "flex", 6)
    validate_legs_query("underdog", "standard", 4)

def test_clamp_boost_keeps_base_discount_raises():
    base = 10 ** (-1 / 4)
    assert leg_break_even(base, 1.15) == pytest.approx(base)
    assert leg_break_even(base, 0.90) == pytest.approx(base / 0.90)
    assert abs(leg_break_even(base, 0.90) - (10 * 0.9**4) ** (-1 / 4)) < 1e-4
    assert leg_break_even(base, None) == pytest.approx(base)

def test_margin_bases():
    assert base_required_margin_pts("prizepicks", "power", 4) == 4.0
    assert base_required_margin_pts("prizepicks", "flex", 6) == 3.0
    assert base_required_margin_pts("underdog", "standard", 5) == 4.0
```

- [ ] **Step 2: Run tests — expect FAIL** (import error)

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_legs_payouts.py -v`

- [ ] **Step 3: Implement `legs_payouts.py`**

```python
# backend/app/domains/betting/legs_payouts.py
from __future__ import annotations

PP_POWER_M = {2: 3.0, 3: 5.0, 4: 10.0, 5: 20.0, 6: 37.5}
UD_STANDARD_M = {2: 3.0, 3: 6.0, 4: 10.0, 5: 20.0, 6: 40.0}
FLEX6_BE = 0.542


def validate_legs_query(app: str, format: str, legs: int) -> None:
    if app == "prizepicks":
        if format == "power" and legs in PP_POWER_M:
            return
        if format == "flex" and legs == 6:
            return
    if app == "underdog" and format == "standard" and legs in UD_STANDARD_M:
        return
    raise ValueError(f"unsupported legs query {app!r}/{format!r}/{legs}")


def base_break_even(app: str, format: str, legs: int) -> float:
    validate_legs_query(app, format, legs)
    if app == "prizepicks" and format == "flex":
        return FLEX6_BE
    table = PP_POWER_M if app == "prizepicks" else UD_STANDARD_M
    m = table[legs]
    return float(m ** (-1.0 / legs))


def base_required_margin_pts(app: str, format: str, legs: int) -> float:
    validate_legs_query(app, format, legs)
    if app == "prizepicks" and format == "flex":
        return 3.0
    return 4.0


def leg_break_even(base_p_be: float, payout_multiplier: float | None) -> float:
    m = 1.0 if payout_multiplier is None else float(payout_multiplier)
    if m <= 0:
        raise ValueError("payout_multiplier must be > 0")
    return base_p_be / min(m, 1.0)


def flex3_ev(p: float) -> float:
    return 2.25 * p**3 + 1.25 * 3 * p**2 * (1.0 - p)
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_legs_payouts.py -v`

- [ ] **Step 5: Commit** (skip unless user asked)

```bash
git add backend/app/domains/betting/legs_payouts.py backend/tests/test_legs_payouts.py
git commit -m "feat(legs): assumed payout tables and modifier clamp"
```

---

### Task 2: Pricer (pure)

**Files:**
- Create: `backend/app/domains/betting/legs_pricer.py`
- Create: `backend/tests/test_legs_pricer.py`

**Interfaces:**
- Consumes: `base_break_even`, `base_required_margin_pts`, `leg_break_even` from Task 1
- Produces:
  - `BookQuote(book: str, line: float, over: int, under: int, stake_over: float | None, stake_under: float | None, age_minutes: float)`
  - `price_line(*, quotes: list[BookQuote], dfs_line: float, app: str, format: str, legs: int, payout_multiplier: float | None) -> PlayResult | RejectResult`
  - `PlayResult.side`, `fair_prob`, `break_even`, `required_margin_pts`, `margin_pts`, `book_disagreement_pts`, `sharp_anchor` (`pinnacle` | `exchange_only`), `books_used`, `books_excluded`, `payout_multiplier`
  - `RejectResult.reason`: `insufficient_coverage` | `insufficient_sharp` | `below_threshold` | `unpriceable_payout`
  - Weights: pinnacle 3.0, novig/prophetx 2.5, draftkings/fanduel 2.0, betmgm/caesars 1.0
  - Sharp/exchange max age 45; supporting 120; hold > 0.12 exclude; exchanges need stake both sides > 0
  - Coverage: (1) pinnacle **or** sized exchange included (2) ≥2 additional (3) total ≥3 (4) ≥2 books with weight ≥ 2.0
  - Log-odds consensus of **over** probs at `dfs_line` only; `p_under = 1 - p_over`; gate `p > 0.5`
  - Disagreement: max−min among included weight ≥ 2.0; if > 4.0 add 1.5 to effective margin
  - `ε = 1e-6`; multiplicative if hold ≤ 0.05; else power bisection `k ∈ [1,10]`, tol `1e-9`; unsolved → exclude book
  - Internal asserts: gated fair ≥ 0.35; every PLAY has ≥2 weight≥2.0 books

Do **not** call `prop_fair.american_to_fair_pct` for hold (it rounds). Use unrounded American → probability.

- [ ] **Step 1: Write failing tests** in `backend/tests/test_legs_pricer.py`

Cover: hold 0.04 vs 0.06 (not 0.05); power unsolved fallback; Pinnacle+MGM+Caesars → `insufficient_coverage`; Pinnacle+DK+MGM can PLAY when the over is a real favorite; exchange stake 0 excluded; sharp age 50 min excluded, DK age 50 min included; disagreement ignores Caesars; `m=1.15` does not lower `break_even` vs `m=1`; `m=0.90` raises BE; never treat `1/m` as implied; `p_over == 0.5` → `below_threshold`; tiny `m` → `unpriceable_payout`.

Helper:

```python
from app.domains.betting.legs_pricer import BookQuote, price_line

def _q(book, over, under, *, age=10.0, so=100.0, su=100.0, line=6.5):
    return BookQuote(
        book=book, line=line, over=over, under=under,
        stake_over=so, stake_under=su, age_minutes=age,
    )
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_legs_pricer.py -v`

- [ ] **Step 3: Implement `legs_pricer.py`** (complete module, not a stub)

```python
import math
from dataclasses import dataclass
from typing import Literal, Union

from app.domains.betting.legs_payouts import (
    base_break_even,
    base_required_margin_pts,
    leg_break_even,
)

EPS = 1e-6
WEIGHTS = {
    "pinnacle": 3.0, "novig": 2.5, "prophetx": 2.5,
    "draftkings": 2.0, "fanduel": 2.0, "betmgm": 1.0, "caesars": 1.0,
}
SHARP = frozenset({"pinnacle", "novig", "prophetx"})
SHARP_MAX_AGE = 45.0
SUPPORT_MAX_AGE = 120.0
HOLD_MAX = 0.12


def american_to_prob(american: int) -> float:
    if american > 0:
        p = 100.0 / (american + 100.0)
    else:
        a = abs(american)
        p = a / (a + 100.0)
    return min(1.0 - EPS, max(EPS, p))


def power_k(p_over: float, p_under: float) -> float | None:
    def f(k: float) -> float:
        return p_over**k + p_under**k - 1.0
    if f(1.0) < 0 or f(10.0) > 0:
        return None
    lo, hi = 1.0, 10.0
    for _ in range(80):
        mid = (lo + hi) / 2.0
        if f(mid) > 0:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-9:
            return (lo + hi) / 2.0
    return (lo + hi) / 2.0
```

Then filter quotes (exact `dfs_line`, two-way, age by book class, hold, exchange stake); multiplicative or power → over-prob; coverage; logit mean; pick side; `p_be = leg_break_even(...)`; if `p_be >= 1` → `unpriceable_payout`; else margin vs effective required; `sharp_anchor = "pinnacle"` if pinnacle used else `"exchange_only"`.

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && PYTHONPATH=..:. python -m pytest tests/test_legs_payouts.py tests/test_legs_pricer.py -v`

- [ ] **Step 5: Commit** (skip unless asked)

```bash
git add backend/app/domains/betting/legs_pricer.py backend/tests/test_legs_pricer.py
git commit -m "feat(legs): exact-line consensus pricer with coverage gates"
```

---

### Task 3: Snapshot `stake` on ProphetX / Novig

**Files:**
- Modify: `backend/app/core/odds_snapshots.py` (`_fetch_player_prop_snapshot`)
- Create: `backend/tests/test_odds_snapshots_legs_stake.py` (or extend `tests/test_odds_snapshots.py`)

**Interfaces:**
- Consumes: existing `_fetch_player_prop_snapshot`
- Produces: happy-path SELECT includes `stake`. DISTINCT ON / identity **unchanged**. If `stake` is undefined, retry without it (same idea as `is_main` fallback). Callers treat missing stake as `None` → exchanges exclude.

- [ ] **Step 1: Failing test** that the happy-path column list includes `stake`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Set**

```python
base_cols = (
    "player_name, stat_name, line_score, side, american_price, stake, scraped_at"
)
```

Catch undefined `stake` and retry without that column. Do not change Pinnacle’s separate fetcher unless it shares this helper.

- [ ] **Step 4: Run** `tests/test_odds_snapshots.py` plus the new test — expect PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 4: Schemas + route + OpenAPI stub

**Files:**
- Create: `backend/app/domains/mlb/schemas_legs.py`
- Create: `backend/app/domains/mlb/legs.py` (stub)
- Modify: `backend/app/domains/mlb/schemas.py` (re-export)
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/app/openapi_export.py` — add `"/api/mlb/legs"` to `REQUIRED_MLB_PATHS`
- Create: `backend/tests/test_mlb_legs.py`
- Regen: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Consumes: `validate_legs_query`
- Produces: `GET /api/mlb/legs?app=&format=&legs=` → `MlbLegsResponse`

Models (json_schema_serialization_defaults_required like other MLB schemas):

- `MlbLegsRejectedSummary`: four int keys, all present
- `MlbLegsBookUsed`: `book`, `line`, `over`, `under`, `hold`, `devig` (`multiplicative` | `power`), `weight`, `devigged_prob`
- `MlbLegsBookExcluded`: `book`, `reason`
- `MlbLegsPlay`: `rank`, `player`, `team`, `matchup`, `market`, `dfs_line`, `side`, `variant` (`standard`), `game_id` (`str | None`), `sharp_anchor`, `fair_prob`, `break_even`, `required_margin_pts`, `margin_pts`, `book_disagreement_pts`, `payout_multiplier`, `books_used`, `books_excluded`
- `MlbLegsResponse`: `generated_at`, `slate`, `app`, `format`, `legs`, `payouts_assumed=True`, `base_break_even`, `break_even_min`, `break_even_max`, `base_required_margin_pts`, `dfs_snapshot_age_minutes`, `lines_seeded`, `legs_evaluated`, `legs_surfaced`, `coverage_funnel_ratio`, `flex_same_game_warning`, `legs`, `rejected_summary`, `warnings`, `disclaimers`

Route: `Cache-Control: no-store`. `ValueError` → **422**.

Stub after validate: empty `legs`, zero counts, `flex_same_game_warning=False`, `coverage_funnel_ratio=None`, spec disclaimers.

- [ ] **Step 1: Failing tests** — `flex&legs=3` → 422; `underdog&boosted` → 422; `prizepicks&power&4` → 200, `payouts_assumed is True`, `legs == []`

Use FastAPI `TestClient` like `tests/test_mlb_props.py`.

- [ ] **Step 2: Run — expect FAIL** (no route)

- [ ] **Step 3: Implement schemas, stub, route, OpenAPI**

```bash
cd backend && PYTHONPATH=..:. python -c "from app.openapi_export import export_openapi; export_openapi()"
# update backend/openapi-golden.json the same way other MLB route tasks do
cd ../frontend && npm run generate:api
```

- [ ] **Step 4: Route tests PASS; OpenAPI lists `/api/mlb/legs`**

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 5: Assembler

**Files:**
- Modify: `backend/app/domains/mlb/legs.py`
- Modify: `backend/tests/test_mlb_legs.py`

**Interfaces:**
- Consumes: `fetch_latest_prizepicks("mlb")`, `fetch_latest_underdog("mlb")`, `fetch_latest_prophetx("mlb")`, `fetch_latest_novig("mlb")`, `fetch_latest_pinnacle("mlb")`, `fetch_latest_parlay_api_odds("mlb")`, `get_today_scoreboard()`, `match_player_key`, `canonical_stat_key_from_pp_mlb` / `_ud_mlb` / `_sharp_mlb`, `index_parlay_api_odds_by_book`, `price_line`, Task 1 payouts
- Produces: `async def get_mlb_legs(*, app: str, format: str, legs: int) -> MlbLegsResponse`
- Cache: in-process `(app, format, legs)` TTL **300** seconds

**Do not** call `prop_fair.compute_fair`. **Do not** load Fliff/Kalshi/bet365. **Do not** use `collect_board_quotes()`.

Algorithm:

1. Validate query.
2. Seed PP or UD. PP: `odds_type` standard only. `lines_seeded` = unique `(player_key, stat, line)`.
3. `dfs_snapshot_age_minutes` from latest seed `scraped_at`. If **> 60**: empty PLAY, warning `dfs_snapshot_stale`, `legs_evaluated=0`, keep `lines_seeded`.
4. Empty seed → `prizepicks_unavailable` / `underdog_unavailable`, `lines_seeded=0`.
5. Two-way exact-line maps: PX, Novig, Pinnacle (`mains_only=False`); Parlay DK/FD/MGM/Caesars only. Pair over+under; pass stakes; `age_minutes` from `scraped_at`.
6. Drop live/final games via `get_today_scoreboard()`. Set `game_id` to `gamePk` when matched; missing id is fine.
7. `price_line` per remaining line. Tally reject reasons. Collect PLAY.
8. Sort: `margin_pts` desc, `fair_prob` desc, `player` asc. Assign `rank`.
9. `break_even_min` / `max` from PLAY or null.
10. `coverage_funnel_ratio` if evaluated > 0; warning `coverage_funnel_collapsed` if evaluated ≥ 20 and ratio ≥ 0.95.
11. `flex_same_game_warning` if `format=="flex"` and top `min(6, n)` PLAY share a non-null `game_id` ≥ 3 times.
12. Assert identity and `legs_surfaced == len(legs)`.
13. Empty Parlay → `parlay_unavailable`.
14. `slate` = `"MLB YYYY-MM-DD"`.

Add `_two_way_at_line(...)` in `legs.py` on top of existing `SideIndex` keys.

- [ ] **Step 1: Failing tests** with mocks: stale DFS keeps `lines_seeded`; live game dropped; demon dropped; identity on mixed fixture; flex same-game warning.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement assembler**

- [ ] **Step 4: Run** `tests/test_mlb_legs.py tests/test_legs_pricer.py tests/test_mlb_props.py -q` — props still pass

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 6: Frontend MLB Legs board

**Files:**
- Modify: `frontend/src/shared/lib/api.ts` — `fetchMlbLegs` (mirror `fetchMlbProps` query string)
- Create: `frontend/src/features/mlb/hooks/useMlbLegs.ts` — `staleTime: 5 * 60 * 1000`
- Create: `frontend/src/features/mlb/league/MlbLegsBoard.tsx`
- Create: `frontend/src/features/mlb/league/MlbLegsBoard.test.tsx`
- Modify: `frontend/src/pages/LeagueLegsPage.tsx`
- Modify: `frontend/src/pages/LeagueLegsPage.test.tsx`

**Interfaces:**
- Consumes: `GET /api/mlb/legs`
- Produces: MLB board; WNBA empty shell **without** calling `fetchMlbLegs`

URL default `?app=prizepicks&format=power&legs=4`, `replace: true`.

Controls: PrizePicks | Underdog; PP Power 2–6 or Flex **6 only**; UD Standard 2–6. No Flex 3.

Chrome: Assumed payouts; `base_required_margin_pts`; PP `base_break_even`; UD PLAY `break_even_min`–`break_even_max` (else table BE). PP copy: 3-pick Power is the hardest Power. UD copy: 2-pick hardest; 4-pick harder than 3-pick.

Show `generated_at`. PLAY list with expand (books, `sharp_anchor`). Flex 6 banner when `flex_same_game_warning`. Empty vs stale DFS vs missing snapshot vs loading vs error.

- [ ] **Step 1: Failing tests** — mocked PLAY renders player; `/wnba/legs` does not fetch; no Flex 3 control; same-game warning visible when flag true

- [ ] **Step 2: Run** `cd frontend && npm test -- src/pages/LeagueLegsPage.test.tsx src/features/mlb/league/MlbLegsBoard.test.tsx`

- [ ] **Step 3: Implement** using `CHROME_PAGE_X`, `CHROME_TITLE_TOP`, `LeagueSectionSwitcher`. Tab styles from `WnbaPropPicksHeader` (do not edit WNBA Props).

- [ ] **Step 4: Tests PASS; `npm run check:api` if OpenAPI changed**

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 7: Docs

**Files:**
- Modify: `md/system-design.md` — `/mlb/legs` uses `GET /api/mlb/legs`; `/wnba/legs` still none
- Modify: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` — Status: **Approved**

- [ ] **Step 1: Edit those two files** (no placeholders)

- [ ] **Step 2: Commit** (skip unless asked)

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Payout tables, clamp, Flex 3 422 | 1, 4, 6 |
| Devig, log-odds, 4 coverage rules, 45/120, hold 12% | 2, 5 |
| Favorite-only, identity, funnel, `lines_seeded` | 2, 5 |
| PX/Novig `stake` | 3 |
| Envelope `base_*`, min/max BE | 4–6 |
| MLB UI / WNBA no fetch | 6 |
| Props / `prop_fair` unchanged | 5 regression |
| system-design + spec Approved | 7 |
