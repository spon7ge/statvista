# WNBA Prop Picks MLB Product Parity

Date: 2026-08-11  
Status: Implemented  
Product: **statvista**

## Goal

Remake `/wnba/prop_picks` into the same DFS-first **+EV ranked hybrid board** as `/mlb/prop_picks`: PrizePicks / Underdog tabs, legs, fair % / edge / source tier, expand books. Game-detail Props stays on today’s assembly and category-card grid.

## Decisions

| Topic | Choice |
| --- | --- |
| Surface | League `/wnba/prop_picks` only |
| Fidelity | Full MLB product (UI + fair/edge API), not a restyle of the dense table |
| Implementation | Port MLB board into the WNBA domain (Approach 1). Do not extract a shared MLB+WNBA service |
| Hide past games | Keep today’s client rule: drop **final** teams and **prior-day** tips; keep upcoming and **in-progress** |
| Fair ladder | Reuse current MLB `compute_fair` (PX+Novig → DK+FD → Pinnacle comparison-only) |
| Book attach | Exact DFS line only |
| Formats | PrizePicks `power` 2–6; Underdog `standard` 2–6; default 4-pick |
| ProphetX WNBA props | In scope — add `odds.wnba_prophetx` and upsert from the existing scraper (JSON exists; table load does not) |
| Old table API | `GET /api/wnba/props/today` becomes the new board contract (breaking). `parlay_props.get_today_props()` stays for game Props |
| Shared UI | WNBA twins of MLB header/filters/list (same as other parity work). Do not generalize `MlbPropPicksList` in this pass |

## Architecture

```
LeaguePropPicksPage  (/wnba/prop_picks)
  ├── LeagueSubnav (Prop Picks active)
  ├── WnbaPropPicksHeader
  │     emerald banner + basketball mark + “WNBA Props”
  │     banner: Stat · Team · Side · legs pill
  │     PrizePicks | Underdog tabs
  └── WnbaPropPicksList  (hybrid ranked rows + expand)
        useWnbaProps({ app, format, legs })
        excludePastGameProps(scoreboard) then filterWnbaPropPicks

GET /api/wnba/props/today?app=&format=&legs=
  └── wnba.props.get_wnba_props_today()
        seed: Parlay PrizePicks (fallback odds.wnba_prizepicks)
              or odds.wnba_underdogs
        exact-line indexes:
              Parlay draftkings + fanduel
              odds.wnba_prophetx, odds.wnba_novig, odds.wnba_pinnacle
        compute_fair + breakeven_pct + recommend side + sort

GET /api/wnba/props/game/{id}  (unchanged)
  └── parlay_props.get_today_props()  # old WnbaPropLine assembly
```

Domains must not import each other. **Copy** MLB `prop_fair` and `prop_formats` into `app/domains/wnba/` (or a non-domain helper) rather than `from app.domains.mlb import …`. Do not move or refactor the live MLB modules in this pass.

## Product rules

### Row grain

One row per `player + stat + line` on the **selected app**. Both sides live on the row. Recommended side = higher edge at that line. Hero shows that side’s edge; alt side is muted.

### Fair (never blend Pinnacle into fair)

Same as current MLB `compute_fair`:

| Tier | Books | When | `source_tier` |
| --- | --- | --- | --- |
| 1 | ProphetX, Novig | Any exact-line fair % present | `sharp_consensus` (2+), `sharp_single_source` (1). Disagreement uses existing MLB helper (`sharp_disagreement` / PX-primary) |
| 2 | DraftKings, FanDuel | Only if Tier 1 empty | `mid_tier_fallback` |
| Soft | Pinnacle | Comparison on expand; Soft Consensus only if ≥2 soft books (dormant with Pinnacle alone) | `soft_consensus` / else `no_sharp_read` |

Agreement ε = **2.0** percentage points. DK/FD may add `dk_fd_agrees` confidence chips without moving a Tier 1 fair %.

### Edge and formats

`edge_pct = fair_pct − p_be` where `p_be = M^(-1/n)` from the existing multiplier tables in `prop_formats.py` (PrizePicks Power 2→3, 3→5, 4→10, 5→20, 6→25; Underdog standard 2→3, 3→6, 4→10, 5→20, 6→40).

Default sort: edge desc among rows with a Tier 1/2/soft read; `no_sharp_read` always last.

### Recency

Same MLB chip rules and priority (at most one collapsed chip): Fresh sharp vs stale DFS → Fresh sharp → Stale sharp → none. Ages from book `changed_at` (snapshot `scraped_at` / last line change), not poll time.

### Hide past games (WNBA-only, client)

Reuse today’s `excludePastGameProps` behavior, adapted to the new row type:

1. Drop rows whose `team_abbrev` is on a **final** scoreboard game (abbrev aliases as today: PHO↔PHX, etc.).
2. Drop rows whose `commence_time` ET calendar date is **before** the scoreboard slate date.
3. Keep upcoming and **live** tips.

New board rows **must** include `team_abbrev` and `commence_time` (nullable) so this filter still works. Rows with a missing tip time are kept (same as today).

## UI

### Header

Keep existing emerald `#059669` banner and `wnba_basketball.png` mark. Add MLB-style:

- Right-aligned banner pills: Stat, Team, Side filters + legs stepper (2–6)
- Centered PrizePicks | Underdog tablist under the banner (`role="tab"` / `tabpanel`)

Switching app clears Stat/Team/Side and refetches that app’s board. Changing legs refetches (breakeven and edges change).

### List

Twin of `MlbPropPicksList`:

- Responsive 1 / 2 / 3 columns; rank order round-robins into columns
- Page size **20**
- Collapsed: headshot · name · team · stat · line · lean · edge · fair · tier/recency chips
- Expand: `fair_explain` + ProphetX, Novig, DK, FD, Pinnacle cells + both-side edges + last-updated tooltips
- Last-updated caption from React Query `dataUpdatedAt`

### Empty / loading / error

| Case | Copy / UI |
| --- | --- |
| Loading (no cached board) | Hybrid-row skeletons |
| Fetch failed, no cache | “Prop lines unavailable” |
| Board returned empty (`error` or no DFS seed) | “No PrizePicks board available.” / “No Underdog board available.” |
| Filters hide all remaining rows | “No props match these filters” |
| Refetch failed after success | Keep last good board |

### Filters

Stat, team, recommended side (Over / Under). No book-column toggles — the app tab is the DFS book. No source-tier filter in v1 (MLB list also filters Stat/Team/Side only).

## Data & API

### Endpoint

`GET /api/wnba/props/today?app=prizepicks|underdog&format=power|standard&legs=2-6`

- PrizePicks requires `format=power`; Underdog requires `format=standard`
- Invalid combo → **422**
- `Cache-Control: no-store`
- In-process cache ~**15 minutes** (same as MLB board)

### Response

Match `MlbPropsResponse` plus WNBA hide-past fields:

```
as_of, app, format, legs, breakeven_pct, props[], error?

WnbaPropRow:
  player_name, team_abbrev?, headshot_url?, position?
  stat, line
  recommended_side?: over | under
  fair_pct?, edge_pct?, alt_edge_pct?
  source_tier, confidence_chips[], sample_chips[], recency_chip?
  books: { prophetx, novig, draftkings, fanduel, pinnacle }  # quote or null
  dfs: { line, changed_at?, american?, payout_multiplier? }
  fair_explain
  commence_time?   # ISO; for excludePastGameProps
```

Book quote: `side`, `fair_pct?`, `american?`, `changed_at?`, `role?: "comparison"` (Pinnacle).

This **replaces** the current `WnbaPropsResponse` / per-side multi-book table on this path. OpenAPI + `api.schema.d.ts` must be regenerated. `fetchWnbaProps` grows `app` / `format` / `legs` like `fetchMlbProps`.

Old `WnbaPropLine` in `betting/schemas_props.py` remains the game-assembly type.

### Assemble

New `backend/app/domains/wnba/props.py` (do not rewrite `parlay_props.get_today_props`):

1. **Seed** selected app into one board row per `(norm_player, stat, line)`.
   - `prizepicks`: Parlay WNBA PrizePicks main/standard lines; if Parlay PP is empty, fall back to latest `odds.wnba_prizepicks` (`odds_type == standard` only).
   - `underdog`: latest `odds.wnba_underdogs`.
2. **Index** exact `(norm_player, stat, side, line)` quotes from Parlay DK/FD and latest PX / Novig / Pinnacle snapshots.
3. For each side the DFS app offers at that line, `compute_fair` then edge vs `breakeven_pct(app, format, legs)`.
4. Recommended side = higher edge; attach ESPN headshot/team/position when the WNBA roster index matches.
5. Sort: rows with a fair/edge read first, `no_sharp_read` last; then edge desc.
6. Soft-fail per source: missing Parlay or a snapshot still returns whatever seeded. Empty seed → `props: []` and `error` string; HTTP 200.

Stat keys: WNBA basketball helpers (`domains/betting/prop_stat_keys.py` and snapshot mappers), not MLB pitching/hitting keys.

### ProphetX player-prop load (required for Tier 1)

Today `src/scrapers/wnba_prophetx.py` writes props JSON but **does not upsert** player props (`props table out of scope`). `load_prophetx_props_snapshot` always writes `odds.mlb_prophetx`.

This remake:

1. Add `odds.wnba_prophetx` (same shape as `odds.mlb_prophetx` / existing `_EXCHANGE_PROPS` identity).
2. Register quote spec `wnba_prophetx`.
3. Route WNBA league loads to `wnba_prophetx` (never `mlb_prophetx`).
4. Map `fetch_latest_prophetx("wnba")` → `odds.wnba_prophetx`.
5. Wire the WNBA scraper `load_supabase_snapshots` to upsert props **and** team (team path already exists).

Novig (`odds.wnba_novig`) and Pinnacle (`odds.wnba_pinnacle`) already exist; add league keys on the snapshot fetch helpers if missing.

## Frontend wiring

| Piece | Change |
| --- | --- |
| `LeaguePropPicksPage` | Mirror `MlbPropPicksPage` (app / legs state, tabpanel, filters in header) |
| `WnbaPropPicksHeader` | Banner + mark + filter/legs children + DFS tabs |
| `WnbaPropPicksFilters` | Twin of `MlbPropPicksFilters` (`tone="banner"`) |
| `WnbaPropPicksList` | Twin of `MlbPropPicksList` |
| `filterWnbaPropPicks` | Stat / team / **recommended** side (not raw over/under row side) |
| `excludePastGameProps` | Adapt to new row type; keep abbrev aliases |
| `useWnbaProps` | Query key `["wnba", "props", app, format, legs]`; refetch interval can match MLB (15m) |
| `PropPicksTable` / book-column filters | Remove from this page (keep files only if still referenced; otherwise delete in the same change) |

Game Props hooks and `WnbaGamePropsGrid` stay on `GET /api/wnba/props/game/{id}`.

## Error & edge cases

| Case | Behavior |
| --- | --- |
| Bad `app` / `format` / `legs` | 422 |
| Parlay down, snapshot PP present | Seed from snapshot; board still renders |
| No PX table/rows yet | Tier 1 may be Novig-only (`sharp_single_source`); do not 500 |
| No DK/FD | Skip Tier 2; still expand empty cells as “No line” |
| Player name mismatch across books | No attach (exact norm + exact line only) |
| Hide-past removes all rows | Empty list; not an API error |
| Game Props during this change | Unchanged; still uses `get_today_props()` |

## Testing

**Backend**

- Query validation (422 on wrong format for app)
- PrizePicks seed prefers Parlay, falls back to snapshot
- Exact-line attach; mismatched line omitted from fair and expand
- Fair/edge/tier reuse MLB cases on WNBA stat keys
- Empty seed → `props: []` + `error`
- `fetch_latest_prophetx("wnba")` hits `odds.wnba_prophetx`
- Scraper/load: WNBA props upsert `wnba_prophetx`, not `mlb_prophetx`

**Frontend**

- Header tabs, legs stepper, banner filters
- App switch refetches and clears filters
- List/expand, pagination 20, column split
- Hide finals + prior-day; keep live
- Empty / error / filter-empty copy
- `fetchWnbaProps` query string matches MLB

**Docs**

- `md/system-design.md` — `/wnba/prop_picks` row + endpoint + data-flow diagram
- This spec’s “league prop picks page unchanged” note in the 2026-08-10 game-props spec is superseded for the **league** page only

## Out of scope

- Game-detail Props grid / `get_today_props()` rewrite
- Slate builder, Flex / insurance math
- Closest-line sportsbook matching
- Sportsbook-only rows (no DFS seed)
- Demon / goblin PrizePicks lines
- Extracting a shared cross-league prop-picks list or relocating MLB `compute_fair` into a shared package
- Source-tier filter chips in the toolbar
- Changing MLB props

## Docs to update on implement

- `md/system-design.md` — Prop Picks page ↔ API + flow
- `frontend/README.md` / `backend/README.md` only if they still describe the WNBA table board
