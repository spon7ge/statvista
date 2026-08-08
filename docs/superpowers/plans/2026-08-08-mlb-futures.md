# MLB Futures Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable MLB Explore **Futures** at `/mlb/futures` with ESPN World Series / league / division odds, MLB crossed-bats chrome, and group pills — cloning the WNBA futures backend pattern into an MLB-owned page/board.

**Architecture:** Backend `mlb/futures.py` fetches ESPN MLB season futures, prefers DraftKings, resolves team `$ref`s, caches ~5 min. Frontend adds subnav link, route, `MlbFuturesPage` + header + pill-filtered `MlbFuturesBoard` (not shared with WNBA).

**Tech Stack:** FastAPI · httpx · pytest · React · TypeScript · TanStack Query · Vitest · openapi-typescript

**Spec:** `docs/superpowers/specs/2026-08-08-mlb-futures-design.md`

## Global Constraints

- Upstream: `GET https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{season}/futures`
- Season via `current_mlb_season_year()` from `app.domains.mlb.leaders`
- Prefer active provider name containing `draftkings` (case-insensitive); else first active / first listed
- Sort entries by American odds ascending (favorites first)
- Prefer ESPN `displayName` for market `display_name`; fall back to cleaned `name`
- MLB-owned UI (`MlbFuturesHeader`, `MlbFuturesBoard`); do **not** reuse WNBA `FuturesBoard` / `LeagueFuturesPage`
- Group pills: World Series | League | Division (default World Series); client-side filter
- Enable Futures in `LeagueSubnav` for `mlb` only (WNBA stays; NBA stays disabled)
- `Cache-Control: no-store` on HTTP; service TTL ~300s
- Product name **statvista** in new user-facing copy
- TDD each task; sync OpenAPI + `md/system-design.md` page ↔ API table
- Follow `md/claude.md` and `frontend/README.md` / `backend/README.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/domains/mlb/schemas_futures.py` | Pydantic response models |
| `backend/app/domains/mlb/futures.py` | Fetch, normalize, cache |
| `backend/app/domains/mlb/schemas.py` | Re-export futures models (match WNBA pattern if used) |
| `backend/app/domains/mlb/routes.py` | `GET /api/mlb/futures` |
| `backend/tests/fixtures/espn_mlb_futures.json` | Trimmed ESPN index + market books |
| `backend/tests/fixtures/espn_mlb_team_10.json` | Minimal team payload |
| `backend/tests/test_mlb_futures.py` | Normalize + route tests |
| `frontend/src/shared/lib/api.ts` | `fetchMlbFutures` |
| `frontend/openapi.json` + `api.schema.d.ts` | Contract sync |
| `frontend/src/features/mlb/hooks/useMlbFutures.ts` | Query hook |
| `frontend/src/features/mlb/league/MlbFuturesHeader.tsx` | Crossed-bats banner |
| `frontend/src/features/mlb/league/MlbFuturesBoard.tsx` | Pills + market blocks |
| `frontend/src/features/mlb/league/mlbFuturesGroups.ts` | Pill ↔ market matching helpers |
| `frontend/src/pages/MlbFuturesPage.tsx` | Page shell |
| `frontend/src/features/basketball/league/LeagueSubnav.tsx` | Enable MLB Futures path |
| `frontend/src/app/AppRouter.tsx` | `/mlb/futures` route |
| `md/system-design.md` | Page ↔ API row |

---

### Task 1: Backend schemas + normalize helpers (TDD)

**Files:**
- Create: `backend/app/domains/mlb/schemas_futures.py`
- Create: `backend/app/domains/mlb/futures.py` (helpers + normalize; fetch/cache can be stubs until Task 2)
- Create: `backend/tests/fixtures/espn_mlb_futures.json`
- Create: `backend/tests/fixtures/espn_mlb_team_10.json`
- Create: `backend/tests/test_mlb_futures.py`

**Interfaces:**
- Produces:
  - `MlbFuturesEntry(team_id, abbrev, name, logo_url: str | None, odds_american: str)`
  - `MlbFuturesMarket(id, name, display_name, provider, entries: list[MlbFuturesEntry])`
  - `MlbFuturesResponse(season: int, as_of: str, markets: list[MlbFuturesMarket], error: str | None = None)`
  - `display_name_for_market(*, name: str, display_name: str | None) -> str`
  - `parse_american_odds(value: str) -> int | None`
  - `pick_provider(futures: list[dict]) -> dict | None`
  - `async def normalize_futures_payload(payload, season, client) -> MlbFuturesResponse`

- [ ] **Step 1: Write fixtures + failing tests**

Fixture shape (trimmed from live ESPN): index `items[]` with at least World Series (`displayName`: `World Series Winner`), one AL/NL winner, one division winner. World Series market detail embedded or inline `futures[]` with DraftKings + ESPN BET providers; DraftKings `books[]` with 2–3 teams (one via `$ref`, optional embedded). Team fixture id `10`, abbrev `NYY`.

```python
# backend/tests/test_mlb_futures.py
from app.domains.mlb import futures as svc

def test_display_name_prefers_espn_display_name():
    assert (
        svc.display_name_for_market(
            name="MLB  - World Series - Winner",
            display_name="World Series Winner",
        )
        == "World Series Winner"
    )
    assert (
        svc.display_name_for_market(name="MLB - Winning League", display_name=None)
        == "MLB - Winning League"
    )


def test_parse_american_odds():
    assert svc.parse_american_odds("+450") == 450
    assert svc.parse_american_odds("-120") == -120
    assert svc.parse_american_odds("even") is None


def test_pick_provider_prefers_draftkings():
    futures = [
        {"provider": {"name": "ESPN BET", "active": 1}, "books": []},
        {"provider": {"name": "DraftKings", "active": 1}, "books": [{"value": "+100"}]},
    ]
    picked = svc.pick_provider(futures)
    assert picked is not None
    assert picked["provider"]["name"] == "DraftKings"


@pytest.mark.asyncio
async def test_normalize_sorts_favorites_and_uses_display_name(monkeypatch):
    # Load fixture; monkeypatch resolve_book_team / resolve_team to return Yanks/Dodgers
    # Assert World Series market display_name, provider DraftKings, first entry shortest odds
    ...
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && python3 -m pytest tests/test_mlb_futures.py -v`

Expected: FAIL (module / symbols missing)

- [ ] **Step 3: Implement schemas + helpers + normalize**

Clone patterns from `backend/app/domains/wnba/futures.py` and `schemas_futures.py`:

- `FUTURES_URL` → baseball/mlb
- `pick_provider`: prefer `"draftkings" in name.lower()` when active
- `display_name_for_market`: `display_name.strip()` if non-empty else `name.strip() or "Futures"`
- In `normalize_futures_payload`, read both `item["name"]` and `item.get("displayName")`
- Reuse team allowlist / resolve / sort-key logic from WNBA (copy into MLB module — do not extract shared package)
- Skip books that fail team resolve or lack odds; skip markets with no provider

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && python3 -m pytest tests/test_mlb_futures.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_futures.py backend/app/domains/mlb/futures.py \
  backend/tests/fixtures/espn_mlb_futures.json backend/tests/fixtures/espn_mlb_team_10.json \
  backend/tests/test_mlb_futures.py
git commit -m "feat(mlb): add ESPN futures normalize helpers"
```

---

### Task 2: Fetch, cache, route, OpenAPI

**Files:**
- Modify: `backend/app/domains/mlb/futures.py`
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/app/domains/mlb/schemas.py` (re-export if WNBA pattern requires)
- Modify: `backend/tests/test_mlb_futures.py`
- Modify: `frontend/openapi.json` + regenerate `frontend/src/shared/lib/api.schema.d.ts`
- Modify: `md/system-design.md`

**Interfaces:**
- Produces:
  - `async def fetch_espn_futures(season: int) -> dict`
  - `async def get_mlb_futures() -> MlbFuturesResponse`
  - Route `GET /api/mlb/futures` → `MlbFuturesResponse`, `Cache-Control: no-store`, 502 on hard failure

- [ ] **Step 1: Write failing route test**

```python
@pytest.mark.asyncio
async def test_mlb_futures_route_ok(monkeypatch):
    async def fake_get():
        return MlbFuturesResponse(season=2026, as_of="2026-08-08T00:00:00Z", markets=[])

    monkeypatch.setattr("app.domains.mlb.routes.get_mlb_futures", fake_get)
    # Use existing AsyncClient/test app pattern from test_wnba_futures.py
    # GET /api/mlb/futures → 200, Cache-Control no-store
```

Also test: when `get_mlb_futures` raises, response is 502.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && python3 -m pytest tests/test_mlb_futures.py -k route -v`

- [ ] **Step 3: Implement fetch/cache + route**

```python
# futures.py
CACHE_TTL_SECONDS = 300.0

async def fetch_espn_futures(season: int) -> dict:
    url = FUTURES_URL.format(season=season)
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(
            url, params={"limit": 200, "lang": "en", "region": "us"}
        )
        res.raise_for_status()
        return res.json()

async def get_mlb_futures() -> MlbFuturesResponse:
    # Same lock + stale-cache pattern as get_wnba_futures
    # season = current_mlb_season_year()
    ...
```

```python
# routes.py
@router.get("/mlb/futures", response_model=MlbFuturesResponse)
async def mlb_futures(response: Response) -> MlbFuturesResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_futures()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB futures unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB futures are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
```

Export OpenAPI (follow repo’s existing export command — typically from backend README / prior MLB tasks, e.g. `python -m app.openapi_export` or project script). Then:

```bash
cd frontend && npm run generate:api
```

Update `md/system-design.md`:
- Route tree: `/mlb/futures` → `MlbFuturesPage`
- Page ↔ API table row: `/mlb/futures` | Season futures | `useMlbFutures` | `GET /api/mlb/futures` | ESPN core futures
- API list: `GET /api/mlb/futures`

- [ ] **Step 4: Run tests + check:api**

```bash
cd backend && python3 -m pytest tests/test_mlb_futures.py -v
cd frontend && npm run check:api
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/futures.py backend/app/domains/mlb/routes.py \
  backend/app/domains/mlb/schemas.py backend/tests/test_mlb_futures.py \
  frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts md/system-design.md
git commit -m "feat(mlb): add GET /api/mlb/futures from ESPN"
```

---

### Task 3: Frontend API client + hook (TDD)

**Files:**
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts`
- Create: `frontend/src/features/mlb/hooks/useMlbFutures.ts`

**Interfaces:**
- Produces: `fetchMlbFutures(): Promise<ApiMlbFuturesResponse>` hitting `/api/mlb/futures`
- Produces: `useMlbFutures()` with `queryKey: ["mlb", "futures"]` and `hasNeverLoaded`

- [ ] **Step 1: Failing api test**

```typescript
it("hits /api/mlb/futures", async () => {
  // mock fetch → assert URL ends with /api/mlb/futures (mirror wnba futures test)
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts -t "mlb/futures"`

- [ ] **Step 3: Implement fetch + hook**

```typescript
// api.ts — mirror fetchWnbaFutures
export async function fetchMlbFutures() {
  const res = await fetch(`${API_BASE}/api/mlb/futures`, { ... });
  ...
}

// useMlbFutures.ts — copy useMlbStandings pattern with fetchMlbFutures
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts -t "mlb/futures"`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts \
  frontend/src/features/mlb/hooks/useMlbFutures.ts
git commit -m "feat(mlb): add futures API client and hook"
```

---

### Task 4: MlbFuturesHeader + group helpers + MlbFuturesBoard (TDD)

**Files:**
- Create: `frontend/src/features/mlb/league/MlbFuturesHeader.tsx` (+ test)
- Create: `frontend/src/features/mlb/league/mlbFuturesGroups.ts` (+ test)
- Create: `frontend/src/features/mlb/league/MlbFuturesBoard.tsx` (+ test)

**Interfaces:**
- Produces:
  - `MlbFuturesHeader({ season })` — crossed bats + `MLB {season} Futures`; banner color constant distinct from Leaders `#F38312` and Standings `#0A2351` (e.g. deep green `#0B3D2E` or similar single constant)
  - `FuturesGroupId = "world_series" | "league" | "division"`
  - `marketMatchesGroup(market, group): boolean`
  - `filterMarketsByGroup(markets, group): markets`
  - `MlbFuturesBoard({ season, markets, group, onGroupChange, isLoading, isError })` — pills + filtered market blocks + `Data: ESPN`

Pill matching (case-insensitive on `display_name` + `name`):

| Group | Match |
| --- | --- |
| `world_series` | includes `world series` |
| `league` | (`american league winner` OR `national league winner` OR `winning league`) AND NOT `division` |
| `division` | includes `division` |

- [ ] **Step 1: Failing tests**

```typescript
// mlbFuturesGroups.test.ts
it("classifies world series / league / division markets", () => {
  expect(marketMatchesGroup(ws, "world_series")).toBe(true);
  expect(marketMatchesGroup(al, "league")).toBe(true);
  expect(marketMatchesGroup(nlWest, "division")).toBe(true);
  expect(marketMatchesGroup(nlWest, "league")).toBe(false);
});

// MlbFuturesHeader.test.tsx — renders MLB 2026 Futures + testid

// MlbFuturesBoard.test.tsx
// - default World Series pill selected (aria)
// - clicking Division shows only division markets
// - loading / error / empty states
// - shows Odds by {provider} and Data: ESPN
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/mlb/league/MlbFuturesHeader.test.tsx src/features/mlb/league/mlbFuturesGroups.test.ts src/features/mlb/league/MlbFuturesBoard.test.tsx`

- [ ] **Step 3: Implement UI**

- Header: copy `MlbStandingsHeader` structure; new banner color constant.
- Board: pill row (`role="tablist"` / `role="tab"` or toggle buttons with `aria-pressed`); one section per filtered market (title = `display_name`, caption Odds by provider, 1–2 col grid of avatar + name + mono odds). Do **not** import basketball `FuturesBoard`.
- Empty group: “No futures listed” (or “No futures in this group”).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/league/MlbFuturesHeader.tsx \
  frontend/src/features/mlb/league/MlbFuturesHeader.test.tsx \
  frontend/src/features/mlb/league/mlbFuturesGroups.ts \
  frontend/src/features/mlb/league/mlbFuturesGroups.test.ts \
  frontend/src/features/mlb/league/MlbFuturesBoard.tsx \
  frontend/src/features/mlb/league/MlbFuturesBoard.test.tsx
git commit -m "feat(mlb): add Futures header, groups, and board"
```

---

### Task 5: Page, subnav, router wiring (TDD)

**Files:**
- Create: `frontend/src/pages/MlbFuturesPage.tsx` (+ test)
- Modify: `frontend/src/features/basketball/league/LeagueSubnav.tsx` (+ test)
- Modify: `frontend/src/app/AppRouter.tsx` (+ test)

**Interfaces:**
- `MlbFuturesPage`: `LeagueSubnav league="mlb"` + header + board; local state `group` default `"world_series"`; `useMlbFutures`
- Subnav: `item === "Futures" && (league === "wnba" || league === "mlb")` → `` `/${league}/futures` ``
- Router: `<Route path="/mlb/futures" element={<MlbFuturesPage />} />`

- [ ] **Step 1: Failing tests**

```typescript
// LeagueSubnav.test.tsx
it("links Futures to /mlb/futures for mlb", () => {
  renderSubnav("/mlb/futures", "mlb");
  expect(screen.getByRole("link", { name: "Futures" })).toHaveAttribute(
    "href",
    "/mlb/futures",
  );
});

// MlbFuturesPage.test.tsx — mocks useMlbFutures; asserts header + board + active Futures subnav

// AppRouter.test.tsx — /mlb/futures mocks /api/mlb/futures and renders page content
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement wiring**

```tsx
// MlbFuturesPage.tsx — mirror MlbStandingsPage shell
export function MlbFuturesPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbFutures();
  const [group, setGroup] = useState<FuturesGroupId>("world_series");
  const season = data?.season ?? new Date().getFullYear();
  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbFuturesHeader season={season} />
        <MlbFuturesBoard
          season={season}
          markets={data?.markets ?? []}
          group={group}
          onGroupChange={setGroup}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run focused frontend tests — expect PASS**

```bash
cd frontend && npx vitest run \
  src/features/basketball/league/LeagueSubnav.test.tsx \
  src/pages/MlbFuturesPage.test.tsx \
  src/app/AppRouter.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MlbFuturesPage.tsx frontend/src/pages/MlbFuturesPage.test.tsx \
  frontend/src/features/basketball/league/LeagueSubnav.tsx \
  frontend/src/features/basketball/league/LeagueSubnav.test.tsx \
  frontend/src/app/AppRouter.tsx frontend/src/app/AppRouter.test.tsx
git commit -m "feat(mlb): wire Futures tab route and page"
```

---

### Task 6: Verification smoke

**Files:** none new (docs already updated in Task 2)

- [ ] **Step 1: Run backend + frontend suites for futures**

```bash
cd backend && python3 -m pytest tests/test_mlb_futures.py -v
cd frontend && npx vitest run src/features/mlb/league src/pages/MlbFuturesPage.test.tsx src/shared/lib/api.test.ts -t "mlb/futures|Futures|futures"
cd frontend && npm run check:api
```

Expected: all PASS

- [ ] **Step 2: Optional live smoke**

With API server running: open `/mlb/futures`, confirm World Series odds load, League/Division pills switch markets, Futures subnav active.

- [ ] **Step 3: Commit only if docs/tests were fixed during smoke**

Otherwise no commit.

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| `GET /api/mlb/futures` ESPN baseball URL | 1–2 |
| DraftKings preferred; favorites sort | 1 |
| `displayName` → `display_name` | 1 |
| Subnav + `/mlb/futures` | 5 |
| MLB header + MLB board (not WNBA reuse) | 4–5 |
| World Series / League / Division pills | 4–5 |
| OpenAPI + system-design | 2 |
| Tests without live ESPN in CI | 1–5 |
| NBA Futures still disabled | 5 (subnav unchanged for nba) |

No placeholders. Types/names consistent (`MlbFutures*`, `get_mlb_futures`, group ids `world_series` / `league` / `division`).
