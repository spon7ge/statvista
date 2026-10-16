# NBA Games Slate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/nba/matchups` placeholder with a dated ESPN-backed NBA scoreboard slate (same chrome as WNBA/MLB); cards are intentionally non-clickable.

**Architecture:** New `backend/app/domains/nba/` ESPN-only scoreboard (`/today` + `?date=`). Frontend mirrors WNBA: `fetchNbaScoreboard*` + `useNbaScoreboard` + `NbaMatchupsPage` inside `LeagueMatchupsPage`. `gameDetailHref` returns `null` for `league === "nba"`; `MatchupGameCard` omits the chevron when there is no href.

**Tech Stack:** FastAPI, httpx, Pydantic, React, TanStack Query, Vitest, pytest, openapi-typescript

**Spec:** `docs/superpowers/specs/2026-10-15-nba-games-slate-design.md`

## Global Constraints

- Product name in user-facing copy/docs: **statvista**
- Slate only — no game detail, odds pills, or props
- ESPN-only (no stats.nba.com merge)
- Cards non-navigable; hide chevron when no link
- Follow `md/claude.md` and existing WNBA scoreboard patterns
- OpenAPI contract stay in sync (`export_openapi` → `npm run generate:api`)
- TDD: failing test first for each behavior
- Do not commit unless the user explicitly asks (skip commit steps or pause for confirmation)

---

## File structure

| Path | Responsibility |
| --- | --- |
| `backend/app/domains/nba/__init__.py` | Package marker |
| `backend/app/domains/nba/schemas_scoreboard.py` | `NbaTeam`, `NbaGame`, `NbaScoreboardResponse` |
| `backend/app/domains/nba/scoreboard.py` | ESPN fetch/normalize, caches, overnight carryover, today/dated getters |
| `backend/app/domains/nba/routes.py` | `/api/nba/scoreboard/today`, `/api/nba/scoreboard?date=` |
| `backend/app/api/router.py` | Include NBA router |
| `backend/app/openapi_export.py` | `REQUIRED_NBA_PATHS` |
| `backend/app/main.py` | Mention NBA scoreboard in description exceptions |
| `backend/tests/fixtures/espn_nba_scoreboard.json` | Minimal ESPN NBA fixture |
| `backend/tests/test_nba_scoreboard_normalize.py` | Normalize + carryover + slate date |
| `backend/tests/test_nba_scoreboard_route.py` | Route 200 / 422 / 502 / no-store |
| `backend/tests/test_api_router.py` | Assert NBA scoreboard path present |
| `frontend/src/shared/lib/api.ts` | Types + fetch helpers |
| `frontend/src/shared/lib/api.test.ts` | Fetch URL tests |
| `frontend/src/features/basketball/hooks/useNbaScoreboard.ts` | Query + poll gating |
| `frontend/src/features/basketball/hooks/useNbaScoreboard.test.tsx` | Hook tests |
| `frontend/src/shared/lib/gameDetailHref.ts` | NBA → always `null` |
| `frontend/src/shared/lib/gameDetailHref.test.ts` | NBA with espn id stays null |
| `frontend/src/features/basketball/league/MatchupGameCard.tsx` | Omit chevron when no href |
| `frontend/src/features/basketball/league/MatchupGameCard.test.tsx` | NBA card not a link / no chevron |
| `frontend/src/pages/LeagueMatchupsPage.tsx` | `NbaMatchupsPage` |
| `frontend/src/pages/LeagueMatchupsPage.test.tsx` | NBA slate not “coming soon” |
| `md/system-design.md` | Page ↔ API table |
| OpenAPI artifacts | `frontend/openapi.json`, `backend/openapi-golden.json`, `api.schema.d.ts` |

---

### Task 1: NBA scoreboard schemas + ESPN normalize

**Files:**
- Create: `backend/app/domains/nba/__init__.py`
- Create: `backend/app/domains/nba/schemas_scoreboard.py`
- Create: `backend/app/domains/nba/scoreboard.py` (normalize helpers only first)
- Create: `backend/tests/fixtures/espn_nba_scoreboard.json`
- Test: `backend/tests/test_nba_scoreboard_normalize.py`

**Interfaces:**
- Consumes: ESPN site API scoreboard JSON shape (same event/competition structure as WNBA)
- Produces: `normalize_espn_scoreboard(payload, *, date_et: str) -> list[NbaGame]`; schemas with `league: Literal["nba"]`

- [ ] **Step 1: Write the failing normalize tests + fixture**

Create `backend/tests/fixtures/espn_nba_scoreboard.json`:

```json
{
  "events": [
    {
      "id": "401810001",
      "date": "2026-10-15T23:00Z",
      "competitions": [
        {
          "venue": {
            "fullName": "Crypto.com Arena",
            "address": { "city": "Los Angeles" }
          },
          "competitors": [
            {
              "homeAway": "home",
              "score": "98",
              "records": [{ "type": "total", "summary": "1-0" }],
              "team": {
                "abbreviation": "LAL",
                "displayName": "Los Angeles Lakers",
                "logo": "https://a.espncdn.com/i/teamlogos/nba/500/lal.png"
              }
            },
            {
              "homeAway": "away",
              "score": "95",
              "records": [{ "type": "total", "summary": "0-1" }],
              "team": {
                "abbreviation": "GSW",
                "displayName": "Golden State Warriors",
                "logo": "https://a.espncdn.com/i/teamlogos/nba/500/gs.png"
              }
            }
          ]
        }
      ],
      "status": {
        "type": {
          "state": "in",
          "completed": false,
          "name": "STATUS_IN_PROGRESS",
          "shortDetail": "4:20 - 3rd",
          "detail": "4:20 - 3rd Quarter"
        },
        "period": 3,
        "displayClock": "4:20"
      }
    }
  ]
}
```

Create `backend/tests/test_nba_scoreboard_normalize.py`:

```python
from __future__ import annotations

import json
from pathlib import Path

from app.domains.nba.scoreboard import (
    combine_with_overnight_carryover,
    format_tip_label,
    normalize_espn_scoreboard,
    slate_et_date,
)
from app.domains.nba.schemas_scoreboard import NbaGame, NbaTeam
from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
FIXTURES = Path(__file__).parent / "fixtures"


def test_normalize_espn_sets_league_venue_records_logos_and_live_label():
    payload = json.loads((FIXTURES / "espn_nba_scoreboard.json").read_text())
    g = normalize_espn_scoreboard(payload, date_et="2026-10-15")[0]
    assert g.league == "nba"
    assert g.espn_event_id == "401810001"
    assert g.id == "espn-401810001"
    assert g.status == "live"
    assert g.status_label == "Q3 4:20"
    assert g.venue == "Crypto.com Arena"
    assert g.venue_city == "Los Angeles"
    assert g.away.abbrev == "GSW"
    assert g.away.record == "0-1"
    assert g.home.abbrev == "LAL"
    assert g.home.logo_url.endswith("/lal.png")


def test_normalize_espn_final_and_scheduled():
    final_payload = {
        "events": [
            {
                "id": "1",
                "date": "2026-10-15T00:00Z",
                "competitions": [
                    {
                        "competitors": [
                            {
                                "homeAway": "home",
                                "score": "110",
                                "team": {
                                    "abbreviation": "BOS",
                                    "displayName": "Boston Celtics",
                                },
                            },
                            {
                                "homeAway": "away",
                                "score": "100",
                                "team": {
                                    "abbreviation": "NYK",
                                    "displayName": "New York Knicks",
                                },
                            },
                        ]
                    }
                ],
                "status": {
                    "type": {
                        "state": "post",
                        "completed": True,
                        "name": "STATUS_FINAL",
                    }
                },
            }
        ]
    }
    g = normalize_espn_scoreboard(final_payload, date_et="2026-10-15")[0]
    assert g.status == "final"
    assert g.status_label == "Final"
    assert g.away.score == 100
    assert g.home.score == 110


def test_combine_with_overnight_carryover_keeps_live_yesterday():
    today = [
        NbaGame(
            id="espn-2",
            espn_event_id="2",
            status="scheduled",
            status_label="7:00 PM ET",
            away=NbaTeam(abbrev="BOS", name="Boston Celtics"),
            home=NbaTeam(abbrev="MIA", name="Miami Heat"),
            start_time_et="2026-10-16T23:00:00Z",
        )
    ]
    yesterday = [
        NbaGame(
            id="espn-1",
            espn_event_id="1",
            status="live",
            status_label="Q4 1:00",
            away=NbaTeam(abbrev="GSW", name="Golden State Warriors", score=95),
            home=NbaTeam(abbrev="LAL", name="Los Angeles Lakers", score=98),
            start_time_et="2026-10-16T02:00:00Z",
        )
    ]
    merged = combine_with_overnight_carryover(today, yesterday)
    assert [g.espn_event_id for g in merged] == ["1", "2"]


def test_slate_et_date_lags_until_3am():
    assert (
        slate_et_date(now=datetime(2026, 10, 16, 2, 30, tzinfo=ET))
        == "2026-10-15"
    )
    assert (
        slate_et_date(now=datetime(2026, 10, 16, 3, 0, tzinfo=ET))
        == "2026-10-16"
    )


def test_format_tip_label():
    assert format_tip_label("2026-10-15T23:00:00Z") is not None
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_scoreboard_normalize.py -v`

Expected: FAIL importing `app.domains.nba.scoreboard`

- [ ] **Step 3: Implement schemas + ESPN-only scoreboard core**

`backend/app/domains/nba/__init__.py` — empty file.

`backend/app/domains/nba/schemas_scoreboard.py` — copy WNBA schemas from `backend/app/domains/wnba/schemas_scoreboard.py`, rename `Wnba*` → `Nba*`, set `league: Literal["nba"] = "nba"`.

`backend/app/domains/nba/scoreboard.py` — ESPN-only port of WNBA helpers (no stats merge):

- `ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"`
- Reuse the same `_espn_status`, `_espn_team_record`, `_espn_venue`, `_team_logo_from_espn`, `format_tip_label`, `normalize_espn_scoreboard` logic from `backend/app/domains/wnba/scoreboard.py`, but:
  - Build `NbaGame` / `NbaTeam`
  - Abbrev: `str(t.get("abbreviation") or "").strip().upper()` (no WNBA `canonical_abbrev`)
- `combine_with_overnight_carryover` matching WNBA (match on `(away.abbrev, home.abbrev)` and `espn_event_id`)
- `slate_et_date`, `previous_et_date`, `SLATE_ROLLOVER_HOUR_ET = 3`
- Leave fetch/cache getters for Task 2 (stubs OK if tests only need normalize + carryover + slate)

- [ ] **Step 4: Run normalize tests — expect PASS**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_scoreboard_normalize.py -v`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/app/domains/nba backend/tests/fixtures/espn_nba_scoreboard.json \
  backend/tests/test_nba_scoreboard_normalize.py
git commit -m "$(cat <<'EOF'
feat(nba): add ESPN scoreboard normalize and schemas

EOF
)"
```

---

### Task 2: Scoreboard fetch, cache, today/dated getters + routes

**Files:**
- Modify: `backend/app/domains/nba/scoreboard.py`
- Create: `backend/app/domains/nba/routes.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/main.py` (description exceptions list)
- Modify: `backend/app/openapi_export.py`
- Modify: `backend/tests/test_api_router.py`
- Test: `backend/tests/test_nba_scoreboard_route.py`

**Interfaces:**
- Consumes: `normalize_espn_scoreboard`, schemas from Task 1
- Produces:
  - `async def fetch_espn_scoreboard(date_et: str) -> dict`
  - `async def get_today_scoreboard() -> NbaScoreboardResponse`
  - `async def get_scoreboard_for_date(date_et: str) -> NbaScoreboardResponse`
  - Routes: `GET /api/nba/scoreboard/today`, `GET /api/nba/scoreboard?date=`

- [ ] **Step 1: Write failing route tests**

`backend/tests/test_nba_scoreboard_route.py`:

```python
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.nba import scoreboard as svc

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    svc._date_cache.clear()
    yield
    svc._cache.clear()
    svc._date_cache.clear()


def test_scoreboard_today_returns_no_store_and_nba_games():
    espn = json.loads((FIXTURES / "espn_nba_scoreboard.json").read_text())

    async def fake_fetch(date_et: str):
        return espn

    with patch.object(svc, "fetch_espn_scoreboard", side_effect=fake_fetch):
        client = TestClient(app)
        res = client.get("/api/nba/scoreboard/today")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    body = res.json()
    assert body["date"]
    assert len(body["games"]) >= 1
    assert body["games"][0]["league"] == "nba"


def test_scoreboard_by_date_returns_requested_date():
    espn = json.loads((FIXTURES / "espn_nba_scoreboard.json").read_text())

    async def fake_fetch(date_et: str):
        return espn

    with patch.object(svc, "fetch_espn_scoreboard", side_effect=fake_fetch):
        client = TestClient(app)
        res = client.get("/api/nba/scoreboard?date=2026-10-14")
    assert res.status_code == 200
    assert res.json()["date"] == "2026-10-14"


def test_scoreboard_by_date_rejects_bad_date():
    client = TestClient(app)
    res = client.get("/api/nba/scoreboard?date=not-a-date")
    assert res.status_code == 422


def test_scoreboard_today_502_when_upstream_fails_with_empty_cache():
    async def boom(date_et: str):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_espn_scoreboard", side_effect=boom):
        client = TestClient(app)
        res = client.get("/api/nba/scoreboard/today")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"
```

Also add to `backend/tests/test_api_router.py`:

```python
assert "/api/nba/scoreboard/today" in route_paths
```

- [ ] **Step 2: Run route tests — expect FAIL**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_scoreboard_route.py backend/tests/test_api_router.py -v`

Expected: FAIL (404 / import / missing routes)

- [ ] **Step 3: Implement fetch/cache/getters + routes + wiring**

In `scoreboard.py`, mirror WNBA today/dated flow but ESPN-only:

```python
async def fetch_espn_scoreboard(date_et: str) -> dict:
    dates = date_et.replace("-", "")
    async with httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS) as client:
        r = await client.get(ESPN_URL, params={"dates": dates})
        r.raise_for_status()
        return r.json()


async def _games_for_date(date_et: str) -> tuple[list[NbaGame], bool]:
    try:
        payload = await fetch_espn_scoreboard(date_et)
        games = normalize_espn_scoreboard(payload, date_et=date_et)
        return games, True
    except Exception as exc:
        logger.warning("ESPN NBA scoreboard failed (%s): %s", date_et, exc)
        return [], False
```

- `get_scoreboard_for_date`: dated `_date_cache` TTL 300s; raise `RuntimeError` if unusable and no stale cache
- `get_today_scoreboard` / `_refresh_today_scoreboard`: single-flight lock; fetch today + yesterday; `combine_with_overnight_carryover`; TTL 30s if any live/halftime else 60s; stale-while-error when cache valid for same slate date
- `cache_ttl_seconds` same as WNBA

`routes.py` — copy WNBA scoreboard route handlers from `backend/app/domains/wnba/routes.py` (only the two scoreboard endpoints), swap imports to NBA, tags `["nba"]`, error detail `"NBA scoreboard is temporarily unavailable"`.

`router.py`:

```python
from app.domains.nba.routes import router as nba_router
# ...
api_router.include_router(nba_router)
```

`openapi_export.py`:

```python
REQUIRED_NBA_PATHS = (
    "/api/nba/scoreboard/today",
    "/api/nba/scoreboard",
)
REQUIRED_FRONTEND_PATHS = REQUIRED_WNBA_PATHS + REQUIRED_MLB_PATHS + REQUIRED_NBA_PATHS
```

Update `main.py` description to list `/api/nba/scoreboard/today` and `/api/nba/scoreboard` among live upstream exceptions.

- [ ] **Step 4: Run route + router tests — expect PASS**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_nba_scoreboard_route.py backend/tests/test_nba_scoreboard_normalize.py backend/tests/test_api_router.py -v`

Expected: PASS

- [ ] **Step 5: Export OpenAPI + regenerate frontend types**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api && npm run check:api
```

Expected: `check:api` exit 0; schema includes `NbaScoreboardResponse` and `/api/nba/scoreboard*`

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add backend/app/domains/nba backend/app/api/router.py backend/app/openapi_export.py \
  backend/app/main.py backend/tests/test_nba_scoreboard_route.py \
  backend/tests/test_api_router.py backend/openapi-golden.json \
  frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
feat(nba): expose ESPN scoreboard today and dated APIs

EOF
)"
```

---

### Task 3: Frontend API client + `useNbaScoreboard`

**Files:**
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts` (and/or `api.scoreboardDate.test.ts`)
- Create: `frontend/src/features/basketball/hooks/useNbaScoreboard.ts`
- Test: `frontend/src/features/basketball/hooks/useNbaScoreboard.test.tsx`

**Interfaces:**
- Consumes: OpenAPI `NbaScoreboardResponse` from Task 2
- Produces:
  - `fetchNbaScoreboard(): Promise<NbaScoreboardResponse>`
  - `fetchNbaScoreboardByDate(dateEt: string): Promise<NbaScoreboardResponse>`
  - `useNbaScoreboard(dateEt?: string)` returning `{ games, isLoading, hasNeverLoaded, shouldPoll, ...query }`

- [ ] **Step 1: Write failing API + hook tests**

In `api.test.ts` (mirror WNBA scoreboard tests):

```ts
describe("fetchNbaScoreboard", () => {
  it("calls /api/nba/scoreboard/today", async () => {
    // stub fetch ok → json
    const { fetchNbaScoreboard } = await import("./api");
    await fetchNbaScoreboard();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/nba/scoreboard/today"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
```

Add dated test (new file or extend `api.scoreboardDate.test.ts`):

```ts
await fetchNbaScoreboardByDate("2026-10-14");
expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining("/api/nba/scoreboard?date=2026-10-14"),
  expect.anything(),
);
```

`useNbaScoreboard.test.tsx` — copy `useWnbaScoreboard.test.tsx`, swap names/URLs/`league: "nba"`, keep poll / hasNeverLoaded / dated vs today assertions.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/basketball/hooks/useNbaScoreboard.test.tsx`

Expected: FAIL (exports / module missing)

- [ ] **Step 3: Implement client + hook**

In `api.ts` (next to WNBA scoreboard helpers):

```ts
export type NbaScoreboardResponse = Schemas["NbaScoreboardResponse"];

export async function fetchNbaScoreboard(): Promise<NbaScoreboardResponse> {
  const res = await fetch(`${API_BASE}/api/nba/scoreboard/today`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Scoreboard request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchNbaScoreboardByDate(
  dateEt: string,
): Promise<NbaScoreboardResponse> {
  const res = await fetch(
    `${API_BASE}/api/nba/scoreboard?date=${encodeURIComponent(dateEt)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Scoreboard request failed: ${res.status}`);
  }
  return res.json();
}
```

`useNbaScoreboard.ts` — copy `useWnbaScoreboard.ts`, replace wnba → nba in imports, query keys `["nba", "scoreboard", ...]`, and fetch functions.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/basketball/hooks/useNbaScoreboard.test.tsx src/shared/lib/api.scoreboardDate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

---

### Task 4: Non-clickable NBA cards (`gameDetailHref` + chevron)

**Files:**
- Modify: `frontend/src/shared/lib/gameDetailHref.ts`
- Modify: `frontend/src/shared/lib/gameDetailHref.test.ts`
- Modify: `frontend/src/features/basketball/league/MatchupGameCard.tsx`
- Modify: `frontend/src/features/basketball/league/MatchupGameCard.test.tsx`

**Interfaces:**
- Consumes: `HomeLeague` including `"nba"`
- Produces: `gameDetailHref` returns `null` whenever `league === "nba"`; card omits chevron when `href` is null

- [ ] **Step 1: Write failing tests**

Extend `gameDetailHref.test.ts`:

```ts
it("returns null for NBA even when espnEventId is set", () => {
  expect(
    gameDetailHref({
      league: "nba",
      espnEventId: "401810001",
      mlbGamePk: null,
    }),
  ).toBeNull();
});
```

Extend `MatchupGameCard.test.tsx`:

```ts
it("does not link or show chevron for NBA games with espnEventId", () => {
  renderCard({
    ...liveGame,
    league: "nba",
    espnEventId: "401810001",
  });
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  // chevron is decorative SVG — assert via absence of link + article card
  expect(document.querySelector("article.card")).toBeTruthy();
});
```

Also assert chevron SVG is absent when there is no href (e.g. query by the card and ensure only one decorative icon path count, or add `data-testid="matchup-card-chevron"` only when linked — prefer testid for clarity):

In implementation, when `href` is set render `<IconChevron data-testid="matchup-card-chevron" ... />`; when not, omit it. Test:

```ts
expect(screen.queryByTestId("matchup-card-chevron")).not.toBeInTheDocument();
```

And for WNBA linked card:

```ts
expect(screen.getByTestId("matchup-card-chevron")).toBeInTheDocument();
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npx vitest run src/shared/lib/gameDetailHref.test.ts src/features/basketball/league/MatchupGameCard.test.tsx`

Expected: FAIL on NBA-with-id returning a path / chevron still present

- [ ] **Step 3: Implement**

`gameDetailHref.ts`:

```ts
export function gameDetailHref(game: {
  league: HomeLeague;
  espnEventId?: string | null;
  mlbGamePk?: string | null;
}): string | null {
  if (game.league === "nba") {
    return null;
  }
  if (game.league === "mlb" && game.mlbGamePk) {
    return `/mlb/games/${game.mlbGamePk}`;
  }
  if (game.espnEventId) {
    return `/games/${game.espnEventId}`;
  }
  return null;
}
```

`MatchupGameCard.tsx`: compute `href` first; only render `IconChevron` with `data-testid="matchup-card-chevron"` when `href` is truthy.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npx vitest run src/shared/lib/gameDetailHref.test.ts src/features/basketball/league/MatchupGameCard.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

---

### Task 5: Wire `NbaMatchupsPage` + system-design docs

**Files:**
- Modify: `frontend/src/pages/LeagueMatchupsPage.tsx`
- Modify: `frontend/src/pages/LeagueMatchupsPage.test.tsx`
- Modify: `md/system-design.md`

**Interfaces:**
- Consumes: `useNbaScoreboard`, `mapToMatchupGames`, `MatchupsPanel`, date helpers
- Produces: `/nba/matchups[?date=]` live slate UI

- [ ] **Step 1: Write failing page test updates**

In `LeagueMatchupsPage.test.tsx`:

1. Mock `useNbaScoreboard` like WNBA/MLB mocks.
2. Change the NBA pill assertion from “coming soon” to date nav + empty-slate copy (or loading-free empty state):

```ts
vi.mock("@/features/basketball/hooks/useNbaScoreboard", () => ({
  useNbaScoreboard: (dateEt?: string) => ({
    games: [],
    isLoading: false,
    hasNeverLoaded: false,
    data: { date: dateEt ?? "2026-08-01", games: [], fetched_at: "" },
  }),
}));

// in the switch-to-NBA test:
await user.click(within(screen.getByTestId("matchups-header")).getByRole("link", { name: "NBA" }));
expect(screen.queryByText(/NBA games coming soon/i)).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
expect(screen.getByText(/no games on this slate/i)).toBeInTheDocument();
```

Add a focused test that prev day works on `/nba/matchups` (same as WNBA date nav test).

- [ ] **Step 2: Run page tests — expect FAIL**

Run: `cd frontend && npx vitest run src/pages/LeagueMatchupsPage.test.tsx`

Expected: FAIL (still “coming soon”)

- [ ] **Step 3: Implement `NbaMatchupsPage`**

In `LeagueMatchupsPage.tsx`, replace the NBA placeholder branch:

```tsx
if (league === "nba") {
  return <NbaMatchupsPage />;
}
```

Add `NbaMatchupsPage` as a copy of `WnbaMatchupsPage` using `useNbaScoreboard` instead of `useWnbaScoreboard` (no odds).

Remove the “NBA games coming soon.” paragraph.

- [ ] **Step 4: Update `md/system-design.md`**

Replace the `/nba/matchups` placeholder row with:

| `/nba/matchups?date=` | Daily slate (no odds pill); Games header with MLB/WNBA/NBA pills + **Today** date nav; cards not clickable (no NBA game detail yet) | `useNbaScoreboard(date)` | `GET /api/nba/scoreboard/today` or `?date=` | ESPN NBA scoreboard; `espn_event_id` present but `gameDetailHref` returns null for nba |

Also add API table rows for the two NBA scoreboard endpoints near the WNBA scoreboard entries.

Update the intro line that says NBA is scaffolded/placeholder.

- [ ] **Step 5: Run page tests — expect PASS**

Run: `cd frontend && npx vitest run src/pages/LeagueMatchupsPage.test.tsx`

Expected: PASS

- [ ] **Step 6: Manual smoke (optional but recommended)**

With backend on `:8000` and `npm run dev`: open `/nba/matchups`, confirm slate loads, date arrows work, cards have no link/chevron.

- [ ] **Step 7: Commit (only if user asked)**

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `/nba/matchups` dated slate UI | 5 |
| ESPN-only scoreboard APIs | 1–2 |
| Overnight carryover on `/today` | 1–2 |
| Non-clickable cards + no chevron | 4 |
| `useNbaScoreboard` poll today when live | 3 |
| OpenAPI / system-design updates | 2, 5 |
| WNBA/MLB unchanged | covered by existing tests in 4–5 |

## Self-review notes

- No shared ESPN basketball refactor (YAGNI per spec).
- `espn_event_id` still serialized for future detail work; nav gated in `gameDetailHref`.
- Commit steps are gated on explicit user request per project rules.
