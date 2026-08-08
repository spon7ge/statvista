# MLB standings page

Date: 2026-08-07  
Status: Approved for planning

## Goal

Ship `/mlb/standings` that mirrors the MLB Leaders page chrome (Explore subnav + branded banner + sectioned grid) while presenting classic MLB standings: **American League** and **National League** sections, each with three division cards. Core columns only. Numbers come from MLB Stats API via a dedicated backend proxy. Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | MLB only; WNBA standings unchanged |
| Approach | Dedicated domain module + `GET /api/mlb/standings` (not frontend-only; not wired through game-detail) |
| Data source | `statsapi.mlb.com` `/api/v1/standings?leagueId=103,104` (AL + NL) |
| Grouping | League sections → division cards (AL East/Central/West, NL East/Central/West) |
| Columns | `#`, Team, `W-L`, `PCT`, `GB`, `L10`, Strk (no Home/Away/Diff in v1) |
| Page chrome | Leaders-style: `LeagueSubnav` → banner header → grid → attribution (no league hero) |
| Banner accent | Distinct from Leaders orange (`#F38312`); use navy `#0A2351` |
| Banner mark | Reuse crossed-bats asset from Leaders |
| Team logos | Prefer API logo when present; else existing `mlbTeamLogos` helper |
| Team colors | Existing frontend `mlbTeamColors` for abbrevs when shown colored |
| Subnav | Enable Standings for `league === "mlb"` → `/mlb/standings` |
| Attribution | `Data: statsapi.mlb.com` |
| Shared cache with game-detail | Out of scope for v1 (separate fetch/cache OK) |

## Architecture

```
HomeNav MLB → /mlb/matchups (existing)
LeagueSubnav Standings → /mlb/standings
        │
        ▼
  MlbStandingsPage (HomeChromeLayout)
        │
        ├── LeagueSubnav (mlb; Standings active)
        ├── MlbStandingsHeader (navy banner: bats + "MLB {season} Standings")
        ├── MlbStandingsGrid
        │     ├── American League → 3× MlbStandingsDivisionCard
        │     └── National League → 3× MlbStandingsDivisionCard
        └── "Data: statsapi.mlb.com"
        │
        ▼
  useMlbStandings() → GET /api/mlb/standings
        │
        ▼
  statsapi.mlb.com /api/v1/standings?leagueId=103,104
        → normalize leagues → divisions → rows → cache
```

### Routing

| Path | Element |
| --- | --- |
| `/mlb/standings` | `MlbStandingsPage` under `HomeChromeLayout` |

- `LeagueSubnav`: when `league === "mlb"`, Standings → `/mlb/standings` (same enablement pattern as WNBA Standings / MLB Leaders).
- Active pill: pathname ends with `/standings`.
- HomeNav MLB active pill continues to cover any pathname starting with `/mlb`.
- WNBA Standings route and behavior unchanged.

## Page structure

Vertical stack under nav + ticker:

1. **LeagueSubnav** — `league="mlb"`; Matchups, Prop Picks, Leaders, and Standings enabled.
2. **MlbStandingsHeader** — rounded banner, navy `#0A2351`, crossed bats mark, white title `MLB {season} Standings`.
3. **MlbStandingsGrid** — sectioned like Leaders (Batting/Pitching → AL/NL):
   - Section title **American League**, then responsive grid of East / Central / West cards.
   - Section title **National League**, then the same for NL divisions.
4. **Attribution** — `Data: statsapi.mlb.com`.

### Division card

- Charcoal card matching Leaders/WNBA (`rounded-xl border border-white/10 bg-white/[0.03]`).
- Title: division label (e.g. `AL East`).
- Table columns: `#` | Team | `W-L` | `PCT` | `GB` | `L10` | Strk.
- Team cell: logo + abbrev (+ full name when space allows); abbrev may use `mlbTeamColors`.
- Strk: emphasize wins (`W…`) vs losses (`L…`) with muted contrast (same idea as WNBA Strk styling).
- Empty division → “No data” row.
- Wide tables may scroll horizontally inside the card.
- Responsive grid for division cards: `1` col mobile → `2`/`3` on larger breakpoints within each league section.

### Typography

Follow MLB Leaders sizes where practical:

| Element | Size |
| --- | --- |
| Banner title | Match Leaders header (`~32–36px`) |
| League section title | 18px semibold |
| Division card title | 18px semibold |
| Table body | Prefer 18px (or slightly smaller if needed for seven columns on mobile; keep readable) |
| Table header / attribution / loading & error | 14px |

### States

| State | Behavior |
| --- | --- |
| Loading | Skeleton division cards under AL and NL section titles |
| Error (never loaded) | Muted “Standings unavailable”; do not wipe a prior successful payload |
| Empty division | Still render the card with a short “No data” row |
| Refetch | No fast polling; React Query defaults; backend cache owns freshness |

## Data & API

### Endpoint

`GET /api/mlb/standings` → `MlbStandingsResponse`

### Upstream

- Host: `statsapi.mlb.com`
- Path: `/api/v1/standings?leagueId=103,104`
- Season: use payload season when present; otherwise current calendar year in America/New_York
- Timeout: ~10s (align with other MLB proxies)

### Response model

```
MlbStandingsResponse
  season: int
  leagues: list[MlbStandingsLeague]

MlbStandingsLeague
  key: "al" | "nl"
  label: str          # "American League", "National League"
  divisions: list[MlbStandingsDivision]

MlbStandingsDivision
  key: str            # e.g. "al_east", "nl_west"
  label: str          # e.g. "AL East"
  teams: list[MlbStandingsRow]

MlbStandingsRow
  rank: int
  team_id: str
  abbrev: str
  name: str
  logo_url: str | null
  wins: int
  losses: int
  wl: str             # "60-53"
  pct: str            # ".531"
  gb: str             # "-" or "1.5"
  l10: str            # "6-4"
  streak: str         # "W3" / "L2"
```

### Mapping rules

- Walk Stats API `records[]` (one per division). Use league + division metadata to build `MlbStandingsLeague` / `MlbStandingsDivision`.
- League order in the response: **AL then NL**. Within each league: **East, Central, West**.
- For each `teamRecords[]` entry:
  - Division rank → `rank` (prefer explicit divisionRank / similar field when present)
  - `team.id` → `team_id` (string)
  - Team abbreviation / name from team object (or existing MLB team maps if abbrev omitted)
  - `wins` / `losses` → `wins`, `losses`, `wl` as `"{wins}-{losses}"`
  - `winningPercentage` → `pct`
  - `gamesBack` → `gb` (normalize leader `"-"` / `"0"` display consistently)
  - `lastTen` from `records.splitRecords` (type `lastTen`) → `l10` as `"{wins}-{losses}"`
  - `streak` → `streak` (string form Stats API provides, e.g. `W3`)
  - Logo: first usable team logo URL when present; else `null` (frontend falls back to `mlbTeamLogos`)
- Skip malformed team rows (missing id/abbrev) rather than failing the whole division.
- Preserve relative order within a division after ranking (API order is usually correct).

### Cache

- In-process cache similar to Leaders / WNBA standings: store response + `expires_at`.
- TTL: **10 minutes**.
- On upstream failure: return stale cache if present; otherwise **503** with `Cache-Control: no-store` (match MLB Leaders route behavior).
- Prefer `no-store` on the HTTP response and rely on the in-process TTL.

### Frontend fetch

- `fetchMlbStandings()` in `shared/lib/api.ts`
- OpenAPI / `api.schema.d.ts` types for the new schemas
- `useMlbStandings()` React Query hook (`queryKey: ["mlb", "standings"]`)

## File layout

```
backend/app/domains/mlb/schemas_standings.py
backend/app/domains/mlb/standings.py
backend/app/domains/mlb/routes.py                 # + GET /mlb/standings
backend/app/domains/mlb/schemas.py                # re-export if needed
backend/tests/test_mlb_standings_normalize.py
backend/tests/test_mlb_standings_route.py
backend/tests/fixtures/mlb_standings_full_sample.json   # AL+NL divisions (richer than last10-only fixture)

frontend/src/pages/MlbStandingsPage.tsx
frontend/src/pages/MlbStandingsPage.test.tsx
frontend/src/features/mlb/league/MlbStandingsHeader.tsx
frontend/src/features/mlb/league/MlbStandingsHeader.test.tsx
frontend/src/features/mlb/league/MlbStandingsGrid.tsx
frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx
frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx
frontend/src/features/mlb/hooks/useMlbStandings.ts
frontend/src/features/mlb/hooks/useMlbStandings.test.tsx
frontend/src/shared/lib/api.ts                    # fetchMlbStandings + types
frontend/src/app/AppRouter.tsx                    # /mlb/standings
frontend/src/features/basketball/league/LeagueSubnav.tsx  # Standings for mlb
frontend/src/features/basketball/league/LeagueSubnav.test.tsx
frontend/src/app/AppRouter.test.tsx
```

## Testing

### Backend

- Fixture → normalize produces AL then NL, three divisions each, expected columns (`wl`, `pct`, `gb`, `l10`, `streak`), stable ranks.
- Malformed team row skipped; other teams still present.
- Route: happy path `200`; cold upstream failure → `503` + `no-store`.
- Cache: second call within TTL does not re-hit upstream (mocked).

### Frontend

- Router mounts page at `/mlb/standings`.
- Subnav: Standings is a link for MLB; active on `/mlb/standings`; WNBA Standings unchanged.
- Header shows navy banner and `MLB {season} Standings`.
- Grid renders AL/NL section titles and sample division rows with core columns + attribution.
- Loading skeletons and never-loaded error copy.
- Relevant Vitest / pytest suites pass.

## Out of scope

- Wild-card standings view or playoff clinch markers
- Home / Away / Diff / RS / RA columns
- Sharing in-process cache with `game_detail.fetch_mlb_standings`
- NBA standings page
- Season switcher / historical seasons UI
- Team profile deep links

## Success criteria

- Clicking **Standings** on MLB subnav opens `/mlb/standings` with Leaders-like chrome (subnav + navy banner + sectioned grid).
- Page shows AL and NL, each with East/Central/West division tables and the core column set.
- Data comes from `GET /api/mlb/standings` backed by Stats API.
- Attribution reads `Data: statsapi.mlb.com`.
- WNBA standings and MLB Leaders remain unchanged aside from subnav enabling Standings for MLB.
