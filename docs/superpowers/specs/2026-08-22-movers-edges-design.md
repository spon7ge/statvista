# Movers & Edges — league research tab

Date: 2026-08-22  
Status: Approved (plan ready)  
Product: statvista  
Mockups: `assets/statvista-website-movers-fullpage.png` (full page), related row/desktop explorations in the same assets folder  
Related: WNBA/MLB prop picks boards (`2026-08-19-*-prop-picks-player-board-design.md`), fair/edge (`prop_fair`), odds change filter (`src/odds/change_filter.py`)

## Goal

Add a bettor-facing **Movers** tab on WNBA (then MLB) that surfaces:

1. **Line movers** — DFS props whose **line and/or American odds** changed since the prior scrape, with was→now.
2. **Edges** — props with a usable fair read and positive edge/EV vs the DFS price.

This is a **research shortlist**, not a third copy of the Prop Picks player board and not a playoff/standings race.

## Non-goals (v1)

- Playoff race / clinch / bubble boards
- Sportsbook steam across all `books_main` columns (DFS movers only in v1)
- Live websocket push (poll / normal TanStack refetch is enough)
- Tip-seller language (“locks”, guaranteed EV)
- NBA
- Replacing `/prop_picks` or the per-player books grid
- Showing EV when `source_tier == no_sharp_read`

## Decisions

| Topic | Choice |
| --- | --- |
| Tab label | **Movers** |
| Page title | **Movers** (subtitle/meta: league · as-of · research only) |
| Routes | `/wnba/movers`, `/mlb/movers` |
| Ship order | **WNBA first**, MLB parity immediately after (same UX) |
| Layout | Split board: **Line movers** on top, **Edges** below (approved mockup) |
| Banner | None — title left; Team + player search pills right (match current Prop Picks chrome) |
| DFS apps | PrizePicks / Underdog **segmented control** under the title row (same defaults as Prop Picks: power/4 vs standard/4), so movers/edges match the board the user cares about |
| Mover source | **DFS snapshots only** (PrizePicks or Underdog table for that league) |
| Edge source | Existing `fair_pct` / `edge_pct` / `recommended_side` / `source_tier` from props assembly |
| Was→now | Required for movers — compare **current** DFS quote to **previous scrape** for the same player+stat+odds_type (or app-equivalent key) |
| Min edge (Edges section) | Default **3.0%** (`edge_pct`); filter control can raise/lower |
| Mover noise floor | Ignore pure juice moves smaller than **5¢ American** when line is unchanged; always keep **line** changes |
| Sort (movers) | Most recent change first, then largest absolute line delta |
| Sort (edges) | Highest `edge_pct` first |
| Row navigation | Click → `/[league]/prop_picks/player/:playerSlug?app=` (existing books grid) |
| Empty states | Separate copy per section (“No line moves since last scrape”, “No edges above threshold”) |
| Disclaimer | Footer: research tool, not betting advice; data as-of timestamp |

## Architecture

```text
Browser
  /wnba/movers?app=prizepicks|underdog
        │
        ▼
GET /api/wnba/movers?app=&format=&legs=     (new)
        │
        ├─ assemble current DFS board (same seed rules as props/today)
        ├─ attach fair/edge (reuse prop_fair path used by props/today)
        ├─ load previous DFS snapshot batch (prior scraped_at watermark)
        ├─ diff → movers[] with from_line/to_line, from_american/to_american
        └─ filter edges[] where edge_pct >= min_edge and source_tier usable
        │
        ▼
Page: filters → Line movers table → Edges table
  row click → existing player props page
```

MLB mirrors with `/api/mlb/movers` and the same response shape.

### Why a new endpoint (not only client-filter `props/today`)

`GET /api/*/props/today` returns the **current** board. It does not include prior line/odds, so the client cannot render was→now. Upsert change-filter also **drops unchanged rows**, so “latest table contents” alone are not a full previous board. v1 needs an explicit **previous-batch compare** in the API.

## API

### `GET /api/wnba/movers` (and MLB twin)

Query params (align with props/today):

| Param | Notes |
| --- | --- |
| `app` | `prizepicks` \| `underdog` |
| `format` | defaults: prizepicks→`power`, underdog→`standard` |
| `legs` | default `4` |
| `min_edge` | optional float, default `3` (percent points, same units as `edge_pct`) |

Response (sketch):

```json
{
  "as_of": "2026-08-22T17:01:00-07:00",
  "league": "wnba",
  "app": "prizepicks",
  "prior_as_of": "2026-08-22T16:40:00-07:00",
  "movers": [
    {
      "player_name": "A'ja Wilson",
      "player_slug": "aja-wilson",
      "team_abbrev": "LVA",
      "stat": "Points",
      "side": "over",
      "from_line": 22.5,
      "to_line": 23.5,
      "from_american": -110,
      "to_american": -115,
      "moved_at": "2026-08-22T16:55:00-07:00",
      "move_kind": "line",
      "edge_pct": 2.1,
      "headshot_url": null
    }
  ],
  "edges": [
    {
      "player_name": "Breanna Stewart",
      "player_slug": "breanna-stewart",
      "team_abbrev": "NYL",
      "stat": "Points",
      "side": "over",
      "line": 22.5,
      "fair_pct": 54.0,
      "edge_pct": 4.6,
      "source_tier": "sharp_consensus",
      "headshot_url": null
    }
  ],
  "error": null
}
```

`move_kind`: `line` \| `juice` \| `both`.

### Previous-batch definition

For the selected DFS table (`odds.wnba_prizepicks` / `underdogs`, MLB twins):

1. Let `T_now` = max(`scraped_at`) in the latest successful board used for “current”.
2. Let `T_prior` = max(`scraped_at`) **strictly less than** `T_now` (previous watermark). If none, `movers = []` and `prior_as_of = null`.
3. Match keys: normalize player name (existing match-key helper) + stat + DFS odds_type/format identity used by the board seed.
4. Emit a mover when line differs **or** American differs by ≥ 5.

Reuse props assembly for current rows so edge/fair stay consistent with Prop Picks.

### Errors

Mirror props soft-fail style where useful: empty DFS seed → empty lists + `error` like `prizepicks_unavailable` / `underdog_unavailable`. Page shows the same empty/error patterns as Prop Picks.

## Frontend

### Subnav

Insert **Movers** after **Prop Picks** (before Leaders):

`Matchups · Prop Picks · Movers · Leaders · Standings · Futures`

Active when path ends with `/movers`.

### Page chrome

- `LeagueSubnav`
- Title **Movers** far left
- Right: Team multi-select pill + player search pill (`tone="pill"`, same as Prop Picks)
- PrizePicks / Underdog tabs (reuse Prop Picks tab pattern / `?app=`)
- Meta line: `{LEAGUE} · As of {local time} · Research only`
- If `prior_as_of` present, movers subtitle: `Changed since {prior local time}`

### Line movers table

Columns: **Player** · **Market** (stat) · **Move** (e.g. `22.5 → 23.5` and/or `-110 → -115`) · **When** (relative) · **Edge** (optional chip if `edge_pct` present)

### Edges table

Columns: **Player** · **Stat** · **Side** · **Line** · **Fair** · **EV%** (`edge_pct`)

Omit rows with `source_tier == no_sharp_read` or null `edge_pct`. Respect `min_edge` (default 3).

### Filters

Client-side on the response: Team set + name query apply to **both** sections. Optional `min_edge` control updates query param and refetches (or filters client-side if API always returns a wider set — prefer **API `min_edge`** for smaller payloads).

## Copy / trust

- EV/edge is **model fair vs DFS price**, not a guarantee.
- Do not use “lock”, “guaranteed”, or sportsbook deep-links in v1.
- Footer attribution consistent with Prop Picks (“Data: …” + research disclaimer).

## Testing

- API: prior watermark missing → empty movers; line change detected; juice-only below 5¢ ignored; edges honor min_edge and exclude `no_sharp_read`.
- UI: subnav active state; tabs switch app; empty sections; row navigates to player props page; as-of rendered.
- Update `md/system-design.md` page ↔ API table when shipping.

## Open questions (resolve in plan if needed)

1. Exact DFS match key for Underdog vs PrizePicks row identity (confirm against existing snapshot loaders).
2. Whether MLB ships in the same PR as WNBA or a follow-up (prefer **same plan, WNBA then MLB tasks**).
3. How far back “previous watermark” may be before we treat movers as stale (e.g. hide movers if `T_now - T_prior` > 6h) — default proposal: **no max gap in v1**, show `prior_as_of` and let the user judge.

## Success criteria

- Bettor can open **Movers** and immediately see what DFS lines moved and which props still show +EV.
- Was→now is accurate vs the previous scrape watermark.
- No EV shown without a sharp/mid/soft fair read.
- Feels distinct from Prop Picks and Standings.
