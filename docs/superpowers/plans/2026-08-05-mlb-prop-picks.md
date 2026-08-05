# MLB Prop Picks DFS Edge Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/mlb/prop_picks` with a hybrid ranked board: selected DFS app lines, server-computed fair % / edge vs format breakeven, source-tier confidence, sample flags, and staleness chips.

**Architecture:** Pure fair/edge/recency engine in `backend/app/domains/mlb/prop_fair.py`. `GET /api/mlb/props/today` seeds from latest MLB PrizePicks or Underdog snapshots, attaches exact-line ProphetX + Parlay (Novig/FD/DK) + Pinnacle (cmp-only), then returns ranked `MlbPropPick` rows. Frontend hybrid list consumes that API; WNBA prop picks UI stays unchanged.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy text queries, Parlay HTTP client, React, TanStack Query, Vitest, pytest

**Spec:** `docs/superpowers/specs/2026-08-05-mlb-prop-picks-design.md`

## Global Constraints

- Route: `/mlb/prop_picks`; API: `GET /api/mlb/props/today?app=&format=&legs=`
- Selected app board only; exact DFS line match for all books (no closest-line)
- Fair: Tier1 PX+Novig (60/40 on agree ≤2.0pp; PX on disagree); single-source uses that book; Tier2 DK+FD only if Tier1 empty (55/45 DK lean); Pinnacle never in fair
- Edge: `fair_pct - breakeven_pct` with `breakeven = M^(-1/n)` from config multipliers
- Formats v1: PrizePicks `power` legs 2–6; Underdog `standard` legs 2–6
- Staleness chips: fresh sharp ≤10m; stale DFS ≥30m; stale sharp ≥60m; one chip max
- Product name in copy: **statvista**
- Do not rework WNBA `PropPicksTable` into this UI
- Read `md/claude.md` + update `md/system-design.md` page↔API table when the route lands

## File structure

| File | Responsibility |
| --- | --- |
| `backend/app/domains/mlb/prop_fair.py` | American→pct, fair tier, breakeven, edge, recency chip (pure) |
| `backend/app/domains/mlb/prop_formats.py` | Multiplier config + `breakeven_pct(app, format, legs)` |
| `backend/app/domains/mlb/schemas_props.py` | `MlbPropPick`, `MlbPropsResponse`, enums |
| `backend/app/domains/mlb/props.py` | Assemble board, cache, Parlay fetch for MLB |
| `backend/app/domains/mlb/routes.py` | Register `GET /mlb/props/today` |
| `backend/app/core/odds_snapshots.py` | League-aware PP/UD/Pinnacle + `fetch_latest_prophetx` |
| `db/migrations/031_odds_mlb_pinnacle.sql` | `odds.mlb_pinnacle` player props (mirror WNBA) |
| `src/odds/load_snapshots.py` | Route MLB pinnacle props upserts to `mlb_pinnacle` |
| `backend/tests/test_mlb_prop_fair.py` | Fair / edge / recency unit tests |
| `backend/tests/test_mlb_props.py` | Assemble + route tests |
| `backend/tests/test_odds_snapshots_mlb_props.py` | League table routing for MLB props reads |
| `frontend/src/shared/lib/api.ts` (+ schema regen) | `fetchMlbProps` |
| `frontend/src/features/mlb/hooks/useMlbProps.ts` | React Query hook |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Hybrid rows + expand |
| `frontend/src/features/mlb/league/MlbPropPicksFilters.tsx` | Filters |
| `frontend/src/features/mlb/league/filterMlbPropPicks.ts` | Client filter helpers |
| `frontend/src/pages/MlbPropPicksPage.tsx` | Page shell |
| `frontend/src/features/basketball/league/LeagueSubnav.tsx` | Enable MLB Prop Picks link |
| `frontend/src/app/AppRouter.tsx` | Route |
| `md/system-design.md` | Page ↔ API row |

---

### Task 1: Fair / breakeven / recency pure engine

**Files:**
- Create: `backend/app/domains/mlb/prop_formats.py`
- Create: `backend/app/domains/mlb/prop_fair.py`
- Create: `backend/tests/test_mlb_prop_fair.py`

**Interfaces:**
- Produces: `american_to_fair_pct(american: int) -> float` (0–100 scale, one decimal)
- Produces: `breakeven_pct(app: Literal["prizepicks","underdog"], format: str, legs: int) -> float`
- Produces: `compute_fair(side_books: dict[str, float | None]) -> FairResult` where keys are `prophetx|novig|draftkings|fanduel` fair %s for **one side**
- Produces: `recency_chip(*, sharp_changed_at, dfs_changed_at, now) -> str | None`
- Produces: `FairResult(fair_pct, source_tier, confidence_chips, sample_chips, fair_explain)`

Assumed multipliers (document in module docstring; adjust later if product confirms):

| App | Format | Legs → M |
| --- | --- | --- |
| prizepicks | power | 2→3, 3→5, 4→10, 5→20, 6→25 |
| underdog | standard | 2→3, 3→6, 4→10, 5→20, 6→40 |

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_mlb_prop_fair.py
from datetime import datetime, timedelta, timezone

from app.domains.mlb.prop_fair import (
    american_to_fair_pct,
    compute_fair,
    recency_chip,
)
from app.domains.mlb.prop_formats import breakeven_pct


def test_american_to_fair_pct_favorite():
    assert american_to_fair_pct(-140) == 58.3  # 140/240


def test_breakeven_power_4():
    # 10x ^ (-1/4) ≈ 56.234...
    assert abs(breakeven_pct("prizepicks", "power", 4) - 56.234) < 0.01


def test_consensus_blend_60_40():
    r = compute_fair({"prophetx": 58.0, "novig": 57.0, "draftkings": None, "fanduel": None})
    assert r.source_tier == "sharp_consensus"
    assert abs(r.fair_pct - (0.6 * 58.0 + 0.4 * 57.0)) < 0.05


def test_disagreement_uses_prophetx():
    r = compute_fair({"prophetx": 60.0, "novig": 50.0, "draftkings": None, "fanduel": None})
    assert r.source_tier == "sharp_disagreement"
    assert r.fair_pct == 60.0


def test_single_source_dk_agree_chip_does_not_move_fair():
    r = compute_fair({"prophetx": 54.0, "novig": None, "draftkings": 53.5, "fanduel": None})
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 54.0
    assert "dk_fd_agrees" in r.confidence_chips
    assert "px_only" in r.sample_chips or "prophetx_only" in r.sample_chips


def test_mid_tier_when_no_exchanges():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": 55.0, "fanduel": 54.0})
    assert r.source_tier == "mid_tier_fallback"
    assert abs(r.fair_pct - (0.55 * 55.0 + 0.45 * 54.0)) < 0.05


def test_no_sharp_read():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": None, "fanduel": None})
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None


def test_recency_fresh_vs_stale():
    now = datetime(2026, 8, 5, 20, 0, tzinfo=timezone.utc)
    chip = recency_chip(
        sharp_changed_at=now - timedelta(minutes=4),
        dfs_changed_at=now - timedelta(minutes=41),
        now=now,
    )
    assert chip == "fresh_sharp_vs_stale_dfs"
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/backend && python -m pytest tests/test_mlb_prop_fair.py -v
```

Expected: import / not found failures.

- [ ] **Step 3: Implement `prop_formats.py` + `prop_fair.py`**

```python
# prop_formats.py (core)
POWER_MULTIPLIERS = {2: 3.0, 3: 5.0, 4: 10.0, 5: 20.0, 6: 25.0}
UNDERDOG_MULTIPLIERS = {2: 3.0, 3: 6.0, 4: 10.0, 5: 20.0, 6: 40.0}

def breakeven_pct(app: str, format: str, legs: int) -> float:
    table = POWER_MULTIPLIERS if app == "prizepicks" else UNDERDOG_MULTIPLIERS
    m = table[legs]
    return round((m ** (-1.0 / legs)) * 100.0, 3)
```

```python
# prop_fair.py — agreement epsilon 2.0; tiers per spec
AGREE_PP = 2.0

def american_to_fair_pct(american: int) -> float:
    if american > 0:
        p = 100.0 / (american + 100.0)
    else:
        a = abs(american)
        p = a / (a + 100.0)
    return round(p * 100.0, 1)
```

Implement `compute_fair` and `recency_chip` exactly per spec (consensus / disagreement / single-source / mid-tier / no-read; chip priority Fresh vs stale → Fresh → Stale → None).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/backend && python -m pytest tests/test_mlb_prop_fair.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/prop_fair.py backend/app/domains/mlb/prop_formats.py backend/tests/test_mlb_prop_fair.py
git commit -m "feat(mlb): add prop fair, breakeven, and recency helpers"
```

---

### Task 2: League-aware snapshot reads + ProphetX + MLB Pinnacle props table

**Files:**
- Create: `db/migrations/031_odds_mlb_pinnacle.sql` (mirror `odds.wnba_pinnacle` columns used by `fetch_latest_pinnacle`)
- Modify: `src/odds/load_snapshots.py` — `load_pinnacle_props_snapshot` upserts `mlb_pinnacle` when `league=="mlb"`
- Modify: `backend/app/core/odds_snapshots.py` — table maps for PP/UD/Pinnacle; add `fetch_latest_prophetx`
- Create: `backend/tests/test_odds_snapshots_mlb_props.py`
- Modify: existing `backend/tests/test_odds_snapshots.py` / pinnacle tests if they assert hardcoded WNBA SQL

**Interfaces:**
- Produces: `fetch_latest_prizepicks("mlb")` → `odds.mlb_prizepicks`
- Produces: `fetch_latest_underdog("mlb")` → `odds.mlb_underdogs`
- Produces: `fetch_latest_pinnacle("mlb")` → `odds.mlb_pinnacle`
- Produces: `fetch_latest_prophetx("mlb")` → rows from `odds.mlb_prophetx` latest `scraped_at`
- WNBA callers must keep working with the same function signatures (`league` default `"wnba"`)

ProphetX select columns: `player_name, stat_name, line_score, side, american_price, scraped_at`.

- [ ] **Step 1: Failing tests for table routing**

Assert SQL or monkeypatched `_fetch_rows` receives league-specific table names when `league="mlb"` (pattern from `test_odds_snapshots_pinnacle.py` team routing).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Migration + loader + `odds_snapshots.py` maps**

```python
_PRIZEPICKS_TABLE = {"mlb": "mlb_prizepicks", "wnba": "wnba_prizepicks", "nba": "wnba_prizepicks"}
# same pattern for underdog / pinnacle props
# build SQL with f"FROM odds.{table}" like fetch_latest_pinnacle_team
```

- [ ] **Step 4: Run — expect PASS** (include a small loader unit test if one already covers pinnacle props table name)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(odds): league-aware MLB props snapshot reads and mlb_pinnacle table"
```

---

### Task 3: `GET /api/mlb/props/today` assembly + schemas

**Files:**
- Create: `backend/app/domains/mlb/schemas_props.py`
- Create: `backend/app/domains/mlb/props.py`
- Modify: `backend/app/domains/mlb/schemas.py` (re-export if that is the local pattern) **or** import schemas_props from routes directly — match MLB domain style
- Modify: `backend/app/domains/mlb/routes.py`
- Create: `backend/tests/test_mlb_props.py`
- Create: `backend/tests/fixtures/parlay_mlb_props_minimal.json` (small Novig/FD/DK sample)
- Modify: `md/system-design.md` page↔API table

**Interfaces:**
- Produces: `get_mlb_props_today(*, app: str, format: str, legs: int) -> MlbPropsResponse`
- Produces: route `GET /api/mlb/props/today` with `Cache-Control: no-store`
- Query validation: `app ∈ {prizepicks,underdog}`, `format` matching app, `legs ∈ 2..6`
- Cache successful assemblies ~45s keyed by `(app, format, legs)`

**Assembly algorithm:**

1. Load DFS rows for `app` (`standard` PrizePicks only; Underdog as stored).
2. Bucket by normalized `(player, stat_key, line)` — one board row per line; collect over/under DFS presence.
3. Index ProphetX / Parlay(novig,fanduel,draftkings) / Pinnacle by `(norm_player, stat_key, side, line)` — **exact line only**.
4. For each side with American prices, `american_to_fair_pct`; call `compute_fair` per side.
5. `edge = fair - breakeven` when fair present; recommended_side = argmax edge (if both missing fair → `no_sharp_read`, recommended_side null or over by convention).
6. Attach book payloads for expand; Pinnacle `role="comparison"`.
7. `changed_at` v1: use that book’s latest snapshot `scraped_at` (document limitation vs true last-move; optional follow-up).
8. Sort: rows with fair/edge first by `edge_pct` desc; `no_sharp_read` last.
9. Parlay: `SPORT_KEY = "baseball_mlb"`; reuse `parlay_get` + filter books to novig/fanduel/draftkings; if Parlay fails, continue with PX/Pinnacle/DFS only.

Reuse `prop_stat_keys` where MLB stat names already map; extend allowlist only if tests show MLB markets missing.

- [ ] **Step 1: Write failing assemble + route tests**

```python
def test_assemble_ranks_consensus_above_no_read(monkeypatch):
    # stub fetch_latest_* and parlay; one Judge TB 1.5 with PX+Novig; one Betts with no sharps
    ...
    assert props[0].player_name == "Aaron Judge"
    assert props[0].source_tier == "sharp_consensus"
    assert props[-1].source_tier == "no_sharp_read"

def test_exact_line_mismatch_omits_book(monkeypatch):
    # PX at 2.5 must not attach to DFS 1.5
    ...

def test_route_validation_legs(client):
    r = client.get("/api/mlb/props/today", params={"app": "prizepicks", "format": "power", "legs": 1})
    assert r.status_code == 422
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && python -m pytest tests/test_mlb_props.py -v
```

- [ ] **Step 3: Implement schemas, `props.py`, route**

Response field names must match the design sketch (`fair_pct`, `edge_pct`, `source_tier`, `recency_chip`, `books`, `dfs`, `fair_explain`, `breakeven_pct` on envelope).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): add MLB props today endpoint with fair and edge"
```

---

### Task 4: Frontend API client + hook + route + subnav

**Files:**
- Modify: `frontend/src/shared/lib/api.ts` — `fetchMlbProps({ app, format, legs })`
- Regenerate or hand-extend: `frontend/src/shared/lib/api.schema.d.ts` (follow repo OpenAPI regen command if documented in `frontend/README.md`; else hand-write types mirroring Pydantic)
- Create: `frontend/src/features/mlb/hooks/useMlbProps.ts`
- Create: `frontend/src/pages/MlbPropPicksPage.tsx` (minimal shell: subnav + “loading” placeholder list OK if Task 5 lands same PR — prefer shell that renders JSON count for smoke)
- Modify: `frontend/src/app/AppRouter.tsx` — `/mlb/prop_picks`
- Modify: `frontend/src/features/basketball/league/LeagueSubnav.tsx` — `Prop Picks` for `league === "mlb"` → `/mlb/prop_picks`
- Tests: `api.test.ts`, `AppRouter.test.tsx`, `LeagueSubnav.test.tsx`, `useMlbProps` or page smoke

**Interfaces:**
- Produces: `fetchMlbProps` → `GET /api/mlb/props/today?...`
- Produces: `useMlbProps({ app, format, legs })` query key `["mlb","props",app,format,legs]`, refetchInterval 60_000

- [ ] **Step 1: Failing router/subnav/api tests**

```tsx
it("links MLB Prop Picks to /mlb/prop_picks", () => { ... });
it("renders MLB prop picks route", async () => { ... });
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npm test -- --run src/app/AppRouter.test.tsx src/features/basketball/league/LeagueSubnav.test.tsx src/shared/lib/api.test.ts
```

- [ ] **Step 3: Implement client, hook, page stub, router, subnav**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(frontend): wire MLB prop picks route and API hook"
```

---

### Task 5: Hybrid list UI + filters

**Files:**
- Create: `frontend/src/features/mlb/league/MlbPropPicksList.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/mlb/league/MlbPropPicksFilters.tsx` (+ `.test.tsx`)
- Create: `frontend/src/features/mlb/league/filterMlbPropPicks.ts` (+ `.test.ts`)
- Modify: `frontend/src/pages/MlbPropPicksPage.tsx` — toolbar (app, format/legs), filters, list
- Match dark MLB/WNBA board tokens already used on league pages (hairline borders, mono edge number)

**UI requirements (from spec):**
- Collapsed: player · stat · line · recommended side (alt muted) · edge hero · fair · tier + sample + one recency chip
- Expand: exact-line books (PX, Novig, DK, FD, Pinnacle cmp) · fair_explain · timestamps · both-side edges
- No Sharp Read: dashed/muted, edge `—`, sorted last (API already sorts; keep stable)
- Filters: stat, team, side, source_tier; toggle fresh-vs-stale-only; clear
- Caption: fair/DFS/Pinnacle one-liner from spec
- Empty/error/loading copy per spec

- [ ] **Step 1: Failing component tests**

```tsx
it("shows edge and sharp consensus chip on collapsed row", () => { ... });
it("expands to show prophetx and pinnacle comparison", async () => { ... });
it("filters to fresh_sharp_vs_stale_dfs when toggle on", () => { ... });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement list + filters + page wiring**

Default toolbar: `app=prizepicks`, `format=power`, `legs=4`. Changing app/format/legs refetches via hook.

- [ ] **Step 4: Run frontend tests — expect PASS**

```bash
cd frontend && npm test -- --run src/features/mlb/league src/pages/MlbPropPicksPage.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(frontend): MLB prop picks hybrid list with fair edge UI"
```

---

### Task 6: Verification + docs polish

**Files:**
- Modify: `md/system-design.md` (if not done in Task 3)
- Modify: `backend/README.md` / `frontend/README.md` only if they list league routes

- [ ] **Step 1: Run full relevant suites**

```bash
cd backend && python -m pytest tests/test_mlb_prop_fair.py tests/test_mlb_props.py tests/test_odds_snapshots_mlb_props.py tests/test_odds_snapshots.py -v
cd frontend && npm test -- --run src/features/mlb/league src/pages/MlbPropPicksPage.test.tsx src/app/AppRouter.test.tsx src/features/basketball/league/LeagueSubnav.test.tsx
```

- [ ] **Step 2: Manual smoke (local API + UI)** — `/mlb/prop_picks` loads; switch PrizePicks↔Underdog; change legs and confirm edge/sort move; expand a consensus row

- [ ] **Step 3: Commit any doc fixes**

```bash
git commit -m "docs: document MLB prop picks page and API wiring"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Fair tiers PX/Novig → DK/FD; Pinnacle cmp-only | 1, 3 |
| Exact line only | 3 |
| Per-line fair; app-selected board | 3, 5 |
| Edge vs Power/standard breakeven | 1, 3, 5 |
| Source tier + sample + DK agrees chip | 1, 3, 5 |
| Staleness chips | 1, 3, 5 |
| Hybrid rows + expand | 5 |
| Filters + parked no-read | 5 |
| `/api/mlb/props/today` + `/mlb/prop_picks` | 3, 4 |
| `mlb_pinnacle` + league-aware reads | 2 |
| system-design page↔API | 3 or 6 |

## Known v1 limitations (do not block ship)

- `changed_at` ≈ snapshot `scraped_at` until line-move history is implemented
- Multiplier table assumed; confirm against live PrizePicks/Underdog payouts
- Parlay MLB market key allowlist may need iteration once live payloads are inspected
