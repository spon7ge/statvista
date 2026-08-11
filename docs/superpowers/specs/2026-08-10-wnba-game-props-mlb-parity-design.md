# WNBA Game Props MLB UI Parity

Date: 2026-08-10  
Status: Approved design  
Product: **statvista**

## Goal

On `/wnba/matchups` game detail pregame **Props**, match the MLB category-card player-props UI: DFS line as the Line anchor, Over/Under pills with best American odds and book name, headshots, 2-column category cards, and show more/less.

## Decisions

| Topic | Choice |
| --- | --- |
| Fidelity | Full MLB parity (Approach A) |
| Implementation | Hybrid game endpoint + dedicated grid (Approach 1) |
| Placement | Props tab only (not Preview) |
| DFS sub-tabs | Keep existing PrizePicks / Underdog under Props |
| Line anchor | Selected DFS app line (`prizepicks` or `underdog`) |
| Best odds pool | Sportsbooks on today’s WNBA props assembly (not DFS books) |
| Best definition | Highest American per side; ties → book priority below |
| Missing side | Empty pill cell |
| League prop picks page | Unchanged |
| Live / Final | Out of scope (pregame only) |

## Architecture

```
WnbaPregameCenter
  tabs: preview | away | home | props
  Props:
    PrizePicks | Underdog sub-tabs
    → WnbaGamePropsGrid (categories from game endpoint)

GET /api/wnba/props/game/{espnEventId}?app=prizepicks|underdog
  └── reuse get_today_props() assembly
        filter to game teams (abbrev expansion)
        per DFS row: best Over + best Under at exact line
        attach headshots from ESPN roster when available
        group into categories[] for the grid
```

## Page structure

### Pregame tabs

Unchanged: `Preview` · `{Away}` · `{Home}` · `Props`

### Props tab

1. Existing PrizePicks / Underdog sub-tab chrome
2. Replace flat `WnbaGamePropsList` with `WnbaGamePropsGrid` for the active `app`

### Preview / Away / Home

Unchanged for this slice.

## UI — `WnbaGamePropsGrid`

Twin of `MlbGamePropsGrid`:

- Responsive **2-column** category cards (`columns-1` / `lg:columns-2`)
- Card header: human-readable **stat title** + **Line / Over / Under**
- Player row: headshot · name · team abbrev · line · Over pill · Under pill
  - Pill: American odds on top; book display name underneath
  - Missing side → empty cell
- **Show more** when a category has more than **5** rows
- Quiet empty / loading / error states; soft `error` banner when categories still exist
- Visual language: existing WNBA dark game chrome (same patterns as MLB grid)

## Data & API

### Endpoint

`GET /api/wnba/props/game/{espnEventId}?app=prizepicks|underdog`

- Unknown game → 404
- Unsupported `app` → 422
- Soft failures assembling odds / roster → response with empty or partial `categories` and optional `error` string; do not 500 the game page UI

### Response (grid-ready)

```
as_of: str
app: str
espn_event_id: str
away_abbrev: str
home_abbrev: str
categories: list[WnbaGamePropCategory]
error: str | null

WnbaGamePropCategory:
  stat: str          # canonical key
  label: str         # display title (e.g. "Points")
  players: list[WnbaGamePropPlayer]

WnbaGamePropPlayer:
  player_name: str
  team_abbrev: str | null
  headshot_url: str | null
  line: float        # DFS app line
  over: WnbaGamePropBestQuote | null
  under: WnbaGamePropBestQuote | null

WnbaGamePropBestQuote:
  american: int
  book: str          # machine key: novig | draftkings | …
```

### Assembly rules

1. Resolve game detail for `away_abbrev`, `home_abbrev` (and date when useful).
2. Call existing `get_today_props()` (same Parlay + DFS + Pinnacle/Novig attach path as `/api/wnba/props/today`).
3. Keep rows whose `team_abbrev` matches away or home after the same abbrev expansion used by the game Props filter today.
4. For each remaining DFS slot `(player, stat, line)` for the requested `app`:
   - Gather sportsbook quotes at that **exact** line for Over and Under separately.
   - Book pool (exclude DFS): `novig`, `draftkings`, `fanduel`, `pinnacle`, `betmgm`, `caesars`, `betrivers`, `bet365` (whatever is present on the row).
   - `over` / `under` = highest American on that side; ties → earlier in that priority list.
5. Group players into `categories` by canonical `stat`, with stable label via existing `display_stat_label` / WNBA prop stat helpers.
6. Attach `headshot_url` from ESPN roster indexes for the two teams when a name match exists; otherwise `null` (UI shows initial).
7. Drop rows that cannot be tied to either team rather than showing them on the wrong game.

### Frontend wiring

- `fetchWnbaGameProps({ espnEventId, app })` + `useWnbaGameProps({ espnEventId, app, enabled })`
- Enable fetch only when Props tab is active for the selected app (mirror MLB: separate queries per app is fine)
- Remove client-side flat-list filtering of `/props/today` from the Props tab
- Regenerate OpenAPI types; update `md/system-design.md` page ↔ API table

## Error & edge cases

| Case | Behavior |
| --- | --- |
| Props fetch fails | Other tabs still work; Props shows short error or empty |
| No DFS lines for matchup | “No props available for this matchup” |
| Only one side quoted | Render that pill only |
| Tie for best American | Stable book priority |
| Unmatched team abbrev | Exclude row |
| Roster/headshot unavailable | Soft error optional; rows still render with initial avatar |

## Testing

**Backend**

- Best Over / Under selection across multiple books
- Tie-break uses stable priority
- Game team filter includes only away/home (abbrev expansion)
- One-sided quote → null on the other side
- Empty categories when no DFS for matchup
- Invalid espnEventId → 404; bad app → 422

**Frontend**

- Grid shows line, odds, and book name under odds
- PrizePicks vs Underdog request correct `app`
- Empty / error / soft-error states
- Show more expands category rows
- PregameCenter wires grid on Props tab only

## Out of scope

- Props grid on Preview
- EV / edge / expand on these cards
- Row click navigation / deep-link highlight
- Replacing `/wnba/prop_picks` page UI
- Live / Final props
- ProphetX player-prop quotes in this pool unless already present on today’s props rows
- Extracting a shared cross-league `GamePropsGrid` component (keep WNBA twin for now)

## Docs to update on implement

- `md/system-design.md` — WNBA game page row + new props game endpoint
- `backend/README.md` / `frontend/README.md` only if they list WNBA game APIs explicitly
