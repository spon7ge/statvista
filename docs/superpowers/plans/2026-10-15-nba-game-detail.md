# NBA Game Detail (Preview / Live / Final) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/nba/games/:espnEventId` with WNBA-equivalent preview / live / final layouts, backed by NBA game-detail, team-preview, and odds APIs; make NBA matchup cards navigable.

**Architecture:** Mirror the WNBA game stack into `backend/app/domains/nba/` (ESPN NBA summary + enrichment) and parallel `Nba*` frontend centers/page. Reuse league-agnostic leaf widgets (`BoxScore`, `ShotChart`, etc.) against a widened `GameDetail` type. Keep WNBA `/games/:id` unchanged.

**Tech Stack:** FastAPI, Pydantic, httpx, React, TypeScript, TanStack Query, Vitest, pytest, openapi-typescript

**Spec:** `docs/superpowers/specs/2026-10-15-nba-game-detail-design.md`

## Global Constraints

- Product name in user-facing copy/docs: **statvista**
- URL: `/nba/games/:espnEventId` only (do not move WNBA off `/games/:id`)
- Parallel `Nba*` modules — no shared-center extraction refactor
- Soft-fail empty optional sections (odds boards, starters, injuries, prediction, leaders)
- OpenAPI contract stay in sync (`export_openapi` → copy golden → `npm run generate:api`)
- Follow `md/claude.md` and WNBA game-detail patterns
- TDD: failing test first for each behavior
- Do not commit unless the user explicitly asks (skip commit steps or pause for confirmation)
- Out of scope: NBA prop picks board, NBA odds scrapers/migrations

---

## File structure

| Path | Responsibility |
| --- | --- |
| `backend/app/domains/nba/schemas_game_detail.py` | `NbaGameDetail` + nested types (`league: "nba"`) |
| `backend/app/domains/nba/game_detail.py` | ESPN NBA summary fetch/normalize/cache + enrichment hooks |
| `backend/app/domains/nba/game_leaders.py` | PPG/RPG/APG cards from summary (WNBA twin) |
| `backend/app/domains/nba/team_season_stats.py` | ESPN NBA byteam season stats + ranks |
| `backend/app/domains/nba/team_colors.py` | Fallback palette by abbrev |
| `backend/app/domains/nba/standings.py` | Minimal standings fetch for last-10 / record enrichment if WNBA game_detail needs it |
| `backend/app/domains/nba/schemas_team_preview.py` | Team preview response models |
| `backend/app/domains/nba/team_preview.py` | Away/Home leaders + roster averages |
| `backend/app/domains/nba/odds.py` | `get_today_odds()` — WNBA-shaped response; empty `book_boards` OK |
| `backend/app/domains/nba/routes.py` | Add games, team-preview, odds routes |
| `backend/app/providers/espn/nba_roster.py` | ESPN NBA roster index (copy WNBA, retarget URLs) |
| `backend/app/providers/espn/nba_team_player_stats.py` | Team leaders / roster rows |
| `backend/app/providers/rotowire/nba_lineups.py` | Uses existing `NBADailyLineups` |
| `backend/app/openapi_export.py` | Extend `REQUIRED_NBA_PATHS` |
| `backend/app/main.py` | Mention new NBA routes in description |
| `backend/tests/fixtures/espn_nba_summary.json` | Minimal ESPN NBA summary fixture |
| `backend/tests/test_nba_game_detail_*.py` | Normalize + route tests |
| `backend/tests/test_nba_team_preview*.py` | Team preview tests |
| `backend/tests/test_nba_odds*.py` | Odds route shape tests |
| `frontend/src/shared/lib/api.ts` | `fetchNbaGameDetail`, `fetchNbaOdds`, `fetchNbaTeamPreview` + types |
| `frontend/src/features/basketball/hooks/useNbaGameDetail.ts` | Query + live poll |
| `frontend/src/features/basketball/hooks/useNbaOdds.ts` | Odds query |
| `frontend/src/features/basketball/hooks/useNbaTeamPreview.ts` | Team preview query |
| `frontend/src/features/basketball/lib/types.ts` | `GameDetail.league: "wnba" \| "nba"` |
| `frontend/src/features/basketball/lib/mapGameDetail.ts` | Accept NBA detail; NBA color resolve |
| `frontend/src/features/basketball/league/nbaTeamColors.ts` | Abbrev → color fallback |
| `frontend/src/features/basketball/lib/nbaOddsBoard.ts` | Collect book boards (WNBA twin) |
| `frontend/src/features/basketball/game/Nba*.tsx` | Pregame / live / final / in-game / headers / panels as needed |
| `frontend/src/pages/NbaGameDetailPage.tsx` | Status → center shell |
| `frontend/src/app/AppRouter.tsx` | Route `/nba/games/:espnEventId` |
| `frontend/src/shared/lib/gameDetailHref.ts` | NBA → `/nba/games/{id}` |
| `md/system-design.md` | Page ↔ API updates |

---

### Task 1: `NbaGameDetail` schemas

**Files:**
- Create: `backend/app/domains/nba/schemas_game_detail.py`
- Test: `backend/tests/test_nba_game_detail_schemas.py`

**Interfaces:**
- Consumes: field list from `backend/app/domains/wnba/schemas_game_detail.py`
- Produces: `NbaGameDetail` with `league: Literal["nba"] = "nba"`; nested models may be redefined in this file (do not import WNBA response models into the NBA public schema)

- [ ] **Step 1: Write the failing schema test**

```python
from app.domains.nba.schemas_game_detail import NbaGameDetail


def test_nba_game_detail_league_literal():
    detail = NbaGameDetail(
        espn_event_id="401810001",
        status="scheduled",
        status_label="7:00 PM ET",
        venue="Crypto.com Arena",
        away={
            "id": "13",
            "abbrev": "LAL",
            "name": "Los Angeles Lakers",
            "score": None,
            "color": "#552583",
        },
        home={
            "id": "9",
            "abbrev": "GSW",
            "name": "Golden State Warriors",
            "score": None,
            "color": "#1D428A",
        },
        fg_made=0,
        fg_attempted=0,
        latest_play=None,
        shots=[],
        plays=[],
        win_probability=None,
        matchup_prediction=None,
        projected_starters=None,
        season_leaders=None,
        injuries=None,
        box_score=None,
        fetched_at="2026-10-15T00:00:00Z",
    )
    assert detail.league == "nba"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_nba_game_detail_schemas.py::test_nba_game_detail_league_literal -v`

Expected: FAIL (module missing)

- [ ] **Step 3: Create schemas**

Copy `backend/app/domains/wnba/schemas_game_detail.py` → `backend/app/domains/nba/schemas_game_detail.py`, then:

1. Rename `WnbaGameDetail` → `NbaGameDetail`, `WnbaGameLeaders` → `NbaGameLeaders`, `WnbaGameLeaderCard` → `NbaGameLeaderCard`, `WnbaSeasonTeamStatLine` → `NbaSeasonTeamStatLine`, `WnbaSeasonTeamStatsPair` → `NbaSeasonTeamStatsPair`
2. Set `league: Literal["nba"] = "nba"`
3. Update `__all__` and imports of `GameStatus` to `app.domains.nba.schemas_scoreboard` (or keep importing from WNBA scoreboard `GameStatus` only if values are identical — prefer NBA scoreboard’s `GameStatus` if already defined)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_nba_game_detail_schemas.py -v`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/app/domains/nba/schemas_game_detail.py backend/tests/test_nba_game_detail_schemas.py
git commit -m "feat(nba): add NbaGameDetail schemas"
```

---

### Task 2: ESPN NBA summary normalize + cache getter

**Files:**
- Create: `backend/app/domains/nba/game_detail.py`
- Create: `backend/app/domains/nba/game_leaders.py`
- Create: `backend/app/domains/nba/team_colors.py`
- Create: `backend/app/domains/nba/team_season_stats.py` (can stub `fetch_season_team_stats_pair` returning `None` until Task 4 if needed — prefer full copy in this task)
- Create: `backend/app/providers/rotowire/nba_lineups.py`
- Create: `backend/app/providers/espn/nba_roster.py` (minimal if only used for starter enrichment)
- Create: `backend/tests/fixtures/espn_nba_summary.json`
- Test: `backend/tests/test_nba_game_detail_normalize.py`

**Interfaces:**
- Consumes: ESPN summary JSON; `NbaGameDetail` schemas
- Produces:
  - `is_valid_espn_event_id(espn_event_id: str) -> bool`
  - `normalize_espn_summary(payload: dict, *, espn_event_id: str) -> NbaGameDetail` (or whatever private normalize WNBA uses — match WNBA public surface)
  - `async def get_game_detail(espn_event_id: str) -> NbaGameDetail`
  - `clear_game_detail_cache() -> None`
  - ESPN URL: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary`

- [ ] **Step 1: Write failing normalize tests + fixture**

Create a minimal `espn_nba_summary.json` with `header` (two competitors, status scheduled or live), empty `plays`, and enough structure for header teams/scores. Mirror fields used in `backend/tests/fixtures/` for WNBA summary if present (`espn_wnba_summary.json`).

```python
import json
from pathlib import Path

from app.domains.nba.game_detail import clear_game_detail_cache, normalize_espn_summary

FIXTURES = Path(__file__).parent / "fixtures"


def setup_function():
    clear_game_detail_cache()


def test_normalize_espn_nba_summary_sets_league_and_teams():
    payload = json.loads((FIXTURES / "espn_nba_summary.json").read_text())
    detail = normalize_espn_summary(payload, espn_event_id="401810001")
    assert detail.league == "nba"
    assert detail.espn_event_id == "401810001"
    assert detail.away.abbrev
    assert detail.home.abbrev
```

If WNBA exposes normalize only via `get_game_detail`, test through a thin `normalize_*` extracted the same way WNBA tests do — open `backend/tests/test_wnba_game_detail_normalize.py` and mirror its entry points exactly.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_nba_game_detail_normalize.py -v`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement by copying WNBA game_detail stack**

1. Copy `wnba/game_detail.py` → `nba/game_detail.py`
2. Copy `wnba/game_leaders.py` → `nba/game_leaders.py`
3. Copy `wnba/team_colors.py` → `nba/team_colors.py` (replace abbrev palette with NBA teams or keep ESPN colors + generic fallbacks)
4. Copy `wnba/team_season_stats.py` → `nba/team_season_stats.py` and change URL sport path `wnba` → `nba`
5. Copy `providers/rotowire/wnba_lineups.py` → `nba_lineups.py`; import `NBADailyLineups` instead of `WNBADailyLineups`
6. Copy `providers/espn/wnba_roster.py` → `nba_roster.py`; retarget ESPN basketball path `wnba` → `nba` and CDN headshot/logo paths
7. In `nba/game_detail.py`, apply these replacements (verify each):
   - `basketball/wnba/summary` → `basketball/nba/summary`
   - imports from `app.domains.wnba.*` → `app.domains.nba.*`
   - `WnbaGameDetail` → `NbaGameDetail`
   - RotoWire import → `app.providers.rotowire.nba_lineups`
   - roster import → `app.providers.espn.nba_roster`
   - any standings import: either copy minimal `nba/standings.py` from WNBA with NBA ESPN standings URL, or soft-fail record/last_10 when standings unavailable
8. Do **not** change normalization math (shots, plays, win prob) beyond league wiring

- [ ] **Step 4: Run normalize tests**

Run: `cd backend && python3 -m pytest tests/test_nba_game_detail_normalize.py -v`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/app/domains/nba/game_detail.py backend/app/domains/nba/game_leaders.py backend/app/domains/nba/team_colors.py backend/app/domains/nba/team_season_stats.py backend/app/providers/rotowire/nba_lineups.py backend/app/providers/espn/nba_roster.py backend/tests/fixtures/espn_nba_summary.json backend/tests/test_nba_game_detail_normalize.py
# also add nba/standings.py if created
git commit -m "feat(nba): normalize ESPN NBA game summary"
```

---

### Task 3: Game detail HTTP route

**Files:**
- Modify: `backend/app/domains/nba/routes.py`
- Modify: `backend/app/main.py` (description bullet for NBA game routes)
- Test: `backend/tests/test_nba_game_detail_route.py`

**Interfaces:**
- Produces: `GET /api/nba/games/{espn_event_id}` → `NbaGameDetail`, `Cache-Control: no-store`
- Errors: `LookupError` → 404 `"Game not found"`; other → 502 `"NBA game detail is temporarily unavailable"`

- [ ] **Step 1: Write failing route tests**

```python
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.domains.nba.schemas_game_detail import NbaGameDetail

client = TestClient(app)


def _minimal_detail() -> NbaGameDetail:
    return NbaGameDetail(
        espn_event_id="401810001",
        status="live",
        status_label="4:20 - 3rd",
        venue="Crypto.com Arena",
        away={
            "id": "13",
            "abbrev": "LAL",
            "name": "Los Angeles Lakers",
            "score": 95,
            "color": "#552583",
        },
        home={
            "id": "9",
            "abbrev": "GSW",
            "name": "Golden State Warriors",
            "score": 98,
            "color": "#1D428A",
        },
        fg_made=0,
        fg_attempted=0,
        latest_play=None,
        shots=[],
        plays=[],
        win_probability=None,
        matchup_prediction=None,
        projected_starters=None,
        season_leaders=None,
        injuries=None,
        box_score=None,
        fetched_at="2026-10-15T00:00:00Z",
    )


def test_nba_game_detail_200():
    with patch(
        "app.domains.nba.routes.get_game_detail",
        new=AsyncMock(return_value=_minimal_detail()),
    ):
        res = client.get("/api/nba/games/401810001")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-store"
    assert res.json()["league"] == "nba"


def test_nba_game_detail_404():
    with patch(
        "app.domains.nba.routes.get_game_detail",
        new=AsyncMock(side_effect=LookupError("Game not found")),
    ):
        res = client.get("/api/nba/games/999")
    assert res.status_code == 404


def test_nba_game_detail_502():
    with patch(
        "app.domains.nba.routes.get_game_detail",
        new=AsyncMock(side_effect=RuntimeError("espn down")),
    ):
        res = client.get("/api/nba/games/401810001")
    assert res.status_code == 502
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_nba_game_detail_route.py -v`

Expected: FAIL (route missing / 404)

- [ ] **Step 3: Add route**

In `backend/app/domains/nba/routes.py`, add (mirror WNBA):

```python
from app.domains.nba.game_detail import get_game_detail
from app.domains.nba.schemas_game_detail import NbaGameDetail

@router.get("/nba/games/{espn_event_id}", response_model=NbaGameDetail)
async def nba_game_detail(
    espn_event_id: str, response: Response
) -> NbaGameDetail:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_game_detail(espn_event_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
            headers=_NO_STORE,
        ) from exc
    except Exception as exc:
        logger.warning("NBA game detail unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="NBA game detail is temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
```

Update `app/main.py` description to mention NBA game detail routes alongside scoreboard.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_nba_game_detail_route.py -v`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/app/domains/nba/routes.py backend/app/main.py backend/tests/test_nba_game_detail_route.py
git commit -m "feat(nba): add GET /api/nba/games/{espn_event_id}"
```

---

### Task 4: Team preview API

**Files:**
- Create: `backend/app/domains/nba/schemas_team_preview.py`
- Create: `backend/app/domains/nba/team_preview.py`
- Create: `backend/app/providers/espn/nba_team_player_stats.py`
- Modify: `backend/app/domains/nba/routes.py`
- Test: `backend/tests/test_nba_team_preview.py`

**Interfaces:**
- Consumes: `get_game_detail`, ESPN NBA roster/stats helpers
- Produces: `async def get_nba_team_preview(espn_event_id: str, side: Literal["away","home"]) -> NbaTeamPreviewResponse`
- Route: `GET /api/nba/games/{espn_event_id}/team-preview?side=`

- [ ] **Step 1: Write failing tests**

Mirror `backend/tests/test_wnba_team_preview.py` (or equivalent): assert 200 shape with `side`, `team`, `leaders`, `roster`; 404 on `LookupError`; invalid side → 422.

```python
def test_nba_team_preview_route_200():
    # patch get_nba_team_preview to return empty leaders/roster for known game
    ...
    res = client.get("/api/nba/games/401810001/team-preview?side=away")
    assert res.status_code == 200
    body = res.json()
    assert body["side"] == "away"
    assert "leaders" in body
    assert "roster" in body
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_nba_team_preview.py -v`

Expected: FAIL

- [ ] **Step 3: Implement**

1. Copy WNBA `schemas_team_preview.py` / `team_preview.py` / `espn/wnba_team_player_stats.py` → NBA names
2. Retarget ESPN URLs `wnba` → `nba`
3. Wire route like WNBA (`side: Literal["away","home"] = Query(...)`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_nba_team_preview.py -v`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/app/domains/nba/schemas_team_preview.py backend/app/domains/nba/team_preview.py backend/app/providers/espn/nba_team_player_stats.py backend/app/domains/nba/routes.py backend/tests/test_nba_team_preview.py
git commit -m "feat(nba): add team-preview API"
```

---

### Task 5: `GET /api/nba/odds/today`

**Files:**
- Create: `backend/app/domains/nba/odds.py` (or add under betting domain if WNBA odds live only there — prefer `domains/nba/odds.py` + route on nba router for consistency with MLB’s `domains/mlb/odds.py`)
- Modify: `backend/app/domains/nba/routes.py`
- Test: `backend/tests/test_nba_odds_route.py`

**Interfaces:**
- Produces: response model matching WNBA odds shape (`as_of`, `sportsbook`, `games`, `book_boards`) — either reuse `WnbaOddsResponse` from `app.schemas.odds` renamed fields are identical, or define `NbaOddsResponse` as a thin alias/copy with same fields
- Behavior: return 200 with empty `games=[]` and `book_boards=[]` when no Sharp/snapshot data; never 500 for empty books
- Soft-try Sharp `league="nba"` if the Sharp client already accepts league strings; if not, empty lists are acceptable for this pass

- [ ] **Step 1: Write failing route test**

```python
def test_nba_odds_today_200_shape():
    res = client.get("/api/nba/odds/today")
    assert res.status_code == 200
    body = res.json()
    assert "as_of" in body
    assert "games" in body
    assert "book_boards" in body
    assert res.headers["cache-control"] == "no-store"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_nba_odds_route.py::test_nba_odds_today_200_shape -v`

Expected: FAIL

- [ ] **Step 3: Implement minimal odds module**

```python
# backend/app/domains/nba/odds.py — skeleton
async def get_today_odds() -> NbaOddsResponse:
    return NbaOddsResponse(
        as_of=_utcnow_iso(),
        sportsbook="",
        games=[],
        book_boards=[],
    )
```

If Sharp NBA rows are easy to plug in (same helper as MLB with `league="nba"` and `wnba_aliases=False`), do so for `games[]`; leave `book_boards` empty without NBA snapshot tables.

Wire `GET /nba/odds/today` on nba router.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_nba_odds_route.py -v`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/app/domains/nba/odds.py backend/app/domains/nba/routes.py backend/tests/test_nba_odds_route.py
git commit -m "feat(nba): add GET /api/nba/odds/today"
```

---

### Task 6: OpenAPI export + frontend schema regen

**Files:**
- Modify: `backend/app/openapi_export.py`
- Modify: `backend/openapi-golden.json` (via export)
- Modify: `frontend/openapi.json`
- Modify: `frontend/src/shared/lib/api.schema.d.ts` (via generate)
- Test: `backend/tests/test_export_openapi.py` (existing)

**Interfaces:**
- Extends `REQUIRED_NBA_PATHS` with:
  - `/api/nba/games/{espn_event_id}`
  - `/api/nba/games/{espn_event_id}/team-preview`
  - `/api/nba/odds/today`

- [ ] **Step 1: Extend REQUIRED_NBA_PATHS and run export test**

```python
REQUIRED_NBA_PATHS = (
    "/api/nba/scoreboard/today",
    "/api/nba/scoreboard",
    "/api/nba/games/{espn_event_id}",
    "/api/nba/games/{espn_event_id}/team-preview",
    "/api/nba/odds/today",
)
```

Run: `cd backend && python3 -m pytest tests/test_export_openapi.py -v`

Expected: PASS once routes exist (Task 3–5 done)

- [ ] **Step 2: Export OpenAPI artifacts**

```bash
cd backend && PYTHONPATH=..:. python -m app.openapi_export
cp ../frontend/openapi.json openapi-golden.json
cd ../frontend && npm run generate:api
```

- [ ] **Step 3: Verify check:api**

Run: `cd frontend && npm run check:api`

Expected: exit 0

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add backend/app/openapi_export.py backend/openapi-golden.json frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "chore(api): export NBA game detail OpenAPI paths"
```

---

### Task 7: Frontend API helpers + hooks

**Files:**
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts`
- Create: `frontend/src/features/basketball/hooks/useNbaGameDetail.ts`
- Create: `frontend/src/features/basketball/hooks/useNbaGameDetail.test.tsx`
- Create: `frontend/src/features/basketball/hooks/useNbaOdds.ts`
- Create: `frontend/src/features/basketball/hooks/useNbaTeamPreview.ts`
- Create: `frontend/src/features/basketball/hooks/useNbaTeamPreview.test.tsx`
- Modify: `frontend/src/features/basketball/lib/types.ts` (`league: "wnba" | "nba"`)
- Modify: `frontend/src/features/basketball/lib/mapGameDetail.ts` (accept NBA detail type; color via NBA resolver)
- Create: `frontend/src/features/basketball/league/nbaTeamColors.ts`
- Create: `frontend/src/features/basketball/lib/nbaOddsBoard.ts` (copy `wnbaOddsBoard.ts`, rename)

**Interfaces:**
- `fetchNbaGameDetail(espnEventId: string): Promise<ApiNbaGameDetail>`
- `fetchNbaOdds(): Promise<ApiNbaOddsResponse>` (or shared odds type)
- `fetchNbaTeamPreview({ espnEventId, side }): Promise<ApiNbaTeamPreviewResponse>`
- `useNbaGameDetail(id)` queryKey `["nba","game",id]`, poll 18_000 when live/halftime
- `mapGameDetail` works for both leagues (widen input type)

- [ ] **Step 1: Write failing api + hook tests**

In `api.test.ts`:

```ts
it("hits /api/nba/games/:id", async () => {
  // mock fetch → assert URL `/api/nba/games/401810001`
  await fetchNbaGameDetail("401810001");
});
```

In `useNbaGameDetail.test.tsx`: mirror `useGameDetail` / `useWnbaScoreboard` poll gating tests with NBA query key.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/basketball/hooks/useNbaGameDetail.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement fetchers, hooks, mapper widen**

```ts
export async function fetchNbaGameDetail(
  espnEventId: string,
): Promise<ApiNbaGameDetail> {
  const res = await fetch(`${API_BASE}/api/nba/games/${espnEventId}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`NBA game detail request failed: ${res.status}`);
  }
  return res.json();
}
```

Widen `GameDetail.league` to `"wnba" | "nba"`. In `mapGameDetail`, branch color resolve: `detail.league === "nba" ? resolveNbaTeamColor(...) : resolveWnbaTeamColor(...)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/basketball/hooks/useNbaGameDetail.test.tsx src/features/basketball/hooks/useNbaTeamPreview.test.tsx src/features/basketball/lib/mapGameDetail.test.ts`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts frontend/src/features/basketball/hooks/useNba*.ts* frontend/src/features/basketball/lib/types.ts frontend/src/features/basketball/lib/mapGameDetail.ts frontend/src/features/basketball/league/nbaTeamColors.ts frontend/src/features/basketball/lib/nbaOddsBoard.ts
git commit -m "feat(nba): add game detail API client and hooks"
```

---

### Task 8: Enable NBA matchup → game links

**Files:**
- Modify: `frontend/src/shared/lib/gameDetailHref.ts`
- Modify: `frontend/src/shared/lib/gameDetailHref.test.ts`
- Modify: `frontend/src/features/basketball/league/MatchupGameCard.test.tsx`

**Interfaces:**
- Produces: for `league === "nba"` and truthy `espnEventId`, return `/nba/games/${espnEventId}`; otherwise previous behavior

- [ ] **Step 1: Update failing tests first**

Replace NBA “returns null” expectations:

```ts
it("returns /nba/games/:id for NBA when espnEventId is set", () => {
  expect(
    gameDetailHref({
      league: "nba",
      espnEventId: "401810001",
      mlbGamePk: null,
    }),
  ).toBe("/nba/games/401810001");
});
```

In `MatchupGameCard.test.tsx`, change “does not link for NBA” to assert `href="/nba/games/401810001"` and chevron present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/shared/lib/gameDetailHref.test.ts src/features/basketball/league/MatchupGameCard.test.tsx`

Expected: FAIL on old null assertions / new href

- [ ] **Step 3: Implement**

```ts
export function gameDetailHref(game: {
  league: HomeLeague;
  espnEventId?: string | null;
  mlbGamePk?: string | null;
}): string | null {
  if (game.league === "mlb" && game.mlbGamePk) {
    return `/mlb/games/${game.mlbGamePk}`;
  }
  if (game.league === "nba" && game.espnEventId) {
    return `/nba/games/${game.espnEventId}`;
  }
  if (game.league !== "nba" && game.espnEventId) {
    return `/games/${game.espnEventId}`;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/shared/lib/gameDetailHref.test.ts src/features/basketball/league/MatchupGameCard.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add frontend/src/shared/lib/gameDetailHref.ts frontend/src/shared/lib/gameDetailHref.test.ts frontend/src/features/basketball/league/MatchupGameCard.test.tsx
git commit -m "feat(nba): link matchup cards to /nba/games/:id"
```

---

### Task 9: NBA game centers + page + router

**Files:**
- Create: `frontend/src/pages/NbaGameDetailPage.tsx`
- Create: `frontend/src/pages/NbaGameDetailPage.test.tsx`
- Create: `frontend/src/features/basketball/game/NbaPregameCenter.tsx` (+ test)
- Create: `frontend/src/features/basketball/game/NbaLiveCenter.tsx` (+ test)
- Create: `frontend/src/features/basketball/game/NbaFinalCenter.tsx`
- Create: `frontend/src/features/basketball/game/NbaInGameCenter.tsx`
- Create: `frontend/src/features/basketball/game/NbaPregameBroadcastHeader.tsx` (+ test if logic differs)
- Create: `frontend/src/features/basketball/game/NbaBroadcastHeader.tsx`
- Create: other `Nba*` panel wrappers only when WNBA components hardcode `wnba-*` ids or WNBA hooks — prefer reusing shared leaves (`ProjectedStarters`, `InjuryReport`, `BoxScore`, `ShotChart`, `WinProbabilityPanel`, `MatchupPrediction`) with NBA shells for odds board / team preview / play feed / season stats / game info / leaders if those files embed WNBA fetchers or copy
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`

**Interfaces:**
- `NbaGameDetailPage` uses `useNbaGameDetail`, `mapGameDetail`, Back → `/nba/matchups`
- Status routing identical to `GameDetailPage`
- Test ids: `nba-pregame-center`, `nba-live-center`, `nba-final-center`

- [ ] **Step 1: Write failing page + router tests**

```tsx
it("routes scheduled NBA games to NbaPregameCenter", async () => {
  // mock fetchNbaGameDetail → scheduled fixture
  renderWithProviders(["/nba/games/401810001"]);
  expect(await screen.findByTestId("nba-pregame-center")).toBeInTheDocument();
});

it("routes live NBA games to NbaLiveCenter", async () => { ... });
it("routes final NBA games to NbaFinalCenter", async () => { ... });
```

AppRouter: `path="/nba/games/:espnEventId" element={<NbaGameDetailPage />}`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/NbaGameDetailPage.test.tsx src/app/AppRouter.test.tsx`

Expected: FAIL

- [ ] **Step 3: Copy WNBA centers → Nba\***

For each of `WnbaPregameCenter`, `WnbaLiveCenter`, `WnbaFinalCenter`, `WnbaInGameCenter`, `WnbaPregameBroadcastHeader`, `WnbaBroadcastHeader`, and any child that embeds `useWnbaOdds` / `useWnbaTeamPreview` / `wnba-*` test ids / `/wnba` copy:

1. Copy to `Nba*` filename
2. Swap hooks to `useNbaOdds` / `useNbaTeamPreview`
3. Swap odds board collector to `collectNbaOddsBookBoards`
4. Replace `wnba-` test ids / aria ids with `nba-`
5. Keep shared leaves imported as-is when they only take `GameDetail`

`NbaGameDetailPage` = copy of `GameDetailPage` with NBA hooks, Back `/nba/matchups`, NBA centers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/NbaGameDetailPage.test.tsx src/features/basketball/game/Nba*.test.tsx src/app/AppRouter.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add frontend/src/pages/NbaGameDetailPage.tsx frontend/src/pages/NbaGameDetailPage.test.tsx frontend/src/features/basketball/game/Nba*.tsx frontend/src/features/basketball/game/Nba*.test.tsx frontend/src/app/AppRouter.tsx frontend/src/app/AppRouter.test.tsx
git commit -m "feat(nba): add preview/live/final game pages"
```

---

### Task 10: Docs — `md/system-design.md` + slate supersession note

**Files:**
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-10-15-nba-games-slate-design.md` (short status note at top: superseded for card navigation by game-detail design)

**Interfaces:**
- Page table: `/nba/matchups` cards → `/nba/games/:espnEventId`
- New row: `/nba/games/:espnEventId` describing WNBA-parity centers + hooks/APIs
- API table: list `GET /api/nba/games/{id}`, team-preview, odds/today

- [ ] **Step 1: Update system-design tables**

Replace the “cards not clickable” NBA matchups note with navigable cards. Add the game detail row modeled on the WNBA `/games/:espnEventId` row, with NBA paths/hooks.

- [ ] **Step 2: Add supersession blurb to slate spec**

At top of slate design:

```markdown
> **Superseded (navigation):** Card linking is defined in `2026-10-15-nba-game-detail-design.md`. Slate data/API decisions below still apply.
```

- [ ] **Step 3: Sanity-check docs mention APIs that exist**

Grep `md/system-design.md` for `/api/nba/games` and `/nba/games/`.

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add md/system-design.md docs/superpowers/specs/2026-10-15-nba-games-slate-design.md
git commit -m "docs: wire NBA game detail into system-design"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| `/nba/games/:espnEventId` | 9 |
| Preview / live / final layout parity | 9 |
| Parallel Nba\* centers | 9 |
| `GET /api/nba/games/{id}` | 2–3 |
| Team preview API | 4 |
| Odds/today (empty boards OK) | 5 |
| Matchup card links | 8 |
| Poll ~18s live | 7 |
| Soft-fail sections | 2, 5, 9 |
| OpenAPI + check:api | 6 |
| system-design update | 10 |
| WNBA unchanged | 8–9 (no edits to WNBA routes/centers except shared type widen) |
| No prop picks / scrapers | Global constraints |

**Placeholder scan:** none intentional; Task 2/4 use copy-and-retarget with explicit replacement lists.  
**Type consistency:** `NbaGameDetail.league === "nba"`; frontend `GameDetail.league` widened; href `/nba/games/${espnEventId}`.
