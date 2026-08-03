# MLB Live Game Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/mlb/games/:gamePk` stub with a live-only game center powered by MLB Stats live feed + ESPN win probability, in HoopVista quiet theme.

**Architecture:** `GET /api/mlb/games/{gamePk}` normalizes Stats `feed/live` (linescore, situation, pitches, plays, box, hits) and soft-merges ESPN MLB summary winprobability via a date+teams bridge. Frontend `MlbGameDetailPage` polls while live; not-live games get a thin status shell.

**Tech Stack:** FastAPI · Pydantic · httpx · React 19 · TypeScript · TanStack Query · Vitest · pytest · openapi-typescript · SVG charts

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-mlb-live-game-detail-design.md`
- Coding standards: `CLAUDE.md`
- Route key: Stats `gamePk` (digits); keep `/mlb/games/:gamePk`
- Live panels only when `status === "live"`; scheduled/final → thin page
- ESPN soft-fail: never 502 a successful Stats payload
- Theme: `GAME_SECTION_SURFACE`, red live accent only, white mono scores, no milestones/RE288
- Response always `Cache-Control: no-store`
- Poll: `18_000` ms while live; stop otherwise
- Do not modify WNBA `components/game/*` behavior (shared `GAME_SECTION_SURFACE` import OK)
- Verify backend: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail* backend/tests/test_export_openapi.py -v`
- Verify frontend: `cd frontend && npx vitest run src/hooks/useMlbGameDetail.test.tsx src/pages/MlbGameDetailPage.test.tsx src/components/mlb src/AppRouter.test.tsx && npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/schemas/mlb_game_detail.py` | Pydantic response models |
| `backend/app/services/mlb_game_detail.py` | Fetch live feed, normalize, cache, orchestrate ESPN merge |
| `backend/app/services/mlb_espn_bridge.py` | Resolve ESPN event id + normalize winprobability |
| `backend/app/api/routes/mlb_game_detail.py` | Thin HTTP route |
| `backend/app/main.py` | Mount router |
| `backend/app/openapi_export.py` | Add `/api/mlb/games/{game_pk}` |
| `backend/tests/fixtures/mlb_statsapi_live_feed.json` | Trimmed live feed |
| `backend/tests/fixtures/espn_mlb_summary_wp.json` | Trimmed ESPN summary with winprobability |
| `backend/tests/test_mlb_game_detail_normalize.py` | Stats normalize tests |
| `backend/tests/test_mlb_espn_bridge.py` | Bridge + WP merge / soft-fail |
| `backend/tests/test_mlb_game_detail_route.py` | Route / cache / errors |
| `frontend/openapi.json` + `api.schema.d.ts` | Regenerated |
| `frontend/src/lib/api.ts` | `fetchMlbGameDetail` |
| `frontend/src/hooks/useMlbGameDetail.ts` | Query + live poll |
| `frontend/src/components/mlb/*` | UI components + mapper |
| `frontend/src/pages/MlbGameDetailPage.tsx` | Page compose |
| `frontend/src/AppRouter.tsx` | Wire page; remove stub |
| `docs/superpowers/specs/2026-08-02-website-api-system-design.md` | Map route → API |

---

### Task 1: MLB game detail Pydantic schemas

**Files:**
- Create: `backend/app/schemas/mlb_game_detail.py`
- Create: `backend/tests/test_mlb_game_detail_schema.py`

**Interfaces:**
- Produces models listed below (all with `model_config = ConfigDict(json_schema_serialization_defaults_required=True)` where other MLB schemas do)
- Consumes: `GameStatus` from `app.schemas.mlb_scoreboard` (or `wnba_scoreboard` if MLB re-exports the same Literal)

```python
# Exact field contracts for later tasks:

class MlbGameDetailTeam(BaseModel):
    id: str
    abbrev: str
    name: str
    score: int | None
    color: str
    logo_url: str | None = None

class MlbLinescoreInning(BaseModel):
    num: int
    away_runs: int | None
    home_runs: int | None

class MlbLinescoreTotals(BaseModel):
    runs: int
    hits: int
    errors: int

class MlbLinescore(BaseModel):
    innings: list[MlbLinescoreInning]
    away: MlbLinescoreTotals
    home: MlbLinescoreTotals
    current_inning: int | None
    inning_half: Literal["top", "bottom"] | None

class MlbPlayerCard(BaseModel):
    name: str
    hand: str | None = None
    summary: str | None = None

class MlbPitch(BaseModel):
    number: int
    type: str | None
    mph: float | None
    result: str | None
    is_strike: bool
    zone_x: float | None
    zone_y: float | None

class MlbRunners(BaseModel):
    first: bool
    second: bool
    third: bool

class MlbSituation(BaseModel):
    balls: int
    strikes: int
    outs: int
    runners: MlbRunners
    at_bat: MlbPlayerCard | None
    on_deck: MlbPlayerCard | None
    pitching: MlbPlayerCard | None
    pitches: list[MlbPitch]
    latest_play_text: str | None = None

class MlbPlay(BaseModel):
    id: str
    inning: int
    half: Literal["top", "bottom"]
    text: str
    scoring: bool
    away_score: int
    home_score: int
    event: str | None = None

class MlbBatterRow(BaseModel):
    order: int | None
    name: str
    position: str | None
    ab: int | None
    r: int | None
    h: int | None
    rbi: int | None
    bb: int | None
    so: int | None

class MlbPitcherRow(BaseModel):
    name: str
    ip: str | None
    h: int | None
    r: int | None
    er: int | None
    bb: int | None
    k: int | None
    pitches: int | None

class MlbBoxScore(BaseModel):
    away_batters: list[MlbBatterRow]
    home_batters: list[MlbBatterRow]
    away_pitchers: list[MlbPitcherRow]
    home_pitchers: list[MlbPitcherRow]

class MlbHitPoint(BaseModel):
    id: str
    team: Literal["away", "home"]
    result: Literal["hr", "hit", "out"]
    x: float
    y: float
    player_name: str | None = None

class MlbWinProbabilityPoint(BaseModel):
    play_id: str
    label: str
    home_win_pct: float  # 0.0–1.0

class MlbWinProbabilityStakes(BaseModel):
    home_win_delta: float
    label: str

class MlbWinProbability(BaseModel):
    home_abbrev: str
    away_abbrev: str
    points: list[MlbWinProbabilityPoint]
    stakes: MlbWinProbabilityStakes | None = None

class MlbGameDetail(BaseModel):
    mlb_game_pk: str
    league: Literal["mlb"] = "mlb"
    status: GameStatus
    status_label: str
    venue: str | None
    away: MlbGameDetailTeam
    home: MlbGameDetailTeam
    linescore: MlbLinescore | None = None
    situation: MlbSituation | None = None
    plays: list[MlbPlay] = []
    scoring_plays: list[MlbPlay] = []
    box_score: MlbBoxScore | None = None
    hit_chart: list[MlbHitPoint] = []
    win_probability: MlbWinProbability | None = None
    sources: list[str]
    fetched_at: str
```

- [ ] **Step 1: Write the failing schema smoke test**

```python
# backend/tests/test_mlb_game_detail_schema.py
from app.schemas.mlb_game_detail import MlbGameDetail, MlbGameDetailTeam

def test_mlb_game_detail_minimal_construct():
    team = MlbGameDetailTeam(
        id="111", abbrev="BOS", name="Boston Red Sox", score=1, color="#BD3039"
    )
    detail = MlbGameDetail(
        mlb_game_pk="776543",
        status="live",
        status_label="Top 1st",
        venue="Fenway Park",
        away=team,
        home=team.model_copy(update={"id": "119", "abbrev": "LAD", "name": "Los Angeles Dodgers", "color": "#005A9C"}),
        sources=["mlb_stats_api"],
        fetched_at="2026-08-02T18:00:00+00:00",
    )
    assert detail.league == "mlb"
    assert detail.win_probability is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_schema.py -v`

Expected: FAIL (`ModuleNotFoundError` or import error)

- [ ] **Step 3: Implement schemas**

Create `backend/app/schemas/mlb_game_detail.py` with the models above. Reuse `GameStatus` from `app.schemas.mlb_scoreboard`. Export names in `__all__`.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_schema.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/mlb_game_detail.py backend/tests/test_mlb_game_detail_schema.py
git commit -m "feat(mlb): add live game detail Pydantic schemas"
```

---

### Task 2: Normalize Stats API live feed

**Files:**
- Create: `backend/app/services/mlb_game_detail.py` (normalize helpers only first)
- Create: `backend/tests/fixtures/mlb_statsapi_live_feed.json`
- Create: `backend/tests/test_mlb_game_detail_normalize.py`

**Interfaces:**
- Consumes: schemas from Task 1
- Produces: `def normalize_mlb_live_feed(payload: dict, *, game_pk: str, fetched_at: str) -> MlbGameDetail`
  - Always sets `sources=["mlb_stats_api"]` and `win_probability=None`
  - Maps status per spec (in-progress → `live`; final → `final`; else `scheduled`)

- [ ] **Step 1: Add trimmed fixture + failing normalize tests**

Create `backend/tests/fixtures/mlb_statsapi_live_feed.json` from a real Stats live feed (or hand-build) including at least:
- `gameData.teams.away/home` (id, abbreviation, name, teamColors or similar)
- `gameData.venue.name`
- `gameData.datetime` / official date
- `liveData.linescore` (innings, teams totals, currentInning, inningHalf, balls, strikes, outs, offense runners)
- `liveData.plays.currentPlay` (matchup batter/pitcher, playEvents pitches with details + pitchData coordinates)
- `liveData.plays.allPlays` (at least one scoring + one non-scoring)
- `liveData.boxscore.teams.away/home.batters` + `players` map with stats
- Hit coordinates on at least one play (`hitData.coordinates`)

```python
# backend/tests/test_mlb_game_detail_normalize.py
import json
from pathlib import Path
from app.services.mlb_game_detail import normalize_mlb_live_feed

FIXTURES = Path(__file__).parent / "fixtures"

def _payload():
    return json.loads((FIXTURES / "mlb_statsapi_live_feed.json").read_text())

def test_normalize_live_status_and_linescore():
    detail = normalize_mlb_live_feed(_payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00")
    assert detail.mlb_game_pk == "776543"
    assert detail.status == "live"
    assert detail.linescore is not None
    assert detail.linescore.away.runs >= 0
    assert detail.sources == ["mlb_stats_api"]
    assert detail.win_probability is None

def test_normalize_situation_and_pitches():
    detail = normalize_mlb_live_feed(_payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00")
    assert detail.situation is not None
    assert detail.situation.outs >= 0
    assert len(detail.situation.pitches) >= 1

def test_normalize_plays_box_and_hits():
    detail = normalize_mlb_live_feed(_payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00")
    assert len(detail.plays) >= 1
    assert any(p.scoring for p in detail.scoring_plays) or len(detail.scoring_plays) >= 0
    assert detail.box_score is not None
    assert len(detail.box_score.away_batters) + len(detail.box_score.home_batters) >= 1
```

If the fixture is hard to obtain live, fetch once during implementation:

```bash
curl -sS "https://statsapi.mlb.com/api/v1.1/game/{LIVE_OR_RECENT_PK}/feed/live" | head -c 200000 > /tmp/live.json
# Trim to needed keys; commit under fixtures/
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -v`

Expected: FAIL (function missing)

- [ ] **Step 3: Implement `normalize_mlb_live_feed`**

In `mlb_game_detail.py`:
- Parse teams, venue, status
- Build linescore from `liveData.linescore`
- Build situation from linescore count + `currentPlay` matchup + pitch events (`isPitch`, `details.isStrike` / call codes, `pitchData.coordinates.x/y` — normalize to a stable zone space documented in a short comment)
- Plays from `allPlays`: `about.inning`, `about.halfInning`, `result.description`, `about.isScoringPlay`, `result.eventType` / `event`
- Box from `boxscore` batting/pitching tables
- Hit chart: plays with `hitData.coordinates` → map result (`home_run`→`hr`, hit types→`hit`, else `out`); team away/home from batting team
- Fallback team colors: away `#BD3039`, home `#1D4ED8` (not purple)
- Logo: reuse `https://www.mlbstatic.com/team-logos/{id}.svg` like scoreboard

Keep functions small: `_map_status`, `_linescore`, `_situation`, `_plays`, `_box`, `_hits`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mlb_game_detail.py backend/tests/fixtures/mlb_statsapi_live_feed.json backend/tests/test_mlb_game_detail_normalize.py
git commit -m "feat(mlb): normalize Stats API live feed for game detail"
```

---

### Task 3: ESPN bridge + win probability merge

**Files:**
- Create: `backend/app/services/mlb_espn_bridge.py`
- Create: `backend/tests/fixtures/espn_mlb_summary_wp.json`
- Create: `backend/tests/fixtures/espn_mlb_scoreboard_day.json` (minimal events list)
- Create: `backend/tests/test_mlb_espn_bridge.py`
- Modify: `backend/app/services/mlb_game_detail.py` (attach WP helper)

**Interfaces:**
- Produces:
  - `async def resolve_espn_event_id(*, date_et: str, away_abbrev: str, home_abbrev: str, client: httpx.AsyncClient | None = None) -> str | None`
  - `def normalize_espn_mlb_win_probability(summary: dict, *, home_abbrev: str, away_abbrev: str) -> MlbWinProbability | None`
  - `def attach_win_probability(detail: MlbGameDetail, wp: MlbWinProbability | None) -> MlbGameDetail` — copies detail with `win_probability` set and `sources` including `"espn"` when wp present
- ESPN scoreboard URL: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={YYYYMMDD}`
- ESPN summary URL: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={id}`

- [ ] **Step 1: Write failing bridge tests**

```python
# backend/tests/test_mlb_espn_bridge.py
import json
from pathlib import Path
from app.services.mlb_espn_bridge import (
    match_espn_event_id,
    normalize_espn_mlb_win_probability,
)
from app.services.mlb_game_detail import attach_win_probability, normalize_mlb_live_feed

FIXTURES = Path(__file__).parent / "fixtures"

def test_match_espn_event_id_by_abbrevs():
    board = json.loads((FIXTURES / "espn_mlb_scoreboard_day.json").read_text())
    eid = match_espn_event_id(board, away_abbrev="BOS", home_abbrev="LAD")
    assert eid == "401696123"  # use id from fixture

def test_normalize_win_probability_points_and_stakes():
    summary = json.loads((FIXTURES / "espn_mlb_summary_wp.json").read_text())
    wp = normalize_espn_mlb_win_probability(summary, home_abbrev="LAD", away_abbrev="BOS")
    assert wp is not None
    assert len(wp.points) >= 2
    assert wp.stakes is not None
    assert wp.home_abbrev == "LAD"

def test_attach_win_probability_adds_espn_source():
    detail = normalize_mlb_live_feed(
        json.loads((FIXTURES / "mlb_statsapi_live_feed.json").read_text()),
        game_pk="776543",
        fetched_at="2026-08-02T18:00:00+00:00",
    )
    summary = json.loads((FIXTURES / "espn_mlb_summary_wp.json").read_text())
    wp = normalize_espn_mlb_win_probability(summary, home_abbrev=detail.home.abbrev, away_abbrev=detail.away.abbrev)
    merged = attach_win_probability(detail, wp)
    assert merged.win_probability is not None
    assert "espn" in merged.sources
    assert "mlb_stats_api" in merged.sources
```

Fixture `espn_mlb_summary_wp.json` needs a `winprobability` array with `homeWinPercentage` (0–1 or 0–100 — detect and normalize to 0–1) and play labels. Stakes = last point home_win_pct − previous.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_espn_bridge.py -v`

Expected: FAIL

- [ ] **Step 3: Implement bridge helpers**

- `match_espn_event_id`: walk `events[]` → competitions → competitors; compare abbrevs case-insensitive; optional small alias dict if Stats vs ESPN differ (e.g. `ARI`/`AZ`)
- `normalize_espn_mlb_win_probability`: map points; build label from period/clock/play text when present; compute stakes; return None if empty
- `attach_win_probability`: `detail.model_copy(update={...})`
- Pure sync match/normalize stay unit-testable without network

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_espn_bridge.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mlb_espn_bridge.py backend/app/services/mlb_game_detail.py backend/tests/fixtures/espn_mlb_*.json backend/tests/test_mlb_espn_bridge.py
git commit -m "feat(mlb): bridge ESPN win probability onto live game detail"
```

---

### Task 4: Service fetch + HTTP route

**Files:**
- Modify: `backend/app/services/mlb_game_detail.py` — `get_mlb_game_detail`, cache, clear helper
- Create: `backend/app/api/routes/mlb_game_detail.py`
- Modify: `backend/app/main.py` — import + `include_router`
- Create: `backend/tests/test_mlb_game_detail_route.py`

**Interfaces:**
- Produces: `async def get_mlb_game_detail(game_pk: str) -> MlbGameDetail`
  - Raises `LookupError` if Stats returns missing/404 game
  - Raises generic Exception / returns cached on hard miss after success (stale-while-error); never cached → propagate for 502
- Cache: `_cache[game_pk] = {detail, expires_at, espn_event_id?}`; live TTL 15s; not-live 60s
- Live feed URL: `https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live`
- Validate pk: `re.fullmatch(r"\d{4,10}", game_pk)` → else LookupError

- [ ] **Step 1: Write failing route tests**

```python
# backend/tests/test_mlb_game_detail_route.py
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.mlb_game_detail import MlbGameDetail, MlbGameDetailTeam

client = TestClient(app)

def _detail(status="live") -> MlbGameDetail:
    t = MlbGameDetailTeam(id="1", abbrev="BOS", name="Boston Red Sox", score=1, color="#BD3039")
    h = MlbGameDetailTeam(id="2", abbrev="LAD", name="Los Angeles Dodgers", score=0, color="#005A9C")
    return MlbGameDetail(
        mlb_game_pk="776543",
        status=status,
        status_label="Top 1st" if status == "live" else "Final",
        venue="Dodger Stadium",
        away=t,
        home=h,
        sources=["mlb_stats_api"],
        fetched_at="2026-08-02T18:00:00+00:00",
    )

def test_mlb_game_detail_ok_no_store():
    with patch("app.api.routes.mlb_game_detail.get_mlb_game_detail", new=AsyncMock(return_value=_detail())):
        res = client.get("/api/mlb/games/776543")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["mlb_game_pk"] == "776543"

def test_mlb_game_detail_invalid_pk_404():
    res = client.get("/api/mlb/games/not-a-pk")
    assert res.status_code == 404

def test_mlb_game_detail_upstream_502():
    with patch("app.api.routes.mlb_game_detail.get_mlb_game_detail", new=AsyncMock(side_effect=RuntimeError("up"))):
        res = client.get("/api/mlb/games/776543")
    assert res.status_code == 502
```

Mirror WNBA route pattern for LookupError → 404.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_route.py -v`

Expected: FAIL (404/route missing)

- [ ] **Step 3: Implement service + route + mount**

```python
# backend/app/api/routes/mlb_game_detail.py  (pattern)
@router.get("/mlb/games/{game_pk}", response_model=MlbGameDetail)
async def mlb_game_detail(game_pk: str, response: Response) -> MlbGameDetail:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_game_detail(game_pk)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Game not found", headers=_NO_STORE) from exc
    except Exception as exc:
        logger.warning("MLB game detail unavailable: %s", exc)
        raise HTTPException(status_code=502, detail="MLB game detail is temporarily unavailable", headers=_NO_STORE) from exc
```

In `get_mlb_game_detail`:
1. Validate pk
2. Return cache if fresh
3. Fetch Stats live feed
4. `normalize_mlb_live_feed`
5. Try ESPN: cached event id or `resolve_espn_event_id` then summary → `normalize_espn_mlb_win_probability` → `attach_win_probability`; on any ESPN error log warning and keep Stats detail
6. Store cache; return

Also add `clear_mlb_game_detail_cache()` for tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_route.py backend/tests/test_mlb_game_detail_normalize.py backend/tests/test_mlb_espn_bridge.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mlb_game_detail.py backend/app/api/routes/mlb_game_detail.py backend/app/main.py backend/tests/test_mlb_game_detail_route.py
git commit -m "feat(mlb): add GET /api/mlb/games/{game_pk} live detail route"
```

---

### Task 5: OpenAPI export + frontend fetch client

**Files:**
- Modify: `backend/app/openapi_export.py` — add `"/api/mlb/games/{game_pk}"` to `REQUIRED_MLB_PATHS`
- Modify: `frontend/openapi.json`, `frontend/src/lib/api.schema.d.ts` (via scripts)
- Modify: `frontend/src/lib/api.ts` — `fetchMlbGameDetail`
- Test: `backend/tests/test_export_openapi.py` (existing); optional `frontend/src/lib/api.test.ts` if present

**Interfaces:**
- Produces: `export async function fetchMlbGameDetail(gamePk: string): Promise<ApiMlbGameDetail>`
- Type alias: `export type ApiMlbGameDetail = components["schemas"]["MlbGameDetail"]` (exact OpenAPI schema name from export)

- [ ] **Step 1: Extend required paths; run failing export test if path missing**

```python
# in openapi_export.py
REQUIRED_MLB_PATHS = (
    "/api/mlb/scoreboard/today",
    "/api/mlb/scoreboard",
    "/api/mlb/odds/today",
    "/api/mlb/games/{game_pk}",
)
```

- [ ] **Step 2: Export + generate**

```bash
PYTHONPATH=backend python3 scripts/export_openapi.py
cd frontend && npm run generate:api
PYTHONPATH=backend python3 -m pytest backend/tests/test_export_openapi.py -v
```

Expected: PASS; schema includes `MlbGameDetail`

- [ ] **Step 3: Add fetch helper**

```typescript
export async function fetchMlbGameDetail(
  gamePk: string,
): Promise<ApiMlbGameDetail> {
  const res = await fetch(`${API_BASE}/api/mlb/games/${gamePk}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB game detail request failed: ${res.status}`);
  }
  return res.json();
}
```

Add `ApiMlbGameDetail` alias beside other `Api*` types.

- [ ] **Step 4: `cd frontend && npm run check:api`**

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add backend/app/openapi_export.py frontend/openapi.json frontend/src/lib/api.schema.d.ts frontend/src/lib/api.ts
git commit -m "feat(mlb): export OpenAPI and fetchMlbGameDetail client"
```

---

### Task 6: Hook + page shell (loading / error / not-live)

**Files:**
- Create: `frontend/src/hooks/useMlbGameDetail.ts`
- Create: `frontend/src/hooks/useMlbGameDetail.test.tsx`
- Create: `frontend/src/components/mlb/types.ts`
- Create: `frontend/src/components/mlb/mapMlbGameDetail.ts`
- Create: `frontend/src/components/mlb/mapMlbGameDetail.test.ts`
- Create: `frontend/src/pages/MlbGameDetailPage.tsx`
- Create: `frontend/src/pages/MlbGameDetailPage.test.tsx`
- Modify: `frontend/src/AppRouter.tsx` — use `MlbGameDetailPage`
- Modify: `frontend/src/AppRouter.test.tsx` — assert page (not stub copy)
- Delete: `frontend/src/pages/MlbGameStubPage.tsx` after router switch

**Interfaces:**
- `useMlbGameDetail(gamePk: string | undefined)` → same shape as `useGameDetail` (`hasNeverLoaded`, poll 18s when live)
- `mapMlbGameDetail(api: ApiMlbGameDetail): MlbGameDetailView` — camelCase UI type mirroring API nested shapes

- [ ] **Step 1: Failing hook + mapper + router tests**

```tsx
// useMlbGameDetail.test.tsx — poll only when live (mirror useGameDetail.test.tsx)
// mapMlbGameDetail.test.ts — maps mlb_game_pk → mlbGamePk, sources, status
// MlbGameDetailPage.test.tsx:
//   - live: shows attribution / linescore region (role or text)
//   - scheduled: shows “Not live yet”
//   - final: shows Final message
// AppRouter.test.tsx: /mlb/games/824971 no longer “coming soon”
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/hooks/useMlbGameDetail.test.tsx src/pages/MlbGameDetailPage.test.tsx src/AppRouter.test.tsx -t "MLB game"`

Expected: FAIL

- [ ] **Step 3: Implement hook, mapper, thin page**

Page structure:
- Loading skeleton with `GAME_SECTION_SURFACE`
- Error → Unable to load + Back `/`
- `status !== "live"` → compact teams/scores/status + message + Back
- `live` → placeholder `<div data-testid="mlb-live-center" />` for now (filled in Tasks 7–8)

```typescript
// useMlbGameDetail.ts
export function useMlbGameDetail(gamePk: string | undefined) {
  const query = useQuery({
    queryKey: ["mlb", "game", gamePk],
    queryFn: () => fetchMlbGameDetail(gamePk!),
    enabled: Boolean(gamePk),
    refetchInterval: (q) => (q.state.data?.status === "live" ? 18_000 : false),
  });
  return {
    ...query,
    shouldPoll: query.data?.status === "live",
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npx vitest run src/hooks/useMlbGameDetail.test.tsx src/components/mlb/mapMlbGameDetail.test.ts src/pages/MlbGameDetailPage.test.tsx src/AppRouter.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMlbGameDetail.ts frontend/src/hooks/useMlbGameDetail.test.tsx frontend/src/components/mlb frontend/src/pages/MlbGameDetailPage.tsx frontend/src/pages/MlbGameDetailPage.test.tsx frontend/src/AppRouter.tsx frontend/src/AppRouter.test.tsx
git rm frontend/src/pages/MlbGameStubPage.tsx
git commit -m "feat(mlb): replace game stub with detail page shell and hook"
```

---

### Task 7: Live UI — header, situation, pitch zone, PBP, box

**Files:**
- Create: `frontend/src/components/mlb/MlbGameHeader.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbLinescore.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbPitchZone.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbLiveSituation.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbPlayByPlay.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbBoxScore.tsx` (+ test)
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx` — compose live layout sections 1–5

**Interfaces:**
- Each component takes mapped `MlbGameDetailView` (or a slice prop)
- Pitch zone: SVG strike zone; plot `zone_x`/`zone_y`; number markers; strike vs ball colors (red/green muted, not neon glow)
- Diamond: three bases filled from `runners`
- PBP: half-inning filter pills; default current half; chronological list
- Scoring plays: full-game chronological
- Stakes line: show `winProbability.stakes.label` when present

- [ ] **Step 1: Write failing component tests** (one assert each: renders key labels from fixture view object)

- [ ] **Step 2: Run vitest on `src/components/mlb` — expect FAIL**

- [ ] **Step 3: Implement components + wire into live branch of page**

Layout order per spec:
1. Back + status · venue · attribution from `sources`
2. Header + linescore
3. Situation grid (pitch | diamond/count/players)
4. PBP | scoring
5. Box score

Import `GAME_SECTION_SURFACE` / `GameSection` from `@/components/game/GameSection`.

- [ ] **Step 4: Run component + page tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb frontend/src/pages/MlbGameDetailPage.tsx frontend/src/pages/MlbGameDetailPage.test.tsx
git commit -m "feat(mlb): live situation, linescore, PBP, and box score UI"
```

---

### Task 8: Win probability + hit chart + system design doc

**Files:**
- Create: `frontend/src/components/mlb/MlbWinProbability.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbHitChart.tsx` (+ test)
- Optional: `frontend/src/components/mlb/mlbWinProbabilityPaths.ts` (adapt geometry from WNBA `winProbabilityPaths.ts` for `home_win_pct` 0–1 → 0–100)
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx`
- Modify: `docs/superpowers/specs/2026-08-02-website-api-system-design.md`

**Interfaces:**
- Win prob: if null → shell + “Win probability unavailable”; else step/line chart with 50% midline, tooltip scrub
- Hit chart: Both / away / home filter; legend HR/Hit/Out; empty state copy

- [ ] **Step 1: Failing tests for unavailable WP, filter on hit chart**

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement + update system design**

In website API map:
- `/mlb/games/:gamePk` → live center (not stub)
- Add `GET /api/mlb/games/{game_pk}` to API table (Stats live feed + ESPN WP)

- [ ] **Step 4: Full verification**

```bash
PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_schema.py backend/tests/test_mlb_game_detail_normalize.py backend/tests/test_mlb_espn_bridge.py backend/tests/test_mlb_game_detail_route.py backend/tests/test_export_openapi.py -v
cd frontend && npx vitest run src/hooks/useMlbGameDetail.test.tsx src/pages/MlbGameDetailPage.test.tsx src/components/mlb src/AppRouter.test.tsx && npm run check:api
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb frontend/src/pages/MlbGameDetailPage.tsx docs/superpowers/specs/2026-08-02-website-api-system-design.md
git commit -m "feat(mlb): win probability, hit chart, and API map update"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Stats-primary live feed | 2, 4 |
| ESPN bridge soft-fail + WP/stakes | 3, 4 |
| Live-only full UI; thin not-live | 6, 7, 8 |
| Linescore, situation, pitch, PBP, box, WP, hit chart | 7, 8 |
| No milestones / no RE288 | Global + non-goals |
| Quiet theme / GAME_SECTION_SURFACE | 7, 8 |
| OpenAPI + fetch client | 5 |
| Attribution sources | 6–7 |
| System design maintenance | 8 |
| WNBA untouched | Global |

No TBD placeholders. Types aligned across Tasks 1→8 via `MlbGameDetail` / `MlbGameDetailView`.
