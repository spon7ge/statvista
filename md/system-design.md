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

statvista’s public site is a React + Vite app talking to a FastAPI service over `/api`. `/` replace-redirects to **MLB games**. The product surface is **Props, Legs, Arbitrage, and Games** (plus game detail). **WNBA** has a live games slate, a DFS-anchored prop-picks research table, game detail, and a **priced Legs** shortlist (`GET /api/wnba/legs`). **MLB** adds a live games hub (dated slate), game detail, a DFS-anchored prop-picks research table, and a **priced Legs** shortlist (`GET /api/mlb/legs`). NBA is scaffolded (`/nba/matchups` placeholder).

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
| WNBA upstream | `/api/wnba/scoreboard/*`, `props/today`, `props/board`, `games/{id}`, … | Yes |
| MLB upstream | `/api/mlb/scoreboard/*`, `/api/mlb/odds/today`, `/api/mlb/props/board`, `/api/mlb/legs` | Yes (matchups, Preview odds, prop research table, Legs) |
| DB-backed (silver / gold) | `/api/games/{date}/slate`, `/api/props`, … | No |

Shared chrome (`HomeChromeLayout`) wraps most routes with a left sidebar (mobile hamburger drawer) and footer. The sidebar wordmark sits beside the page title. Primary nav is a card: **Home** (chevron folds MLB / WNBA / NBA matchups; default open) then **Props, Legs, Arbitrage, and Games** (current league's board/legs/arb/slate, else MLB; NBA Props, Legs, and Arbitrage fall back to MLB). Page league pills still switch the open section. Wordmark and Home land on `/mlb/matchups`. Props links prefetch the destination board on hover; the sidebar also warms that board on mount. Client React Query keeps MLB `/props/board` and WNBA `/props/board` fresh for 15 minutes (`staleTime` matches the poll; no refetch on window focus). MLB Legs uses `GET /api/mlb/legs` with a **5-minute** in-process cache and matching client `staleTime` (freshness is the product).

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
      /wnba/legs           LeagueLegsPage (LegsBoard via useWnbaLegs)
      /wnba/arbitrage      LeagueArbitragePage
      /wnba/prop_picks/player/:playerSlug  replace-redirect → /wnba/prop_picks
      /nba/matchups        LeagueMatchupsPage (placeholder)
      /mlb/matchups        LeagueMatchupsPage (league="mlb", live slate)
      /mlb/prop_picks      MlbPropPicksPage
      /mlb/legs            LeagueLegsPage (MLB board via useMlbLegs)
      /mlb/arbitrage       LeagueArbitragePage
      /mlb/prop_picks/player/:playerSlug  replace-redirect → /mlb/prop_picks
      /mlb/games/:gamePk   MlbGameDetailPage
    * → NotFoundPage
```

### Conventions

| Layer | Role |
|-------|------|
| `pages/` | Route composition |
| `features/{home,basketball,mlb}/` | UI by domain |
| `hooks/useWnba*.ts`, `useWnbaLegs.ts`, `useWnbaPropBoard.ts`, `useMlbScoreboard.ts`, `useMlbPropBoard.ts`, `useMlbLegs.ts`, `useGameDetail.ts` | TanStack Query wrappers |
| `lib/api.ts` | Typed `fetch` helpers + `VITE_API_BASE_URL` |

**Chrome data:** The layout itself does not fetch scoreboards. Games pages load each league's scoreboard independently.

---

## 3. Page ↔ API map

| Route | Page job | Hook(s) | API | Upstream / notes |
|-------|----------|---------|-----|------------------|
| `/` | Landing | — | — | Replace-redirect to `/mlb/matchups` |
| `/wnba/matchups?date=` | Daily slate (no team-lines odds pill); Games header with MLB/WNBA/NBA league pills and **Today** date nav on that same row | `useWnbaScoreboard(date)` | scoreboard (`/today` or `?date=`) | Cards → `/games/:espnEventId` (Preview odds board uses `GET /api/wnba/odds/today`) |
| `/wnba/prop_picks` | Sportsbook **research table** (MLB twin): one row per player + market + **PrizePicks/Underdog line** + side; composite cell (overlapping headshot + team logo; **name · matchup**; market below); columns **Proposition**, **Line**, **DFS** (PrizePicks/Underdog logo + American; PrizePicks -137; no implied %), **Odds** (sportsbooks only — this side: logo + that book’s line + American, even when the number differs from DFS); **IP** (average raw implied of Odds Americans), L5/L10/L15, H2H (this season + last season vs opponent, pooled; colored cells); **Game** (day's slate, away @ home) + Team + **Bookmaker** + **Proposition** (market) + **Over/Under** + **Hit rate** (L5/L10/L15 highest→lowest) + player name search; no PrizePicks/Underdog tabs | `useWnbaPropBoard` | `GET /api/wnba/props/board` | Client `filterWnbaPropBoardRows` (game + team + book + market + side + name; selected books trim `dfs` or `books` chips; drop rows with no PrizePicks/Underdog line); default sort game start / name / stat / Over then Under / line; hit-rate control sorts L5/L10/L15 desc; **30 rows per page** with Previous/Next; empty copy “No board yet” |
| `/wnba/legs` | **Priced complete entries** (same product as MLB): PrizePicks / Underdog; Power 2–6 or Flex 6; UD Standard 2–6. Greedy packer emits complete N-pick `entries`. Vertical PLAY cards (headshot, matchup, name, market); chip-row `breakeven: x%`. | `useWnbaLegs({ app, format, legs })` | `GET /api/wnba/legs?app=&format=&legs=` | `wnba.legs.get_wnba_legs()` + shared `legs_pricer` / `legs_payouts` / `legs_pack`. WNBA DFS + PX/Novig/Pinnacle alts + `odds.wnba_parlay_api_odds`. Drop live/halftime/final. `game_id` = ESPN event id. PLAY `headshot_url` from ESPN roster. Default `?app=prizepicks&format=power&legs=4`. Specs: `docs/superpowers/specs/2026-08-30-wnba-legs-design.md`, `docs/superpowers/specs/2026-08-31-legs-board-vertical-cards-design.md` |
| `/wnba/arbitrage` | **Coming soon** placeholder; league pills | — | none | “Arbitrage coming soon.”; no API yet |
| `/wnba/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/wnba/prop_picks`. `WnbaPlayerPropsOddsGrid` remains for shared book-column patterns; game-detail Props still uses `GET /api/wnba/props/game/{espn_event_id}` |
| `/games/:espnEventId` | Game detail: scheduled → MLB-parity pregame (broadcast header with record + last 10; centered Preview / Away / Home / **Props**); Preview two-column (left: Projected Starters → Game Info → Matchup Prediction → Game Leaders PPG/RPG/APG; right: multi-book Odds board → Team Stats + `#rank` → Injuries); Away/Home → team preview (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-); **Props** tab has PrizePicks / Underdog sub-tabs and shows the matchup-scoped **Player Props** category-card grid (Line / Over / Under, book name under odds); live/halftime or final → broadcast header + Summary \| Box (Scoring plays \| All plays; Summary right rail: linescore, team stats, win probability, shot chart, Game Info; Box: stacked away/home box score) | `useGameDetail`, `useWnbaOdds`, `useWnbaGameProps(espnEventId, app)`, `useWnbaTeamPreview(espnEventId, side)` | `GET /api/wnba/games/{id}`, `GET /api/wnba/odds/today` (Preview `book_boards`), `GET /api/wnba/props/game/{id}?app=prizepicks\|underdog` (Props tab only), `GET /api/wnba/games/{id}/team-preview?side=` (Away/Home) | ESPN summary + standings/team stats/roster for enrichment (standings + roster JSON via `app.core.outbound_cache`); RotoWire starters; Preview odds prefer `book_boards` (ProphetX → Novig → Pinnacle) with soft-fail per book and fallback to legacy `games[]`; game-scoped props reuse today's props assembly filtered to away/home abbrevs; soft-fail empty sections; no Player of the Game or pitch zone |
| `/nba/matchups` | Placeholder; same Games league-pill header as WNBA/MLB | — | none | “NBA games coming soon” |
| `/mlb/matchups?date=` | Daily slate (no team-lines odds pill); Games header with MLB/WNBA/NBA league pills and **Today** date nav on that same row | `useMlbScoreboard(date)` | scoreboard (`/today` or `?date=`) | Stats API schedule; cards → `/mlb/games/:gamePk` (Preview odds board still uses `GET /api/mlb/odds/today`) |
| `/mlb/prop_picks` | Sportsbook **research table**: one row per player + market + **PrizePicks/Underdog line** + side; composite cell (overlapping headshot + team logo; **name · matchup**; market below); columns **Proposition**, **Line**, **DFS** (PrizePicks/Underdog logo + American; PrizePicks -137; no implied %), **Odds** (sportsbooks only — this side: logo + that book’s line + American, even when the number differs from DFS); **IP** (average raw implied of Odds Americans), L5/L10/L15, H2H (this season + last season vs opponent, pooled; colored cells); **Game** (day's slate, away @ home) + Team + **Bookmaker** + **Proposition** (market) + **Over/Under** + **Hit rate** (L5/L10/L15 highest→lowest) + player name search; no PrizePicks/Underdog tabs | `useMlbPropBoard` | `GET /api/mlb/props/board` | Client `filterMlbPropBoardRows` (game + team + book + market + side + name; selected books trim `dfs` or `books` chips; drop rows with no PrizePicks/Underdog line); default sort game start / name / stat / Over then Under / line; hit-rate control sorts L5/L10/L15 desc; **30 rows per page** with Previous/Next; empty copy “No board yet” |
| `/mlb/legs` | **Priced complete entries**: PrizePicks / Underdog tabs; Power 2–6 or Flex 6 (no Flex 3); UD Standard 2–6. Greedy packer emits zero or more **complete N-pick `entries`** (each card exactly `legs` priced rows); no public flat PLAY list. Empty `entries` is valid. Vertical PLAY cards (headshot, matchup, name, market line); click expands per-book audit. Chip-row **`breakeven: {base_break_even}`**. Flex 6 enforces max 2 legs per `game_id` on a card; `flex_same_game_warning` always false. | `useMlbLegs({ app, format, legs })` | `GET /api/mlb/legs?app=&format=&legs=` | Server `mlb.legs.get_mlb_legs()` + `betting.legs_pricer` / `legs_payouts` / `legs_pack` (not `prop_fair`). Exact-line two-way consensus (PX/Novig/Pinnacle alts + Parlay DK/FD/MGM/Caesars; ProphetX `stake` required, Novig stake optional; hold >12% excluded). ≥1 sharp/exchange + ≥2 weight≥2.0 books. PLAY pool sorted then packed; leftover in `unpacked_remainder`. PLAY `headshot_url` from ESPN roster. DFS seed >60 min → no PLAY priced (`dfs_snapshot_stale`, `lines_seeded` still set). Default `?app=prizepicks&format=power&legs=4`. Invalid query (e.g. flex/3, UD boosted) → 422. Specs: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md`, `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md`, `docs/superpowers/specs/2026-08-31-legs-board-vertical-cards-design.md` |
| `/mlb/arbitrage` | **Coming soon** placeholder; league pills | — | none | “Arbitrage coming soon.”; no API yet |
| `/mlb/prop_picks/player/:playerSlug` | Removed | — | — | Replace-redirect to `/mlb/prop_picks`. `MlbPlayerPropsOddsGrid` remains for shared book-column patterns; game-detail Props still uses `GET /api/mlb/props/game/{gamePk}` |
| `/mlb/games/:gamePk` | Game detail: pregame broadcast header (Preview shows RotoWire lineups when matched with right-rail odds board beside lineups; Preview / Away / Home / **Props** tabs; Preview keeps team odds board beside lineups (no player props grid); **Props** tab has PrizePicks / Underdog sub-tabs and shows the matchup-scoped **Player Props** category-card grid (Line / Over / Under, book name under odds); Away/Home tabs show **team preview** (Team Batting/Pitching Leaders + full active-roster season batting/pitching tables); under lineups: season Team Stats (with league `#N` ranks) + Injuries; right rail Odds → Game Info → Matchup prediction (ESPN) when present, then Game Leaders — HR/AVG/OPS batter cards (best active-roster hitter per category, value + muted `#N`, last name + team logo, ESPN headshots)), live Summary/Box center (ESPN-style matchup + pitch zone above play feed, linescore/team stats/win prob/hit chart in Summary right rail, box score side-by-side in Box tab), or final Summary/Box center (optional fan-vote Player of the Game card from MLB Play above Play feed when winner published; hidden when null) | `useMlbGameDetail(gamePk)`, `useMlbLineups(date)`, `useMlbLineupMatchup`, `useMlbOdds`, `useMlbGameProps(gamePk, app)`, `useMlbTeamPreview(gamePk, side)` | `GET /api/mlb/games/{gamePk}`, `GET /api/mlb/lineups?date=` (Preview tab), `GET /api/mlb/lineups/matchup?date=&away=&home=`, `GET /api/mlb/odds/today` (Preview odds board), `GET /api/mlb/props/game/{gamePk}?app=prizepicks\|underdog` (Props tab only), `GET /api/mlb/games/{gamePk}/team-preview?side=away|home` (Away/Home tabs) | MLB Stats API (+ ESPN when available); RotoWire projected lineups for Preview, matched by abbrev with both sides' pitcher + 9 batters complete; Stats API enriches the matched lineup with season pitching and career BvP; Preview right-rail odds board stacks matched books from `odds/today` `book_boards` (ProphetX → Novig → Pinnacle only) with Money / Total / Spread columns per away/home row pair and a subtle book name under each pair; falls back to legacy `games[]` when `book_boards` is empty; game-scoped props reuse the same assembly as `props/today` (PX/Novig/Pinnacle scrapers + Parlay books from `odds.mlb_parlay_api_odds` snapshot only — no live Parlay fallback), filtered to away/home abbrevs; DFS line anchors Over/Under pills with best American odds across ProphetX, Novig, DK, FD, Pinnacle at the exact line (Props→PrizePicks → PrizePicks line; Props→Underdog → Underdog line); soft empty/error on props fetch (`parlay_unavailable` when Parlay snapshot empty); Preview soft-merges season YTD team hitting/pitching (Stats) + league competition ranks + injuries (ESPN) under projected lineups even when lineups are unavailable; Preview Matchup prediction from ESPN summary `predictor` when available (hidden when null); Game Leaders from game detail payload (`game_leaders`; best roster batter per HR/AVG/OPS with league rank; hidden when null); Final soft-merges MLB Play fan-vote `player_of_the_game` on game detail (null when absent or not final); halftime falls back to compact header; game detail payload also includes optional `venue_city`, `venue_state`, `weather`, and `umpires` for Game Info UI |

### Cross-cutting API behavior

- Most WNBA handlers use short in-process caches; responses that must stay fresh often send `Cache-Control: no-store`.
- WNBA ESPN standings (`site.web.api`) and roster fetches, plus WNBA leaders (`stats.wnba.com/leagueleaders`), use shared `app.core.outbound_cache` (memory + disk under `data/cache/outbound`, per-key TTL, stale-while-revalidate, coalescing, host rate limit/backoff).
- MLB scoreboard today always returns `Cache-Control: no-store`; upstream failures surface as HTTP 502 (also no-store).
- OpenAPI is the contract. Backend export → `frontend/openapi.json` → regenerate `api.schema.d.ts`. Verify with `npm run check:api`.
- Prop picks: server builds DFS-anchored rows (`wnba.props` / `mlb.props` + `prop_fair` / `prop_formats` + odds snapshots; MLB rows also attach `books_main` for per-book main lines). Player book joins use `match_player_key` (accent-stripped norm + small aliases); DFS display names unchanged. MLB Stats person search and ESPN roster lookup prefer an active `Jr.` when the query omits that suffix (so hit rates are not attached to a retired father). WNBA research-table hit rates resolve stats.wnba.com ids from `commonallplayers` (fallback `leaguedashplayerstats`) via the same `match_player_key`. WNBA Parlay books still come from live Parlay indexes on `GET /api/wnba/props/today`; live WNBA Parlay fetch throttled-writes `odds.wnba_parlay_api_odds` (same persist helper as game props). The WNBA research table (`GET /api/wnba/props/board`) reads Parlay from that snapshot only, like MLB. MLB Parlay books (DK/FD/cmp) come only from `odds.mlb_parlay_api_odds` (live Parlay fetch throttled-writes that table, never serves from live rows). `/wnba/prop_picks` and `/mlb/prop_picks` are research tables (`filterWnbaPropBoardRows` / `filterMlbPropBoardRows` on `/props/board`). Game-detail Props still reuse today's props assembly for the category grid. MLB `/mlb/legs` is a **separate** pipeline (`betting.legs_pricer` + `legs_payouts`); it does not reuse `prop_fair` or `prop_formats`.

### Prop picks data flow (detail)

```text
LeaguePropPicksPage
  → useWnbaPropBoard()  (staleTime 15m; sidebar prefetches GET /api/wnba/props/board)
  → GET /api/wnba/props/board
  → wnba.prop_board.get_wnba_prop_board()
       ├─ cluster sportsbook mains + PrizePicks/Underdog mains by (player, stat, exact line)
       ├─ skip clusters with no PrizePicks/Underdog; DFS rows attach each book's main (any line)
       ├─ emit Over + Under rows; dfs vs books; IP = average raw implied of Odds Americans
       ├─ L5/L10/L15 + H2H from stats.wnba.com gamelogs (soft-fail warnings)
       └─ GET /api/wnba/props/today unchanged (still feeds game-detail Props)
  → client filterWnbaPropBoardRows (team + market + side + name) + sortable research table

MlbPropPicksPage
  → useMlbPropBoard()  (staleTime 15m; sidebar prefetches GET /api/mlb/props/board)
  → GET /api/mlb/props/board
  → mlb.prop_board.get_mlb_prop_board()
       ├─ cluster sportsbook mains + PrizePicks/Underdog mains by (player, stat, exact line)
       ├─ skip clusters with no PrizePicks/Underdog; DFS rows attach each book's main (any line)
       ├─ emit Over + Under rows; dfs vs books; IP = average raw implied of Odds Americans
       ├─ opp def/pace ranks + L5/L10/L15 (soft-fail warnings)
       └─ GET /api/mlb/props/today unchanged (still feeds game-detail Props)
  → client filterMlbPropBoardRows (team + market + side + name) + sortable research table

LeagueLegsPage (MLB)
  → useMlbLegs({ app, format, legs })  (staleTime 5m)
  → GET /api/mlb/legs?app=&format=&legs=
  → mlb.legs.get_mlb_legs()
       ├─ seed PrizePicks or Underdog (standard only); lines_seeded
       ├─ abort PLAY if DFS snapshot age > 60 min
       ├─ exact-line two-ways: PX/Novig/Pinnacle (alts) + Parlay DK/FD/MGM/Caesars
       ├─ drop live/final games; attach gamePk
       ├─ legs_pricer (log-odds, coverage gates, favorite side only; UD Over-only stats Over)
       └─ legs_pack (greedy complete-N cards; Flex max 2 per game_id; unpacked_remainder)
  → entries[] cards or threshold/stale/empty

LeagueLegsPage (WNBA)
  → useWnbaLegs({ app, format, legs })  (staleTime 5m)
  → GET /api/wnba/legs?app=&format=&legs=
  → wnba.legs.get_wnba_legs()
       ├─ seed PrizePicks or Underdog (standard only); lines_seeded
       ├─ abort PLAY if DFS snapshot age > 60 min
       ├─ exact-line two-ways: PX/Novig/Pinnacle (alts) + Parlay from `odds.wnba_parlay_api_odds`
       ├─ drop live/halftime/final; attach ESPN event id as `game_id`
       ├─ legs_pricer (log-odds, coverage gates, favorite side only)
       └─ legs_pack (greedy complete-N cards; Flex max 2 per game_id; unpacked_remainder)
  → entries[] cards or threshold/stale/empty
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
    betting/        # shared DFS pricing (legs_pricer, legs_payouts) + prop helpers
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

Feature-level history lives under `docs/superpowers/specs/` and `docs/superpowers/plans/`. Clone, local run, and a short product pitch live in the root `README.md`.

---

## 5. Quick reference — endpoints used by the site

| Method | Path | Primary service module |
|--------|------|------------------------|
| GET | `/api/wnba/scoreboard/today` | `wnba_scoreboard` |
| GET | `/api/wnba/scoreboard?date=` | `wnba_scoreboard` |
| GET | `/api/wnba/odds/today` | `parlay_odds` (+ `book_boards`: ProphetX → Novig → Pinnacle from Supabase team snapshots; legacy `games[]` retained) |
| GET | `/api/wnba/props/today` | `wnba.props` (+ `prop_fair`, `prop_formats`, snapshots) |
| GET | `/api/wnba/props/board` | `wnba.prop_board` (DFS-anchored rows; sportsbook mains attached on `books` even when the line differs; `dfs` vs `books`; IP / L5–L15 / H2H; 200 even when enrichments fail) |
| GET | `/api/wnba/legs?app=&format=&legs=` | `wnba.legs` + `betting.legs_pricer` / `legs_payouts` / `legs_pack` (complete-N `entries`; 5 min cache; 422 on invalid combo; 200 empty slate) |
| GET | `/api/wnba/props/game/{espn_event_id}` | `wnba.game_props` (+ `get_today_props`, game detail, roster headshots) |
| GET | `/api/wnba/games/{espn_event_id}` | `wnba_game_detail` (+ scheduled record/last_10, season_team_stats ranks, game_leaders) |
| GET | `/api/wnba/games/{espn_event_id}/team-preview?side=` | `wnba.team_preview` (PPG/RPG/APG/BPG/SPG leaders + roster averages incl. SH-EFF, SC-EFF, PPEP, RTG, +/-) |
| GET | `/api/mlb/scoreboard/today` | `mlb_scoreboard` (MLB Stats API) |
| GET | `/api/mlb/scoreboard?date=` | `mlb_scoreboard` |
| GET | `/api/mlb/odds/today` | `mlb_odds` (Sharp `league=mlb`) |
| GET | `/api/mlb/props/today` | `mlb.props` (+ `prop_fair`, `prop_formats`, `prop_stat_keys`, `books_main`; PP/UD from Supabase; Parlay books from `fetch_latest_parlay_api_odds("mlb")` / `odds.mlb_parlay_api_odds` only) |
| GET | `/api/mlb/props/board` | `mlb.prop_board` (DFS-anchored rows; sportsbook mains attached on `books` even when the line differs; `dfs` vs `books`; IP / ranks / L5–L15; 200 even when enrichments fail) |
| GET | `/api/mlb/legs?app=&format=&legs=` | `mlb.legs` + `betting.legs_pricer` / `legs_payouts` / `legs_pack` (complete-N `entries`; 5 min cache; 422 on invalid combo; 200 empty slate) |
| GET | `/api/mlb/props/game/{game_pk}?app=` | `mlb.game_props` (+ same props assembly as today; Parlay from `odds.mlb_parlay_api_odds` snapshot, not live indexes) |
| GET | `/api/mlb/games/{game_pk}/team-preview?side=` | `mlb.team_preview` (+ leaders boards, team season player splits) |

Health (ops, not UI): `GET /api/health`.
