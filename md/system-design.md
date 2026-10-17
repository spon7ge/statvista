# statvista website + API system design

Date: 2026-08-02  
Status: Current-state reference (onboarding)  
Scope: React website (`frontend/`) + FastAPI read path (`backend/`)  
Audience: Contributors and future-you navigating page ↔ API wiring

## Goal

Document how the live statvista website is structured today: routes, shared chrome, data-fetching hooks, FastAPI endpoints, and upstream sources — so a contributor can answer “what powers this page?” without reverse-engineering the tree.

## Non-goals

- Airflow DAGs, dbt medallion transforms, model training, or scraper internals (see `models/README.md`)
- Full catalog of unused DB-backed dashboard routes beyond noting they exist
- Deployment / hosting runbooks
- MLB Statcast (not in current slice)

---

## 1. Overview & boundaries

statvista’s public site is a React + Vite app talking to a FastAPI service over `/api`. `/` replace-redirects to **MLB games**. The product surface is **Props and Games** (plus game detail), with Site links for **About**, **Blog**, and **Contact**. **WNBA** has a live games slate, an anchor-book prop-picks research table, and game detail. **MLB** adds a live games hub (dated slate), game detail, and an anchor-book prop-picks research table. **NBA** has a live games slate (`/nba/matchups`, ESPN scoreboard, no odds on cards), a live anchor-book prop-picks research table at `/nba/prop_picks`, and WNBA-parity game detail at `/nba/games/:espnEventId` (Preview / Away / Home; live/final Summary \| Box; no Props tab).

### Read-path model

```text
Browser
  → React (TanStack Query hooks → lib/api.ts)
  → FastAPI (/api/wnba/*, /api/mlb/scoreboard/*, /api/nba/* for the live site)
  → Upstream adapters
      (ESPN, stats.wnba.com, MLB Stats API, ParlayAPI, Supabase odds snapshots, RotoWire)
```

Two backend families exist. The **live website mainly uses the WNBA, MLB, and NBA upstream routes** (NBA: scoreboard + game detail + team preview + odds/today), not the older Postgres research-dashboard routes.

| Family | Examples | Used by current React pages? |
|--------|----------|------------------------------|
| WNBA upstream | `/api/wnba/scoreboard/*`, `props/today`, `props/board`, `games/{id}`, … | Yes |
| MLB upstream | `/api/mlb/scoreboard/*`, `/api/mlb/odds/today`, `/api/mlb/props/board` | Yes (matchups, Preview odds, prop research table) |
| NBA upstream | `/api/nba/scoreboard/*`, `games/{id}`, `games/{id}/team-preview`, `odds/today`, `props/board` | Yes (matchups slate + game detail + prop research table) |
| DB-backed (silver / gold) | `/api/games/{date}/slate`, `/api/props`, … | No |

Shared chrome (`HomeChromeLayout`) wraps most routes with a left sidebar (mobile hamburger drawer) and footer. The sidebar wordmark sits beside the page title. Primary nav is a card: **Props and Games** (current league's board/slate, else MLB; NBA Props routes to `/nba/prop_picks`). A Site card below that has **About** (routes to `/about`), **Blog** (routes to `/blog`), and **Contact** (routes to `/contact`; form UI; send not wired). Page league pills still switch the open section. Wordmark lands on `/mlb/matchups`. Props links prefetch the destination board on hover; the sidebar also warms that board on mount. Client React Query keeps MLB, WNBA, and NBA `/props/board` fresh for 15 minutes (`staleTime` matches the poll; no refetch on window focus).

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
| API types | OpenAPI → `src/lib/api.schema.d.ts` (`npm run generate:api`) |

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
| `pages/` | Route composition |
| `features/{home,basketball,mlb}/` | UI by domain |
| `hooks/useWnba*.ts`, `useWnbaPropBoard.ts`, `useMlbScoreboard.ts`, `useMlbPropBoard.ts`, `useGameDetail.ts`, `useNbaScoreboard.ts`, `useNbaPropBoard.ts`, `useNbaGameDetail.ts`, `useNbaOdds.ts`, `useNbaTeamPreview.ts` | TanStack Query wrappers |
| `lib/api.ts` | Typed `fetch` helpers + `VITE_API_BASE_URL` |

**Chrome data:** The layout itself does not fetch scoreboards. Games pages load each league's scoreboard independently.

---

## 3. Page ↔ API map

| Route | Page job | Hook(s) | API | Upstream / notes |
|-------|----------|---------|-----|------------------|
| `/` | Landing | — | — | Replace-redirect to `/mlb/matchups` |
| `/about` | Static About (description, tech stack); sidebar Site link | — | none | `AboutPage` / `AboutContent`; no API |
| `/blog` | Placeholder blog index (2 posts / row: title, accent block, read time); sidebar Site link | — | none | `BlogPage` / `BlogIndex`; static catalog |
| `/blog/:slug` | Placeholder article; unknown slug → NotFound | — | none | `BlogPostPage` / `BlogPost`; `getPost` |
| `/contact` | Contact form stub (name, subject, description); Send disabled — coming soon; sidebar Site link | — | none | `ContactPage` / `ContactForm`; no API |
| `/wnba/matchups?date=` | Daily slate (no team-lines odds pill); Games header with MLB/WNBA/NBA league pills and **Today** date nav on that same row | `useWnbaScoreboard(date)` | scoreboard (`/today` or `?date=`) | Cards → `/games/:espnEventId` (Preview odds board uses `GET /api/wnba/odds/today`) |
| `/wnba/prop_picks` | Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (stacked: anchor number above selected book logo + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed book list, stored in ?book=), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter. | `useWnbaPropBoard(book)` | `GET /api/wnba/props/board?book=` | Client filterWnbaPropBoardRows (game + market + side + name). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker. Rows whose listed tip has passed, and rows for teams that are not on the loaded slate, are hidden on the page (rechecked every 30s, without waiting for the 15-minute board refetch). |
| `/wnba/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/wnba/prop_picks`. `WnbaPlayerPropsOddsGrid` remains for shared book-column patterns |
| `/games/:espnEventId` | Game detail: scheduled → MLB-parity pregame (broadcast header with record + last 10; centered Preview / Away / Home); Preview two-column (left: Projected Starters → Game Info → Matchup Prediction → Game Leaders PPG/RPG/APG; right: multi-book Odds board → Team Stats + `#rank` → Injuries); Away/Home → team preview (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-); live/halftime or final → broadcast header + Summary \| Box (Scoring plays \| All plays; Summary right rail: linescore, team stats, win probability, shot chart, Game Info; Box: stacked away/home box score) | `useGameDetail`, `useWnbaOdds`, `useWnbaTeamPreview(espnEventId, side)` | `GET /api/wnba/games/{id}`, `GET /api/wnba/odds/today` (Preview `book_boards`), `GET /api/wnba/games/{id}/team-preview?side=` (Away/Home) | ESPN summary + standings/team stats/roster for enrichment (standings + roster JSON via `app.core.outbound_cache`); RotoWire starters; Preview odds prefer `book_boards` (ProphetX → Novig → Pinnacle) with soft-fail per book and fallback to legacy `games[]`; soft-fail empty sections; no Player of the Game or pitch zone |
| `/nba/matchups?date=` | Daily slate (no odds pill); Games header with MLB/WNBA/NBA pills + **Today** date nav | `useNbaScoreboard(date)` | `GET /api/nba/scoreboard/today` or `?date=` | ESPN NBA scoreboard; cards → `/nba/games/:espnEventId` via `gameDetailHref` when `espn_event_id` present |
| `/nba/prop_picks` | Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (stacked: anchor number above selected book logo + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed seven-book list, stored in ?book=), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter. | `useNbaPropBoard(book)` | `GET /api/nba/props/board?book=` | Client filterNbaPropBoardRows (game + market + side + name). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker. Rows whose listed tip has passed, and rows for teams that are not on the loaded slate, are hidden on the page (rechecked every 30s, without waiting for the 15-minute board refetch). |
| `/nba/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/nba/prop_picks`. |
| `/nba/games/:espnEventId` | Game detail: scheduled → WNBA-parity pregame (broadcast header shows team identity and matchup; record / last 10 remain unavailable until standings are wired; centered Preview / Away / Home — no Props tab); Preview two-column (left: Projected Starters → Game Info → Matchup Prediction → Game Leaders PPG/RPG/APG; right: Odds board → Season Team Stats + `#rank` → Injuries); Away/Home → team preview (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-); live/halftime or final → broadcast header + Summary \| Box (Scoring plays \| All plays; Summary right rail: linescore, team stats, win probability, shot chart, Game Info; Box: stacked away/home box score) | `useNbaGameDetail`, `useNbaOdds`, `useNbaTeamPreview(espnEventId, side)` | `GET /api/nba/games/{id}`, `GET /api/nba/odds/today` (Preview `book_boards` is currently empty because NBA team snapshots do not exist; Sharp-backed `games[]` may populate), `GET /api/nba/games/{id}/team-preview?side=` (Away/Home) | ESPN NBA summary + team stats/roster enrichment; NBA standings enrichment is not wired, so record / last 10 stay absent. RotoWire NBA starters when available; Preview odds falls back to Sharp-backed `games[]` while `book_boards` is empty; poll ~18s when live/halftime; soft-fail empty sections; Back → `/nba/matchups`. Spec: `docs/superpowers/specs/2026-10-15-nba-game-detail-design.md` |
| `/mlb/matchups?date=` | Daily slate (no team-lines odds pill); Games header with MLB/WNBA/NBA league pills and **Today** date nav on that same row | `useMlbScoreboard(date)` | scoreboard (`/today` or `?date=`) | Stats API schedule; cards → `/mlb/games/:gamePk` (Preview odds board still uses `GET /api/mlb/odds/today`) |
| `/mlb/prop_picks` | Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (stacked: anchor number above selected book logo + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed book list, stored in ?book=), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter. | `useMlbPropBoard(book)` | `GET /api/mlb/props/board?book=` | Client filterMlbPropBoardRows (game + market + side + name). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker. Rows whose listed tip has passed, and rows for teams that are not on the loaded slate, are hidden on the page (rechecked every 30s, without waiting for the 15-minute board refetch). |
| `/mlb/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/mlb/prop_picks`. `MlbPlayerPropsOddsGrid` remains for shared book-column patterns |
| `/mlb/games/:gamePk` | Game detail: pregame broadcast header (Preview shows RotoWire lineups when matched with right-rail odds board beside lineups; Preview / Away / Home tabs; Preview keeps team odds board beside lineups; Away/Home tabs show **team preview** (Team Batting/Pitching Leaders + full active-roster season batting/pitching tables); under lineups: season Team Stats (with league `#N` ranks) + Injuries; right rail Odds → Game Info → Matchup prediction (ESPN) when present, then Game Leaders — HR/AVG/OPS batter cards (best active-roster hitter per category, value + muted `#N`, last name + team logo, ESPN headshots)), live Summary/Box center (ESPN-style matchup + pitch zone above play feed, linescore/team stats/win prob/hit chart in Summary right rail, box score side-by-side in Box tab), or final Summary/Box center (optional fan-vote Player of the Game card from MLB Play above Play feed when winner published; hidden when null) | `useMlbGameDetail(gamePk)`, `useMlbLineups(date)`, `useMlbLineupMatchup`, `useMlbOdds`, `useMlbTeamPreview(gamePk, side)` | `GET /api/mlb/games/{gamePk}`, `GET /api/mlb/lineups?date=` (Preview tab), `GET /api/mlb/lineups/matchup?date=&away=&home=`, `GET /api/mlb/odds/today` (Preview odds board), `GET /api/mlb/games/{gamePk}/team-preview?side=away|home` (Away/Home tabs) | MLB Stats API (+ ESPN when available); RotoWire projected lineups for Preview, matched by abbrev with both sides' pitcher + 9 batters complete; Stats API enriches the matched lineup with season pitching and career BvP; Preview right-rail odds board stacks matched books from `odds/today` `book_boards` (ProphetX → Novig → Pinnacle only) with Money / Total / Spread columns per away/home row pair and a subtle book name under each pair; falls back to legacy `games[]` when `book_boards` is empty; Preview soft-merges season YTD team hitting/pitching (Stats) + league competition ranks + injuries (ESPN) under projected lineups even when lineups are unavailable; Preview Matchup prediction from ESPN summary `predictor` when available (hidden when null); Game Leaders from game detail payload (`game_leaders`; best roster batter per HR/AVG/OPS with league rank; hidden when null); Final soft-merges MLB Play fan-vote `player_of_the_game` on game detail (null when absent or not final); halftime falls back to compact header; game detail payload also includes optional `venue_city`, `venue_state`, `weather`, and `umpires` for Game Info UI |

### Cross-cutting API behavior

- Most WNBA handlers use short in-process caches; responses that must stay fresh often send `Cache-Control: no-store`.
- WNBA ESPN standings (`site.web.api`) and roster fetches, plus WNBA leaders (`stats.wnba.com/leagueleaders`), use shared `app.core.outbound_cache` (memory + disk under `data/cache/outbound`, per-key TTL, stale-while-revalidate, coalescing, host rate limit/backoff).
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
       ├─ L5/L10/L15 + H2H from the daily nba_api player-base cache (soft-fail warnings)
       └─ GET /api/wnba/props/today unchanged (API retained; not wired to game detail UI)
  → client filterWnbaPropBoardRows (game + market + side + name) + sortable research table

MlbPropPicksPage
  → useMlbPropBoard(book)  (staleTime 15m; sidebar prefetches GET /api/mlb/props/board?book=prizepicks)
  → GET /api/mlb/props/board?book=
  → mlb.prop_board.get_mlb_prop_board(book)
       ├─ cluster quotes by (player, stat, exact line)
       ├─ keep clusters that contain the anchor book; do not attach a different line onto the row
       ├─ emit Over + Under rows; anchor vs books; IP = average raw implied of anchor + matching books
       ├─ opp def/pace ranks + L5/L10/L15 (soft-fail warnings)
       └─ GET /api/mlb/props/today unchanged (API retained; not wired to game detail UI)
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
    betting/        # shared prop helpers (player match, Parlay, DFS attach)
    mlb/            # live MLB endpoints
    research/       # DB-backed research endpoints
    wnba/           # live WNBA endpoints
    nba/            # live NBA endpoints (scoreboard, game detail, team preview, odds/today)
  providers/        # upstream API clients and adapters
  schemas/          # shared Pydantic models used by multiple domains
  core/             # configuration, errors, and database helpers
```

Site-facing WNBA and MLB routes are adapters over external APIs and Supabase odds tables. The unused
live-props, live-slates, and prediction routes were removed on 2026-08-04; the remaining
research routes do not attach ML predictions.

### Errors & empty states

- Hooks distinguish “never loaded” from “refetch failed after a successful load” — keep last good scoreboard / props when possible.
- `mergeLeagueScoreboards` only surfaces an error when **every** league scoreboard has never loaded; one league failing leaves the other visible.
- Pages show loading skeletons, empty copy, or “Unable to load…”; player page maps HTTP 404 to “Player not found”.
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
2. Keep `lib/api.ts` + OpenAPI types in sync.
3. Prefer shared hooks / query keys for scoreboard-like shared data.

Feature-level history lives under `docs/superpowers/specs/` and `docs/superpowers/plans/`. Clone, local run, and a short product pitch live in the root `README.md`.

---

## 5. Quick reference — endpoints used by the site

| Method | Path | Primary service module |
|--------|------|------------------------|
| GET | `/api/wnba/scoreboard/today` | `wnba_scoreboard` |
| GET | `/api/wnba/scoreboard?date=` | `wnba_scoreboard` |
| GET | `/api/wnba/odds/today` | `parlay_odds` (+ `book_boards`: ProphetX → Novig → Pinnacle from Supabase team snapshots; legacy `games[]` retained) |
| GET | `/api/wnba/props/today` | `wnba.props` (+ `prop_fair`, `prop_formats`, snapshots) |
| GET | `/api/wnba/props/board` | `wnba.prop_board`. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. dfs is removed. ip_pct averages the anchor and those matches. Rows are omitted once the game has started: the listed tip is at or before now, or the scoreboard status is live, halftime, or final. When today's slate has no game still ahead, the next date within 7 days that has a game still ahead is used. When the scoreboard has a slate, rows for teams that are not on it are omitted. If the scoreboard did not load, rows with no tip stay. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing. |
| GET | `/api/wnba/props/game/{espn_event_id}` | `wnba.game_props` (+ `get_today_props`, game detail, roster headshots) |
| GET | `/api/wnba/games/{espn_event_id}` | `wnba_game_detail` (+ scheduled record/last_10, season_team_stats ranks, game_leaders) |
| GET | `/api/wnba/games/{espn_event_id}/team-preview?side=` | `wnba.team_preview` (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-) |
| GET | `/api/mlb/scoreboard/today` | `mlb_scoreboard` (MLB Stats API) |
| GET | `/api/mlb/scoreboard?date=` | `mlb_scoreboard` |
| GET | `/api/nba/scoreboard/today` | `nba.scoreboard` (ESPN only; overnight live carryover; `no-store`, 502 on upstream failure) |
| GET | `/api/nba/scoreboard?date=` | `nba.scoreboard` (ESPN only; 5 min per-date cache) |
| GET | `/api/nba/games/{espn_event_id}` | `nba.game_detail` (+ season_team_stats ranks and game_leaders; record/last_10 absent until NBA standings enrichment is wired; stale-while-error cache) |
| GET | `/api/nba/games/{espn_event_id}/team-preview?side=` | `nba.team_preview` (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-) |
| GET | `/api/nba/odds/today` | `nba.odds` (WNBA-shaped response; `book_boards` is currently empty because NBA team snapshots do not exist, while Sharp-backed `games[]` may populate) |
| GET | `/api/nba/props/board` | `nba.prop_board`. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. Seven-book chip order (ProphetX, Novig, Pinnacle, DraftKings, FanDuel, PrizePicks, Underdog). dfs is removed. ip_pct averages the anchor and those matches. Rows are omitted once the game has started: the listed tip is at or before now, or the scoreboard status is live, halftime, or final. When today's slate has no game still ahead, the next date within 7 days that has a game still ahead is used. When the scoreboard has a slate, rows for teams that are not on it are omitted. If the scoreboard did not load, rows with no tip stay. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing. |
| GET | `/api/mlb/odds/today` | `mlb_odds` (Sharp `league=mlb`) |
| GET | `/api/mlb/props/today` | `mlb.props` (+ `prop_fair`, `prop_formats`, `prop_stat_keys`, `books_main`; PP/UD from Supabase; Parlay books from `fetch_latest_parlay_api_odds("mlb")` / `odds.mlb_parlay_api_odds` only) |
| GET | `/api/mlb/props/board` | `mlb.prop_board`. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. dfs is removed. ip_pct averages the anchor and those matches. Rows are omitted once the game has started: the listed tip is at or before now, or the scoreboard status is live, halftime, or final. When today's slate has no game still ahead, the next date within 7 days that has a game still ahead is used. When the scoreboard has a slate, rows for teams that are not on it are omitted. If the scoreboard did not load, rows with no tip stay. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing. |
| GET | `/api/mlb/props/game/{game_pk}?app=` | `mlb.game_props` (+ same props assembly as today; Parlay from `odds.mlb_parlay_api_odds` snapshot, not live indexes) |
| GET | `/api/mlb/games/{game_pk}/team-preview?side=` | `mlb.team_preview` (+ leaders boards, team season player splits) |

Health (ops, not UI): `GET /api/health`.
