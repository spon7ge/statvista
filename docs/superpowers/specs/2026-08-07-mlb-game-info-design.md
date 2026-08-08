# MLB Game Info card

Date: 2026-08-07  
Status: Approved for planning

## Goal

Add a **Game Info** card on MLB game detail that matches the provided mock: date, venue (+ city/state), weather (temp + wind), and umpires. Place it under odds on Preview and under the hit chart on Live/Final Summary. Data comes from the existing Stats API live feed via additive fields on `GET /api/mlb/games/{gamePk}`. Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Preview + Live + Final Summary; not halftime stub; not Box tab |
| Approach | Extend game-detail normalize (Approach 1) — no separate info endpoint |
| Preview placement | Right column under `MlbGameOddsBoard` (beside lineups) |
| Live / Final placement | Summary right rail under `MlbHitChart` |
| Missing fields | Always show the card; omit only empty rows |
| Data source | Same live feed already fetched for game detail |
| Venue location | `gameData.venue.location.city` + `.state` (full name when present) |
| Weather | `gameData.weather.{condition,temp,wind}` |
| Umpires | `liveData.boxscore.officials[]` by `officialType` |
| Soft-fail | Missing blocks → nulls; never fail game detail |
| Icons | Outline icons (lucide calendar / building-stadium or building / cloud / wind; umpire mask via simple SVG or closest lucide) |

## Architecture

```
MlbGameDetailPage
  ├── scheduled → MlbPregameCenter → MlbProjectedLineups
  │                 right column: MlbGameOddsBoard → MlbGameInfo
  ├── live → MlbLiveCenter (Summary)
  │            right rail: … → MlbHitChart → MlbGameInfo
  └── final → MlbFinalCenter (Summary)
               right rail: … → MlbHitChart → MlbGameInfo
        │
        ▼
  useMlbGameDetail → GET /api/mlb/games/{gamePk}
        │
        ▼
  normalize_mlb_live_feed
        + venue city/state, weather, umpires
```

## Page structure

### Preview

Inside `MlbProjectedLineups` two-column grid, right column stack:

1. `MlbGameOddsBoard` (existing)
2. `MlbGameInfo` (new)

If odds are pending/unavailable, Game Info still renders under that slot (odds empty/pending UI unchanged).

### Live & Final

Summary tab right rail order becomes:

1. Linescore  
2. Team stats  
3. Win probability (compact)  
4. Hit chart  
5. **Game Info**

Box tab unchanged.

### Card UI

- Charcoal / dark rounded card; title **Game Info** (bold white).
- Vertical icon + content rows with generous spacing (match mock).
- Primary text white; secondary (city/state, umpire labels) muted gray.
- Rows:
  1. **Date** — calendar icon; long form from `game_date` (e.g. `August 7, 2026`). Prefer formatting `YYYY-MM-DD` in America/New_York calendar sense without inventing a clock time.
  2. **Venue** — stadium icon; venue name; second line `"{city}, {state}"` when either part exists.
  3. **Weather** — condition/cloud icon + `"{temp}°"` when temp present; wind icon + wind string when present. Show the weather row if temp and/or wind exists; condition may drive icon only.
  4. **Umpires** — mask icon; stacked lines `Home Plate:` / `First Base:` / `Second Base:` / `Third Base:` with names. Show row if at least one umpire name is present; omit individual lines that lack a name (or show only filled positions).

If all rows would be empty, still render the titled card with no body rows (no crash).

## Data & API

### Additive schema on `MlbGameDetail`

```
venue_city: str | null
venue_state: str | null

weather: MlbGameWeather | null
  condition: str | null
  temp_f: str | null      # numeric string from Stats, e.g. "74"
  wind: str | null        # display string as Stats provides

umpires: MlbGameUmpires | null
  home_plate: str | null
  first_base: str | null
  second_base: str | null
  third_base: str | null
```

Existing `venue`, `game_date`, `game_date_label` unchanged.

### Mapping rules

- **City / state:** from `gameData.venue.location`; empty strings → null.
- **Weather object:** omit (`null`) when temp, wind, and condition are all absent; otherwise include present fields.
- **Umpires:** map `officialType` case-insensitively:
  - `Home Plate` → `home_plate`
  - `First Base` → `first_base`
  - `Second Base` → `second_base`
  - `Third Base` → `third_base`
  - Ignore other types (LF, RF, etc.) in v1
  - Name from `official.fullName`
  - Entire `umpires` null when no mapped names
- Do not require new network calls.

### Frontend view

Extend `MlbGameDetailView` + `mapMlbGameDetail` with camelCase mirrors (`venueCity`, `venueState`, `weather`, `umpires`).

## File layout

```
backend/app/domains/mlb/schemas_game_detail.py   # MlbGameWeather, MlbGameUmpires, fields
backend/app/domains/mlb/game_detail.py           # parse + attach in normalize
backend/tests/test_mlb_game_detail_normalize.py  # or dedicated game-info tests
backend/tests/fixtures/…                         # enrich existing live-feed fixture if needed
frontend/openapi.json + api.schema.d.ts
frontend/src/features/mlb/lib/types.ts
frontend/src/features/mlb/lib/mapMlbGameDetail.ts
frontend/src/features/mlb/game/MlbGameInfo.tsx
frontend/src/features/mlb/game/MlbGameInfo.test.tsx
frontend/src/features/mlb/game/MlbProjectedLineups.tsx
frontend/src/features/mlb/game/MlbLiveCenter.tsx
frontend/src/features/mlb/game/MlbFinalCenter.tsx
md/system-design.md                              # note additive game-detail fields if listed
```

## Testing

### Backend

- Fixture with location + weather + four officials → mapped fields.
- Missing weather / officials / location → nulls; normalize still succeeds.
- Extra official types ignored.

### Frontend

- Card renders date, venue+city, weather, umpires from sample detail.
- Omits weather/umpires rows when null.
- Projected lineups right column includes Game Info under odds board.
- Live/Final Summary right rail includes Game Info under hit chart.

## Out of scope

- Halftime compact path
- Box Score tab
- Attendance, first pitch, TV/radio, official scorer
- Separate `/info` endpoint
- Weather icon mapping for every condition (simple cloud/wind is enough in v1)
- Changing existing odds or hit-chart behavior

## Success criteria

- Preview shows Game Info under odds with real Stats-backed fields when available.
- Live and Final Summary show Game Info under the hit chart.
- Missing weather/umpires before first pitch do not break the page; those rows simply omit.
- OpenAPI types stay in sync; brand remains **statvista**.
