# MLB Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/mlb/standings` with Leaders-style navy banner and AL/NL division tables fed by `GET /api/mlb/standings` from MLB Stats API.

**Architecture:** Dedicated MLB standings domain module fetches `statsapi.mlb.com/api/v1/standings?leagueId=103,104`, resolves team abbreviations via `/api/v1/teams`, normalizes into AL→NL leagues with East/Central/West divisions, and caches 10 minutes. Frontend mirrors `MlbLeadersPage` chrome (subnav + banner + sectioned grid) with core columns only.

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React 19 · TypeScript · Vite · TanStack Query · React Router · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-mlb-standings-design.md`
- Coding standards: `md/claude.md` (small focused modules, strong typing, defensive mapping, tests with code)
- Brand: **statvista**
- Route: `/mlb/standings` only; WNBA standings unchanged
- Data: Stats API standings + teams map (not ESPN; not frontend-only)
- Columns (fixed): `#` · Team · `W-L` · `PCT` · `GB` · `L10` · Strk
- Grouping: American League / National League sections → 3 division cards each
- Banner accent: navy `#0A2351` (not Leaders orange `#F38312`); reuse crossed-bats mark
- Attribution copy: exact string `Data: statsapi.mlb.com`
- HTTP: `Cache-Control: no-store`; cold failure **502** (match MLB Leaders route, not 503)
- Do not share cache with `game_detail.fetch_mlb_standings` in v1
- Verify backend: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_standings_normalize.py backend/tests/test_mlb_standings_route.py -v`
- Verify frontend: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandings src/features/mlb/hooks/useMlbStandings src/pages/MlbStandingsPage.test.tsx src/features/basketball/league/LeagueSubnav.test.tsx src/app/AppRouter.test.tsx && npm run build`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_standings.py` | Pydantic response models |
| `backend/app/domains/mlb/standings.py` | Fetch, normalize, cache |
| `backend/app/domains/mlb/routes.py` | `GET /mlb/standings` |
| `backend/app/domains/mlb/schemas.py` | Re-export standings models |
| `backend/app/openapi_export.py` | Add `/api/mlb/standings` to required paths |
| `backend/tests/fixtures/mlb_standings_full_sample.json` | AL+NL division fixture |
| `backend/tests/test_mlb_standings_normalize.py` | Normalize unit tests |
| `backend/tests/test_mlb_standings_route.py` | Route + cache + 502 |
| `frontend/openapi.json` / `api.schema.d.ts` / `backend/openapi-golden.json` | Contract regen |
| `frontend/src/shared/lib/api.ts` | Types + `fetchMlbStandings` |
| `frontend/src/features/mlb/hooks/useMlbStandings.ts` | React Query hook |
| `frontend/src/features/mlb/league/MlbStandingsHeader.tsx` | Navy banner |
| `frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx` | One division table |
| `frontend/src/features/mlb/league/MlbStandingsGrid.tsx` | AL/NL sections + states |
| `frontend/src/pages/MlbStandingsPage.tsx` | Compose page |
| `frontend/src/app/AppRouter.tsx` | Register route |
| `frontend/src/features/basketball/league/LeagueSubnav.tsx` | Enable Standings for mlb |
| `md/system-design.md` | Page ↔ API row + app tree |

---

### Task 1: Backend schemas + normalize

**Files:**
- Create: `backend/app/domains/mlb/schemas_standings.py`
- Create: `backend/app/domains/mlb/standings.py` (normalize helpers only in this task; fetch/cache in Task 2)
- Create: `backend/tests/fixtures/mlb_standings_full_sample.json`
- Create: `backend/tests/test_mlb_standings_normalize.py`
- Modify: `backend/app/domains/mlb/schemas.py` (re-export)

**Interfaces:**
- Consumes: Stats API standings `records[]` with `league.id`, `division.id`, `teamRecords[]`; `team_id_to_abbrev: dict[int, str]`
- Produces:
  - `normalize_mlb_standings(payload: dict, team_id_to_abbrev: dict[int, str], *, season: int | None = None) -> MlbStandingsResponse`
  - Models: `MlbStandingsRow`, `MlbStandingsDivision`, `MlbStandingsLeague`, `MlbStandingsResponse`

**Upstream shape notes (real API):**
- `records` has 6 division blocks; each has `league: {id}` (103=AL, 104=NL) and `division: {id}` only (no name) — use static maps.
- Division ids: `201` AL East, `202` AL Central, `200` AL West, `204` NL East, `205` NL Central, `203` NL West.
- `team` often has only `id` / `name` / `link` (no abbreviation) — abbrev **must** come from teams map.
- `streak` is an object: `{ "streakCode": "W4", ... }` → use `streakCode`.
- `lastTen` lives under `records.splitRecords[]` with `type == "lastTen"`.
- Season often on each `teamRecords[].season`.

- [ ] **Step 1: Write the fixture**

Create `backend/tests/fixtures/mlb_standings_full_sample.json` with all 6 divisions, at least one complete team each for AL East + NL West, plus one malformed team (missing id) in AL East to assert skip behavior. Minimal complete teamRecord:

```json
{
  "copyright": "Copyright 2026 MLB Advanced Media, L.P.",
  "records": [
    {
      "standingsType": "regularSeason",
      "league": { "id": 103, "link": "/api/v1/league/103" },
      "division": { "id": 201, "link": "/api/v1/divisions/201" },
      "teamRecords": [
        {
          "team": { "id": 139, "name": "Rays", "link": "/api/v1/teams/139" },
          "season": "2026",
          "streak": { "streakType": "wins", "streakNumber": 4, "streakCode": "W4" },
          "divisionRank": "1",
          "gamesBack": "-",
          "winningPercentage": ".600",
          "wins": 69,
          "losses": 46,
          "records": {
            "splitRecords": [
              { "wins": 7, "losses": 3, "type": "lastTen", "pct": ".700" }
            ]
          }
        },
        {
          "team": { "name": "Broken" },
          "wins": 1,
          "losses": 1
        }
      ]
    },
    {
      "standingsType": "regularSeason",
      "league": { "id": 103, "link": "/api/v1/league/103" },
      "division": { "id": 202, "link": "/api/v1/divisions/202" },
      "teamRecords": [
        {
          "team": { "id": 142, "name": "Twins", "link": "/api/v1/teams/142" },
          "season": "2026",
          "streak": { "streakCode": "L1" },
          "divisionRank": "1",
          "gamesBack": "-",
          "winningPercentage": ".520",
          "wins": 52,
          "losses": 48,
          "records": {
            "splitRecords": [
              { "wins": 5, "losses": 5, "type": "lastTen", "pct": ".500" }
            ]
          }
        }
      ]
    },
    {
      "standingsType": "regularSeason",
      "league": { "id": 103, "link": "/api/v1/league/103" },
      "division": { "id": 200, "link": "/api/v1/divisions/200" },
      "teamRecords": [
        {
          "team": { "id": 117, "name": "Astros", "link": "/api/v1/teams/117" },
          "season": "2026",
          "streak": { "streakCode": "W2" },
          "divisionRank": "1",
          "gamesBack": "-",
          "winningPercentage": ".540",
          "wins": 54,
          "losses": 46,
          "records": {
            "splitRecords": [
              { "wins": 6, "losses": 4, "type": "lastTen", "pct": ".600" }
            ]
          }
        }
      ]
    },
    {
      "standingsType": "regularSeason",
      "league": { "id": 104, "link": "/api/v1/league/104" },
      "division": { "id": 204, "link": "/api/v1/divisions/204" },
      "teamRecords": [
        {
          "team": { "id": 143, "name": "Phillies", "link": "/api/v1/teams/143" },
          "season": "2026",
          "streak": { "streakCode": "W1" },
          "divisionRank": "1",
          "gamesBack": "-",
          "winningPercentage": ".560",
          "wins": 56,
          "losses": 44,
          "records": {
            "splitRecords": [
              { "wins": 6, "losses": 4, "type": "lastTen", "pct": ".600" }
            ]
          }
        }
      ]
    },
    {
      "standingsType": "regularSeason",
      "league": { "id": 104, "link": "/api/v1/league/104" },
      "division": { "id": 205, "link": "/api/v1/divisions/205" },
      "teamRecords": [
        {
          "team": { "id": 158, "name": "Brewers", "link": "/api/v1/teams/158" },
          "season": "2026",
          "streak": { "streakCode": "L2" },
          "divisionRank": "1",
          "gamesBack": "-",
          "winningPercentage": ".550",
          "wins": 55,
          "losses": 45,
          "records": {
            "splitRecords": [
              { "wins": 4, "losses": 6, "type": "lastTen", "pct": ".400" }
            ]
          }
        }
      ]
    },
    {
      "standingsType": "regularSeason",
      "league": { "id": 104, "link": "/api/v1/league/104" },
      "division": { "id": 203, "link": "/api/v1/divisions/203" },
      "teamRecords": [
        {
          "team": { "id": 119, "name": "Dodgers", "link": "/api/v1/teams/119" },
          "season": "2026",
          "streak": { "streakCode": "W3" },
          "divisionRank": "1",
          "gamesBack": "-",
          "winningPercentage": ".580",
          "wins": 58,
          "losses": 42,
          "records": {
            "splitRecords": [
              { "wins": 8, "losses": 2, "type": "lastTen", "pct": ".800" }
            ]
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing normalize tests**

Create `backend/tests/test_mlb_standings_normalize.py`:

```python
from __future__ import annotations

import json
from pathlib import Path

from app.domains.mlb.standings import normalize_mlb_standings

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {
    139: "TB",
    142: "MIN",
    117: "HOU",
    143: "PHI",
    158: "MIL",
    119: "LAD",
}


def _payload():
    return json.loads((FIXTURES / "mlb_standings_full_sample.json").read_text())


def test_normalize_orders_al_then_nl_with_six_divisions():
    result = normalize_mlb_standings(_payload(), TEAM_MAP)
    assert result.season == 2026
    assert [lg.key for lg in result.leagues] == ["al", "nl"]
    assert [lg.label for lg in result.leagues] == [
        "American League",
        "National League",
    ]
    assert [d.key for d in result.leagues[0].divisions] == [
        "al_east",
        "al_central",
        "al_west",
    ]
    assert [d.key for d in result.leagues[1].divisions] == [
        "nl_east",
        "nl_central",
        "nl_west",
    ]


def test_normalize_maps_core_columns_and_skips_broken_rows():
    result = normalize_mlb_standings(_payload(), TEAM_MAP)
    al_east = result.leagues[0].divisions[0]
    assert al_east.label == "AL East"
    assert len(al_east.teams) == 1
    row = al_east.teams[0]
    assert row.rank == 1
    assert row.team_id == "139"
    assert row.abbrev == "TB"
    assert row.name == "Rays"
    assert row.wl == "69-46"
    assert row.pct == ".600"
    assert row.gb == "-"
    assert row.l10 == "7-3"
    assert row.streak == "W4"
    assert row.logo_url is None


def test_normalize_requires_abbrev_from_map():
    result = normalize_mlb_standings(_payload(), {})
    assert result.leagues[0].divisions[0].teams == []
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_standings_normalize.py -v`

Expected: FAIL (module / function missing)

- [ ] **Step 4: Implement schemas + normalize**

`backend/app/domains/mlb/schemas_standings.py`:

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

LeagueKey = Literal["al", "nl"]


class MlbStandingsRow(BaseModel):
    rank: int
    team_id: str
    abbrev: str
    name: str
    logo_url: str | None
    wins: int
    losses: int
    wl: str
    pct: str
    gb: str
    l10: str
    streak: str


class MlbStandingsDivision(BaseModel):
    key: str
    label: str
    teams: list[MlbStandingsRow]


class MlbStandingsLeague(BaseModel):
    key: LeagueKey
    label: str
    divisions: list[MlbStandingsDivision]


class MlbStandingsResponse(BaseModel):
    season: int
    leagues: list[MlbStandingsLeague]
```

In `standings.py`, define static maps and `normalize_mlb_standings`:

```python
_LEAGUE_META: dict[int, tuple[LeagueKey, str]] = {
    103: ("al", "American League"),
    104: ("nl", "National League"),
}

# division_id -> (division_key, label, league_key)
_DIVISION_META: dict[int, tuple[str, str, LeagueKey]] = {
    201: ("al_east", "AL East", "al"),
    202: ("al_central", "AL Central", "al"),
    200: ("al_west", "AL West", "al"),
    204: ("nl_east", "NL East", "nl"),
    205: ("nl_central", "NL Central", "nl"),
    203: ("nl_west", "NL West", "nl"),
}

_DIVISION_ORDER = (
    "al_east",
    "al_central",
    "al_west",
    "nl_east",
    "nl_central",
    "nl_west",
)
```

Mapping rules:
- Skip unknown league/division ids.
- Skip rows missing team id, wins/losses, or abbrev (after map lookup + `canonical_mlb_abbrev`).
- `rank` from `divisionRank` (int); default skip if missing/invalid.
- `pct` from `winningPercentage` string; `gb` from `gamesBack` (keep `"-"`).
- `l10` from lastTen split wins/losses; skip row if missing.
- `streak` from `streak.streakCode` string; skip if missing.
- `logo_url` always `None` for v1 (frontend `mlbTeamLogos`).
- Season: first valid `teamRecords[].season`, else `season` arg, else raise `ValueError`.
- Assemble leagues AL then NL; within each, only include divisions that appeared, ordered by `_DIVISION_ORDER`.

Re-export new models from `schemas.py` `__all__`.

- [ ] **Step 5: Run normalize tests — PASS**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_standings_normalize.py -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/schemas_standings.py \
  backend/app/domains/mlb/standings.py \
  backend/app/domains/mlb/schemas.py \
  backend/tests/fixtures/mlb_standings_full_sample.json \
  backend/tests/test_mlb_standings_normalize.py
git commit -m "$(cat <<'EOF'
feat(mlb): normalize Stats API standings into AL/NL divisions

EOF
)"
```

---

### Task 2: Backend fetch, cache, route, OpenAPI

**Files:**
- Modify: `backend/app/domains/mlb/standings.py` (fetch + `get_mlb_standings`)
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/app/openapi_export.py`
- Create: `backend/tests/test_mlb_standings_route.py`
- Update: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`
- Update: `md/system-design.md`
- Update: `docs/superpowers/specs/2026-08-07-mlb-standings-design.md` (status + 502 clarification)

**Interfaces:**
- Produces: `async def get_mlb_standings() -> MlbStandingsResponse`
- Route: `GET /api/mlb/standings` → 200 / 502 + `Cache-Control: no-store`

- [ ] **Step 1: Write failing route tests**

Create `backend/tests/test_mlb_standings_route.py` mirroring `test_mlb_leaders_route.py`:

```python
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import routes
from app.domains.mlb import standings as svc
from app.domains.mlb.schemas_standings import MlbStandingsResponse
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"
TEAM_MAP = {139: "TB", 142: "MIN", 117: "HOU", 143: "PHI", 158: "MIL", 119: "LAD"}


@pytest.fixture(autouse=True)
def clear_cache():
    svc._cache.clear()
    yield
    svc._cache.clear()


def test_standings_returns_no_store(monkeypatch):
    async def fake() -> MlbStandingsResponse:
        return MlbStandingsResponse(season=2026, leagues=[])

    monkeypatch.setattr(routes, "get_mlb_standings", fake, raising=False)
    res = TestClient(app).get("/api/mlb/standings")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json() == {"season": 2026, "leagues": []}


def test_standings_returns_502_when_unavailable(monkeypatch):
    monkeypatch.setattr(
        routes,
        "get_mlb_standings",
        AsyncMock(side_effect=RuntimeError("upstream down")),
        raising=False,
    )
    res = TestClient(app).get("/api/mlb/standings")
    assert res.status_code == 502
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["detail"] == "MLB standings are temporarily unavailable"


def test_standings_stale_while_error():
    payload = json.loads((FIXTURES / "mlb_standings_full_sample.json").read_text())

    async def ok_standings():
        return payload

    async def ok_teams(client, season):
        return TEAM_MAP

    async def boom_standings():
        raise RuntimeError("upstream down")

    async def boom_teams(client, season):
        raise RuntimeError("upstream down")

    with patch.object(svc, "fetch_mlb_standings_payload", side_effect=ok_standings), patch.object(
        svc, "fetch_team_abbrev_map", side_effect=ok_teams
    ):
        client = TestClient(app)
        assert client.get("/api/mlb/standings").status_code == 200

    svc._cache["expires_at"] = 0

    with patch.object(
        svc, "fetch_mlb_standings_payload", side_effect=boom_standings
    ), patch.object(svc, "fetch_team_abbrev_map", side_effect=boom_teams):
        res = client.get("/api/mlb/standings")
        assert res.status_code == 200
        assert res.json()["season"] == 2026
```

- [ ] **Step 2: Run route tests — expect FAIL**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_standings_route.py -v`

Expected: FAIL (route / getters missing)

- [ ] **Step 3: Implement fetch + cache + route**

In `standings.py` (mirror `leaders.py` / `wnba/standings.py`):

```python
STANDINGS_URL = "https://statsapi.mlb.com/api/v1/standings"
TEAMS_URL = "https://statsapi.mlb.com/api/v1/teams"
STATS_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 10 * 60

async def fetch_mlb_standings_payload() -> dict:
    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        res = await client.get(
            STANDINGS_URL,
            params={"leagueId": "103,104"},
        )
        res.raise_for_status()
        return res.json()

async def fetch_team_abbrev_map(client: httpx.AsyncClient, season: int) -> dict[int, str]:
    # Same pattern as leaders.fetch_team_abbrev_map (canonical_mlb_abbrev)
    ...

async def get_mlb_standings() -> MlbStandingsResponse:
    # fresh cache → return
    # lock → double-check → fetch standings + teams map → normalize → store
    # on failure: return stale for same season if present; else raise
```

Reuse lock/fresh/stale pattern from `get_mlb_leaders`. Prefer importing or duplicating a thin teams-map fetch (duplication OK for v1 isolation from game_detail).

Wire route in `routes.py`:

```python
from app.domains.mlb.standings import get_mlb_standings
from app.domains.mlb.schemas_standings import MlbStandingsResponse

@router.get("/mlb/standings", response_model=MlbStandingsResponse)
async def mlb_standings(response: Response) -> MlbStandingsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_standings()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("MLB standings unavailable: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="MLB standings are temporarily unavailable",
            headers=_NO_STORE,
        ) from exc
```

- [ ] **Step 4: OpenAPI + system-design**

Add `"/api/mlb/standings"` to `REQUIRED_MLB_PATHS` in `openapi_export.py`.

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Update `md/system-design.md`:
- App tree: add `/mlb/standings MlbStandingsPage`
- Page ↔ API table row: `/mlb/standings` | Division standings | `useMlbStandings` | `GET /api/mlb/standings` | Stats API standings
- API inventory table if present: add `GET /api/mlb/standings`

In the design spec, set Status to `Ready for implementation` and change cold-failure wording from 503 → **502** to match Leaders.

- [ ] **Step 5: Run backend tests — PASS**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_standings_normalize.py backend/tests/test_mlb_standings_route.py -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/standings.py \
  backend/app/domains/mlb/routes.py \
  backend/app/openapi_export.py \
  backend/tests/test_mlb_standings_route.py \
  backend/openapi-golden.json \
  frontend/openapi.json \
  frontend/src/shared/lib/api.schema.d.ts \
  md/system-design.md \
  docs/superpowers/specs/2026-08-07-mlb-standings-design.md
git commit -m "$(cat <<'EOF'
feat(mlb): add standings API route and OpenAPI contract

EOF
)"
```

---

### Task 3: Frontend standings UI + data hook

**Files:**
- Modify: `frontend/src/shared/lib/api.ts`
- Create: `frontend/src/features/mlb/hooks/useMlbStandings.ts`
- Create: `frontend/src/features/mlb/hooks/useMlbStandings.test.tsx`
- Create: `frontend/src/features/mlb/league/MlbStandingsHeader.tsx`
- Create: `frontend/src/features/mlb/league/MlbStandingsHeader.test.tsx`
- Create: `frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx`
- Create: `frontend/src/features/mlb/league/MlbStandingsGrid.tsx`
- Create: `frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx`

**Interfaces:**
- Consumes: `ApiMlbStandingsResponse` from OpenAPI schemas
- Produces: `fetchMlbStandings()`, `useMlbStandings()`, header/grid/card components

- [ ] **Step 1: Write failing UI / hook tests**

`MlbStandingsHeader.test.tsx` — mirror Leaders header test but navy:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MLB_STANDINGS_BANNER_NAVY,
  MlbStandingsHeader,
} from "./MlbStandingsHeader";

describe("MlbStandingsHeader", () => {
  it("renders a navy banner titled MLB {season} Standings with bats mark", () => {
    render(<MlbStandingsHeader season={2026} />);
    const header = screen.getByTestId("mlb-standings-header");
    expect(
      screen.getByRole("heading", { name: "MLB 2026 Standings" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(10, 35, 81)" });
    expect(MLB_STANDINGS_BANNER_NAVY).toBe("#0A2351");
    const mark = header.querySelector("img");
    expect(mark?.getAttribute("src") ?? "").toMatch(/mlb-crossed-bats/);
  });
});
```

`MlbStandingsGrid.test.tsx` — sample AL East + NL West rows; assert section titles, division title, columns content, attribution, loading/error.

`useMlbStandings.test.tsx` — mirror `useWnbaStandings` / `useMlbLeaders`: loads `/api/mlb/standings`, exposes `hasNeverLoaded`.

- [ ] **Step 2: Run targeted Vitest — expect FAIL**

Run: `cd frontend && npm run test -- --run src/features/mlb/league/MlbStandingsHeader.test.tsx src/features/mlb/league/MlbStandingsGrid.test.tsx src/features/mlb/hooks/useMlbStandings.test.tsx`

Expected: FAIL (modules missing)

- [ ] **Step 3: Implement api + hook + components**

In `api.ts`:

```ts
export type ApiMlbStandingsRow = Schemas["MlbStandingsRow"];
export type ApiMlbStandingsDivision = Schemas["MlbStandingsDivision"];
export type ApiMlbStandingsLeague = Schemas["MlbStandingsLeague"];
export type ApiMlbStandingsResponse = Schemas["MlbStandingsResponse"];

export async function fetchMlbStandings(): Promise<ApiMlbStandingsResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/standings`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB standings failed: ${res.status}`);
  }
  return res.json();
}
```

`useMlbStandings.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMlbStandings } from "@/shared/lib/api";

export function useMlbStandings() {
  const query = useQuery({
    queryKey: ["mlb", "standings"],
    queryFn: fetchMlbStandings,
  });
  return {
    ...query,
    hasNeverLoaded: query.isError && query.data === undefined,
  };
}
```

`MlbStandingsHeader.tsx` — copy `MlbLeadersHeader` structure; export `MLB_STANDINGS_BANNER_NAVY = "#0A2351"`; title `MLB {season} Standings`; `data-testid="mlb-standings-header"`.

`MlbStandingsDivisionCard.tsx` — charcoal card; columns `#` Team `W-L` `PCT` `GB` `L10` Strk; team cell uses `mlbTeamLogoUrl(abbrev)` (and optional `logo_url` if present) + colored abbrev via `mlbTeamColor` / existing helper; streak muted contrast for W vs L.

`MlbStandingsGrid.tsx` — sectioned like `MlbLeadersGrid`:

```tsx
// For each league in leagues:
//   <h2>{league.label}</h2>
//   <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
//     {league.divisions.map(... MlbStandingsDivisionCard)}
//   </div>
// Loading: AL + NL skeleton sections
// Error: "Standings unavailable"
// Footer: Data: statsapi.mlb.com
```

Typography: section/card titles 18px; table headers/attribution 14px; body ~18px where it fits.

- [ ] **Step 4: Run targeted Vitest — PASS**

Run the same command as Step 2. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/api.ts \
  frontend/src/features/mlb/hooks/useMlbStandings.ts \
  frontend/src/features/mlb/hooks/useMlbStandings.test.tsx \
  frontend/src/features/mlb/league/MlbStandingsHeader.tsx \
  frontend/src/features/mlb/league/MlbStandingsHeader.test.tsx \
  frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx \
  frontend/src/features/mlb/league/MlbStandingsGrid.tsx \
  frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): add standings UI grid and data hook

EOF
)"
```

---

### Task 4: Page, router, subnav

**Files:**
- Create: `frontend/src/pages/MlbStandingsPage.tsx`
- Create: `frontend/src/pages/MlbStandingsPage.test.tsx`
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`
- Modify: `frontend/src/features/basketball/league/LeagueSubnav.tsx`
- Modify: `frontend/src/features/basketball/league/LeagueSubnav.test.tsx`

**Interfaces:**
- Consumes: `useMlbStandings`, `MlbStandingsHeader`, `MlbStandingsGrid`, `LeagueSubnav`
- Produces: navigable `/mlb/standings` with Standings active in MLB subnav

- [ ] **Step 1: Write failing page / router / subnav tests**

`MlbStandingsPage.test.tsx` — mirror `MlbLeadersPage.test.tsx`:

```tsx
// mock fetch → sample ApiMlbStandingsResponse with AL East team
// expect heading "MLB 2026 Standings"
// expect "American League", division label, team abbrev, attribution
// expect fetch called with "/api/mlb/standings"
```

`LeagueSubnav.test.tsx` — add:

```tsx
it("links MLB Standings to /mlb/standings", () => {
  renderSubnav("/mlb/standings", "mlb");
  const standings = screen.getByRole("link", { name: "Standings" });
  expect(standings).toHaveAttribute("href", "/mlb/standings");
  expect(standings).toHaveAttribute("aria-current", "page");
});
```

Keep NBA Standings disabled. Keep WNBA Standings behavior.

`AppRouter.test.tsx` — add case: renders MLB standings at `/mlb/standings` when `/api/mlb/standings` mocked.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npm run test -- --run src/pages/MlbStandingsPage.test.tsx src/features/basketball/league/LeagueSubnav.test.tsx src/app/AppRouter.test.tsx`

Expected: FAIL on new assertions / missing page

- [ ] **Step 3: Implement page + wiring**

`MlbStandingsPage.tsx`:

```tsx
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { MlbStandingsGrid } from "@/features/mlb/league/MlbStandingsGrid";
import { MlbStandingsHeader } from "@/features/mlb/league/MlbStandingsHeader";
import { useMlbStandings } from "@/features/mlb/hooks/useMlbStandings";

export function MlbStandingsPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbStandings();
  const season = data?.season ?? new Date().getFullYear();

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbStandingsHeader season={season} />
        <MlbStandingsGrid
          leagues={data?.leagues ?? []}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
```

`AppRouter.tsx`: import `MlbStandingsPage`; add `<Route path="/mlb/standings" element={<MlbStandingsPage />} />` next to leaders.

`LeagueSubnav.tsx` `itemPath`:

```tsx
if (item === "Standings" && (league === "wnba" || league === "mlb"))
  return `/${league}/standings`;
```

- [ ] **Step 4: Run frontend tests + build — PASS**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend
npm run test -- --run src/features/mlb/league/MlbStandingsHeader.test.tsx \
  src/features/mlb/league/MlbStandingsGrid.test.tsx \
  src/features/mlb/hooks/useMlbStandings.test.tsx \
  src/pages/MlbStandingsPage.test.tsx \
  src/features/basketball/league/LeagueSubnav.test.tsx \
  src/app/AppRouter.test.tsx
npm run build
```

Expected: PASS / build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MlbStandingsPage.tsx \
  frontend/src/pages/MlbStandingsPage.test.tsx \
  frontend/src/app/AppRouter.tsx \
  frontend/src/app/AppRouter.test.tsx \
  frontend/src/features/basketball/league/LeagueSubnav.tsx \
  frontend/src/features/basketball/league/LeagueSubnav.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): wire standings page route and subnav

EOF
)"
```

---

### Task 5: Spec status + full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-08-07-mlb-standings-design.md` (Status → Implemented when green)

- [ ] **Step 1: Run full verification commands**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_standings_normalize.py backend/tests/test_mlb_standings_route.py -v
cd frontend && npm run check:api
npm run test -- --run src/features/mlb/league/MlbStandingsHeader.test.tsx \
  src/features/mlb/league/MlbStandingsGrid.test.tsx \
  src/features/mlb/hooks/useMlbStandings.test.tsx \
  src/pages/MlbStandingsPage.test.tsx \
  src/features/basketball/league/LeagueSubnav.test.tsx \
  src/app/AppRouter.test.tsx
npm run build
```

Expected: all green

- [ ] **Step 2: Manual smoke (optional but recommended)**

With API + Vite running: open `/mlb/standings`, confirm navy banner, AL/NL sections, six division cards, Standings subnav active.

- [ ] **Step 3: Mark spec Implemented + commit**

```bash
# set Status: Implemented in the design spec
git add docs/superpowers/specs/2026-08-07-mlb-standings-design.md
git commit -m "$(cat <<'EOF'
docs(mlb): mark standings design implemented

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| `/mlb/standings` + HomeChromeLayout | Task 4 |
| Navy Leaders-style banner + bats | Task 3 |
| AL/NL sections → East/Central/West cards | Task 1 normalize order + Task 3 grid |
| Columns `#` Team W-L PCT GB L10 Strk | Task 1 + Task 3 card |
| `GET /api/mlb/standings` Stats API proxy + 10m cache | Task 2 |
| Subnav Standings enabled for MLB | Task 4 |
| Attribution `Data: statsapi.mlb.com` | Task 3 |
| OpenAPI + system-design update | Task 2 |
| Loading / never-loaded error / empty division | Task 3 |
| Tests backend + frontend | Tasks 1–4 |
| Out of scope (wild card, Home/Away/Diff, shared game-detail cache) | Not planned |

**Clarification applied:** cold HTTP failure is **502** (Leaders parity), not 503 from an earlier draft line in the spec — Task 2 updates the spec accordingly.

**No placeholders** left in task steps; types/names are consistent (`get_mlb_standings`, `MlbStandingsResponse`, `useMlbStandings`, navy `#0A2351`).
