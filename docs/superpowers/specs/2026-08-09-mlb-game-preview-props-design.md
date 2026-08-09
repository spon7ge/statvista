# MLB Game Preview Player Props (category cards)

Date: 2026-08-09  
Status: Approved for planning  
Product: **statvista**

## Goal

On `/mlb/games/:gamePk` pregame, showcase **player props** in a 2-column category-card grid (Line / Over / Under) matching the reference Predictions-style UI. Cards use the **PrizePicks DFS line** as the line anchor; Over/Under pills show the **best American odds across all books** that offer that exact line, with the **bookmaker name under the odds**. Clicking a Preview row switches to a new in-page **PrizePicks** tab. New **PrizePicks** and **Underdog** tabs use the same grid UI, each anchored on that app’s DFS lines, filtered to the matchup.

## Decisions

| Topic | Choice |
| --- | --- |
| Placement of grid | **Preview** tab section under existing lineups / odds / info stack (not a separate Predictions tab) |
| Click destination | Always switch to in-page **PrizePicks** tab (Approach A); Underdog remains its own tab |
| DFS tabs on game page | Add **PrizePicks** + **Underdog** beside Preview / Away / Home |
| DFS tab content | Same category-card UI as Preview (not the EV-ranked `/mlb/prop_picks` board) |
| Line anchor | PrizePicks line on Preview + PrizePicks tab; Underdog line on Underdog tab |
| Best odds pool | **All** books present for that exact line (ProphetX, Novig, Kalshi, DK, FD, Pinnacle, BetMGM, BetOnline) |
| Best definition | Highest American odds per side; ties → priority: prophetx → novig → kalshi → draftkings → fanduel → pinnacle → betmgm → betonline |
| Missing side | Omit pill / leave cell empty |
| Approach | Hybrid (3): thin game-scoped endpoint reusing today’s props assembly + shared grid component |
| Deep-link highlight | Out of scope for v1 (tab switch only) |
| EV / edge / expand | Out of scope on these cards |
| Live / Final | Out of scope (pregame only) |
| Novig watermark | Do not copy “Powered by Novig”; use MLB game dark chrome |

## Architecture

```
MlbPregameCenter
  tabs: preview | away | home | prizepicks | underdog
  Preview:
    MlbProjectedLineups (existing)
    + MlbGamePropsGrid (app=prizepicks)  ← click row → prizepicks tab
  PrizePicks / Underdog:
    MlbGamePropsGrid (app=prizepicks | underdog)

GET /api/mlb/props/game/{gamePk}?app=prizepicks|underdog
  └── reuse DFS + book snapshot assembly from props/today
        filter to game teams (+ date when available)
        per DFS row: best Over + best Under at exact line
        group into categories[] for the grid
```

## Page structure

### Pregame tabs

`Preview` · `{Away team name}` · `{Home team name}` · `PrizePicks` · `Underdog`

Extend `PregameTab` in `MlbPregameBroadcastHeader` / `MlbPregameCenter`.

### Preview

1. Existing `MlbProjectedLineups` two-column stack (unchanged)
2. Full-width **Player Props** section below: `MlbGamePropsGrid` with `app=prizepicks`

### PrizePicks / Underdog tabs

Full-width `MlbGamePropsGrid` for that `app`, scoped to the current game’s two teams.

### Away / Home tabs

Unchanged stubs for this slice.

## UI — `MlbGamePropsGrid`

- Responsive **2-column** grid of category cards (1 column on narrow viewports)
- Card header: human-readable **stat title** + column labels **Line / Over / Under**
- Player row: headshot · name · line · Over pill · Under pill
  - Pill: American odds on top; **book display name** underneath (e.g. DraftKings)
  - Missing side → empty cell
- **Show more** when a category has more than **5** visible rows (collapse back to 5)
- Rows on Preview are clickable → `onTabChange("prizepicks")`
- Rows on DFS tabs are display-only (no navigation required)
- Quiet empty / error states; never break the rest of Preview

Visual language: existing MLB charcoal / dark game chrome; match the reference layout structure (category cards + Line/Over/Under), not a separate Novig skin.

## Data & API

### Endpoint

`GET /api/mlb/props/game/{gamePk}?app=prizepicks|underdog`

- Invalid `gamePk` → 404
- Unknown / unsupported `app` → 422
- Soft failures assembling odds → response with empty `categories` and optional `error` string (same spirit as props/today); do not 500 the game page UI

### Response (grid-ready)

```
as_of: str
app: str
game_pk: str
away_abbrev: str
home_abbrev: str
categories: list[MlbGamePropCategory]
error: str | null

MlbGamePropCategory:
  stat: str          # canonical key
  label: str         # display title (e.g. "Home Runs")
  players: list[MlbGamePropPlayer]

MlbGamePropPlayer:
  player_name: str
  team_abbrev: str | null
  headshot_url: str | null
  line: float        # DFS app line
  over: MlbGamePropBestQuote | null
  under: MlbGamePropBestQuote | null

MlbGamePropBestQuote:
  american: int
  book: str          # machine key: draftkings | fanduel | …
```

### Assembly rules

1. Resolve game detail (or minimal schedule fields) for `away_abbrev`, `home_abbrev`, and game date.
2. Build DFS board for `app` using the same snapshot / Odds API sources as `GET /api/mlb/props/today`.
3. Keep rows whose `team_abbrev` matches away or home (case-insensitive). Prefer also matching game date when DFS / book rows carry a date, to reduce doubleheader bleed.
4. For each remaining DFS row `(player, stat, line)`:
   - Gather all book quotes at that **exact line** for Over and for Under separately.
   - Book pool: prophetx, novig, kalshi, draftkings, fanduel, pinnacle, betmgm, betonline (whatever exists for the line).
   - `over` / `under` = quote with the **highest American** odds on that side; on tie, pick the earlier book in: prophetx → novig → kalshi → draftkings → fanduel → pinnacle → betmgm → betonline.
5. Group players into `categories` by `stat`, with stable category order (reuse or extend existing MLB prop stat ordering / labels).
6. Drop rows that cannot be tied to either team abbrev rather than showing them on the wrong game.

### Frontend wiring

- `fetchMlbGameProps(gamePk, app)` + `useMlbGameProps(gamePk, app)`
- Fetch when the active tab needs it: Preview → `prizepicks`; PrizePicks → `prizepicks`; Underdog → `underdog` (no always-on prefetch required for v1)
- Regenerate OpenAPI types; update `md/system-design.md` page ↔ API table

## Error & edge cases

| Case | Behavior |
| --- | --- |
| Props fetch fails | Preview lineups/odds still work; props section shows short error or empty |
| No DFS lines for matchup | Empty state: “No props available for this matchup” |
| Only one side quoted | Render that pill only |
| Tie for best American | Stable book priority |
| Doubleheader same abbrevs | Filter by team abbrevs + game date when available |
| Unmatched team abbrev | Exclude row |

## Testing

**Backend**

- Best Over / Under selection across multiple books
- Tie-break uses stable priority
- Game team filter includes only away/home
- One-sided quote → null on the other side
- Empty categories when no DFS for matchup
- Invalid gamePk → 404

**Frontend**

- Grid shows line, odds, and book name under odds
- Preview row click switches to PrizePicks tab
- PrizePicks vs Underdog tabs request correct `app`
- Empty / error states render without crashing Preview
- Show more expands category rows

## Out of scope

- Scroll/highlight of the clicked player on PrizePicks tab
- EV, edge %, fair %, source-tier chips on these cards
- Replacing `/mlb/prop_picks` page UI
- Live / Final props tabs
- Separate Predictions tab
- Novig branding watermark

## Docs to update on implement

- `md/system-design.md` — `/mlb/games/:gamePk` row + new props game endpoint
- `backend/README.md` / `frontend/README.md` only if they list MLB game APIs explicitly
