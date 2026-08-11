# WNBA Game Info ESPN Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend WNBA game-detail API with date, broadcast, venue location, and officials from ESPN, and rebuild `WnbaGameInfo` to match the approved screenshot layout.

**Architecture:** Parse new fields in `normalize_espn_summary` from competition + `gameInfo`, expose them on `WnbaGameDetail`, regenerate OpenAPI types, map to camelCase `GameDetail`, and render icon rows in `WnbaGameInfo` (omit empty rows; first official = Head Official; no jersey numbers).

**Tech Stack:** FastAPI/Pydantic, ESPN summary JSON, React + Vitest, OpenAPI (`scripts/export_openapi.py` + `npm run generate:api`).

## Global Constraints

- No official jersey `#`s (ESPN does not provide them).
- First official by ESPN `order` is labeled `(Head Official)`.
- Expand US state abbreviations only in the UI location line.
- Product name remains **statvista**.
- Commits only when the user explicitly requests them; skip commit steps otherwise.
- Spec: `docs/superpowers/specs/2026-08-10-wnba-game-info-design.md`

## File map

| File | Role |
| --- | --- |
| `backend/app/domains/wnba/schemas_game_detail.py` | New official model + fields on `WnbaGameDetail` |
| `backend/app/domains/wnba/game_detail.py` | Extractors + wire into `normalize_espn_summary` |
| `backend/tests/fixtures/espn_wnba_summary.json` | Enrich fixture with date/broadcasts/venue address/officials |
| `backend/tests/test_wnba_game_detail_normalize.py` | Normalize assertions |
| `backend/tests/test_wnba_pregame_enrichment.py` | Update `_minimal_scheduled_detail` constructors if required |
| `scripts/export_openapi.py` → `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts` | Contract sync |
| `frontend/src/features/basketball/lib/types.ts` | View-model fields |
| `frontend/src/features/basketball/lib/mapGameDetail.ts` (+ test) | Mapping |
| `frontend/src/features/basketball/lib/testFixtures.ts` | Defaults for new fields |
| `frontend/src/features/basketball/game/WnbaGameInfo.tsx` (+ test) | UI |

---

### Task 1: Backend schema + normalize extractors

**Files:**
- Modify: `backend/app/domains/wnba/schemas_game_detail.py`
- Modify: `backend/app/domains/wnba/game_detail.py`
- Modify: `backend/tests/fixtures/espn_wnba_summary.json`
- Modify: `backend/tests/test_wnba_game_detail_normalize.py`
- Modify: `backend/tests/test_wnba_pregame_enrichment.py` (and any other `WnbaGameDetail(...)` constructors that break)

**Interfaces:**
- Produces: `GameDetailOfficial(name: str, order: int)`; `WnbaGameDetail` fields `game_date`, `broadcast`, `venue_city`, `venue_state`, `officials: list[GameDetailOfficial] | None`

- [ ] **Step 1: Write failing normalize test**

Enrich `backend/tests/fixtures/espn_wnba_summary.json`:

- On `header.competitions[0]` add:
  - `"date": "2026-08-10T02:00Z"`
  - `"broadcasts": [{ "isNational": true, "market": { "type": "National" }, "type": { "shortName": "TV" }, "media": { "shortName": "USA" } }]`
- Expand `gameInfo` to:

```json
"gameInfo": {
  "venue": {
    "fullName": "Mortgage Matchup Center",
    "address": { "city": "Phoenix", "state": "AZ" }
  },
  "officials": [
    { "displayName": "Fatou Cissoko-Stephens", "fullName": "Fatou Cissoko-Stephens", "order": 1 },
    { "displayName": "Ken Jones", "fullName": "Ken Jones", "order": 2 },
    { "displayName": "Marcy Williams", "fullName": "Marcy Williams", "order": 3 }
  ]
}
```

Add to `backend/tests/test_wnba_game_detail_normalize.py`:

```python
def test_normalize_game_info_date_broadcast_venue_officials():
    payload = load_fixture("espn_wnba_summary.json")
    detail = normalize_espn_summary(
        payload,
        espn_event_id="401857098",
        fetched_at="2026-07-30T00:00:00-04:00",
    )
    assert detail.game_date == "2026-08-10"
    assert detail.broadcast == "USA"
    assert detail.venue == "Mortgage Matchup Center"
    assert detail.venue_city == "Phoenix"
    assert detail.venue_state == "AZ"
    assert detail.officials is not None
    assert [o.model_dump() for o in detail.officials] == [
        {"name": "Fatou Cissoko-Stephens", "order": 1},
        {"name": "Ken Jones", "order": 2},
        {"name": "Marcy Williams", "order": 3},
    ]
```

Also add a small unit-style case (inline payload) that prefers national TV over streaming when both exist.

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend pytest backend/tests/test_wnba_game_detail_normalize.py::test_normalize_game_info_date_broadcast_venue_officials -v
```

Expected: FAIL (missing fields / AttributeError).

- [ ] **Step 3: Add schema models/fields**

In `schemas_game_detail.py`:

```python
class GameDetailOfficial(BaseModel):
    name: str
    order: int


class WnbaGameDetail(BaseModel):
    # ...existing...
    venue: str | None
    game_date: str | None = None
    broadcast: str | None = None
    venue_city: str | None = None
    venue_state: str | None = None
    officials: list[GameDetailOfficial] | None = None
    # ...rest...
```

Defaults (`= None`) keep existing constructors compiling; still set explicitly in normalize.

- [ ] **Step 4: Implement extractors and wire normalize**

In `game_detail.py`:

```python
def _competition_game_date(comp: dict) -> str | None:
    raw = comp.get("date")
    if not isinstance(raw, str) or len(raw) < 10:
        return None
    candidate = raw[:10]
    try:
        date.fromisoformat(candidate)
    except ValueError:
        return None
    return candidate


def _pick_broadcast(comp: dict) -> str | None:
    broadcasts = comp.get("broadcasts") or []
    if not isinstance(broadcasts, list):
        return None

    def short_name(entry: dict) -> str | None:
        media = entry.get("media") or {}
        name = media.get("shortName") if isinstance(media, dict) else None
        return str(name).strip() or None if name else None

    nationals = [
        b for b in broadcasts
        if isinstance(b, dict)
        and (
            b.get("isNational") is True
            or str((b.get("market") or {}).get("type") or "").lower() == "national"
        )
    ]
    pool = nationals or [b for b in broadcasts if isinstance(b, dict)]

    def is_tv(entry: dict) -> bool:
        t = entry.get("type") or {}
        return str((t.get("shortName") if isinstance(t, dict) else "") or "").lower() == "tv"

    for entry in pool:
        if is_tv(entry):
            name = short_name(entry)
            if name:
                return name
    for entry in pool:
        name = short_name(entry)
        if name:
            return name
    return None


def _venue_city_state(game_info: dict) -> tuple[str | None, str | None]:
    venue = game_info.get("venue") or {}
    if not isinstance(venue, dict):
        return None, None
    address = venue.get("address") or {}
    if not isinstance(address, dict):
        return None, None
    city = str(address.get("city") or "").strip() or None
    state = str(address.get("state") or "").strip() or None
    return city, state


def _normalize_officials(game_info: dict) -> list[GameDetailOfficial] | None:
    raw = game_info.get("officials") or []
    if not isinstance(raw, list) or not raw:
        return None
    out: list[GameDetailOfficial] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("displayName") or entry.get("fullName") or "").strip()
        if not name:
            continue
        try:
            order = int(entry.get("order") or 0)
        except (TypeError, ValueError):
            order = 0
        out.append(GameDetailOfficial(name=name, order=order))
    if not out:
        return None
    out.sort(key=lambda o: o.order)
    return out
```

In `normalize_espn_summary`, after reading `comp` / venue:

```python
game_info = payload.get("gameInfo") or {}
if not isinstance(game_info, dict):
    game_info = {}
venue = (game_info.get("venue") or {}).get("fullName")
venue_city, venue_state = _venue_city_state(game_info)
# ...
return WnbaGameDetail(
    ...
    venue=str(venue) if venue else None,
    game_date=_competition_game_date(comp if isinstance(comp, dict) else {}),
    broadcast=_pick_broadcast(comp if isinstance(comp, dict) else {}),
    venue_city=venue_city,
    venue_state=venue_state,
    officials=_normalize_officials(game_info),
    ...
)
```

Ensure `from datetime import date` (or `datetime.date`) is imported.

- [ ] **Step 5: Run normalize tests**

```bash
PYTHONPATH=backend pytest backend/tests/test_wnba_game_detail_normalize.py backend/tests/test_wnba_pregame_enrichment.py -v
```

Expected: PASS. Fix any `WnbaGameDetail(...)` call sites that reject unknown required fields (defaults should prevent this).

- [ ] **Step 6: Commit (only if user requested)**

```bash
git add backend/app/domains/wnba/schemas_game_detail.py \
  backend/app/domains/wnba/game_detail.py \
  backend/tests/fixtures/espn_wnba_summary.json \
  backend/tests/test_wnba_game_detail_normalize.py
git commit -m "$(cat <<'EOF'
feat(wnba): extract game info date, broadcast, venue location, officials

EOF
)"
```

---

### Task 2: Regenerate OpenAPI client types

**Files:**
- Update: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Consumes: Task 1 Pydantic models
- Produces: `ApiWnbaGameDetail` with new snake_case fields in `api.schema.d.ts`

- [ ] **Step 1: Export and generate**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=.:backend python scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api && npm run check:api
```

Expected: `WnbaGameDetail` in `api.schema.d.ts` includes `game_date`, `broadcast`, `venue_city`, `venue_state`, `officials`.

- [ ] **Step 2: Commit (only if user requested)**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
chore: regenerate OpenAPI for WNBA game info fields

EOF
)"
```

---

### Task 3: Frontend types + mapper

**Files:**
- Modify: `frontend/src/features/basketball/lib/types.ts`
- Modify: `frontend/src/features/basketball/lib/mapGameDetail.ts`
- Modify: `frontend/src/features/basketball/lib/mapGameDetail.test.ts`
- Modify: `frontend/src/features/basketball/lib/testFixtures.ts`

**Interfaces:**
- Produces: `GameDetailOfficial { name: string; order: number }`; `GameDetail` fields `gameDate`, `broadcast`, `venueCity`, `venueState`, `officials`

- [ ] **Step 1: Failing mapper test**

```ts
it("maps game info date, broadcast, venue location, and officials", () => {
  const mapped = mapGameDetail({
    ...baseApiDetail, // existing minimal fixture in the test file
    game_date: "2026-08-10",
    broadcast: "USA",
    venue: "Climate Pledge Arena",
    venue_city: "Seattle",
    venue_state: "WA",
    officials: [
      { name: "Fatou Cissoko-Stephens", order: 1 },
      { name: "Ken Jones", order: 2 },
    ],
  });
  expect(mapped.gameDate).toBe("2026-08-10");
  expect(mapped.broadcast).toBe("USA");
  expect(mapped.venueCity).toBe("Seattle");
  expect(mapped.venueState).toBe("WA");
  expect(mapped.officials).toEqual([
    { name: "Fatou Cissoko-Stephens", order: 1 },
    { name: "Ken Jones", order: 2 },
  ]);
});
```

Adapt to whatever base object `mapGameDetail.test.ts` already uses (`null` defaults for new fields in the happy-path baseline assert).

- [ ] **Step 2: Run — expect fail**

```bash
cd frontend && npx vitest run src/features/basketball/lib/mapGameDetail.test.ts
```

- [ ] **Step 3: Implement types + map + fixtures**

```ts
export type GameDetailOfficial = { name: string; order: number };

export type GameDetail = {
  // ...
  venue: string | null;
  gameDate: string | null;
  broadcast: string | null;
  venueCity: string | null;
  venueState: string | null;
  officials: GameDetailOfficial[] | null;
  // ...
};
```

In `mapGameDetail`:

```ts
gameDate: detail.game_date ?? null,
broadcast: detail.broadcast ?? null,
venueCity: detail.venue_city ?? null,
venueState: detail.venue_state ?? null,
officials: detail.officials
  ? detail.officials.map((o) => ({ name: o.name, order: o.order }))
  : null,
```

Update `testFixtures` builders to set the new fields (`null` by default).

- [ ] **Step 4: Run mapper tests — PASS**

```bash
cd frontend && npx vitest run src/features/basketball/lib/mapGameDetail.test.ts
```

- [ ] **Step 5: Commit (only if user requested)**

---

### Task 4: Rebuild `WnbaGameInfo` UI

**Files:**
- Modify: `frontend/src/features/basketball/game/WnbaGameInfo.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaGameInfo.test.tsx`

**Interfaces:**
- Consumes: enriched `GameDetail` from Task 3
- Produces: screenshot-ordered rows; omit empties

- [ ] **Step 1: Rewrite tests to match target layout**

```tsx
it("renders date, broadcast, venue location, and officials", () => {
  render(
    <WnbaGameInfo
      detail={{
        ...detail,
        gameDate: "2026-08-10",
        broadcast: "USA",
        venue: "Climate Pledge Arena",
        venueCity: "Seattle",
        venueState: "WA",
        officials: [
          { name: "Fatou Cissoko-Stephens", order: 1 },
          { name: "Ken Jones", order: 2 },
          { name: "Marcy Williams", order: 3 },
        ],
      }}
    />,
  );
  expect(screen.getByText("August 10, 2026")).toBeInTheDocument();
  expect(screen.getByText("USA")).toBeInTheDocument();
  expect(screen.getByText("Climate Pledge Arena")).toBeInTheDocument();
  expect(screen.getByText("Seattle, Washington")).toBeInTheDocument();
  expect(
    screen.getByText("Fatou Cissoko-Stephens (Head Official)"),
  ).toBeInTheDocument();
  expect(screen.getByText("Ken Jones")).toBeInTheDocument();
  expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
});

it("omits empty rows when optional game info is missing", () => {
  render(
    <WnbaGameInfo
      detail={{
        ...detail,
        gameDate: null,
        broadcast: null,
        venue: null,
        venueCity: null,
        venueState: null,
        officials: null,
      }}
    />,
  );
  expect(screen.getByTestId("wnba-game-info")).toBeInTheDocument();
  expect(screen.queryByText("USA")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd frontend && npx vitest run src/features/basketball/game/WnbaGameInfo.test.tsx
```

- [ ] **Step 3: Implement UI**

Mirror MLB `InfoRow` layout. Icons: `Calendar`, `Tv` or `Play` (screenshot play-in-rectangle — prefer Lucide `TvMinimalPlay` / `MonitorPlay` if available, else `Tv`), venue use a stadium-like icon if present (`Landmark` or keep `Building2`), whistle via small inline SVG (or Lucide `Whistle` if available in the installed lucide version).

Helpers in the same file (or tiny local util):

```ts
export function formatWnbaGameDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", /* ... full 50 + DC ... */ WA: "Washington",
};

function formatVenueLocation(city: string | null, state: string | null): string | null {
  const cityPart = city?.trim() || null;
  const stateRaw = state?.trim() || null;
  const statePart = stateRaw
    ? US_STATE_NAMES[stateRaw.toUpperCase()] ?? stateRaw
    : null;
  const parts = [cityPart, statePart].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
```

Include the full 50-state + DC map (copy a standard abbrev table — do not leave `/* ... */` placeholders).

Render order: date → broadcast → venue → officials. Official line:

```tsx
{officials.map((o, index) => (
  <p key={`${o.order}-${o.name}`} className="text-sm text-white">
    {index === 0 ? `${o.name} (Head Official)` : o.name}
  </p>
))}
```

Use `className="!p-3"` on `GameSection` for Summary card parity if other cards use it.

- [ ] **Step 4: Run UI + related tests**

```bash
cd frontend && npx vitest run \
  src/features/basketball/game/WnbaGameInfo.test.tsx \
  src/features/basketball/lib/mapGameDetail.test.ts \
  src/features/basketball/game/WnbaPregameCenter.test.tsx \
  src/features/basketball/game/WnbaFinalCenter.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit (only if user requested)**

```bash
git add frontend/src/features/basketball/game/WnbaGameInfo.tsx \
  frontend/src/features/basketball/game/WnbaGameInfo.test.tsx \
  frontend/src/features/basketball/lib/types.ts \
  frontend/src/features/basketball/lib/mapGameDetail.ts \
  frontend/src/features/basketball/lib/mapGameDetail.test.ts \
  frontend/src/features/basketball/lib/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(wnba): enrich Game Info with date, broadcast, venue, officials

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| `game_date` / broadcast / venue city-state / officials API | 1 |
| OpenAPI sync | 2 |
| Frontend map | 3 |
| Screenshot UI rows + Head Official + no `#` | 4 |
| Expand state abbrev in UI | 4 |
| Omit empty rows | 4 |

## Self-review notes

- Broadcast preference (national TV first) is explicit in Task 1 helper.
- Fixture enrichment keeps the primary normalize suite covering the new paths.
- State expansion is client-only; wire keeps ESPN abbrev.
