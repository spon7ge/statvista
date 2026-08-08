# MLB League Leaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/mlb/leaders` with twelve top-10 hitting/pitching boards from `GET /api/mlb/leaders` (StatsAPI), WNBA-style layout, MLB typography 18px / 14px subtle.

**Architecture:** Backend proxies `statsapi.mlb.com/api/v1/stats/leaders` per category (always with `statGroup`), resolves team id→abbrev, caches 10 minutes. Frontend MLB page + grid/card components (do not change WNBA fonts); enable LeagueSubnav Leaders for MLB.

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React · TypeScript · Vite · TanStack Query · React Router · Vitest · Tailwind

**Spec:** `docs/superpowers/specs/2026-08-07-mlb-leaders-design.md`

## Global Constraints

- Product name: **statvista**
- Route: `/mlb/leaders` only; WNBA leaders fonts/behavior unchanged
- Data: StatsAPI only; always pass `statGroup` with `leaderCategories`
- WHIP upstream key: `walksAndHitsPerInningPitched`
- Categories (fixed order): AVG, HR, RBI, SB, OPS, Hits, ERA, WHIP, SO, W, SV, IP
- Season label: `{season} season` (not “per game”); `pace: "season"`
- Attribution: exact `Data: statsapi.mlb.com`
- Typography (MLB cards/grid chrome): primary `text-[18px]`; subtle `text-[14px]`
- Player names: plain text (no player route links)
- `gp`: always `null` from leaders payload; UI shows `—`
- HTTP: `Cache-Control: no-store`; in-process cache TTL 10 minutes; stale-on-refresh-failure
- Coding: `md/claude.md`; update `md/system-design.md` page↔API row
- Verify backend: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_leaders_normalize.py backend/tests/test_mlb_leaders_route.py -v`
- Verify frontend: `cd frontend && npm test -- --run src/features/mlb/league/MlbLeadersGrid.test.tsx src/features/mlb/league/MlbLeaderCategoryCard.test.tsx src/pages/MlbLeadersPage.test.tsx src/features/basketball/league/LeagueSubnav.test.tsx src/app/AppRouter.test.tsx && npm run check:api`

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_leaders.py` | Response models |
| `backend/app/domains/mlb/schemas.py` | Re-export leaders models |
| `backend/app/domains/mlb/leaders.py` | Normalize, fetch, cache |
| `backend/app/domains/mlb/routes.py` | `GET /mlb/leaders` |
| `backend/app/openapi_export.py` | Add `/api/mlb/leaders` to REQUIRED_MLB_PATHS |
| `backend/tests/fixtures/statsapi_mlb_leaders_*.json` | Upstream fixtures |
| `backend/tests/test_mlb_leaders_normalize.py` | Normalize unit tests |
| `backend/tests/test_mlb_leaders_route.py` | Route + 502 |
| `frontend/src/shared/lib/api.ts` | `fetchMlbLeaders` |
| `frontend/src/features/mlb/hooks/useMlbLeaders.ts` | React Query hook |
| `frontend/src/features/mlb/league/mlbTeamColors.ts` | Abbrev → hex |
| `frontend/src/features/mlb/league/MlbLeaderCategoryCard.tsx` | Card @ 18/14px |
| `frontend/src/features/mlb/league/MlbLeadersGrid.tsx` | Header + 12-card grid |
| `frontend/src/pages/MlbLeadersPage.tsx` | Page compose |
| `frontend/src/app/AppRouter.tsx` | Register route |
| `frontend/src/features/basketball/league/LeagueSubnav.tsx` | Enable MLB Leaders |
| OpenAPI artifacts + `md/system-design.md` + spec Status | Contract / docs |

---

### Task 1: Backend schemas + normalize

**Files:**
- Create: `backend/app/domains/mlb/schemas_leaders.py`
- Create: `backend/app/domains/mlb/leaders.py` (normalize + category specs; fetch later)
- Create: `backend/tests/fixtures/statsapi_mlb_leaders_hr.json` (minimal 2-leader HR payload)
- Create: `backend/tests/fixtures/statsapi_mlb_leaders_avg.json` (AVG with `.328` value)
- Create: `backend/tests/test_mlb_leaders_normalize.py`
- Modify: `backend/app/domains/mlb/schemas.py` (re-export)

**Interfaces:**
- Consumes: StatsAPI `leagueLeaders[0].leaders[]` objects + `team_id_to_abbrev: dict[int, str]`
- Produces:
  - `CATEGORY_SPECS` ordered list of `(key, label, stat, leaderCategories, statGroup)`
  - `normalize_category_payload(payload, *, key, label, stat, team_id_to_abbrev) -> MlbLeaderCategory`
  - `assemble_mlb_leaders(categories: list[MlbLeaderCategory], *, season: int) -> MlbLeadersResponse`
  - Models: `MlbLeaderRow`, `MlbLeaderCategory`, `MlbLeadersResponse`

- [ ] **Step 1: Write schemas**

```python
# backend/app/domains/mlb/schemas_leaders.py
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel

MlbLeaderCategoryKey = Literal[
    "avg", "hr", "rbi", "sb", "ops", "hits",
    "era", "whip", "so", "w", "sv", "ip",
]

class MlbLeaderRow(BaseModel):
    rank: int
    player_id: str
    name: str
    team_abbrev: str
    gp: int | None = None
    value: str

class MlbLeaderCategory(BaseModel):
    key: MlbLeaderCategoryKey
    label: str
    stat: str
    leaders: list[MlbLeaderRow]

class MlbLeadersResponse(BaseModel):
    season: int
    pace: Literal["season"] = "season"
    categories: list[MlbLeaderCategory]
```

Re-export from `schemas.py` like WNBA does for leaders models.

- [ ] **Step 2: Failing normalize tests**

```python
# backend/tests/test_mlb_leaders_normalize.py
import json
from pathlib import Path
from app.domains.mlb.leaders import CATEGORY_SPECS, normalize_category_payload, assemble_mlb_leaders

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {117: "HOU", 139: "TB"}

def test_category_specs_order_and_whip_key():
    keys = [c[0] for c in CATEGORY_SPECS]
    assert keys == [
        "avg", "hr", "rbi", "sb", "ops", "hits",
        "era", "whip", "so", "w", "sv", "ip",
    ]
    whip = next(c for c in CATEGORY_SPECS if c[0] == "whip")
    assert whip[3] == "walksAndHitsPerInningPitched"
    assert whip[4] == "pitching"
    for _k, _l, _s, _cat, group in CATEGORY_SPECS:
        assert group in ("hitting", "pitching")

def test_normalize_hr_maps_team_and_null_gp():
    payload = json.loads((FIXTURES / "statsapi_mlb_leaders_hr.json").read_text())
    cat = normalize_category_payload(
        payload, key="hr", label="Home Runs", stat="HR", team_id_to_abbrev=TEAM_MAP
    )
    assert cat.key == "hr"
    assert cat.leaders[0].name == "Yordan Alvarez"
    assert cat.leaders[0].team_abbrev == "HOU"
    assert cat.leaders[0].gp is None
    assert cat.leaders[0].value == "35"
    assert cat.leaders[0].player_id == "670541"

def test_normalize_preserves_avg_string():
    payload = json.loads((FIXTURES / "statsapi_mlb_leaders_avg.json").read_text())
    cat = normalize_category_payload(
        payload, key="avg", label="Batting Average", stat="AVG", team_id_to_abbrev=TEAM_MAP
    )
    assert cat.leaders[0].value == ".328"

def test_assemble_sets_pace_season():
    payload = json.loads((FIXTURES / "statsapi_mlb_leaders_hr.json").read_text())
    hr = normalize_category_payload(
        payload, key="hr", label="Home Runs", stat="HR", team_id_to_abbrev=TEAM_MAP
    )
    resp = assemble_mlb_leaders([hr], season=2026)
    assert resp.pace == "season"
    assert resp.season == 2026
```

Create HR fixture from live shape (2 leaders OK). Create AVG fixture with `"value": ".328"`.

- [ ] **Step 3: Run tests — expect FAIL**

`PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_leaders_normalize.py -v`

- [ ] **Step 4: Implement normalize in `leaders.py`**

```python
CATEGORY_SPECS: list[tuple[str, str, str, str, str]] = [
    ("avg", "Batting Average", "AVG", "battingAverage", "hitting"),
    ("hr", "Home Runs", "HR", "homeRuns", "hitting"),
    ("rbi", "RBI", "RBI", "runsBattedIn", "hitting"),
    ("sb", "Stolen Bases", "SB", "stolenBases", "hitting"),
    ("ops", "OPS", "OPS", "onBasePlusSlugging", "hitting"),
    ("hits", "Hits", "H", "hits", "hitting"),
    ("era", "ERA", "ERA", "earnedRunAverage", "pitching"),
    ("whip", "WHIP", "WHIP", "walksAndHitsPerInningPitched", "pitching"),
    ("so", "Strikeouts", "SO", "strikeouts", "pitching"),
    ("w", "Wins", "W", "wins", "pitching"),
    ("sv", "Saves", "SV", "saves", "pitching"),
    ("ip", "Innings Pitched", "IP", "inningsPitched", "pitching"),
]
TOP_N = 10

def normalize_category_payload(
    payload: dict,
    *,
    key: str,
    label: str,
    stat: str,
    team_id_to_abbrev: dict[int, str],
) -> MlbLeaderCategory:
    blocks = payload.get("leagueLeaders") or []
    raw_leaders = (blocks[0] or {}).get("leaders") or [] if blocks else []
    leaders: list[MlbLeaderRow] = []
    for entry in raw_leaders:
        if len(leaders) >= TOP_N:
            break
        person = entry.get("person") or {}
        team = entry.get("team") or {}
        pid = person.get("id")
        name = str(person.get("fullName") or "").strip()
        value = str(entry.get("value") or "").strip()
        try:
            rank = int(entry.get("rank"))
        except (TypeError, ValueError):
            continue
        if pid is None or not name or not value:
            continue
        tid = team.get("id")
        abbrev = team_id_to_abbrev.get(int(tid), "???") if tid is not None else "???"
        leaders.append(
            MlbLeaderRow(
                rank=rank,
                player_id=str(pid),
                name=name,
                team_abbrev=abbrev,
                gp=None,
                value=value,
            )
        )
    return MlbLeaderCategory(key=key, label=label, stat=stat, leaders=leaders)

def assemble_mlb_leaders(
    categories: list[MlbLeaderCategory], *, season: int
) -> MlbLeadersResponse:
    return MlbLeadersResponse(season=season, pace="season", categories=categories)
```

- [ ] **Step 5: Run normalize tests — PASS**

- [ ] **Step 6: Commit** (if user requested commits / at finish batch)

---

### Task 2: Backend fetch, cache, route, OpenAPI

**Files:**
- Modify: `backend/app/domains/mlb/leaders.py` (fetch + `get_mlb_leaders`)
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/app/openapi_export.py`
- Create: `backend/tests/test_mlb_leaders_route.py`
- Update: `backend/openapi-golden.json`, `frontend/openapi.json`, `api.schema.d.ts`
- Update: `md/system-design.md`

**Interfaces:**
- Produces: `async def get_mlb_leaders() -> MlbLeadersResponse`
- Route: `GET /api/mlb/leaders` → 200 / 502

- [ ] **Step 1: Failing route test** (mirror `test_wnba_leaders_route.py`)

Monkeypatch `get_mlb_leaders` to return a minimal `MlbLeadersResponse` with one empty category list or one category; assert 200 + `Cache-Control: no-store`. Second test: raise Exception → 502.

- [ ] **Step 2: Implement fetch + cache**

```python
LEADERS_URL = "https://statsapi.mlb.com/api/v1/stats/leaders"
TEAMS_URL = "https://statsapi.mlb.com/api/v1/teams"
STATS_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 10 * 60

def current_mlb_season_year() -> int:
    return datetime.now(ET).year

def leaders_request_params(leader_category: str, stat_group: str, season: int) -> dict[str, str | int]:
    return {
        "leaderCategories": leader_category,
        "statGroup": stat_group,  # required — never omit
        "season": season,
        "sportId": 1,
        "limit": TOP_N,
    }

async def fetch_team_abbrev_map(client: httpx.AsyncClient, season: int) -> dict[int, str]:
    res = await client.get(TEAMS_URL, params={"sportId": 1, "season": season})
    res.raise_for_status()
    out: dict[int, str] = {}
    for team in (res.json().get("teams") or []):
        tid = team.get("id")
        abbr = str(team.get("abbreviation") or "").strip().upper()
        if tid is not None and abbr:
            out[int(tid)] = abbr
    return out

async def fetch_category_payload(
    client: httpx.AsyncClient, leader_category: str, stat_group: str, season: int
) -> dict:
    res = await client.get(
        LEADERS_URL,
        params=leaders_request_params(leader_category, stat_group, season),
    )
    res.raise_for_status()
    return res.json()

async def get_mlb_leaders() -> MlbLeadersResponse:
    # Same lock + fresh/stale pattern as get_wnba_leaders
    # On miss: gather 12 category fetches + teams map concurrently
    # assemble in CATEGORY_SPECS order
    ...
```

Add unit test that `leaders_request_params(...)` includes `"statGroup"`.

- [ ] **Step 3: Wire route**

```python
@router.get("/mlb/leaders", response_model=MlbLeadersResponse)
async def mlb_leaders(response: Response) -> MlbLeadersResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_leaders()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB leaders unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB leaders are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
```

- [ ] **Step 4: OpenAPI**

Add `"/api/mlb/leaders"` to `REQUIRED_MLB_PATHS`. Export:

```bash
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

- [ ] **Step 5: system-design.md**

Add row for `/mlb/leaders` → `useMlbLeaders` → `GET /api/mlb/leaders` → StatsAPI leaders. Add to app tree if present.

- [ ] **Step 6: Run backend tests — PASS**

---

### Task 3: Frontend MLB leaders UI

**Files:**
- Create: `mlbTeamColors.ts`, `MlbLeaderCategoryCard.tsx` (+ test), `MlbLeadersGrid.tsx` (+ test)
- Create: `useMlbLeaders.ts` (+ optional test)
- Create: `pages/MlbLeadersPage.tsx` (+ test)
- Modify: `shared/lib/api.ts` — `fetchMlbLeaders`

**Interfaces:**
- `fetchMlbLeaders(): Promise<ApiMlbLeadersResponse>`
- `useMlbLeaders()` same shape as `useWnbaLeaders` (`data`, `isLoading`, `hasNeverLoaded`)

- [ ] **Step 1: `fetchMlbLeaders` + hook** (mirror WNBA)

```ts
export async function fetchMlbLeaders(): Promise<ApiMlbLeadersResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/leaders`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MLB leaders failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: `mlbTeamColors.ts`**

Hardcode 30 MLB abbrevs → brand hex (NYY, BOS, LAD, …). Export `teamColor(abbrev: string): string` with white/50 fallback.

- [ ] **Step 3: Card with typography**

```tsx
// MlbLeaderCategoryCard — no Link around name
<h3 className="mb-3 text-[18px] font-semibold tracking-tight text-white">{category.label}</h3>
<table className="w-full text-left text-[18px]">
  <thead>
    <tr className="text-[14px] tracking-wide text-white/35 uppercase">...</tr>
  </thead>
  <tbody>
    ...
    <td className="py-1.5 text-[14px] text-white/45">{row.gp ?? "—"}</td>
    <td className="py-1.5 text-right font-semibold text-white">{row.value}</td>
  </tbody>
</table>
```

Assert in test: category label / player use `text-[18px]`; header / attribution path uses `text-[14px]`; no `a[href*="/mlb/player"]`.

- [ ] **Step 4: Grid**

```tsx
<p className="mt-2 text-[14px] text-white/40">{season} season</p>
// 12 skeletons when loading
<p className="text-[14px] text-white/35">Data: statsapi.mlb.com</p>
```

Page title may keep `text-2xl sm:text-3xl`.

- [ ] **Step 5: `MlbLeadersPage`**

```tsx
export function MlbLeadersPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbLeaders();
  const season = data?.season ?? new Date().getFullYear();
  return (
    <div className="space-y-0">
      <LeagueSubnav league="mlb" />
      <MlbLeadersGrid
        season={season}
        categories={data?.categories ?? []}
        isLoading={isLoading && !data}
        isError={hasNeverLoaded}
      />
    </div>
  );
}
```

- [ ] **Step 6: Frontend tests — PASS**

---

### Task 4: Subnav, router, docs status

**Files:**
- Modify: `LeagueSubnav.tsx` — `if (item === "Leaders" && (league === "wnba" || league === "mlb")) return \`/${league}/leaders\`;`
- Modify: `LeagueSubnav.test.tsx` — MLB Leaders href `/mlb/leaders`
- Modify: `AppRouter.tsx` — `<Route path="/mlb/leaders" element={<MlbLeadersPage />} />`
- Modify: `AppRouter.test.tsx` — smoke fetch mock for `/api/mlb/leaders`
- Spec Status → Implemented

- [ ] **Step 1: Enable subnav + route**
- [ ] **Step 2: Tests PASS** (subnav + AppRouter + full verify commands in Global Constraints)
- [ ] **Step 3: Mark spec Implemented**
- [ ] **Step 4: Commit / finish branch per user**

---

## Spec coverage

| Requirement | Task |
| --- | --- |
| 12 categories + WHIP key + statGroup | 1–2 |
| Normalize + null gp + AVG string | 1 |
| Fetch/cache/route/502/OpenAPI | 2 |
| system-design row | 2 |
| MLB UI 18/14, no player links, attribution | 3 |
| Subnav + `/mlb/leaders` route | 4 |
| WNBA unchanged | 3–4 (no WNBA file edits except Subnav enable) |
