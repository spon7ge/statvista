# Movers & Edges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a **Movers** league tab (`/wnba/movers`, then `/mlb/movers`) that shows DFS **line movers** (was→now since the prior scrape row) and **Edges** (+EV vs fair), per `docs/superpowers/specs/2026-08-22-movers-edges-design.md`.

**Architecture:** New `GET /api/{league}/movers` builds the current DFS board the same way as `props/today` (fair/edge included), then diffs each quote against the **previous row for that DFS identity** in Supabase (`ROW_NUMBER` / dual fetch). Frontend is a split-board page (Line movers + Edges) with Prop Picks–style chrome; subnav replaces the disabled **Playoff race** placeholder with **Movers**.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy/`odds_snapshots`, React 19, TanStack Query, Vitest/pytest, OpenAPI → `api.schema.d.ts`.

## Global Constraints

- Tab label **Movers**; routes `/wnba/movers` and `/mlb/movers`.
- DFS apps only: `prizepicks` | `underdog` (defaults power/4, standard/4).
- No EV when `source_tier == no_sharp_read`; default `min_edge=3`.
- Juice-only moves need |Δ american| ≥ 5; line changes always count.
- PrizePicks snapshots have **no** `american_price` — PP movers are **line-only**; Underdog can be line and/or juice.
- Prior quote = previous row for quote **identity** (not PK including `line_score`): PP `(league, player_name, stat_type, odds_type)`; UD `(league, player_name, stat_name, side)`.
- Replace subnav **Playoff race** with linked **Movers** (do not leave both).
- Product name **statvista**; research disclaimer, no tip-seller copy.
- Do not commit unless the user asks (ignore commit steps or stop before them if working interactively).

## File map

| File | Role |
| --- | --- |
| `backend/app/core/odds_snapshots.py` | `fetch_dfs_quote_history` / prior+current rows per identity |
| `backend/app/domains/betting/movers_diff.py` | Pure diff helpers (shared WNBA/MLB) |
| `backend/app/domains/wnba/schemas_movers.py` | Response models |
| `backend/app/domains/wnba/movers.py` | Assemble movers + edges for WNBA |
| `backend/app/domains/wnba/routes.py` | `GET /wnba/movers` |
| `backend/app/domains/mlb/schemas_movers.py` | MLB response models (mirror) |
| `backend/app/domains/mlb/movers.py` | MLB assemble |
| `backend/app/domains/mlb/routes.py` | `GET /mlb/movers` |
| `backend/tests/test_movers_diff.py` | Diff unit tests |
| `backend/tests/test_odds_snapshots_movers.py` | Snapshot history SQL/tests |
| `backend/tests/test_wnba_movers.py` | Service + route tests |
| `backend/tests/test_mlb_movers.py` | MLB service + route tests |
| `frontend/openapi.json` + `api.schema.d.ts` | Regenerated types |
| `frontend/src/shared/lib/api.ts` | `fetchWnbaMovers` / `fetchMlbMovers` |
| `frontend/src/features/basketball/hooks/useWnbaMovers.ts` | Query hook |
| `frontend/src/features/mlb/hooks/useMlbMovers.ts` | Query hook |
| `frontend/src/features/basketball/league/LeagueSubnav.tsx` | Movers link |
| `frontend/src/features/*/league/*Movers*` | Tables + page chrome |
| `frontend/src/pages/WnbaMoversPage.tsx` / `MlbMoversPage.tsx` | Pages |
| `frontend/src/app/AppRouter.tsx` | Routes |
| `md/system-design.md` | Page ↔ API row |

---

### Task 1: DFS quote history reader (prior + current)

**Files:**
- Modify: `backend/app/core/odds_snapshots.py`
- Test: `backend/tests/test_odds_snapshots_movers.py`

**Interfaces:**
- Produces: `fetch_dfs_current_and_prior(league: str, *, app: Literal["prizepicks","underdog"]) -> list[dict]` where each dict has current fields plus optional `prior_line_score`, `prior_american_price`, `prior_scraped_at` (None if no prior).

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_odds_snapshots_movers.py
from unittest.mock import MagicMock, patch
from app.core import odds_snapshots as svc

def test_fetch_dfs_current_and_prior_joins_second_row():
    rows = [
        # rn=1 current, rn=2 prior (same identity, different line)
        {"player_name": "A", "stat_type": "Points", "odds_type": "standard",
         "line_score": 23.5, "scraped_at": "2026-08-22T17:00:00+00:00", "rn": 1},
        {"player_name": "A", "stat_type": "Points", "odds_type": "standard",
         "line_score": 22.5, "scraped_at": "2026-08-22T16:00:00+00:00", "rn": 2},
    ]
    with patch.object(svc, "_fetch_rows", return_value=rows):
        out = svc.fetch_dfs_current_and_prior("wnba", app="prizepicks")
    assert len(out) == 1
    assert out[0]["line_score"] == 23.5
    assert out[0]["prior_line_score"] == 22.5
```

- [ ] **Step 2: Run test — expect FAIL** (function missing)

Run: `pytest backend/tests/test_odds_snapshots_movers.py::test_fetch_dfs_current_and_prior_joins_second_row -v`

- [ ] **Step 3: Implement**

Add SQL that ranks by quote identity (`get_quote_spec(table).identity_cols` **without** requiring `league` twice — filter `league = :league`), `ROW_NUMBER() OVER (PARTITION BY player… ORDER BY scraped_at DESC) AS rn`, `WHERE rn <= 2`. Then fold rn=1/rn=2 in Python into `prior_*` fields.

PrizePicks columns: `player_name, stat_type, odds_type, line_score, scraped_at` (no american).  
Underdog columns: include `stat_name, side, american_price, payout_multiplier`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest backend/tests/test_odds_snapshots_movers.py -v`

- [ ] **Step 5: Commit** (only if user requested commits)

```bash
git add backend/app/core/odds_snapshots.py backend/tests/test_odds_snapshots_movers.py
git commit -m "feat(odds): fetch DFS current and prior quote rows for movers"
```

---

### Task 2: Pure movers diff helpers

**Files:**
- Create: `backend/app/domains/betting/movers_diff.py`
- Test: `backend/tests/test_movers_diff.py`

**Interfaces:**
- Produces:
  - `american_delta(a: int | None, b: int | None) -> int | None`
  - `classify_move(*, from_line, to_line, from_american, to_american, juice_floor: int = 5) -> Literal["line","juice","both"] | None` (None = not a mover)
  - `build_mover_row(...)` returning a plain dict matching schema fields below

- [ ] **Step 1: Failing tests**

```python
from app.domains.betting.movers_diff import classify_move

def test_line_change_always_counts():
    assert classify_move(from_line=22.5, to_line=23.5, from_american=None, to_american=None) == "line"

def test_tiny_juice_ignored():
    assert classify_move(from_line=22.5, to_line=22.5, from_american=-110, to_american=-112) is None

def test_juice_floor():
    assert classify_move(from_line=22.5, to_line=22.5, from_american=-110, to_american=-120) == "juice"
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pytest backend/tests/test_movers_diff.py -v`

- [ ] **Step 3: Implement helpers** in `movers_diff.py` (no DB imports).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (if requested)

---

### Task 3: WNBA movers schemas + service

**Files:**
- Create: `backend/app/domains/wnba/schemas_movers.py`
- Create: `backend/app/domains/wnba/movers.py`
- Test: `backend/tests/test_wnba_movers.py`
- Consumes: `fetch_dfs_current_and_prior`, `classify_move`, existing `get_wnba_props_today` internals / fair path

**Interfaces:**
- Produces: `async def get_wnba_movers(*, app, format, legs, min_edge: float = 3.0) -> WnbaMoversResponse`

Schema fields (match spec):

```python
class WnbaMoverRow(BaseModel):
    player_name: str
    player_slug: str
    team_abbrev: str | None = None
    stat: str
    side: Literal["over", "under"] | None = None
    from_line: float | None = None
    to_line: float
    from_american: int | None = None
    to_american: int | None = None
    moved_at: str | None = None
    move_kind: Literal["line", "juice", "both"]
    edge_pct: float | None = None
    headshot_url: str | None = None

class WnbaEdgeRow(BaseModel):
    player_name: str
    player_slug: str
    team_abbrev: str | None = None
    stat: str
    side: Literal["over", "under"]
    line: float
    fair_pct: float
    edge_pct: float
    source_tier: SourceTier
    headshot_url: str | None = None

class WnbaMoversResponse(BaseModel):
    as_of: str
    league: Literal["wnba"] = "wnba"
    app: Literal["prizepicks", "underdog"]
    prior_as_of: str | None
    movers: list[WnbaMoverRow]
    edges: list[WnbaEdgeRow]
    error: str | None = None
```

Slug: reuse the same normalization as frontend `slugifyPlayerName` (ASCII fold, lowercase, hyphenate) — put a small `player_slug(name: str) -> str` in `movers_diff.py` or import existing backend helper if one exists.

Service algorithm:

1. Call existing props assembly (`get_wnba_props_today`) for current board + fair/edge (or extract shared assemble if cleaner — prefer **call `get_wnba_props_today`** in v1 to avoid drift).
2. `history = fetch_dfs_current_and_prior("wnba", app=app)`.
3. Index history by match key; for each current prop row, if `classify_move` non-None, append mover (attach `edge_pct` from props row when present).
4. Edges = props where `edge_pct is not None` and `edge_pct >= min_edge` and `source_tier != "no_sharp_read"`, sorted desc.
5. `prior_as_of` = max prior scraped_at among movers’ priors (or None).

- [ ] **Step 1: Failing service tests** with monkeypatched `get_wnba_props_today` + `fetch_dfs_current_and_prior`.

- [ ] **Step 2: Implement schemas + service**

- [ ] **Step 3: Tests PASS**

Run: `pytest backend/tests/test_wnba_movers.py -v`

---

### Task 4: WNBA route

**Files:**
- Modify: `backend/app/domains/wnba/routes.py`
- Modify: `backend/tests/test_wnba_movers.py` (add TestClient route case) **or** `backend/tests/test_wnba_movers_route.py`

- [ ] **Step 1: Failing route test** `GET /api/wnba/movers?app=prizepicks&format=power&legs=4&min_edge=3`

- [ ] **Step 2: Add route**

```python
@router.get("/wnba/movers", response_model=WnbaMoversResponse)
async def wnba_movers(
    response: Response,
    app: Literal["prizepicks", "underdog"] = Query(...),
    format: str = Query(..., min_length=1),
    legs: int = Query(..., ge=2, le=6),
    min_edge: float = Query(3.0, ge=0),
) -> WnbaMoversResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_wnba_movers(app=app, format=format, legs=legs, min_edge=min_edge)
```

- [ ] **Step 3: Tests PASS**

---

### Task 5: OpenAPI + frontend API client + hook (WNBA)

**Files:**
- Regenerate: `frontend/openapi.json`, `frontend/src/shared/lib/api.schema.d.ts` (project’s usual export script — follow `backend/README.md` / existing `generate:api` flow)
- Modify: `frontend/src/shared/lib/api.ts`, `frontend/src/shared/lib/api.test.ts`
- Create: `frontend/src/features/basketball/hooks/useWnbaMovers.ts`
- Test: `frontend/src/features/basketball/hooks/useWnbaMovers.test.tsx`

- [ ] **Step 1: Export OpenAPI from running app / project script, then**

Run: `cd frontend && npm run generate:api`

- [ ] **Step 2: Add client**

```ts
export async function fetchWnbaMovers(params: {
  app: string;
  format: string;
  legs: number;
  minEdge?: number;
}): Promise<ApiWnbaMoversResponse> {
  const qs = new URLSearchParams({
    app: params.app,
    format: params.format,
    legs: String(params.legs),
    min_edge: String(params.minEdge ?? 3),
  });
  const res = await fetch(`${API_BASE}/api/wnba/movers?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Movers request failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Hook** mirroring `useWnbaProps` query key `["wnba","movers", app, format, legs, minEdge]`

- [ ] **Step 4: api + hook tests PASS**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/basketball/hooks/useWnbaMovers.test.tsx`

---

### Task 6: Subnav — replace Playoff race with Movers

**Files:**
- Modify: `frontend/src/features/basketball/league/LeagueSubnav.tsx`
- Modify: `frontend/src/features/basketball/league/LeagueSubnav.test.tsx`

- [ ] **Step 1: Failing test** — expect link `Movers` → `/wnba/movers`, active on that path; **no** disabled “Playoff race”.

- [ ] **Step 2: Update `exploreItems`**

Replace `"Playoff race"` with `"Movers"`. In `itemPath` / `isActive`:

```ts
if (item === "Movers" && (league === "wnba" || league === "mlb"))
  return `/${league}/movers`;
// isActive:
if (item === "Movers") return pathname.endsWith("/movers");
```

Order should read: Matchups · Prop Picks · Leaders · Standings · **Movers** · Futures  
(or Prop Picks · **Movers** · Leaders… if you prefer spec order — **use spec order**: after Prop Picks). Adjust `exploreItems` array to:

`Matchups, Prop Picks, Movers, Leaders, Standings, Futures`

- [ ] **Step 3: Tests PASS**

Run: `npx vitest run src/features/basketball/league/LeagueSubnav.test.tsx`

---

### Task 7: WNBA Movers UI

**Files:**
- Create: `frontend/src/features/basketball/league/WnbaMoversHeader.tsx` (title + pills slot + optional meta — or inline in page)
- Create: `frontend/src/features/basketball/league/WnbaMoversBoard.tsx` (two tables)
- Create: `frontend/src/features/basketball/league/WnbaMoversBoard.test.tsx`
- Create: `frontend/src/pages/WnbaMoversPage.tsx`
- Create: `frontend/src/pages/WnbaMoversPage.test.tsx`
- Reuse: `WnbaPropPicksFilters` (`tone="pill"`), `appFromSearch` from `WnbaPropPicksHeader`

**UI rules (from spec + mockup):**
- Title **Movers** left; Team + Search + **Min edge** control right
- PrizePicks / Underdog tabs
- Section **Line movers** then **Edges**
- Row click → `/wnba/prop_picks/player/${player_slug}?app=`
- Empty copy per section; show `as_of` / `prior_as_of`

- [ ] **Step 1: Board unit tests** (render fixture movers/edges, assert columns + link href)

- [ ] **Step 2: Implement board + page**

- [ ] **Step 3: Page test** with mocked `useWnbaMovers`

- [ ] **Step 4: Vitest PASS**

---

### Task 8: Wire WNBA route in AppRouter

**Files:**
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`

- [ ] **Step 1: Add** `<Route path="/wnba/movers" element={<WnbaMoversPage />} />`

- [ ] **Step 2: Router test** visits `/wnba/movers`, mocks `/api/wnba/movers`, asserts heading **Movers**

- [ ] **Step 3: PASS**

---

### Task 9: MLB parity

**Files:**
- Create: `backend/app/domains/mlb/schemas_movers.py`, `movers.py`
- Modify: `backend/app/domains/mlb/routes.py`
- Test: `backend/tests/test_mlb_movers.py`
- Create: `frontend/src/features/mlb/hooks/useMlbMovers.ts`
- Create: `frontend/src/pages/MlbMoversPage.tsx` (+ board components under `features/mlb/league/`)
- Modify: `frontend/src/shared/lib/api.ts`, `AppRouter.tsx`
- Regenerate OpenAPI again after MLB route

Mirror WNBA: same response shape (`league: "mlb"`), same UI, links to `/mlb/prop_picks/player/...`.

- [ ] **Step 1: Backend MLB tests + service + route**

- [ ] **Step 2: Frontend MLB page + router**

- [ ] **Step 3: `npm run generate:api` + tests PASS**

---

### Task 10: Docs

**Files:**
- Modify: `md/system-design.md` (page ↔ API table + subnav note)
- Modify: `docs/superpowers/specs/2026-08-22-movers-edges-design.md` — set Status: **Implemented** when done
- Note prior-row approach (identity history) as the resolved form of “previous watermark” in the spec Decisions if needed (one-line clarification)

- [ ] **Step 1: Update system-design rows** for `/wnba/movers` and `/mlb/movers`

- [ ] **Step 2: Mark spec implemented**

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Movers tab + routes | 6, 8, 9 |
| Split Line movers + Edges | 7, 9 |
| Was→now from prior scrape | 1–3 |
| Fair/edge reuse, hide `no_sharp_read` | 3 |
| min_edge default 3 + control | 3, 4, 7 |
| Juice floor 5¢; PP line-only | 2, 3 |
| Replace playoff placeholder | 6 |
| Player props deep link | 7, 9 |
| system-design update | 10 |
| WNBA then MLB | 3–8 then 9 |

## Placeholder / consistency self-check

- No TBD steps; PP vs UD column differences called out.
- `min_edge` query param name snake_case on API, camelCase in TS client.
- Subnav order matches spec (Movers after Prop Picks).
- Diff uses **identity prior row**, which satisfies the spec’s was→now intent more reliably than a single global watermark when scrapes are partial (change_filter).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-movers-edges.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — run tasks in this session with checkpoints  

Which approach?
