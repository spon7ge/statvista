# WNBA prop picks — player board + per-player odds grid

Date: 2026-08-19  
Status: Implemented  
Parent: `docs/superpowers/specs/2026-08-11-wnba-prop-picks-mlb-parity-design.md`  
Mirror of: `docs/superpowers/specs/2026-08-19-mlb-prop-picks-player-board-design.md`  
Related: DFS snapshots `2026-08-02-wnba-prop-picks-dfs-snapshots-design.md`

## Goal

Change `/wnba/prop_picks` from a +EV-ranked **prop** board to a **player** board that mirrors `/mlb/prop_picks`. Each card shows the player and a **View X props** CTA. Clicking opens a player detail page with a BettingPros-style odds grid: one row per market, sportsbook columns, each cell that book’s **main** Over/Under (own line), not alts and not exact-DFS-line-only matches. No OPEN/BEST columns.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Port MLB player-board pattern into WNBA (option A) — no shared MLB/WNBA component extraction in v1 |
| Board unit | One card per unique player (aggregated from DFS board rows) |
| Sort | Prop count descending |
| Card CTA | `View X props` → player detail route (replace Over/Under + edge % + expand) |
| Tabs | Keep PrizePicks / Underdog |
| Format / legs UI | Remove pills; API keeps existing defaults under the hood (`power`/`4`, `standard`/`4`) |
| Filters | Team + player name search only (no Stat / Side) |
| Past games | Keep client hide of finals + prior-day tips via scoreboard (`excludePastGameProps`) |
| PrizePicks board seed | Latest Supabase snapshot via `fetch_latest_prizepicks("wnba")` — **not** Parlay PrizePicks (drop Parlay-first fallback) |
| Underdog board seed | Unchanged (`fetch_latest_underdog("wnba")`) |
| Detail grid books | **Match MLB:** ProphetX, Novig, DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365, Pinnacle |
| Book lines | Each book’s **main** line for that player+stat (may differ from DFS); alts excluded |
| OPEN / BEST | Out of scope |
| Architecture | Client aggregation on `GET /api/wnba/props/today`; enrich payload with `books_main`; no new player API in v1 |
| Parlay sportsbooks | Widen WNBA Parlay allowlist/indexes to the same cmp books as MLB so `books_main` can populate (fair/edge may stay on existing exact-line sources) |

## Architecture

```
/wnba/prop_picks?app=prizepicks|underdog
        │
        ▼
GET /api/wnba/props/today?app=…&format=<default>&legs=<default>
        │
        ├─ app=prizepicks → fetch_latest_prizepicks("wnba")   # Supabase only
        ├─ app=underdog   → fetch_latest_underdog("wnba")
        ├─ books mains    → PX/Novig/Pinnacle snapshots + Parlay DK/FD + cmp books
        └─ roster enrich  → headshot / position / team (existing)
        │
        ▼
Client: excludePastGameProps (finals / prior-day tips)
  → group by player_name
  → prop_count = unique DFS markets (player + stat)
  → cards sorted by prop_count desc
  → Team filter + name search
  → CTA: View X props
        │
        ▼
/wnba/prop_picks/player/:playerSlug?app=…
        │
        ▼
Same fetch → filter to player
  → header (headshot, name, team · pos)
  → odds grid: one row per unique DFS market (stat)
     (if DFS has multiple lines for same stat, keep one row;
      label with the DFS line from the first board row)
     columns = MLB-parity book set (no OPEN/BEST)
     cell = main O/U at that book’s line, or NL
```

## Backend

### PrizePicks seed

In `get_wnba_props_today`:

- When `app == "prizepicks"`, load DFS rows from `fetch_latest_prizepicks("wnba")` only.
- Do **not** use `parlay.prizepicks_board` and do **not** fall back from empty Parlay PP to Supabase (or the reverse).
- If the snapshot is empty / unavailable, return an empty `props` list with `error: "prizepicks_unavailable"`.
- Underdog continues to use `fetch_latest_underdog("wnba")`; empty board uses existing `underdog_unavailable` / `parlay_unavailable` soft-fail rules where they still apply to non-seed failures.

### Parlay book indexes

Today `backend/app/providers/parlay/wnba_board.py` only indexes DraftKings and FanDuel. Expand `_ALLOWED_BOOKS` / `_SCHEMA_BOOK_KEYS` to match MLB’s sportsbook set used for `books_main`:

- `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365`
- Keep PrizePicks in the allowlist only if still needed for other Parlay consumers; **league prop_picks board seed must not use Parlay PP**.

### Main-line book quotes

Today’s `WnbaPropBooks` / `WnbaPropBookQuote` are **exact DFS line** quotes for fair/edge. Detail UI needs each book’s **main** line for `(player, stat)`.

Add `books_main` on each `WnbaPropRow` mirroring `MlbPropBooksMain`:

```text
{ line: float, over_american: int | null, under_american: int | null, changed_at?: str | null }
```

Books (all optional / nullable):

- `prophetx`, `novig`, `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365`, `pinnacle`

Rules:

- Select **main** lines only; skip alts.
- If a book has no main for that player+stat → null (UI shows NL).
- Line may differ from `row.line` / `dfs.line`.
- Fair/edge/tier computation may keep using exact-line indexes for now; detail grid reads `books_main` only.
- Prefer mains-only snapshot fetches for PX/Novig when available (same pattern as MLB) so DISTINCT ON cannot collapse a False-alt over the True-main.

Sources:

- ProphetX, Novig, Pinnacle: latest Supabase scrapers, filtered to mains.
- DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365: Parlay book indexes, main only.
- Parlay outage: Parlay-sourced columns empty; PX/Novig/Pinnacle still populate when snapshots exist.

### Unchanged

- Endpoint path `GET /api/wnba/props/today`
- Query validation for `app` / `format` / `legs` (frontend always sends defaults)
- Roster enrichment (`headshot_url`, `position`, `team_abbrev`)
- Game-detail Props tab (`GET /api/wnba/props/game/{id}`) — out of scope for this change

## Frontend

### `/wnba/prop_picks` (player board)

- Keep PrizePicks / Underdog tabs; remove format/legs pills.
- Aggregate API rows by `player_name` (WNBA helpers analogous to `groupMlbPropPlayers`) → `{ player_name, prop_count, headshot_url, position, team_abbrev, player_slug, … }`.
- `prop_count` / **X** = number of **unique stats** for that player on the selected DFS app.
- Sort by `prop_count` descending.
- Card: headshot → team · pos → name → **View X props** (no line/stat, no Over/Under, no edge %, no expand).
- Filters: Team multi-select + player name search.
- Continue filtering out final / prior-day tip props via scoreboard before aggregation.
- Pagination: page-size 20 on **players** (not raw prop rows).
- Sync `app` in the URL search params (same as MLB) so detail deep-links round-trip.

### `/wnba/prop_picks/player/:playerSlug`

- New route; preserve `app` in query so the board seed matches the tab the user came from.
- Player slug: normalize `player_name` for the URL; resolve against today’s board (prefer exact name; use team if needed on collision).
- Header: headshot, name, team · pos.
- Grid: one row per unique DFS `stat` for that player; DFS line label from the first board row for that stat when multiple DFS lines exist.
- Columns: ProphetX, Novig, DraftKings, FanDuel, BetMGM, Caesars, Kalshi, Fliff, bet365, Pinnacle.
- Cell: Over and Under with that book’s main line + american, or **NL**.
- Unknown slug / player not on today’s board: empty state + link back to `/wnba/prop_picks`.

### Docs

- Update `md/system-design.md` `/wnba/prop_picks` row and add `/wnba/prop_picks/player/:playerSlug`.
- Mark this spec Implemented when shipped; note that 2026-08-11 +EV hybrid board UI is superseded for the league page (game Props tab remains separate).

## Errors

| Case | Behavior |
| --- | --- |
| PrizePicks snapshot missing | Empty board + `prizepicks_unavailable` (no Parlay PP fallback) |
| Underdog snapshot missing | Existing underdog empty/error behavior |
| Player slug not in board | Detail empty state + back link |
| Book main missing | NL in cell |
| Parlay down (DK/FD/cmp) | Those columns NL; PX/Novig/Pinnacle still OK |

## Tests

- Backend: PP board from `fetch_latest_prizepicks("wnba")`; never seeds from Parlay PP; Parlay indexes include cmp books; `books_main` picks mains / skips alts; empty PP snapshot error; roster enrichment still applied.
- Frontend: cards show count + CTA; sort by count; Team + search; no format/legs; past-game hide still applied; detail grid shows per-book main lines; unknown slug empty state.
- Router: player detail route registered.

## Non-goals

- Dedicated `GET /api/wnba/props/player/...` endpoint (v1)
- Shared MLB/WNBA player-board package extraction
- OPEN / BEST / consensus columns
- Alt lines in the grid
- Removing Parlay for sportsbook indexes
- Redesigning game-detail Props tab
- Restoring +EV / edge ranking on the board face

## Success criteria

1. `/wnba/prop_picks` shows one card per player with **View X props**, sorted by count.
2. PrizePicks tab players/lines come from latest Supabase PrizePicks snapshot only.
3. Detail page shows each book’s main O/U for that player’s DFS markets (alts excluded), with the same book columns as MLB.
4. Team filter + name search work; format/legs pills are gone; finals/prior-day tips stay hidden.
5. Expand-in-place + Over/Under/edge on the card face are gone.
