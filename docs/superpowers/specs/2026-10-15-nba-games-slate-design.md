# NBA Games slate (matchups)

Date: 2026-10-15  
Status: Approved for planning

## Goal

Replace the `/nba/matchups` “NBA games coming soon” placeholder with a live dated scoreboard slate matching the WNBA/MLB Games experience: league pills, Today date nav, LIVE NOW / REST OF THE SLATE cards. Cards are not navigable in this pass (no NBA game detail yet).

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Games slate only — not game detail, props, or odds pills on cards |
| Card navigation | Non-clickable; `gameDetailHref` returns `null` for `league === "nba"` |
| Chevron | Hide on non-link cards so they do not look tappable |
| Data source | ESPN NBA scoreboard only (no stats.nba.com merge for v1) |
| API shape | Mirror WNBA: `/today` + `?date=YYYY-MM-DD`; same response fields |
| URL state | `?date=YYYY-MM-DD`; omit param when viewing today |
| Polling | Live refetch only when viewing today with in-progress games (~18s) |
| Overnight carryover | Implement on `/today` like WNBA (keep late live/final games that ESPN drops at ET midnight); dated endpoint is calendar day only |
| Architecture | New `app/domains/nba/` domain (do not refactor shared ESPN basketball normalizer in this pass) |

## Out of scope

- NBA game detail (`/games/:id` or `/nba/games/:id`)
- Odds merge on the slate
- Prop picks / DFS board for NBA
- Home ticker NBA wiring beyond existing types
- Extracting a shared ESPN basketball scoreboard module

## Architecture

```
/nba/matchups[?date=YYYY-MM-DD]
        │
        ├── parse date (invalid → fall back to today, clear bad param)
        │
        ├── useNbaScoreboard(selectedDate)
        │     today → GET /api/nba/scoreboard/today (+ poll if live)
        │     other → GET /api/nba/scoreboard?date=
        │
        └── MatchupsPanel
              cards: article (no Link); espn_event_id present but unused for nav
```

### Backend

**New package:** `backend/app/domains/nba/`

| Piece | Role |
| --- | --- |
| `schemas_scoreboard.py` | `NbaTeam`, `NbaGame` (`league: "nba"`), `NbaScoreboardResponse` |
| `scoreboard.py` | Fetch/normalize ESPN; today cache + dated cache; ET “today” lag; overnight carryover on `/today` |
| `routes.py` | `GET /api/nba/scoreboard/today`, `GET /api/nba/scoreboard?date=` |
| `__init__.py` | Package marker |

**Upstream:** `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`  
(dated queries use ESPN’s `dates=` / equivalent param the same way WNBA’s ESPN path does).

**Game fields (parity with WNBA slate):**

- `id`, `espn_event_id`, `league: "nba"`
- `status`, `status_label`, `start_time_et`
- `away` / `home`: `abbrev`, `name`, `score`, `record`, `logo_url`
- `venue`, `venue_city`

**Errors:** Upstream failure with no usable cache → `502` + `Cache-Control: no-store`. Invalid `date` → `422`.

**Wiring:** Include NBA router in `app/api/router.py`. Add scoreboard paths to OpenAPI export / golden so frontend types stay generated.

### Frontend

| View | Path |
| --- | --- |
| Today | `/nba/matchups` (no query) |
| Other day | `/nba/matchups?date=YYYY-MM-DD` |

**Page (`LeagueMatchupsPage`)**

- `league === "nba"` → `NbaMatchupsPage` (same date-nav + `MatchupsPanel` pattern as WNBA/MLB).
- Remove “NBA games coming soon” body.
- No odds hook on this page.

**API / hooks**

- `fetchNbaScoreboard`, `fetchNbaScoreboardByDate` in `shared/lib/api.ts`
- `useNbaScoreboard` mirroring `useWnbaScoreboard` (query keys under `["nba", "scoreboard", ...]`)

**Navigation guard**

- `gameDetailHref`: if `game.league === "nba"` return `null` even when `espnEventId` is set (WNBA continues to use `/games/:espnEventId`).
- `MatchupGameCard`: when `href` is null, render `<article>` and omit the chevron so the card does not look tappable.

### Docs

- Update `md/system-design.md`: `/nba/matchups` is a live dated slate (not placeholder); note cards do not link yet; list `GET /api/nba/scoreboard/*`.

## Error handling

| Case | Behavior |
| --- | --- |
| Loading first paint | Existing matchup skeletons |
| Error with no cached data | Same “Unable to load matchups” / `hasNeverLoaded` pattern as WNBA |
| Empty slate | “No games on this slate” |
| Stale success then poll error | Keep last good games (same as WNBA hook) |

## Testing

**Backend**

- Normalize fixture (ESPN NBA scoreboard JSON): status mapping, logos, venue/records, `league: "nba"`.
- Route tests for `/today` and `?date=` (200 shape; 422 bad date; 502 on total failure).

**Frontend**

- `useNbaScoreboard` today vs dated URL + poll gating.
- `LeagueMatchupsPage` with `league="nba"`: date nav present; not “coming soon”; cards render without links.
- `gameDetailHref` / `MatchupGameCard`: NBA game with `espnEventId` is non-navigable; WNBA still links.

## Success criteria

1. Games → NBA shows a real dated slate from ESPN via `/api/nba/scoreboard*`.
2. UX chrome matches WNBA/MLB (header pills + Today nav + LIVE NOW / REST OF THE SLATE).
3. Cards are not clickable and do not look like links.
4. WNBA/MLB behavior unchanged.
5. `md/system-design.md` reflects the new page ↔ API wiring.
