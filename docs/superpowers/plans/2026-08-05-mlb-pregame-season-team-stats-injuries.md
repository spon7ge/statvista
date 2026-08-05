# MLB Pregame Season Team Stats + Injuries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-merge season-to-date team stats (MLB Stats API) and injuries (ESPN) onto `GET /api/mlb/games/{gamePk}`, and render them under Projected lineups on MLB Preview even when RotoWire lineups are unavailable.

**Architecture:** Extend `MlbGameDetail` with `season_team_stats` and `injuries`. Fetch/normalize team season hitting+pitching via a new Stats provider helper (cached `teamId|season`). Soft-fetch ESPN summary once (reuse/extend the existing WP path) and map injuries like WNBA. Frontend maps new fields and renders `MlbSeasonTeamStats` + `MlbInjuryReport` below the lineup block inside the Preview stack.

**Tech Stack:** FastAPI/Pydantic/httpx, pytest, React/TypeScript, Vitest/RTL, openapi-typescript

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-mlb-pregame-season-team-stats-injuries-design.md`
- Parent UI: `docs/superpowers/specs/2026-08-04-mlb-projected-lineup-matchup-ui-design.md`
- Season YTD only — do not change live/final game `team_stats` / `MlbFinalTeamStats`
- Stat rows: `HR · R · H · AVG · OBP · SLG · ERA · SO · BB` (SO/BB = pitching)
- Leader: team-color dots; lower-better: `ERA`, `BB`; higher-better: all others including `SO`
- Soft-fail independently; never 502 Stats-backed detail for ESPN/season failures
- Show under Projected lineups even when lineups are unavailable
- Brand: **statvista** in any new product copy
- Update `md/system-design.md` when fields land on game detail

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/domains/mlb/schemas_game_detail.py` | `MlbSeasonTeamStatLine`, `MlbSeasonTeamStatsPair`, `MlbInjury`, `MlbInjuries`; fields on `MlbGameDetail` |
| `backend/app/domains/mlb/schemas.py` | Re-export new models |
| `backend/app/providers/mlb_stats/team_season.py` | Fetch + normalize team season hitting/pitching; in-memory cache |
| `backend/app/providers/espn/mlb_bridge.py` | `normalize_espn_mlb_injuries(summary, *, away_id, home_id)` provider-local shape |
| `backend/app/domains/mlb/game_detail.py` | Soft-merge season stats + injuries; reuse ESPN summary fetch with WP |
| `backend/tests/test_mlb_season_team_stats.py` | Provider + normalize unit tests |
| `backend/tests/test_espn_mlb_injuries.py` | ESPN injury normalize tests |
| `backend/tests/test_mlb_game_detail_season_injuries.py` | Soft-merge / attach tests |
| `backend/openapi-golden.json` + `frontend/openapi.json` + `api.schema.d.ts` | Regenerated contract |
| `frontend/src/features/mlb/lib/types.ts` | View types for season stats + injuries |
| `frontend/src/features/mlb/lib/mapMlbGameDetail.ts` | Map new API fields |
| `frontend/src/features/mlb/game/MlbSeasonTeamStats.tsx` | Season comparison UI |
| `frontend/src/features/mlb/game/MlbInjuryReport.tsx` | Two-column injuries UI |
| `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` | Stack: lineups → season stats → injuries |
| `md/system-design.md` | Page ↔ API note |

---

### Task 1: Pydantic schemas for season stats + injuries

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Test: `backend/tests/test_mlb_game_detail_schemas_season_injuries.py` (create)

**Interfaces:**
- Produces:
  - `MlbSeasonTeamStatLine(hr, r, h, avg, obp, slg, era, so, bb)` — ints/strs nullable as in spec
  - `MlbSeasonTeamStatsPair(away, home)`
  - `MlbInjury(name: str, position: str | None, status: str, detail: str | None)`
  - `MlbInjuries(away: list[MlbInjury], home: list[MlbInjury])`
  - `MlbGameDetail.season_team_stats: MlbSeasonTeamStatsPair | None = None`
  - `MlbGameDetail.injuries: MlbInjuries | None = None`

- [ ] **Step 1: Write failing schema smoke test**

```python
from app.domains.mlb.schemas_game_detail import (
    MlbInjuries,
    MlbInjury,
    MlbSeasonTeamStatLine,
    MlbSeasonTeamStatsPair,
)


def test_season_team_stat_line_round_trip():
    line = MlbSeasonTeamStatLine(
        hr=146, r=578, h=1003, avg=".261", obp=".339", slg=".430",
        era="3.71", so=1019, bb=350,
    )
    assert line.model_dump()["so"] == 1019


def test_injuries_round_trip():
    injuries = MlbInjuries(
        away=[MlbInjury(name="Dalton Rushing", position="C", status="10-Day IL", detail="Arm")],
        home=[],
    )
    assert injuries.away[0].detail == "Arm"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mlb_game_detail_schemas_season_injuries.py -v`  
Expected: FAIL (import / missing symbols)

- [ ] **Step 3: Add models + `MlbGameDetail` fields + `__all__` + `schemas.py` re-exports**

Add after `MlbTeamStatsPair` in `schemas_game_detail.py`:

```python
class MlbSeasonTeamStatLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    hr: int | None = None
    r: int | None = None
    h: int | None = None
    avg: str | None = None
    obp: str | None = None
    slg: str | None = None
    era: str | None = None
    so: int | None = None
    bb: int | None = None


class MlbSeasonTeamStatsPair(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: MlbSeasonTeamStatLine
    home: MlbSeasonTeamStatLine


class MlbInjury(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str
    position: str | None = None
    status: str
    detail: str | None = None


class MlbInjuries(BaseModel):
    model_config = _RESPONSE_CONFIG

    away: list[MlbInjury]
    home: list[MlbInjury]
```

On `MlbGameDetail`, after `team_stats`:

```python
    season_team_stats: MlbSeasonTeamStatsPair | None = None
    injuries: MlbInjuries | None = None
```

Update `__all__` and `schemas.py` imports/`__all__` accordingly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mlb_game_detail_schemas_season_injuries.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_game_detail.py backend/app/domains/mlb/schemas.py backend/tests/test_mlb_game_detail_schemas_season_injuries.py
git commit -m "feat(mlb): add season team stats and injuries schemas"
```

---

### Task 2: Stats API team season helper

**Files:**
- Create: `backend/app/providers/mlb_stats/team_season.py`
- Test: `backend/tests/test_mlb_season_team_stats.py`

**Interfaces:**
- Consumes: httpx; Stats `GET /api/v1/teams/{teamId}/stats?stats=season&group={hitting|pitching}&season={year}&sportIds=1`
- Produces:
  - `async def fetch_team_season_stat_line(client, team_id: int, season: int) -> dict` — keys matching `MlbSeasonTeamStatLine` field names (values may be None)
  - `async def fetch_season_team_stats_pair(client, *, away_team_id: int, home_team_id: int, season: int) -> MlbSeasonTeamStatsPair | None`
  - In-memory cache keyed `f"{team_id}|{season}"`, TTL 900 seconds
  - Soft-fail: return empty/partial dict on HTTP errors; pair `None` if both sides entirely empty

- [ ] **Step 1: Write failing tests with mocked httpx responses**

```python
import respx
import httpx
from app.providers.mlb_stats.team_season import (
    clear_team_season_cache,
    fetch_team_season_stat_line,
    parse_hitting_split,
    parse_pitching_split,
)


def test_parse_hitting_and_pitching_splits():
    hitting = {"homeRuns": 146, "runs": 578, "hits": 1003, "avg": ".261", "obp": ".339", "slg": ".430"}
    pitching = {"era": "3.71", "strikeOuts": 1019, "baseOnBalls": 350}
    h = parse_hitting_split(hitting)
    p = parse_pitching_split(pitching)
    assert h["hr"] == 146 and p["so"] == 1019 and p["bb"] == 350


@respx.mock
async def test_fetch_team_season_stat_line_merges_groups():
    clear_team_season_cache()
    team_id = 119
    season = 2026
    respx.get(url__regex=r".*/teams/119/stats.*group=hitting.*").mock(
        return_value=httpx.Response(200, json={
            "stats": [{"splits": [{"stat": {
                "homeRuns": 1, "runs": 2, "hits": 3, "avg": ".200", "obp": ".300", "slg": ".400"
            }}]}]
        })
    )
    respx.get(url__regex=r".*/teams/119/stats.*group=pitching.*").mock(
        return_value=httpx.Response(200, json={
            "stats": [{"splits": [{"stat": {
                "era": "4.00", "strikeOuts": 10, "baseOnBalls": 5
            }}]}]
        })
    )
    async with httpx.AsyncClient() as client:
        line = await fetch_team_season_stat_line(client, team_id, season)
    assert line["hr"] == 1 and line["era"] == "4.00" and line["so"] == 10
```

(If the project prefers `unittest.mock` over `respx`, match existing `test_mlb_stats_people.py` style.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mlb_season_team_stats.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement `team_season.py`**

```python
# Key pieces (illustrative — match project typing/logging style):
STATS_BASE = "https://statsapi.mlb.com/api/v1"
TEAM_SEASON_TTL_SECONDS = 900.0

def parse_hitting_split(stat: dict) -> dict: ...
def parse_pitching_split(stat: dict) -> dict: ...

async def _fetch_group(client, team_id: int, season: int, group: str) -> dict:
    res = await client.get(
        f"{STATS_BASE}/teams/{team_id}/stats",
        params={"stats": "season", "group": group, "season": season, "sportIds": 1},
    )
    res.raise_for_status()
    splits = (res.json().get("stats") or [{}])[0].get("splits") or []
    return (splits[0].get("stat") or {}) if splits else {}

async def fetch_team_season_stat_line(client, team_id: int, season: int) -> dict:
    # cache check → fetch hitting + pitching → merge → store
    ...
```

Map Stats keys: `homeRuns→hr`, `runs→r`, `hits→h`, `avg/obp/slg` as strings, `era` string, `strikeOuts→so`, `baseOnBalls→bb`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_mlb_season_team_stats.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/mlb_stats/team_season.py backend/tests/test_mlb_season_team_stats.py
git commit -m "feat(mlb): fetch and cache team season hitting/pitching stats"
```

---

### Task 3: ESPN MLB injuries normalize

**Files:**
- Modify: `backend/app/providers/espn/mlb_bridge.py`
- Test: `backend/tests/test_espn_mlb_injuries.py`

**Interfaces:**
- Consumes: ESPN summary `injuries` blocks (same shape as WNBA)
- Produces:
  - `@dataclass EspnInjury(name, position, status, detail)`
  - `@dataclass EspnInjuries(away: list[EspnInjury], home: list[EspnInjury])`
  - `normalize_espn_mlb_injuries(summary: dict, *, away_espn_team_id: str, home_espn_team_id: str) -> EspnInjuries | None`
  - Returns `None` when both sides empty or `injuries` missing

- [ ] **Step 1: Write failing normalize test**

```python
from app.providers.espn.mlb_bridge import normalize_espn_mlb_injuries

SUMMARY = {
    "injuries": [
        {
            "team": {"id": "19"},
            "injuries": [
                {
                    "status": "10-Day IL",
                    "athlete": {"displayName": "Dalton Rushing", "position": {"abbreviation": "C"}},
                    "details": {"type": "Arm"},
                }
            ],
        },
        {"team": {"id": "16"}, "injuries": []},
    ]
}


def test_normalize_espn_mlb_injuries():
    result = normalize_espn_mlb_injuries(
        SUMMARY, away_espn_team_id="19", home_espn_team_id="16"
    )
    assert result is not None
    assert result.away[0].name == "Dalton Rushing"
    assert result.away[0].status == "10-Day IL"
    assert result.away[0].detail == "Arm"
    assert result.home == []


def test_normalize_espn_mlb_injuries_none_when_empty():
    assert normalize_espn_mlb_injuries(
        {"injuries": [{"team": {"id": "1"}, "injuries": []}, {"team": {"id": "2"}, "injuries": []}]},
        away_espn_team_id="1",
        home_espn_team_id="2",
    ) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_espn_mlb_injuries.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement normalize helpers in `mlb_bridge.py`**

Mirror WNBA `_injuries_for_team` / `_normalize_injuries` logic using provider dataclasses (do not import domain schemas into providers).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/espn/mlb_bridge.py backend/tests/test_espn_mlb_injuries.py
git commit -m "feat(espn): normalize MLB summary injuries"
```

---

### Task 4: Soft-merge onto game detail

**Files:**
- Modify: `backend/app/domains/mlb/game_detail.py`
- Test: `backend/tests/test_mlb_game_detail_season_injuries.py`

**Interfaces:**
- Consumes: `fetch_team_season_stat_line` / pair helper; `normalize_espn_mlb_injuries`; existing `fetch_espn_mlb_summary` / `resolve_espn_event_id`
- Produces:
  - `attach_season_team_stats(detail, pair) -> MlbGameDetail`
  - `attach_injuries(detail, injuries) -> MlbGameDetail`
  - Refactor `_attach_espn_win_probability` into a soft-merge that:
    1. Resolves ESPN event id
    2. Fetches summary once
    3. Attaches WP when present
    4. Maps injuries using ESPN competitor team ids from summary header (`_competitor_team_ids` pattern from WNBA — add helper in bridge or game_detail)
  - `_attach_season_team_stats(detail)` runs when `detail.status == "scheduled"` (skip on live/final to protect poll latency; cache still helps if later expanded)
  - Soft-fail each path independently; log warnings

- [ ] **Step 1: Write failing attach / soft-fail tests**

```python
import pytest
from app.domains.mlb.game_detail import attach_injuries, attach_season_team_stats
from app.domains.mlb.schemas_game_detail import (
    MlbInjuries,
    MlbInjury,
    MlbSeasonTeamStatLine,
    MlbSeasonTeamStatsPair,
)


def test_attach_season_team_stats(sample_scheduled_detail):
    pair = MlbSeasonTeamStatsPair(
        away=MlbSeasonTeamStatLine(hr=1),
        home=MlbSeasonTeamStatLine(hr=2),
    )
    out = attach_season_team_stats(sample_scheduled_detail, pair)
    assert out.season_team_stats is not None
    assert out.season_team_stats.home.hr == 2


def test_attach_injuries(sample_scheduled_detail):
    injuries = MlbInjuries(
        away=[MlbInjury(name="A", position="P", status="IL", detail=None)],
        home=[],
    )
    out = attach_injuries(sample_scheduled_detail, injuries)
    assert out.injuries is not None
    assert out.injuries.away[0].name == "A"
```

Reuse or build a minimal `MlbGameDetail` fixture like other game_detail tests. Add async tests that mock ESPN/Stats failures and assert detail still returns without raising.

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement attach helpers + wire into `get_mlb_game_detail`**

After normalize + last10 (scheduled):

```python
    if detail.status == "scheduled":
        try:
            detail = await _attach_season_team_stats(detail)
        except Exception as exc:
            logger.warning("season team stats unavailable for %s: %s", detail.mlb_game_pk, exc)

    detail, espn_event_id = await _attach_espn_summary_enrichment(
        detail, payload, cached_espn_event_id=cached_espn_event_id
    )
```

Inside ESPN enrichment: one summary fetch → WP + injuries. Map `EspnInjuries` → `MlbInjuries` at the domain boundary (same pattern as `_to_mlb_win_probability`).

Extract ESPN away/home team ids from summary header competitors (not Stats team ids — ESPN ids differ).

- [ ] **Step 4: Run tests — expect PASS**

Also run a quick regression: `cd backend && python -m pytest tests/test_mlb_game_detail_normalize.py tests/test_mlb_game_detail_season_injuries.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/game_detail.py backend/tests/test_mlb_game_detail_season_injuries.py
git commit -m "feat(mlb): soft-merge season team stats and injuries onto game detail"
```

---

### Task 5: OpenAPI golden + frontend schema regen

**Files:**
- Modify: `backend/openapi-golden.json`
- Modify: `frontend/openapi.json`
- Modify: `frontend/src/shared/lib/api.schema.d.ts`
- Docs: `md/system-design.md` (row for `/mlb/games/:gamePk`)

**Interfaces:**
- Produces: OpenAPI components include `MlbSeasonTeamStatLine`, `MlbInjuries`, etc. on `MlbGameDetail`

- [ ] **Step 1: Export OpenAPI**

```bash
cd backend && PYTHONPATH=. python -c "from app.openapi_export import export_openapi; print(export_openapi())"
# Also update golden if CI diffs against backend/openapi-golden.json — copy or project script:
cp ../frontend/openapi.json openapi-golden.json   # only if that is the repo convention; else follow existing golden update path from recent PRs
```

Verify how golden is updated in this repo (often `backend/openapi-golden.json` is the committed snapshot of the export). Match the pattern from recent MLB commits.

- [ ] **Step 2: Regenerate TS types**

```bash
cd frontend && npm run generate:api
```

- [ ] **Step 3: Update `md/system-design.md`**

Extend the `/mlb/games/:gamePk` row to note Preview season team stats (Stats API) + injuries (ESPN) soft-merged on detail, rendered under projected lineups.

- [ ] **Step 4: Commit**

```bash
git add backend/openapi-golden.json frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts md/system-design.md
git commit -m "chore: export OpenAPI for MLB season stats and injuries"
```

---

### Task 6: Frontend mapper + view types

**Files:**
- Modify: `frontend/src/features/mlb/lib/types.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts`
- Modify: `frontend/src/features/mlb/lib/testFixtures.ts` (add null defaults)

**Interfaces:**
- Produces on `MlbGameDetailView`:
  - `seasonTeamStats: { away: MlbSeasonTeamStatLine; home: MlbSeasonTeamStatLine } | null`
  - `injuries: { away: MlbInjury[]; home: MlbInjury[] } | null`
  - `MlbSeasonTeamStatLine` with `hr,r,h,avg,obp,slg,era,so,bb`
  - `MlbInjury` with `name, position, status, detail`

- [ ] **Step 1: Write failing mapper test**

```typescript
it("maps season_team_stats and injuries", () => {
  const view = mapMlbGameDetail({
    ...baseApiDetail,
    season_team_stats: {
      away: { hr: 1, r: 2, h: 3, avg: ".200", obp: ".300", slg: ".400", era: "4.00", so: 10, bb: 5 },
      home: { hr: 2, r: 3, h: 4, avg: ".250", obp: ".350", slg: ".450", era: "3.50", so: 12, bb: 4 },
    },
    injuries: {
      away: [{ name: "A", position: "P", status: "IL", detail: "Arm" }],
      home: [],
    },
  });
  expect(view.seasonTeamStats?.away.hr).toBe(1);
  expect(view.injuries?.away[0].name).toBe("A");
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npx vitest run src/features/mlb/lib/mapMlbGameDetail.test.ts`

- [ ] **Step 3: Add types + mapping**

```typescript
seasonTeamStats: detail.season_team_stats
  ? {
      away: mapSeasonTeamStatLine(detail.season_team_stats.away),
      home: mapSeasonTeamStatLine(detail.season_team_stats.home),
    }
  : null,
injuries: detail.injuries
  ? {
      away: detail.injuries.away.map((i) => ({
        name: i.name,
        position: i.position ?? null,
        status: i.status,
        detail: i.detail ?? null,
      })),
      home: detail.injuries.home.map((i) => ({ /* same */ })),
    }
  : null,
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/lib/types.ts frontend/src/features/mlb/lib/mapMlbGameDetail.ts frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts frontend/src/features/mlb/lib/testFixtures.ts
git commit -m "feat(mlb): map season team stats and injuries on game detail view"
```

---

### Task 7: `MlbSeasonTeamStats` UI

**Files:**
- Create: `frontend/src/features/mlb/game/MlbSeasonTeamStats.tsx`
- Create: `frontend/src/features/mlb/game/MlbSeasonTeamStats.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView`
- Produces: section `data-testid="mlb-season-team-stats"`; hide when `seasonTeamStats` null
- Rows in order: HR, R, H, AVG, OBP, SLG, ERA, SO, BB
- Leader dots: team color; `lowerIsBetter` for ERA and BB
- Reuse layout patterns from `MlbFinalTeamStats.tsx` (logos, grid, mono numbers) but **do not** share game-stat keys (`k`/`sb`/`lob`)

- [ ] **Step 1: Write failing component tests**

```tsx
it("highlights ERA leader as lower-better", () => {
  render(<MlbSeasonTeamStats detail={detailWithSeasonStats} />);
  expect(screen.getByTestId("mlb-season-team-stats")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-season-stat-era-away")).toBeInTheDocument(); // away has lower ERA
});

it("hides when seasonTeamStats is null", () => {
  render(<MlbSeasonTeamStats detail={{ ...detail, seasonTeamStats: null }} />);
  expect(screen.queryByTestId("mlb-season-team-stats")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbSeasonTeamStats.test.tsx`

- [ ] **Step 3: Implement component**

Mirror `MlbFinalTeamStats` structure with `STAT_DEFINITIONS` for season keys and `data-testid={`mlb-season-stat-${key}-${side}`}`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbSeasonTeamStats.tsx frontend/src/features/mlb/game/MlbSeasonTeamStats.test.tsx
git commit -m "feat(mlb): add season team stats comparison for pregame"
```

---

### Task 8: `MlbInjuryReport` UI

**Files:**
- Create: `frontend/src/features/mlb/game/MlbInjuryReport.tsx`
- Create: `frontend/src/features/mlb/game/MlbInjuryReport.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView`
- Produces: `data-testid="mlb-injury-report"`; mirror basketball `InjuryReport` behavior (None listed, hide when null / both empty already null from API)
- Title: **Injuries** (match screenshot)

- [ ] **Step 1: Write failing tests**

```tsx
it("renders away and home injuries", () => {
  render(<MlbInjuryReport detail={detailWithInjuries} />);
  expect(screen.getByTestId("mlb-injury-report")).toBeInTheDocument();
  expect(screen.getByText("Dalton Rushing")).toBeInTheDocument();
});

it("shows None listed for empty side", () => {
  // away has rows, home empty
  expect(screen.getByText("None listed")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** (adapt `frontend/src/features/basketball/game/InjuryReport.tsx` to MLB types/colors)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbInjuryReport.tsx frontend/src/features/mlb/game/MlbInjuryReport.test.tsx
git commit -m "feat(mlb): add pregame injury report"
```

---

### Task 9: Wire under Projected lineups

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.test.tsx` (if needed)

**Interfaces:**
- `MlbProjectedLineups` returns a stack:
  1. Existing lineups `GameSection` (`data-testid="mlb-projected-lineups"`, keep `sm:w-1/2`)
  2. Full-width `MlbSeasonTeamStats`
  3. Full-width `MlbInjuryReport`
- Wrapper: `div.space-y-4` with `data-testid="mlb-projected-lineups-stack"`
- When lineups unavailable / loading, still render stats + injuries below the message

- [ ] **Step 1: Write failing integration assertions**

```tsx
it("renders season stats and injuries under lineups when unavailable", () => {
  render(
    <MlbProjectedLineups
      detail={{ ...mlbScheduledDetail, seasonTeamStats: pair, injuries }}
      game={null}
    />,
  );
  expect(screen.getByText("Lineups unavailable")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-season-team-stats")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-injury-report")).toBeInTheDocument();
});
```

Update fixtures so `mlbScheduledDetail` includes `seasonTeamStats: null` / `injuries: null` by default; override in this test.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement stack in `MlbProjectedLineups`**

```tsx
return (
  <div className="space-y-4" data-testid="mlb-projected-lineups-stack">
    <GameSection className="w-full !p-3 sm:w-1/2" data-testid="mlb-projected-lineups">
      {/* existing header + lineup / loading / unavailable */}
    </GameSection>
    <MlbSeasonTeamStats detail={detail} />
    <MlbInjuryReport detail={detail} />
  </div>
);
```

- [ ] **Step 4: Run projected + pregame tests — expect PASS**

```bash
cd frontend && npx vitest run src/features/mlb/game/MlbProjectedLineups.test.tsx src/features/mlb/game/MlbPregameCenter.test.tsx src/features/mlb/game/MlbSeasonTeamStats.test.tsx src/features/mlb/game/MlbInjuryReport.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbProjectedLineups.tsx frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx frontend/src/features/mlb/game/MlbPregameCenter.test.tsx
git commit -m "feat(mlb): show season stats and injuries under projected lineups"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Season YTD stats via Stats API | 2, 4 |
| ESPN injuries | 3, 4 |
| Soft-merge on game detail | 4 |
| Always under projected lineups | 9 |
| Independent of RotoWire gate | 9 |
| Team-color dots; ERA/BB lower-better | 7 |
| Rows HR R H AVG OBP SLG ERA SO BB | 7 |
| Hide null sections; None listed | 7, 8 |
| Live/final `MlbFinalTeamStats` unchanged | (no task touches it) |
| OpenAPI + system-design | 5 |
| Soft-fail never 502 | 2, 3, 4 |

No intentional placeholders left; BB lower-better is explicit in Task 7.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-05-mlb-pregame-season-team-stats-injuries.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

Which approach?
