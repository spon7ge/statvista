# statvista website + API system design

Date: 2026-10-18  
Status: Current-state reference (onboarding)  
Scope: React website (`frontend/`) + FastAPI read path (`backend/`) + the odds snapshots that path reads  
Audience: Contributors and future-you navigating page ↔ API wiring

## Goal

Document how the live statvista website works from the browser to the upstream source, so a contributor can answer “what powers this page?” without reverse-engineering the tree.

## Non-goals

- Scraper internals (which book parser writes which column). The end-to-end section only says that scrapers fill the odds tables the API reads.
- Deployment / hosting runbooks
- MLB Statcast (not in the current slice)

---

## 1. Overview & boundaries

statvista’s public site is a React + Vite app talking to a FastAPI service over `/api`. `/` replace-redirects to **MLB games**. The product surface is **Props and Games** (plus game detail), with Site links for **About**, **Blog**, and **Contact**. **WNBA** has a live games slate, an anchor-book prop-picks research table, and game detail. **MLB** adds a live games hub (dated slate), game detail, and an anchor-book prop-picks research table. **NBA** has a live games slate (`/nba/matchups`, ESPN scoreboard, no odds on cards), a live anchor-book prop-picks research table at `/nba/prop_picks`, and WNBA-parity game detail at `/nba/games/:espnEventId` (Preview / Away / Home; live/final Summary \| Box; no Props tab).

### End to end

Local run is two processes. FastAPI listens on port 8000 (`PYTHONPATH=..:. uvicorn app.main:app --reload --port 8000` from `backend/`). Vite listens on port 5173 and proxies `/api` to that process, so the browser never sees `SHARP_API_KEY` or `PARLAY_API_KEY`. Static hosts set `VITE_API_BASE_URL` instead of using the proxy.

```text
Browser
  → React page (TanStack Query hook → frontend/src/shared/lib/api.ts)
  → FastAPI /api/{wnba|mlb|nba}/…
  → one of:
      ESPN, stats.wnba.com, MLB Stats API, RotoWire   (live game data)
      SharpAPI                                             (MLB and NBA game odds)
      ParlayAPI                                            (WNBA game odds; prop snapshots)
      Supabase via SUPABASE_DB_URL                        (odds tables the boards read)
```

Odds rows are not computed on the click. Scrapers (`python -m src.scrapers.run_all_odds`, plus a host browser for PrizePicks) write Supabase. The prop board and the Preview odds boards read those tables. There is no model in this path.

**Opening the site.** `/` replace-redirects to `/mlb/matchups`. `HomeChromeLayout` draws the wordmark (links to MLB games), the sidebar, the page, and a footer that is only the copyright line. An unknown path renders `NotFoundPage` (same footer, link back to games) outside that layout. About, Blog, and Contact are static. Contact's send button is not wired.

**Games.** League pills keep you on Games or Props and change the league. The matchups page loads that league's scoreboard (`/today`, or `?date=`). MLB comes from the MLB Stats API. WNBA and NBA come from ESPN; WNBA also cross-checks stats.wnba.com. A card opens game detail:

| League | Page | What the page asks for |
|--------|------|------------------------|
| WNBA | `/games/:espnEventId` | `GET /api/wnba/games/{id}`, Preview odds `GET /api/wnba/odds/today`, Away/Home `GET /api/wnba/games/{id}/team-preview?side=` |
| NBA | `/nba/games/:espnEventId` | The NBA twins of those three. Record and last-10 are absent. Preview `book_boards` is empty until NBA team snapshots exist; Sharp `games[]` can still fill the board. |
| MLB | `/mlb/games/:gamePk` | `GET /api/mlb/games/{gamePk}`, Preview lineups `GET /api/mlb/lineups` and `GET /api/mlb/lineups/matchup`, Preview odds `GET /api/mlb/odds/today`, Away/Home team preview |

Game detail composes that payload in the API: ESPN or the Stats API for the game, RotoWire for projected lineups, and the odds call above. WNBA game detail still loads ESPN standings so the header can show record and last-10. No game page has a Props tab.

**Props.** Each board calls `GET /api/{league}/props/board?book=` (omit `book` and the server uses PrizePicks). The handler clusters snapshot quotes by player, stat, and exact line, keeps a cluster only when the anchor book posted that line, and emits an Over row and an Under row. IP is the average raw implied probability of the anchor and the other books on that same line. L5/L10/L15 (and H2H for WNBA and NBA) come from a once-a-day season-log cache under `data/cache/season_logs/`; a failed refresh keeps yesterday's file. The page then filters (game, book count, proposition, side, name, hit rate) and hides rows whose tip has passed or whose teams are not on the upcoming slate. The sidebar prefetches the open league's PrizePicks board. The query stays fresh for 15 minutes and does not refetch on window focus.

**Routes that still exist and that no page calls.** `GET /api/mlb/props/today`, `GET /api/wnba/props/today`, `GET /api/mlb/props/game/{game_pk}`, and `GET /api/wnba/props/game/{espn_event_id}`. Player-slug URLs (`/wnba|mlb|nba/prop_picks/player/:slug`) replace-redirect to that league's board.

The sidebar's primary card is **Props** and **Games** for the open league (otherwise MLB). NBA Props goes to `/nba/prop_picks`. A Site card under that has About, Blog, and Contact. On a narrow screen the sidebar is a hamburger drawer; Escape or the backdrop closes it. Props links prefetch that league's board on hover, and the sidebar warms the same board when it mounts.

---

## 2. Frontend shell & route map

### Stack

| Layer | Choice |
|-------|--------|
| UI runtime | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styling | `tokens.css` + `ui.css`; Tailwind v4 layout utilities mapped to those tokens |
| Routing | React Router (`BrowserRouter` + `AppRouter`) |
| Data fetching | TanStack Query |
| API types | OpenAPI → `frontend/src/shared/lib/api.schema.d.ts` (`npm run generate:api`) |

**Dev:** Vite proxies `/api` → `http://127.0.0.1:8000`.  
**Static hosts:** set `VITE_API_BASE_URL` to the API origin (no proxy).

### App tree

```text
main.tsx
  QueryClientProvider → BrowserRouter → AppRouter
    HomeChromeLayout (AppSidebar + SiteFooter)
      /                    Navigate → /mlb/matchups
      /games/:espnEventId  GameDetailPage
      /wnba/matchups       LeagueMatchupsPage (league="wnba")
      /wnba/prop_picks     LeaguePropPicksPage (research table)
      /wnba/prop_picks/player/:playerSlug  replace-redirect → /wnba/prop_picks
      /nba/matchups        LeagueMatchupsPage (league="nba", live slate)
      /nba/prop_picks      NbaPropPicksPage
      /nba/prop_picks/player/:playerSlug  replace-redirect → /nba/prop_picks
      /nba/games/:espnEventId  NbaGameDetailPage
      /mlb/matchups        LeagueMatchupsPage (league="mlb", live slate)
      /mlb/prop_picks      MlbPropPicksPage
      /mlb/prop_picks/player/:playerSlug  replace-redirect → /mlb/prop_picks
      /mlb/games/:gamePk   MlbGameDetailPage
      /about               AboutPage
      /blog                BlogPage
      /blog/:slug          BlogPostPage
      /contact             ContactPage
    * → NotFoundPage
```

### Conventions

| Layer | Role |
|-------|------|
| `frontend/src/pages/` | Route composition |
| `frontend/src/features/{home,basketball,mlb,nba}/` | UI and TanStack Query hooks by domain |
| `frontend/src/shared/lib/api.ts` | Typed `fetch` helpers + `VITE_API_BASE_URL` |

**Chrome data:** The layout itself does not fetch scoreboards. Games pages load each league's scoreboard independently.

---

## 3. Page ↔ API map

| Route | Page job | Hook(s) | API | Upstream / notes |
|-------|----------|---------|-----|------------------|
| `/` | Landing | — | — | Replace-redirect to `/mlb/matchups` |
| `/about` | Static About (who built it, why, research-not-advice, tech stack); sidebar Site link | — | none | `AboutPage` / `AboutContent`; no API |
| `/blog` | Blog index, 2 posts per row from `sm` (category, title, question excerpt, topics, date, read time; no image); sidebar Site link | — | none | `BlogPage` / `BlogIndex`; static catalog |
| `/blog/:slug` | Article for a catalog slug (same fields, no image); unknown slug → NotFound | — | none | `BlogPostPage` / `BlogPost`; `getPost` |
| `/contact` | Contact form stub (name, subject, description); Send disabled — coming soon; sidebar Site link | — | none | `ContactPage` / `ContactForm`; no API |
| `/wnba/matchups?date=` | Daily slate (no team-lines odds pill); Games header with MLB/WNBA/NBA league pills and **Today** date nav on that same row | `useWnbaScoreboard(date)` | scoreboard (`/today` or `?date=`) | Cards → `/games/:espnEventId` (Preview odds board uses `GET /api/wnba/odds/today`) |
| `/wnba/prop_picks` | Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (stacked: anchor number above selected book logo + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed book list, stored in ?book=), Books (multi-select exact counts from 1 through the fullest row; a row's count is the anchor plus Odds chips with a posted price at that line), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter. | `useWnbaPropBoard(book)` | `GET /api/wnba/props/board?book=` | Client filterWnbaPropBoardRows (game + market + side + name + book count). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker. Rows whose listed tip has passed, and rows for teams that are not on the loaded slate, are hidden on the page (rechecked every 30s, without waiting for the 15-minute board refetch). |
| `/wnba/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/wnba/prop_picks`. `WnbaPlayerPropsOddsGrid` remains for shared book-column patterns |
| `/games/:espnEventId` | Game detail: scheduled → MLB-parity pregame (broadcast header with record + last 10; centered Preview / Away / Home); Preview two-column (left: Projected Starters → Game Info → Matchup Prediction → Game Leaders PPG/RPG/APG; right: multi-book Odds board → Team Stats + `#rank` (after FT%: EFG%, TS%, AST%, AST/TO, OREB%, DREB%, REB%, TOV%, OFF, DEF, NET, PACE, PIE from the season-log cache) → Injuries); Away/Home → team preview (PPG/RPG/APG/BPG/SPG leaders + roster averages; after FT% the season-log cache adds USG%, EFG%, TS%, AST%, AST/TO, OREB%, DREB%, REB%, TOV%, OFF, DEF, NET, PIE, then RTG, +/-); live/halftime or final → broadcast header + Summary \| Box (Scoring plays \| All plays; Summary right rail: linescore, team stats, win probability, shot chart, Game Info; Box: stacked away/home box score) | `useGameDetail`, `useWnbaOdds`, `useWnbaTeamPreview(espnEventId, side)` | `GET /api/wnba/games/{id}`, `GET /api/wnba/odds/today` (Preview `book_boards`), `GET /api/wnba/games/{id}/team-preview?side=` (Away/Home) | ESPN summary + standings/team stats/roster for enrichment (standings + roster JSON via `app.core.outbound_cache`); RotoWire starters; Preview odds prefer `book_boards` (ProphetX → Novig → Pinnacle) with soft-fail per book and fallback to legacy `games[]`; soft-fail empty sections; no Player of the Game or pitch zone |
| `/nba/matchups?date=` | Daily slate (no odds pill); Games header with MLB/WNBA/NBA pills + **Today** date nav | `useNbaScoreboard(date)` | `GET /api/nba/scoreboard/today` or `?date=` | ESPN NBA scoreboard; cards → `/nba/games/:espnEventId` via `gameDetailHref` when `espn_event_id` present |
| `/nba/prop_picks` | Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (stacked: anchor number above selected book logo + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed seven-book list, stored in ?book=), Books (multi-select exact counts from 1 through the fullest row; a row's count is the anchor plus Odds chips with a posted price at that line), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter. | `useNbaPropBoard(book)` | `GET /api/nba/props/board?book=` | Client filterNbaPropBoardRows (game + market + side + name + book count). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker. Rows whose listed tip has passed, and rows for teams that are not on the loaded slate, are hidden on the page (rechecked every 30s, without waiting for the 15-minute board refetch). |
| `/nba/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/nba/prop_picks`. |
| `/nba/games/:espnEventId` | Game detail: scheduled → WNBA-parity pregame (broadcast header shows team identity and matchup; record / last 10 remain unavailable until standings are wired; centered Preview / Away / Home — no Props tab); Preview two-column (left: Projected Starters → Game Info → Matchup Prediction → Game Leaders PPG/RPG/APG; right: Odds board → Season Team Stats + `#rank` (after FT%: EFG%, TS%, AST%, AST/TO, OREB%, DREB%, REB%, TOV%, OFF, DEF, NET, PACE, PIE from the season-log cache) → Injuries); Away/Home → team preview (PPG/RPG/APG/BPG/SPG leaders + roster averages; after FT% the season-log cache adds USG%, EFG%, TS%, AST%, AST/TO, OREB%, DREB%, REB%, TOV%, OFF, DEF, NET, PIE, then RTG, +/-); live/halftime or final → broadcast header + Summary \| Box (Scoring plays \| All plays; Summary right rail: linescore, team stats, win probability, shot chart, Game Info; Box: stacked away/home box score) | `useNbaGameDetail`, `useNbaOdds`, `useNbaTeamPreview(espnEventId, side)` | `GET /api/nba/games/{id}`, `GET /api/nba/odds/today` (Preview `book_boards` is currently empty because NBA team snapshots do not exist; Sharp-backed `games[]` may populate), `GET /api/nba/games/{id}/team-preview?side=` (Away/Home) | ESPN NBA summary + team stats/roster enrichment; NBA standings enrichment is not wired, so record / last 10 stay absent. RotoWire NBA starters when available; Preview odds falls back to Sharp-backed `games[]` while `book_boards` is empty; poll ~18s when live/halftime; soft-fail empty sections; Back → `/nba/matchups`. Spec: `docs/superpowers/specs/2026-10-15-nba-game-detail-design.md` |
| `/mlb/matchups?date=` | Daily slate (no team-lines odds pill); Games header with MLB/WNBA/NBA league pills and **Today** date nav on that same row | `useMlbScoreboard(date)` | scoreboard (`/today` or `?date=`) | Stats API schedule; cards → `/mlb/games/:gamePk` (Preview odds board still uses `GET /api/mlb/odds/today`) |
| `/mlb/prop_picks` | Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (stacked: anchor number above selected book logo + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed book list, stored in ?book=), Books (multi-select exact counts from 1 through the fullest row; a row's count is the anchor plus Odds chips with a posted price at that line), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter. | `useMlbPropBoard(book)` | `GET /api/mlb/props/board?book=` | Client filterMlbPropBoardRows (game + market + side + name + book count). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker. Rows whose listed tip has passed, and rows for teams that are not on the loaded slate, are hidden on the page (rechecked every 30s, without waiting for the 15-minute board refetch). |
| `/mlb/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/mlb/prop_picks`. `MlbPlayerPropsOddsGrid` remains for shared book-column patterns |
| `/mlb/games/:gamePk` | Game detail: pregame broadcast header (Preview shows RotoWire lineups when matched with right-rail odds board beside lineups; Preview / Away / Home tabs; Preview keeps team odds board beside lineups; Away/Home tabs show **team preview** (Team Batting/Pitching Leaders + full active-roster season batting/pitching tables); under lineups: season Team Stats (with league `#N` ranks) + Injuries; right rail Odds → Game Info → Matchup prediction (ESPN) when present, then Game Leaders — HR/AVG/OPS batter cards (best active-roster hitter per category, value + muted `#N`, last name + team logo, ESPN headshots)), live Summary/Box center (ESPN-style matchup + pitch zone above play feed, linescore/team stats/win prob/hit chart in Summary right rail, box score side-by-side in Box tab), or final Summary/Box center (optional fan-vote Player of the Game card from MLB Play above Play feed when winner published; hidden when null) | `useMlbGameDetail(gamePk)`, `useMlbLineups(date)`, `useMlbLineupMatchup`, `useMlbOdds`, `useMlbTeamPreview(gamePk, side)` | `GET /api/mlb/games/{gamePk}`, `GET /api/mlb/lineups?date=` (Preview tab), `GET /api/mlb/lineups/matchup?date=&away=&home=`, `GET /api/mlb/odds/today` (Preview odds board), `GET /api/mlb/games/{gamePk}/team-preview?side=away|home` (Away/Home tabs) | MLB Stats API (+ ESPN when available); RotoWire projected lineups for Preview, matched by abbrev with both sides' pitcher + 9 batters complete; Stats API enriches the matched lineup with season pitching and career BvP; Preview right-rail odds board stacks matched books from `odds/today` `book_boards` (ProphetX → Novig → Pinnacle only) with Money / Total / Spread columns per away/home row pair and a subtle book name under each pair; falls back to legacy `games[]` when `book_boards` is empty; Preview soft-merges season YTD team hitting/pitching (Stats) + league competition ranks + injuries (ESPN) under projected lineups even when lineups are unavailable; Preview Matchup prediction from ESPN summary `predictor` when available (hidden when null); Game Leaders from game detail payload (`game_leaders`; best roster batter per HR/AVG/OPS with league rank; hidden when null); Final soft-merges MLB Play fan-vote `player_of_the_game` on game detail (null when absent or not final); halftime falls back to compact header; game detail payload also includes optional `venue_city`, `venue_state`, `weather`, and `umpires` for Game Info UI |

### Cross-cutting API behavior

- Most WNBA handlers use short in-process caches; responses that must stay fresh often send `Cache-Control: no-store`.
- WNBA ESPN standings (`site.web.api`) and roster fetches use shared `app.core.outbound_cache` (memory + disk under `data/cache/outbound`, per-key TTL, stale-while-revalidate, coalescing, host rate limit/backoff). Game detail still loads standings for record and last-10.
- MLB scoreboard today always returns `Cache-Control: no-store`; upstream failures surface as HTTP 502 (also no-store).
- OpenAPI is the contract. Backend export → `frontend/openapi.json` → regenerate `api.schema.d.ts`. Verify with `npm run check:api`.
- Prop picks: server builds rows for the anchor book on `/props/board` (`wnba.props` / `mlb.props` / seven-book NBA snapshots in `odds.nba_*` + `prop_fair` / `prop_formats` where applicable; MLB rows also attach `books_main` for per-book main lines). Player book joins use `match_player_key` (accent-stripped norm + small aliases); DFS display names unchanged. MLB Stats person search and ESPN roster lookup prefer an active `Jr.` when the query omits that suffix (so hit rates are not attached to a retired father). WNBA and NBA research-table hit rates come from a once-a-day `nba_api` pull of season-wide `PlayerGameLogs` and `TeamGameLogs` (base and advanced; regular season, playoffs, and preseason), cached under `data/cache/season_logs/`. L5/L10/L15 uses the current season's player-base rows joined with `match_player_key`. H2H uses regular-season games only from that season and the previous one (NBA 2026-27 and 2025-26; WNBA 2026 and 2025). Preseason games count for L5/L10/L15 only when that player has no regular-season or playoff games, and they are left out of H2H. A failed or empty refresh keeps the previous day's cache. WNBA Parlay books still come from live Parlay indexes on `GET /api/wnba/props/today`; live WNBA Parlay fetch throttled-writes `odds.wnba_parlay_api_odds` (same persist helper as game props). The WNBA research table (`GET /api/wnba/props/board`) reads Parlay from that snapshot only, like MLB. MLB Parlay books (DK/FD/cmp) come only from `odds.mlb_parlay_api_odds` (live Parlay fetch throttled-writes that table, never serves from live rows). `/wnba/prop_picks`, `/mlb/prop_picks`, and `/nba/prop_picks` are research tables (`filterWnbaPropBoardRows` / `filterMlbPropBoardRows` / `filterNbaPropBoardRows` on `/props/board`). Game detail no longer exposes a Props tab.

### Prop picks data flow (detail)

```text
LeaguePropPicksPage
  → useWnbaPropBoard(book)  (staleTime 15m; sidebar prefetches GET /api/wnba/props/board?book=prizepicks)
  → GET /api/wnba/props/board?book=
  → wnba.prop_board.get_wnba_prop_board(book)
       ├─ cluster quotes by (player, stat, exact line)
       ├─ keep clusters that contain the anchor book; do not attach a different line onto the row
       ├─ emit Over + Under rows; anchor vs books; IP = average raw implied of anchor + matching books
       └─ L5/L10/L15 + H2H from the daily nba_api player-base cache (soft-fail warnings)
  → client filterWnbaPropBoardRows (game + market + side + name) + sortable research table

MlbPropPicksPage
  → useMlbPropBoard(book)  (staleTime 15m; sidebar prefetches GET /api/mlb/props/board?book=prizepicks)
  → GET /api/mlb/props/board?book=
  → mlb.prop_board.get_mlb_prop_board(book)
       ├─ cluster quotes by (player, stat, exact line)
       ├─ keep clusters that contain the anchor book; do not attach a different line onto the row
       ├─ emit Over + Under rows; anchor vs books; IP = average raw implied of anchor + matching books
       └─ opp def/pace ranks + L5/L10/L15 (soft-fail warnings)
  → client filterMlbPropBoardRows (game + market + side + name) + sortable research table

NbaPropPicksPage
  → useNbaPropBoard(book)  (staleTime 15m; sidebar prefetches GET /api/nba/props/board?book=prizepicks)
  → GET /api/nba/props/board?book=
  → nba.prop_board.get_nba_prop_board(book)
       ├─ cluster quotes by (player, stat, exact line) from seven Supabase book snapshots (`odds.nba_*`)
       ├─ keep clusters that contain the anchor book; do not attach a different line onto the row
       ├─ emit Over + Under rows; anchor vs books; IP = average raw implied of anchor + matching books
       └─ L5/L10/L15 + H2H from the daily nba_api player-base cache (soft-fail warnings)
  → client filterNbaPropBoardRows (game + market + side + name) + sortable research table
```

---

## 4. Backend layout, errors, testing

### Backend shape

```text
backend/app/
  main.py           # FastAPI configuration + /api router mount
  api/
    router.py       # assembles health and domain routers
    routes/health.py
    deps.py         # shared request dependencies
  domains/
    betting/        # WNBA odds route; shared prop helpers (player match, Parlay)
    mlb/            # live MLB endpoints
    wnba/           # live WNBA endpoints
    nba/            # live NBA endpoints
  providers/        # ESPN, MLB Stats, Sharp, Parlay, and other upstream clients
  schemas/          # shared Pydantic models used by multiple domains
  core/             # configuration, errors, outbound cache, database helpers
```

Site-facing routes are adapters over ESPN, the MLB Stats API, stats.wnba.com, RotoWire, SharpAPI, ParlayAPI, and Supabase odds tables. The prediction stack (`src/pipeline/`, `src/live_pipeline/`) and the old research catalog (`/api/games`, `/api/players`, `/api/player/{id}`, `/api/matchups/{date}`) are gone. `models/` is leftover training notes; nothing in this path imports it.

### Errors & empty states

- Hooks distinguish “never loaded” from “refetch failed after a successful load” — keep last good scoreboard / props when possible.
- `mergeLeagueScoreboards` only surfaces an error when **every** league scoreboard has never loaded; one league failing leaves the other visible.
- Pages show loading skeletons, empty copy, or “Unable to load…”. An unknown route shows “Page not found” and a link back to games.
- Upstream failures are handled in services (partial payloads and optional `error` fields where schemas allow, e.g. props).

### Testing

| Area | Tooling |
|------|---------|
| Frontend | Vitest + Testing Library (pages, hooks, mappers) |
| Backend | pytest on services and routes |
| Contract | `npm run check:api` after OpenAPI export |

### Maintenance

When you add or change a page:

1. Update the page ↔ API table in this doc.
2. Keep `frontend/src/shared/lib/api.ts` + OpenAPI types in sync.
3. Prefer shared hooks / query keys for scoreboard-like shared data.

Feature-level history lives under `docs/superpowers/specs/` and `docs/superpowers/plans/`. Clone, local run, and a short product pitch live in the root `README.md`.

---

## 5. Quick reference — endpoints the pages call

`GET /api/mlb/props/today`, `GET /api/wnba/props/today`, `GET /api/mlb/props/game/{game_pk}`, and `GET /api/wnba/props/game/{espn_event_id}` are still mounted. No page calls them.

| Method | Path | Primary service module |
|--------|------|------------------------|
| GET | `/api/wnba/scoreboard/today` | `wnba_scoreboard` |
| GET | `/api/wnba/scoreboard?date=` | `wnba_scoreboard` |
| GET | `/api/wnba/odds/today` | `parlay_odds` (+ `book_boards`: ProphetX → Novig → Pinnacle from Supabase team snapshots; legacy `games[]` retained) |
| GET | `/api/wnba/props/board` | `wnba.prop_board`. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. dfs is removed. ip_pct averages the anchor and those matches. Rows are omitted once the game has started: the listed tip is at or before now, or the scoreboard status is live, halftime, or final. When today's slate has no game still ahead, the next date within 7 days that has a game still ahead is used. When the scoreboard has a slate, rows for teams that are not on it are omitted. If the scoreboard did not load, rows with no tip stay. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing. |
| GET | `/api/wnba/games/{espn_event_id}` | `wnba_game_detail` (+ scheduled record/last_10, season_team_stats ranks, game_leaders) |
| GET | `/api/wnba/games/{espn_event_id}/team-preview?side=` | `wnba.team_preview` (PPG/RPG/APG/BPG/SPG leaders + roster averages; after FT% the season-log cache adds USG%, EFG%, TS%, AST%, AST/TO, OREB%, DREB%, REB%, TOV%, OFF, DEF, NET, PIE, then RTG, +/-) |
| GET | `/api/mlb/scoreboard/today` | `mlb_scoreboard` (MLB Stats API) |
| GET | `/api/mlb/scoreboard?date=` | `mlb_scoreboard` |
| GET | `/api/nba/scoreboard/today` | `nba.scoreboard` (ESPN only; overnight live carryover; `no-store`, 502 on upstream failure) |
| GET | `/api/nba/scoreboard?date=` | `nba.scoreboard` (ESPN only; 5 min per-date cache) |
| GET | `/api/nba/games/{espn_event_id}` | `nba.game_detail` (+ season_team_stats ranks and game_leaders; record/last_10 absent until NBA standings enrichment is wired; stale-while-error cache) |
| GET | `/api/nba/games/{espn_event_id}/team-preview?side=` | `nba.team_preview` (PPG/RPG/APG/BPG/SPG leaders + roster averages; after FT% the season-log cache adds USG%, EFG%, TS%, AST%, AST/TO, OREB%, DREB%, REB%, TOV%, OFF, DEF, NET, PIE, then RTG, +/-) |
| GET | `/api/nba/odds/today` | `nba.odds` (WNBA-shaped response; `book_boards` is currently empty because NBA team snapshots do not exist, while Sharp-backed `games[]` may populate) |
| GET | `/api/nba/props/board` | `nba.prop_board`. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. Seven-book chip order (ProphetX, Novig, Pinnacle, DraftKings, FanDuel, PrizePicks, Underdog). dfs is removed. ip_pct averages the anchor and those matches. Rows are omitted once the game has started: the listed tip is at or before now, or the scoreboard status is live, halftime, or final. When today's slate has no game still ahead, the next date within 7 days that has a game still ahead is used. When the scoreboard has a slate, rows for teams that are not on it are omitted. If the scoreboard did not load, rows with no tip stay. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing. |
| GET | `/api/mlb/games/{game_pk}` | `mlb.game_detail` |
| GET | `/api/mlb/lineups?date=` | `mlb.lineups` (RotoWire projected lineups) |
| GET | `/api/mlb/lineups/matchup?date=&away=&home=` | `mlb.lineup_matchup` |
| GET | `/api/mlb/odds/today` | `mlb.odds` (Sharp `league=mlb`) |
| GET | `/api/mlb/props/board` | `mlb.prop_board`. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. dfs is removed. ip_pct averages the anchor and those matches. Rows are omitted once the game has started: the listed tip is at or before now, or the scoreboard status is live, halftime, or final. When today's slate has no game still ahead, the next date within 7 days that has a game still ahead is used. When the scoreboard has a slate, rows for teams that are not on it are omitted. If the scoreboard did not load, rows with no tip stay. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing. |
| GET | `/api/mlb/games/{game_pk}/team-preview?side=` | `mlb.team_preview` (+ leaders boards, team season player splits) |

Health (ops, not UI): `GET /api/health`.
