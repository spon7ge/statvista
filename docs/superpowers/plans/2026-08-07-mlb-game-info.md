# MLB Game Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Game Info card on MLB game detail (date, venue+city/state, weather, umpires) under odds on Preview and under the hit chart on Live/Final Summary, fed by additive Stats API fields on game detail.

**Architecture:** Extend `normalize_mlb_live_feed` to parse venue location, weather, and boxscore officials into nullable schema fields. Shared `MlbGameInfo` React card consumes `MlbGameDetailView`; Preview wraps odds + Game Info in a right column stack; Live/Final append the card under `MlbHitChart` on Summary only.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vite · Vitest · Testing Library · lucide-react · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-mlb-game-info-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Always show the Game Info card; omit only missing rows
- Preview: right column under `MlbGameOddsBoard`
- Live/Final: Summary right rail under `MlbHitChart` (not Box tab; not halftime)
- Soft-fail normalize — missing blocks never fail game detail
- No new endpoint; extend existing live-feed normalize
- OpenAPI must stay in sync (`export_openapi` + `npm run generate:api`)
- Verify backend: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -k game_info -v` (or dedicated test file named in Task 1)
- Verify frontend: targeted Vitest for `MlbGameInfo` + placement + `npm run build`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_detail.py` | `MlbGameWeather`, `MlbGameUmpires`, additive fields |
| `backend/app/domains/mlb/game_detail.py` | Parse helpers + attach in `normalize_mlb_live_feed` |
| `backend/tests/test_mlb_game_info_normalize.py` | Normalize unit tests (new focused file) |
| `backend/tests/fixtures/` | Minimal snippet or enrich existing feed fixture |
| `backend/app/openapi_export.py` | No path change (same `/api/mlb/games/{game_pk}`) — still re-export schema |
| `frontend/openapi.json` / `api.schema.d.ts` / `openapi-golden.json` | Regenerated types |
| `frontend/src/features/mlb/lib/types.ts` | View types |
| `frontend/src/features/mlb/lib/mapMlbGameDetail.ts` | Map new fields |
| `frontend/src/features/mlb/game/MlbGameInfo.tsx` | Card UI |
| `frontend/src/features/mlb/game/MlbGameInfo.test.tsx` | Card tests |
| `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` | Right column under odds |
| `frontend/src/features/mlb/game/MlbLiveCenter.tsx` | Under hit chart |
| `frontend/src/features/mlb/game/MlbFinalCenter.tsx` | Under hit chart |
| `md/system-design.md` | Note additive game-detail fields if game row documents payload |

---

### Task 1: Backend schemas + normalize

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py`
- Modify: `backend/app/domains/mlb/game_detail.py`
- Create: `backend/tests/test_mlb_game_info_normalize.py`
- Optionally enrich: existing live-feed fixture under `backend/tests/fixtures/`

**Interfaces:**
- Produces:
  - `class MlbGameWeather(BaseModel): condition: str | None; temp_f: str | None; wind: str | None`
  - `class MlbGameUmpires(BaseModel): home_plate: str | None; first_base: str | None; second_base: str | None; third_base: str | None`
  - On `MlbGameDetail`: `venue_city`, `venue_state`, `weather`, `umpires` (all optional/nullable)
  - Helpers: `_venue_location(game_data) -> tuple[str|None, str|None]`, `_weather(game_data) -> MlbGameWeather | None`, `_umpires(boxscore) -> MlbGameUmpires | None`

- [ ] **Step 1: Write failing normalize tests**

Create `backend/tests/test_mlb_game_info_normalize.py`:

```python
from app.domains.mlb.game_detail import normalize_mlb_live_feed

def _minimal_payload(**overrides):
    base = {
        "gameData": {
            "status": {"abstractGameState": "Final", "detailedState": "Final"},
            "datetime": {"officialDate": "2026-08-07"},
            "teams": {
                "away": {"id": 147, "abbreviation": "NYY", "name": "Yankees"},
                "home": {"id": 111, "abbreviation": "BOS", "name": "Red Sox"},
            },
            "venue": {
                "name": "Yankee Stadium",
                "location": {"city": "Bronx", "state": "New York"},
            },
            "weather": {"condition": "Cloudy", "temp": "74", "wind": "2 mph N"},
        },
        "liveData": {
            "boxscore": {
                "officials": [
                    {"officialType": "Home Plate", "official": {"fullName": "Mark Ripperger"}},
                    {"officialType": "First Base", "official": {"fullName": "Dan Merzel"}},
                    {"officialType": "Second Base", "official": {"fullName": "Dan Bellino"}},
                    {"officialType": "Third Base", "official": {"fullName": "Derek Thomas"}},
                    {"officialType": "Left Field", "official": {"fullName": "Ignore Me"}},
                ]
            },
            "linescore": {},
            "plays": {"allPlays": []},
        },
    }
    # shallow-merge overrides as needed in tests
    return base

def test_normalize_game_info_fields():
    detail = normalize_mlb_live_feed(_minimal_payload(), game_pk="1", fetched_at="t")
    assert detail.venue == "Yankee Stadium"
    assert detail.venue_city == "Bronx"
    assert detail.venue_state == "New York"
    assert detail.weather is not None
    assert detail.weather.temp_f == "74"
    assert detail.weather.condition == "Cloudy"
    assert detail.weather.wind == "2 mph N"
    assert detail.umpires is not None
    assert detail.umpires.home_plate == "Mark Ripperger"
    assert detail.umpires.first_base == "Dan Merzel"
    assert detail.umpires.second_base == "Dan Bellino"
    assert detail.umpires.third_base == "Derek Thomas"

def test_normalize_game_info_soft_missing():
    payload = _minimal_payload()
    payload["gameData"]["venue"] = {"name": "Somewhere"}
    payload["gameData"].pop("weather", None)
    payload["liveData"]["boxscore"] = {}
    detail = normalize_mlb_live_feed(payload, game_pk="1", fetched_at="t")
    assert detail.venue_city is None
    assert detail.venue_state is None
    assert detail.weather is None
    assert detail.umpires is None
```

Adapt `_minimal_payload` if existing normalize tests already have a shared fixture builder — reuse that instead of inventing a conflicting shape. If status mapping requires more linescore fields, copy from an existing normalize test helper.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_info_normalize.py -v
```

Expected: FAIL (fields / helpers missing)

- [ ] **Step 3: Implement schemas + parse helpers + wire normalize**

In `schemas_game_detail.py` add models and fields on `MlbGameDetail` (defaults `None`).

In `game_detail.py`:

```python
def _venue_location(game_data: dict) -> tuple[str | None, str | None]:
    loc = _as_dict(_as_dict(game_data.get("venue")).get("location"))
    city = str(loc.get("city") or "").strip() or None
    state = str(loc.get("state") or "").strip() or None
    return city, state

def _weather(game_data: dict) -> MlbGameWeather | None:
    raw = _as_dict(game_data.get("weather"))
    if not raw:
        return None
    condition = str(raw.get("condition") or "").strip() or None
    temp_f = str(raw.get("temp") or "").strip() or None
    wind = str(raw.get("wind") or "").strip() or None
    if not condition and not temp_f and not wind:
        return None
    return MlbGameWeather(condition=condition, temp_f=temp_f, wind=wind)

_UMPIRE_TYPE_MAP = {
    "home plate": "home_plate",
    "first base": "first_base",
    "second base": "second_base",
    "third base": "third_base",
}

def _umpires(boxscore: dict) -> MlbGameUmpires | None:
    slots: dict[str, str | None] = {
        "home_plate": None,
        "first_base": None,
        "second_base": None,
        "third_base": None,
    }
    for entry in _as_list(boxscore.get("officials")):
        item = _as_dict(entry)
        key = _UMPIRE_TYPE_MAP.get(str(item.get("officialType") or "").strip().lower())
        if not key:
            continue
        name = str(_as_dict(item.get("official")).get("fullName") or "").strip()
        if name:
            slots[key] = name
    if not any(slots.values()):
        return None
    return MlbGameUmpires(**slots)
```

In `normalize_mlb_live_feed`, after venue name:

```python
venue_city, venue_state = _venue_location(game_data)
weather = _weather(game_data)
umpires = _umpires(boxscore)
# pass into MlbGameDetail(...)
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_game_detail.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_game_info_normalize.py
git commit -m "$(cat <<'EOF'
feat(mlb): normalize venue location, weather, and umpires on game detail

EOF
)"
```

---

### Task 2: OpenAPI + frontend types/mapper

**Files:**
- Regenerate: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`
- Modify: `frontend/src/features/mlb/lib/types.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- Modify: `md/system-design.md` (brief note on additive fields under `/mlb/games/:gamePk` row if payload is documented)

**Interfaces:**
- Consumes: OpenAPI `MlbGameDetail` with new fields
- Produces: view fields `venueCity`, `venueState`, `weather`, `umpires` on `MlbGameDetailView`

- [ ] **Step 1: Export OpenAPI + generate types**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api && npm run check:api
```

- [ ] **Step 2: Extend view types + mapper**

```ts
export type MlbGameWeather = {
  condition: string | null;
  tempF: string | null;
  wind: string | null;
};

export type MlbGameUmpires = {
  homePlate: string | null;
  firstBase: string | null;
  secondBase: string | null;
  thirdBase: string | null;
};

// on MlbGameDetailView:
venueCity: string | null;
venueState: string | null;
weather: MlbGameWeather | null;
umpires: MlbGameUmpires | null;
```

Map in `mapMlbGameDetail` from snake_case API fields (`temp_f` → `tempF`, etc.).

- [ ] **Step 3: Add/adjust a small mapper unit test if one exists; otherwise skip**

Prefer extending an existing `mapMlbGameDetail` test if present.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): expose game info fields in OpenAPI and detail mapper

EOF
)"
```

---

### Task 3: `MlbGameInfo` component

**Files:**
- Create: `frontend/src/features/mlb/game/MlbGameInfo.tsx`
- Create: `frontend/src/features/mlb/game/MlbGameInfo.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView`
- Produces: `<MlbGameInfo detail={detail} />` with `data-testid="mlb-game-info"`

- [ ] **Step 1: Write failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { MlbGameInfo } from "./MlbGameInfo";
// build minimal MlbGameDetailView fixture with gameDate, venue, venueCity, venueState, weather, umpires

it("renders date, venue, weather, and umpires", () => {
  render(<MlbGameInfo detail={fullDetail} />);
  expect(screen.getByTestId("mlb-game-info")).toBeInTheDocument();
  expect(screen.getByText("Game Info")).toBeInTheDocument();
  expect(screen.getByText("August 7, 2026")).toBeInTheDocument();
  expect(screen.getByText("Yankee Stadium")).toBeInTheDocument();
  expect(screen.getByText("Bronx, New York")).toBeInTheDocument();
  expect(screen.getByText("74°")).toBeInTheDocument();
  expect(screen.getByText("2 mph N")).toBeInTheDocument();
  expect(screen.getByText(/Home Plate/)).toBeInTheDocument();
  expect(screen.getByText("Mark Ripperger")).toBeInTheDocument();
});

it("omits weather and umpires rows when null", () => {
  render(<MlbGameInfo detail={minimalDetail} />);
  expect(screen.queryByText("74°")).not.toBeInTheDocument();
  expect(screen.queryByText(/Home Plate/)).not.toBeInTheDocument();
});
```

Date formatting: implement a small helper that formats `YYYY-MM-DD` as `MMMM D, YYYY` in a stable locale (`en-US`) without timezone shifting (parse as calendar date parts, not `new Date(iso)` UTC pitfalls).

- [ ] **Step 2: Run test — FAIL**

```bash
cd frontend && npm run test -- --run src/features/mlb/game/MlbGameInfo.test.tsx
```

- [ ] **Step 3: Implement card**

Dark rounded card (`rounded-xl border border-white/10 bg-white/[0.03] p-4` or match nearby cards). Title **Game Info**. Rows with lucide icons (`Calendar`, `Building2` or `Landmark`, `Cloud`, `Wind`). For umpire mask, use a simple inline SVG (catcher/mask silhouette) or `Shield` if no mask — prefer a tiny inline SVG so the mock matches.

Omit rows when:
- Date: no `gameDate`
- Venue: no `venue` and no city/state
- Weather: no `weather` or neither `tempF` nor `wind`
- Umpires: no `umpires` or all names null

Always render the titled shell even if every row is omitted.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): add Game Info card component

EOF
)"
```

---

### Task 4: Wire Preview / Live / Final + verify

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.tsx`
- Modify: `frontend/src/features/mlb/game/MlbLiveCenter.tsx`
- Modify: `frontend/src/features/mlb/game/MlbFinalCenter.tsx`
- Modify tests for those centers / projected lineups if they assert structure
- Modify: `docs/superpowers/specs/2026-08-07-mlb-game-info-design.md` → Status: Implemented

**Interfaces:**
- Preview right column: odds then Game Info
- Live/Final Summary: hit chart then Game Info

- [ ] **Step 1: Failing placement assertions**

In projected lineups test (create or extend): after render with detail, expect `mlb-game-info` under right column / after odds board.

In live/final center tests (extend if present): Summary shows `mlb-game-info`; Box tab does not.

- [ ] **Step 2: Wire UI**

`MlbProjectedLineups.tsx` — replace bare odds board sibling with:

```tsx
<div
  data-testid="mlb-preview-right-column"
  className="min-w-0 space-y-4"
>
  <MlbGameOddsBoard
    detail={detail}
    view={oddsView}
    isPending={oddsPending}
  />
  <MlbGameInfo detail={detail} />
</div>
```

`MlbLiveCenter.tsx` / `MlbFinalCenter.tsx` — after `<MlbHitChart detail={detail} />` add `<MlbGameInfo detail={detail} />` inside the right `space-y-4` stack.

- [ ] **Step 3: Run verification**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_info_normalize.py -v
cd frontend && npm run check:api
npm run test -- --run src/features/mlb/game/MlbGameInfo.test.tsx \
  src/features/mlb/game/MlbProjectedLineups.test.tsx \
  src/features/mlb/game/MlbLiveCenter.test.tsx \
  src/features/mlb/game/MlbFinalCenter.test.tsx
npm run build
```

(Skip missing test files that do not exist; add minimal placement tests if none exist.)

- [ ] **Step 4: Mark spec Implemented + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): place Game Info under odds and hit chart

EOF
)"
# if status flip is separate:
git commit -m "$(cat <<'EOF'
docs(mlb): mark game info design implemented

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Additive venue city/state, weather, umpires | Task 1 |
| Soft-fail missing blocks | Task 1 |
| OpenAPI + mapper | Task 2 |
| Card UI matching mock rows | Task 3 |
| Preview under odds (right column) | Task 4 |
| Live/Final under hit chart | Task 4 |
| Omit missing rows; always show card | Task 3 |
| Out of scope (halftime, Box, new endpoint) | Not planned |

No placeholders left; types/names consistent (`MlbGameWeather`, `temp_f`/`tempF`, `MlbGameInfo`).
