# statvista website + API system design

Date: 2026-08-02  
Status: Current-state reference (onboarding)  
Scope: React website (`frontend/`) + FastAPI read path (`backend/`)  
Audience: Contributors and future-you navigating page ↔ API wiring

## Goal

Document how the live statvista website is structured today: routes, shared chrome, data-fetching hooks, FastAPI endpoints, and upstream sources — so a contributor can answer “what powers this page?” without reverse-engineering the tree.

## Non-goals

- Airflow DAGs, dbt medallion transforms, model training, or scraper internals (see root `README.md`)
- Full catalog of unused DB-backed dashboard routes beyond noting they exist
- Deployment / hosting runbooks
- MLB Statcast or About-page MLB content (not in current slice)

---

## 1. Overview & boundaries

statvista’s public site is a React + Vite app talking to a FastAPI service over `/api`. The product surface today is primarily **WNBA** (home, league hubs, game detail, prop picks, player pages). **MLB** adds live scoreboard on the home chrome, a live matchups hub (dated slate), game detail, and a DFS prop-picks **player board** (View X props → per-player odds grid). NBA is scaffolded (`/nba/matchups` placeholder).

### Read-path model

```text
Browser
  → React (TanStack Query hooks → lib/api.ts)
  → FastAPI (/api/wnba/*, /api/mlb/scoreboard/today for the live site)
  → Upstream adapters
      (ESPN, stats.wnba.com, MLB Stats API, ParlayAPI, Supabase odds snapshots, RotoWire)
```

Two backend families exist. The **live website mainly uses the WNBA and MLB upstream routes**, not the older Postgres research-dashboard routes.

| Family | Examples | Used by current React pages? |
|--------|----------|------------------------------|
| WNBA upstream | `/api/wnba/scoreboard/*`, `props/today`, `games/{id}`, … | Yes |
| MLB upstream | `/api/mlb/scoreboard/*`, `/api/mlb/odds/today` | Yes (home + game Preview odds) |
| DB-backed (silver / gold) | `/api/games/{date}/slate`, `/api/props`, … | No |

Shared chrome (`HomeChromeLayout`) wraps most routes with nav, live ticker, and footer. `/about` is static (no API).

---

## 2. Frontend shell & route map

### Stack

| Layer | Choice |
|-------|--------|
| UI runtime | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styling | Tailwind CSS v4, Geist, lucide-react |
| Routing | React Router (`BrowserRouter` + `AppRouter`) |
| Data fetching | TanStack Query |
| API types | OpenAPI → `src/lib/api.schema.d.ts` (`npm run generate:api`) |

**Dev:** Vite proxies `/api` → `http://127.0.0.1:8000`.  
**Static hosts:** set `VITE_API_BASE_URL` to the API origin (no proxy).

### App tree

```text
main.tsx
  QueryClientProvider → BrowserRouter → AppRouter
    HomeChromeLayout (HomeNav + LiveTicker + SiteFooter)
      /                    HomePage
      /about               AboutPage (static)
      /games/:espnEventId  GameDetailPage
      /wnba/matchups       LeagueMatchupsPage (league="wnba")
      /wnba/prop_picks     LeaguePropPicksPage
      /wnba/prop_picks/player/:playerSlug  WnbaPlayerPropsPage
      /wnba/leaders        LeagueLeadersPage
      /wnba/standings      LeagueStandingsPage
      /wnba/futures        LeagueFuturesPage
      /wnba/player/:id     LeaguePlayerPage
      /nba/matchups        LeagueMatchupsPage (placeholder)
      /mlb/matchups        LeagueMatchupsPage (league="mlb", live slate)
      /mlb/prop_picks      MlbPropPicksPage
      /mlb/prop_picks/player/:playerSlug  MlbPlayerPropsPage
      /mlb/leaders         MlbLeadersPage
      /mlb/standings       MlbStandingsPage
      /mlb/futures         MlbFuturesPage
      /mlb/games/:gamePk   MlbGameStubPage (coming soon)
    * → NotFoundPage
```

### Conventions

| Layer | Role |
|-------|------|
| `pages/` | Route composition |
| `components/{home,league,game,about}/` | UI by domain |
| `hooks/useWnba*.ts`, `useMlbScoreboard.ts`, `useGameDetail.ts` | TanStack Query wrappers |
| `lib/api.ts` | Typed `fetch` helpers + `VITE_API_BASE_URL` |

**Chrome data:** Layout and home merge WNBA + MLB scoreboards via `mergeLeagueScoreboards`. Each league has its own query key; failures in one league do not clear the other. While any game is live in either league, the relevant scoreboard refetches about every 18 seconds.

---

## 3. Page ↔ API map

| Route | Page job | Hook(s) | API | Upstream / notes |
|-------|----------|---------|-----|------------------|
| `/` | Brand, LIVE NOW, explainer, league CTAs | `useWnbaScoreboard`, `useMlbScoreboard` | WNBA + MLB scoreboard today | Client merge via `mergeLeagueScoreboards` |
| `/about` | Product / tech / data story | — | none | Static components under `components/about/` |
| Chrome ticker | All chrome routes | same scoreboard queries | WNBA + MLB today | Client merge; isolated per-league error handling |
| `/wnba/matchups?date=` | Daily slate (no team-lines odds pill) | `useWnbaScoreboard(date)` | scoreboard (`/today` or `?date=`) | Cards → `/games/:espnEventId` (Preview odds board uses `GET /api/wnba/odds/today`) |
| `/wnba/prop_picks` | Filterable DFS +EV ranked board (hybrid rows + expand) | `useWnbaProps({ app, format, legs })` | `GET /api/wnba/props/today?app=&format=&legs=` | Seed Parlay PrizePicks (fallback `odds.wnba_prizepicks`) or `odds.wnba_underdogs`; DK/FD from Parlay; PX/Novig/Pinnacle from snapshots; server fair/edge/tier; client hide finals + prior-day tips; Stat/Team/Side filters; page size 20 |
| `/wnba/prop_picks/player/:playerSlug?app=` | Per-player main-line odds grid (BettingPros-style) | `useWnbaProps` | same `GET /api/wnba/props/today?app=&format=&legs=` | `findPlayerBySlug` + `uniqueStatRows`; `WnbaPlayerPropsOddsGrid` reads `books_main` (ProphetX, Novig, DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365, Pinnacle — main lines only, NL when missing; no OPEN/BEST); unknown slug → empty state + link back to board |
| `/wnba/leaders` | Season leaderboards | `useWnbaLeaders` | `GET /api/wnba/leaders` | stats.wnba.com `leagueleaders` via outbound cache; WNBA hub pages (Leaders, Standings, Futures, Prop Picks, Player) use MLB-style colored banners with basketball sport mark |
| `/wnba/standings` | East / West standings | `useWnbaStandings` | `GET /api/wnba/standings` | ESPN `site.web.api` via `app.core.outbound_cache` (memory + `data/cache/outbound`, TTL + SWR) |
| `/wnba/futures` | Championship / award futures | `useWnbaFutures` | `GET /api/wnba/futures` | ESPN core futures API |
| `/wnba/player/:id` | Bio, averages, recent games | `useWnbaPlayer` | `GET /api/wnba/player/{id}` | stats.wnba.com (info + dash + gamelog) |
| `/games/:espnEventId` | Game detail: scheduled → MLB-parity pregame (broadcast header with record + last 10; centered Preview / Away / Home / **Props**); Preview two-column (left: Projected Starters → Game Info → Matchup Prediction → Game Leaders PPG/RPG/APG; right: multi-book Odds board → Team Stats + `#rank` → Injuries); Away/Home → team preview (PPG/RPG/APG leaders + roster averages); **Props** tab has PrizePicks / Underdog sub-tabs and shows the matchup-scoped **Player Props** category-card grid (Line / Over / Under, book name under odds); live/halftime or final → broadcast header + Summary \| Box (Scoring plays \| All plays; Summary right rail: linescore, team stats, win probability, shot chart, Game Info; Box: stacked away/home box score) | `useGameDetail`, `useWnbaOdds`, `useWnbaGameProps(espnEventId, app)`, `useWnbaTeamPreview(espnEventId, side)` | `GET /api/wnba/games/{id}`, `GET /api/wnba/odds/today` (Preview `book_boards`), `GET /api/wnba/props/game/{id}?app=prizepicks\|underdog` (Props tab only), `GET /api/wnba/games/{id}/team-preview?side=` (Away/Home) | ESPN summary + standings/team stats/roster for enrichment (standings + roster JSON via `app.core.outbound_cache`); RotoWire starters; Preview odds prefer `book_boards` (ProphetX → Novig → Pinnacle) with soft-fail per book and fallback to legacy `games[]`; game-scoped props reuse today's props assembly filtered to away/home abbrevs; soft-fail empty sections; no Player of the Game or pitch zone |
| `/nba/matchups` | Placeholder | — | none | “NBA matchups coming soon” |
| `/mlb/matchups?date=` | Daily slate (no team-lines odds pill) | `useMlbScoreboard(date)` | scoreboard (`/today` or `?date=`) | Stats API schedule; cards → `/mlb/games/:gamePk` (Preview odds board still uses `GET /api/mlb/odds/today`) |
| `/mlb/prop_picks` | DFS **player board**: PrizePicks / Underdog tabs (format/legs defaults hidden — power/4 vs standard/4); one card per player with **View X props** CTA; sort by unique-stat count desc; Team multi-select + player name search | `useMlbProps` | `GET /api/mlb/props/today?app=&format=&legs=` | Client `groupMlbPropPlayers` aggregates rows; PrizePicks seed from latest Supabase snapshot only (`fetch_latest_prizepicks("mlb")`, no Parlay PP fallback; empty → `prizepicks_unavailable`); Underdog from Supabase snapshot; each row carries `books_main` (per-book main O/U) for detail grid; Parlay indexes DK/FD + BetMGM/Caesars/Kalshi/Fliff/bet365; ProphetX/Novig/Pinnacle from Supabase scrapers; paginates 20 **players** per page |
| `/mlb/prop_picks/player/:playerSlug?app=` | Per-player main-line odds grid (BettingPros-style) | `useMlbProps` | same `GET /api/mlb/props/today?app=&format=&legs=` | `findPlayerBySlug` + `uniqueStatRows`; `MlbPlayerPropsOddsGrid` reads `books_main` (ProphetX, Novig, DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365, Pinnacle — main lines only, NL when missing; no OPEN/BEST); Parlay supplies DK/FD + cmp books; unknown slug → empty state + link back to board |
| `/mlb/leaders` | Season leaderboards | `useMlbLeaders` | `GET /api/mlb/leaders` | MLB Stats API season `/stats` (sorted; includes GP) |
| `/mlb/standings` | Division standings | `useMlbStandings` | `GET /api/mlb/standings` | Stats API standings |
| `/mlb/futures` | Season futures | `useMlbFutures` | `GET /api/mlb/futures` | ESPN core futures API |
| `/mlb/games/:gamePk` | Game detail: pregame broadcast header (Preview shows RotoWire lineups when matched with right-rail odds board beside lineups; Preview / Away / Home / **Props** tabs; Preview keeps team odds board beside lineups (no player props grid); **Props** tab has PrizePicks / Underdog sub-tabs like `/mlb/prop_picks` and shows the matchup-scoped **Player Props** category-card grid (Line / Over / Under, book name under odds); Away/Home tabs show **team preview** (Team Batting/Pitching Leaders + full active-roster season batting/pitching tables); under lineups: season Team Stats (with league `#N` ranks) + Injuries; right rail Odds → Game Info → Matchup prediction (ESPN) when present, then Game Leaders — HR/AVG/OPS batter cards (best active-roster hitter per category, value + muted `#N`, last name + team logo, ESPN headshots)), live Summary/Box center (ESPN-style matchup + pitch zone above play feed, linescore/team stats/win prob/hit chart in Summary right rail, box score side-by-side in Box tab), or final Summary/Box center (optional fan-vote Player of the Game card from MLB Play above Play feed when winner published; hidden when null) | `useMlbGameDetail(gamePk)`, `useMlbLineups(date)`, `useMlbLineupMatchup`, `useMlbOdds`, `useMlbGameProps(gamePk, app)`, `useMlbTeamPreview(gamePk, side)` | `GET /api/mlb/games/{gamePk}`, `GET /api/mlb/lineups?date=` (Preview tab), `GET /api/mlb/lineups/matchup?date=&away=&home=`, `GET /api/mlb/odds/today` (Preview odds board), `GET /api/mlb/props/game/{gamePk}?app=prizepicks\|underdog` (Props tab only), `GET /api/mlb/games/{gamePk}/team-preview?side=away|home` (Away/Home tabs) | MLB Stats API (+ ESPN when available); RotoWire projected lineups for Preview, matched by abbrev with both sides' pitcher + 9 batters complete; Stats API enriches the matched lineup with season pitching and career BvP; Preview right-rail odds board stacks matched books from `odds/today` `book_boards` (ProphetX → Novig → Pinnacle only) with Money / Total / Spread columns per away/home row pair and a subtle book name under each pair; falls back to legacy `games[]` when `book_boards` is empty; game-scoped props reuse Parlay + Supabase snapshot assembly from `props/today` (PX/Novig/Pinnacle scrapers + Parlay DK/FD), filtered to away/home abbrevs; DFS line anchors Over/Under pills with best American odds across ProphetX, Novig, DK, FD, Pinnacle at the exact line (Props→PrizePicks → PrizePicks line; Props→Underdog → Underdog line); soft empty/error on props fetch (`parlay_unavailable` when Parlay fails); Preview soft-merges season YTD team hitting/pitching (Stats) + league competition ranks + injuries (ESPN) under projected lineups even when lineups are unavailable; Preview Matchup prediction from ESPN summary `predictor` when available (hidden when null); Game Leaders from game detail payload (`game_leaders`; best roster batter per HR/AVG/OPS with league rank; hidden when null); Final soft-merges MLB Play fan-vote `player_of_the_game` on game detail (null when absent or not final); halftime falls back to compact header; game detail payload also includes optional `venue_city`, `venue_state`, `weather`, and `umpires` for Game Info UI |

### Cross-cutting API behavior

- Most WNBA handlers use short in-process caches; responses that must stay fresh often send `Cache-Control: no-store`.
- WNBA ESPN standings (`site.web.api`) and roster fetches, plus WNBA leaders (`stats.wnba.com/leagueleaders`), use shared `app.core.outbound_cache` (memory + disk under `data/cache/outbound`, per-key TTL, stale-while-revalidate, coalescing, host rate limit/backoff).
- MLB scoreboard today always returns `Cache-Control: no-store`; upstream failures surface as HTTP 502 (also no-store).
- OpenAPI is the contract. Backend export → `frontend/openapi.json` → regenerate `api.schema.d.ts`. Verify with `npm run check:api`.
- Prop picks: server builds DFS-anchored rows (`wnba.props` / `mlb.props` + `prop_fair` / `prop_formats` + odds snapshots; MLB rows also attach `books_main` for per-book main lines). WNBA board filters Stat / Team / Side client-side (`filterWnbaPropPicks`); MLB board groups into player cards and filters Team + name (`groupMlbPropPlayers`, `filterMlbPropPlayers`). Game-detail Props still reuse today's props assembly for the category grid.

### Prop picks data flow (detail)

```text
LeaguePropPicksPage
  → useWnbaProps({ app, format, legs })
  → GET /api/wnba/props/today?app=&format=&legs=
  → wnba.props.get_wnba_props_today()
       ├─ seed: Parlay PrizePicks (fallback odds.wnba_prizepicks) or odds.wnba_underdogs
       ├─ exact-line indexes: Parlay DK/FD + odds.wnba_prophetx / novig / pinnacle
       └─ prop_fair + prop_formats (fair %, edge, tier, recommend, sort)
  → client excludePastGameProps(scoreboard) + filterWnbaPropPicks (Stat/Team/Side; page size 20)
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
    betting/        # DFS and sportsbook prop/odds endpoints
    mlb/            # live MLB endpoints
    research/       # DB-backed research endpoints
    wnba/           # live WNBA endpoints
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

Feature-level history lives under `docs/superpowers/specs/` and `docs/superpowers/plans/`. Full platform (ETL / ML) overview remains in the root `README.md`.

---

## 5. Quick reference — endpoints used by the site

| Method | Path | Primary service module |
|--------|------|------------------------|
| GET | `/api/wnba/scoreboard/today` | `wnba_scoreboard` |
| GET | `/api/wnba/scoreboard?date=` | `wnba_scoreboard` |
| GET | `/api/wnba/odds/today` | `parlay_odds` (+ `book_boards`: ProphetX → Novig → Pinnacle from Supabase team snapshots; legacy `games[]` retained) |
| GET | `/api/wnba/props/today` | `wnba.props` (+ `prop_fair`, `prop_formats`, snapshots) |
| GET | `/api/wnba/props/game/{espn_event_id}` | `wnba.game_props` (+ `get_today_props`, game detail, roster headshots) |
| GET | `/api/wnba/leaders` | `wnba_leaders` |
| GET | `/api/wnba/standings` | `wnba_standings` |
| GET | `/api/wnba/futures` | `wnba_futures` |
| GET | `/api/wnba/player/{player_id}` | `wnba_player` |
| GET | `/api/wnba/games/{espn_event_id}` | `wnba_game_detail` (+ scheduled record/last_10, season_team_stats ranks, game_leaders) |
| GET | `/api/wnba/games/{espn_event_id}/team-preview?side=` | `wnba.team_preview` (team PPG/RPG/APG leaders + roster averages) |
| GET | `/api/mlb/scoreboard/today` | `mlb_scoreboard` (MLB Stats API) |
| GET | `/api/mlb/scoreboard?date=` | `mlb_scoreboard` |
| GET | `/api/mlb/odds/today` | `mlb_odds` (Sharp `league=mlb`) |
| GET | `/api/mlb/props/today` | `mlb.props` (+ `prop_fair`, `prop_formats`, `prop_stat_keys`, `odds_snapshots`, `books_main`; PP seed from Supabase, not Parlay) |
| GET | `/api/mlb/props/game/{game_pk}?app=` | `mlb.game_props` (+ `props` board assembly, `odds_snapshots`) |
| GET | `/api/mlb/games/{game_pk}/team-preview?side=` | `mlb.team_preview` (+ leaders boards, team season player splits) |
| GET | `/api/mlb/leaders` | `mlb.leaders` (MLB Stats API) |
| GET | `/api/mlb/standings` | `mlb.standings` (MLB Stats API) |
| GET | `/api/mlb/futures` | `mlb_futures` |

Health (ops, not UI): `GET /api/health`.
