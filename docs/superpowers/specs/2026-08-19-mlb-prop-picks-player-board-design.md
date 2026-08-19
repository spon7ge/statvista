# MLB prop picks — player board + per-player odds grid

Date: 2026-08-19  
Status: Approved (design)  
Parent: `docs/superpowers/specs/2026-08-05-mlb-prop-picks-design.md`  
Related: ESPN card enrichment `2026-08-05-mlb-prop-picks-card-espn-enrichment-design.md`

## Goal

Change `/mlb/prop_picks` from a +EV-ranked **prop** board to a **player** board. Each card shows the player and a **View X props** CTA. Clicking opens a player detail page with a BettingPros-style odds grid: one row per market, sportsbook columns, each cell that book’s **main** Over/Under (own line), not alts and not exact-DFS-line-only matches. No OPEN/BEST columns.

## Decisions

| Topic | Choice |
| --- | --- |
| Board unit | One card per unique player (aggregated from DFS board rows) |
| Sort | Prop count descending |
| Card CTA | `View X props` → player detail route (replace Over/Under + edge % + expand) |
| Tabs | Keep PrizePicks / Underdog |
| Format / legs UI | Remove pills; API keeps existing defaults under the hood |
| Filters | Team + player name search only (no Stat / Side) |
| PrizePicks board seed | Latest Supabase snapshot via `fetch_latest_prizepicks("mlb")` — **not** Parlay PrizePicks |
| Underdog board seed | Unchanged (`fetch_latest_underdog("mlb")`) |
| Detail grid books | ProphetX, Novig, DraftKings, FanDuel, Pinnacle |
| Book lines | Each book’s **main** line for that player+stat (may differ from DFS); alts excluded |
| OPEN / BEST | Out of scope |
| Architecture | Client aggregation on `GET /api/mlb/props/today`; enrich payload with per-book main quotes; no new player API in v1 |
| DK / FD source | Still current Parlay book indexes in v1 (board seed only moves off Parlay) |

## Architecture

```
/mlb/prop_picks?app=prizepicks|underdog
        │
        ▼
GET /api/mlb/props/today?app=…&format=<default>&legs=<default>
        │
        ├─ app=prizepicks → fetch_latest_prizepicks("mlb")   # Supabase
        ├─ app=underdog   → fetch_latest_underdog("mlb")
        ├─ books mains    → PX/Novig/Pinnacle snapshots + DK/FD Parlay indexes
        └─ roster enrich  → headshot / position / team (existing)
        │
        ▼
Client: group by player_name
  → prop_count = unique DFS markets (player + stat)
  → cards sorted by prop_count desc
  → Team filter + name search
  → CTA: View X props
        │
        ▼
/mlb/prop_picks/player/:playerSlug?app=…
        │
        ▼
Same fetch → filter to player
  → header (headshot, name, team · pos)
  → odds grid: one row per unique DFS market (stat)
     (if DFS has multiple lines for same stat, keep one row;
      label with the DFS line from the first board row)
     columns = books (no OPEN/BEST)
     cell = main O/U at that book’s line, or NL
```

## Backend

### PrizePicks seed

In `get_mlb_props_today`:

- When `app == "prizepicks"`, load DFS rows from `fetch_latest_prizepicks("mlb")`.
- Do **not** use `parlay.prizepicks_board`.
- If the snapshot is empty / unavailable, return an empty `props` list with a clear `error` (e.g. `prizepicks_unavailable`). Do not fall back to Parlay PP.
- Mirror Underdog snapshot field mapping patterns already used for MLB DFS board build (`stat_type` / `line_score` / etc. as required by existing `_build_board`).

### Main-line book quotes

Today’s `MlbPropBooks` / `MlbPropBookQuote` are **exact DFS line** quotes for fair/edge. Detail UI needs each book’s **main** line for `(player, stat)`.

Add a parallel structure on each row (name TBD in plan; e.g. `books_main`) where each book is nullable:

```text
{ line: float, over_american: int | null, under_american: int | null, changed_at?: str | null }
```

Rules:

- Select **main** lines only; skip alts.
- If a book has no main for that player+stat → null (UI shows NL).
- Line may differ from `row.line` / `dfs.line`.
- Fair/edge/tier computation may keep using exact-line indexes for now; detail grid reads `books_main` only.

Sources:

- ProphetX, Novig, Pinnacle: latest Supabase scrapers (same fetches as today), filtered to mains.
- DraftKings, FanDuel: existing Parlay book indexes, main only.
- Parlay outage: DK/FD columns empty; other books still populate when snapshots exist.

### Unchanged

- Endpoint path `GET /api/mlb/props/today`
- Query validation for `app` / `format` / `legs` (frontend always sends defaults)
- Roster enrichment (`headshot_url`, `position`, `team_abbrev`)

## Frontend

### `/mlb/prop_picks` (player board)

- Keep PrizePicks / Underdog tabs; remove format/legs pills.
- Aggregate API rows by `player_name` → `{ player_name, prop_count, headshot_url, position, team_abbrev, … }`.
- `prop_count` / **X** = number of **unique stats** for that player on the selected DFS app (not raw row count if the same stat appears at multiple DFS lines).
- Sort by `prop_count` descending.
- Card: headshot → team · pos → name → **View X props** (no line/stat, no Over/Under, no edge %, no expand).
- Filters: Team multi-select + player name search.
- Pagination can remain page-size 20 on **players** (not raw prop rows).

### `/mlb/prop_picks/player/:playerSlug`

- New route; preserve `app` in query (or equivalent) so the board seed matches the tab the user came from.
- Player slug: normalize `player_name` for the URL; resolve against today’s board (prefer exact name; use team if needed on collision).
- Header: headshot, name, team · pos.
- Grid: one row per unique DFS `stat` for that player (same set as `prop_count`); DFS line label from the first board row for that stat when multiple DFS lines exist.
- Columns: ProphetX, Novig, DraftKings, FanDuel, Pinnacle.
- Cell: Over and Under with that book’s main line + american, or **NL**.
- Unknown slug / player not on today’s board: empty state + link back to `/mlb/prop_picks`.

### Docs

- Update `md/system-design.md` `/mlb/prop_picks` row (and add player detail route).

## Errors

| Case | Behavior |
| --- | --- |
| PrizePicks snapshot missing | Empty board + `prizepicks_unavailable` (no Parlay PP fallback) |
| Underdog snapshot missing | Existing underdog empty/error behavior |
| Player slug not in board | Detail empty state + back link |
| Book main missing | NL in cell |
| Parlay down (DK/FD) | Those columns NL; PX/Novig/Pinnacle still OK |

## Tests

- Backend: PP board from `fetch_latest_prizepicks("mlb")`; never seeds from Parlay PP; main-line attach picks mains / skips alts; empty snapshot error; roster enrichment still applied.
- Frontend: cards show count + CTA; sort by count; Team + search; no format/legs; detail grid shows per-book main lines; unknown slug empty state.
- Router: player detail route registered.

## Non-goals

- Dedicated `GET /api/mlb/props/player/...` endpoint (v1)
- OPEN / BEST / consensus columns
- Alt lines in the grid
- Removing Parlay for DK/FD book indexes
- WNBA prop picks parity
- Restoring +EV / edge ranking on the board face

## Success criteria

1. `/mlb/prop_picks` shows one card per player with **View X props**, sorted by count.
2. PrizePicks tab players/lines come from latest Supabase PrizePicks snapshot only.
3. Detail page shows each book’s main O/U for that player’s DFS markets (alts excluded).
4. Team filter + name search work; format/legs pills are gone.
5. Expand-in-place + Over/Under/edge on the card face are gone.
