# MLB Futures tab (World Series + league + division)

Date: 2026-08-08  
Status: Approved for planning  
Related: `2026-08-01-wnba-futures-design.md`, `2026-08-07-mlb-standings-design.md`, `2026-08-07-mlb-leaders-design.md`  
ESPN UI reference: [espn.com/mlb/futures/_/group/worldseries](https://www.espn.com/mlb/futures/_/group/worldseries)

## Goal

Enable the Explore **Futures** tab for MLB at `/mlb/futures`. Show season futures odds from ESPN’s core API (World Series, league, and division markets — same feed family as [espn.com/mlb/futures](https://www.espn.com/mlb/futures)) in MLB league-hub chrome with group pills to filter markets.

## Decisions

| Topic | Choice |
| --- | --- |
| Nav | Enable Futures for `league === "mlb"` → `/mlb/futures` |
| NBA | Futures remains disabled |
| Data source | ESPN core API (not HTML scrape, not Sharp / sportsbooks directly) |
| Upstream | `GET https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{season}/futures` |
| Season | Current calendar year (America/New_York) unless an existing MLB season helper already exists — reuse if present |
| Markets | All markets returned by ESPN for that season (confirmed 2026-08-08: World Series, AL/NL winners, six division winners, Winning League) |
| Provider | Prefer active provider named like DraftKings; else first active / first listed |
| Sort | Shortest American odds first (favorites at top) |
| UI shell | Mirror MLB Leaders/Standings: `LeagueSubnav` + crossed-bats `MlbFuturesHeader` + content (no Matchups date hero) |
| Board | **MLB-owned** `MlbFuturesBoard` (do not reuse WNBA `FuturesBoard` / `LeagueFuturesPage`) |
| Market UX | Group pills: **World Series** \| **League** \| **Division** (default World Series) |
| Cache | ~5 minutes in-process |
| Branding | Product name **statvista** in any new user-facing copy |

## Architecture

```
LeagueSubnav "Futures" (mlb)
        │
        ▼
/mlb/futures  →  MlbFuturesPage
  LeagueSubnav + MlbFuturesHeader + group pills + MlbFuturesBoard
        │
        ▼
GET /api/mlb/futures
        │
        ▼
mlb/futures.py  (clone of wnba/futures.py patterns)
  fetch season futures index
  for each market → pick provider → books[]
  resolve team $ref → abbrev, name, logo_url
  normalize + sort entries
```

## Backend

### Route

`GET /api/mlb/futures`

Response shape (same envelope as WNBA):

```json
{
  "season": 2026,
  "as_of": "2026-08-08T00:00:00Z",
  "markets": [
    {
      "id": "2761",
      "name": "MLB  - World Series - Winner",
      "display_name": "World Series Winner",
      "provider": "DraftKings",
      "entries": [
        {
          "team_id": "10",
          "abbrev": "NYY",
          "name": "New York Yankees",
          "logo_url": "https://...",
          "odds_american": "+450"
        }
      ]
    }
  ],
  "error": null
}
```

### Normalize

- Parse `items[]` markets; each has `futures[]` provider blobs with `books[]` (`team` + `value`).
- Select one provider per market (DraftKings preferred when active).
- Resolve `team.$ref` (or embedded team) to `team_id`, `abbrev`, `name`, `logo_url`; cache team lookups; allowlist ESPN hosts (same as WNBA).
- Skip rows that cannot resolve to a usable team + odds string.
- Sort entries by American odds ascending (favorites first); keep ESPN display string (e.g. `+450`).
- Prefer ESPN `displayName` for `display_name` (e.g. `World Series Winner`); fall back to cleaned `name`.
- `Cache-Control: no-store` on the HTTP response; service TTL still ~5 min.

### Season selection

Use current calendar year in America/New_York, or reuse an existing MLB season helper if one already exists in the MLB domain.

## Frontend

### Subnav

- `itemPath`: `"Futures"` + `league === "mlb"` → `/mlb/futures` (keep WNBA path; NBA still null/disabled).
- `isActive`: pathname ends with `/futures`.

### Route

- `AppRouter`: `/mlb/futures` → `MlbFuturesPage`.

### Page chrome

- `LeagueSubnav league="mlb"`.
- `MlbFuturesHeader`: crossed-bats mark + `MLB {season} Futures` title; banner accent distinct from Leaders orange (`#F38312`) and Standings navy (`#0A2351`).
- Group pills under the header: **World Series** | **League** | **Division**. Default selected: **World Series**.
- `MlbFuturesBoard`: MLB feature module (e.g. `frontend/src/features/mlb/league/`), not the basketball `FuturesBoard`.
- Quiet list per visible market: `TeamAbbrevAvatar` + name + mono American odds; caption `Odds by {provider}`.
- Loading skeletons; error with no data; empty markets copy.
- Footer attribution: `Data: ESPN`.

### Group pill mapping

Filter client-side from the full `markets` payload (API returns all markets; pills do not hit the network again).

| Pill | Include when `display_name` / `name` matches (case-insensitive contains) |
| --- | --- |
| World Series | `World Series` |
| League | `American League Winner`, `National League Winner`, or `Winning League` (exclude division winners) |
| Division | `Division Winner` or names matching AL/NL East/Central/West division markets |

If a pill has zero matching markets, show empty copy for that group (do not hide the pill).

### OpenAPI

Export `frontend/openapi.json` + regenerate `api.schema.d.ts` for `GET /api/mlb/futures`. Update `md/system-design.md` page ↔ API table.

### Hook

- `useMlbFutures` — TanStack Query + `hasNeverLoaded` pattern used by other MLB league hooks.

## Error handling

| Case | Behavior |
| --- | --- |
| ESPN down, cache hit | Return cached payload; optional `error` string |
| ESPN down, no cache | `502` / UI “Unable to load futures” |
| Empty `markets` | 200 with `markets: []`; empty UI message |
| Team `$ref` fails | Omit that entry; continue |
| Pill with no markets | Empty group message; pills remain |
| NBA Futures click | Still disabled |

## Tests

- Backend: provider pick, odds parse/sort, display_name from ESPN, fixture market → entries (no live network in CI).
- Frontend: subnav enables Futures for MLB; header renders; pill filter shows the correct market blocks; loading/error/empty board states.
- OpenAPI / schema includes the new path.

## Out of scope

- NBA Futures page
- HTML scraping espn.com futures pages
- Season picker / historical seasons
- Deep links per ESPN `group=` URL (pills are app-owned groups)
- Betting deep links / affiliate CTAs
- Shared refactor extracting a multi-league futures package
- Supabase persistence of futures odds

## Success criteria

1. MLB Explore **Futures** navigates to `/mlb/futures`.
2. Page uses MLB chrome (crossed-bats header + MLB board) with World Series / League / Division pills (default World Series).
3. Odds load from ESPN core API for all season markets; DraftKings preferred when available; favorites sorted first within each market.
4. Unit tests pass without live ESPN calls in CI.
5. OpenAPI + system-design page ↔ API table updated.
