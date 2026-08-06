# MLB prop picks card — ESPN enrichment + PrizePicks-style layout

Date: 2026-08-05  
Status: Implemented

## Goal

Redesign collapsed MLB prop pick cards to a centered PrizePicks-style stack (headshot, team·position, name, line+stat, side + edge), and enrich `GET /api/mlb/props/today` with ESPN headshot URL, position, and team abbrev via a cached MLB roster index.

## Decisions

| Topic | Choice |
| --- | --- |
| Data source | ESPN site API MLB team rosters (mirror WNBA roster provider) |
| Headshot URL | `https://a.espncdn.com/i/headshots/mlb/players/full/{espn_id}.png` |
| Match key | Normalized player name (`norm_player_name`, same as WNBA) |
| Missing bio | Null fields; UI omits team/pos pieces and uses initials placeholder on image error |
| API fields | Add nullable `headshot_url`, `position`; populate existing `team_abbrev` when matched |
| Card surface | `#3a3d42`, no white border (current chrome) |
| Edge tone | Green if `edge_pct > 0`, red if `< 0`, muted if null/zero |
| Expanded panel | Unchanged (books, fair explain, chips stay expand-only) |
| Out of scope | PrizePicks image scrape, per-request ESPN search, Supabase player table, WNBA prop cards |

## Architecture

```
GET /api/mlb/props/today
        │
        ├── DFS + books board (existing)
        └── ESPN MLB roster index (cached)
                name → espn_id, position, team_abbrev, headshot_url
                        │
                        ▼
              MlbPropRow (+ headshot_url, position, team_abbrev)
                        │
                        ▼
              MlbPropPicksList collapsed card
```

## Backend

### Provider: `backend/app/providers/espn/mlb_roster.py`

- Fetch each MLB team roster from  
  `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{team_id}/roster`
- Team id list: from ESPN teams endpoint or a static 30-team id map (prefer teams endpoint once, then roster-per-team; cache both).
- Build a process-wide name index with TTL (~10–15 min), keyed by `norm_player_name(displayName)`.
- Per athlete store: `espn_id`, `position` (abbreviation), `team_abbrev`, `headshot_url` (CDN template from id).
- Name collisions (rare): first write wins; log at debug. Do not block the board.

### Domain: `MlbPropRow` + assembly

- Schema (`schemas_props.py` + OpenAPI regen):  
  - `headshot_url: str | None`  
  - `position: str | None`  
  - `team_abbrev` already exists — fill from roster when currently null / always prefer roster when match found.
- In `get_mlb_props_today` / row build: after building board rows, resolve each `player_name` against the roster index and attach fields.
- Failures fetching ESPN: return props without enrichment (nulls); do not fail the endpoint.

### Tests

- Unit: roster payload → index mapping (name, position, abbrev, headshot URL).
- Unit: prop assembly attaches enrichment when name matches; leaves nulls when not.
- Unit: ESPN fetch error → props still returned.

## Frontend

### Collapsed card layout (`MlbPropPicksList` `PropPickCard`)

Centered vertical stack inside existing `#3a3d42` card:

1. **Headshot** — circular/rounded ESPN image; `onError` → initials circle  
2. **Team · position** — muted `14px` (e.g. `NYY · OF`); omit missing segments  
3. **Player name** — white, prominent  
4. **Prop + line** — white `18px` centered (`{line} {stat}` or `{stat} @ {line}` — prefer `{line} {stat}` to match PrizePicks visual)  
5. **Bottom row** — left: Over/Under (white pill or plain label); right: edge `%` green/red  

No chips, fair, avatar-from-abbrev, or source-tier on the collapsed face.

### Grid / expand

- Use CSS grid (`1` / `2` / `3` cols) so ranked edges fill **row-major** (left→right, then down). Highest edges appear across the top rows, not stacked down the first column.
- Expanding a card can shift its row; that tradeoff is preferred over column-fill reading order.

### Tests

- Collapsed assertions for headshot `src` when URL present, team·pos text, name, line+stat, side + colored edge.
- Placeholder path when `headshot_url` null / image error.
- Existing expand / filter / sort tests updated for new collapsed copy.

## Non-goals

- Changing PrizePicks/Underdog scrapers
- Persisting roster index to Supabase
- Applying this card to WNBA prop picks in this change

## Open follow-ups (not blocking)

- Fuzzy name match for DFS short names (e.g. “Fernando Tatis” vs “Fernando Tatis Jr.”) if match rate is low in production
- Optional: surface `espn_id` on the row for deep links later
