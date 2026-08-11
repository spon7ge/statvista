# WNBA Game Info ESPN Enrichment

## Goal

Rebuild WNBA **Game Info** to match the target layout: date, broadcast, venue + city/state, and officials — backed by ESPN summary fields already available in the game-detail payload.

## Non-goals

- Official jersey numbers (ESPN summary does not provide them)
- Weather (WNBA indoor; not in screenshot)
- Changing MLB Game Info
- New external data sources for officials

## Current state

- Backend `normalize_espn_summary` only extracts `gameInfo.venue.fullName` → `venue`
- Frontend `WnbaGameInfo` renders a single venue row with `Building2`

## Target UI

Match the screenshot row order inside `GameSection` titled **Game Info**:

1. **Calendar** · `August 10, 2026` (long US date)
2. **Broadcast / play icon** · network short name (e.g. `USA`, `Peacock`) — omit row if null
3. **Venue icon** · arena name (white) + `City, State` secondary (`text-white/50`); expand US state abbreviations for display (`WA` → `Washington`)
4. **Whistle** · officials list; first by ESPN `order` gets trailing ` (Head Official)`; no `#` prefix

Omit empty rows. Keep `data-testid="wnba-game-info"`. Use `!p-3` / existing GameSection chrome consistent with other Summary cards.

## API

Extend `WnbaGameDetail` (OpenAPI / Pydantic) with:

| Field | Type | Source |
| --- | --- | --- |
| `game_date` | `str \| null` | Competition `date` → `YYYY-MM-DD` (date part only; no TZ shift for display formatting on client) |
| `broadcast` | `str \| null` | Prefer national TV `broadcasts[].media.shortName` (`isNational` / market National + type TV); else first national; else first broadcast shortName |
| `venue_city` | `str \| null` | `gameInfo.venue.address.city` |
| `venue_state` | `str \| null` | `gameInfo.venue.address.state` (raw abbrev OK on wire) |
| `officials` | `list[{ name: str, order: int }] \| null` | `gameInfo.officials` sorted by `order`; `name` from `displayName` or `fullName`; empty list → `null` |

Keep existing `venue`.

### Normalize helpers

In `backend/app/domains/wnba/game_detail.py`:

- `_game_date(comp) -> str | None`
- `_broadcast(comp) -> str | None`
- `_venue_location(gameInfo) -> (city, state)`
- `_officials(gameInfo) -> list | None`

Enrich fixtures used by normalize tests with realistic `date`, `broadcasts`, venue address, and officials so extractors are covered.

## Frontend

- Extend `GameDetail` + `mapGameDetail` for the new camelCase fields
- Rebuild `WnbaGameInfo` rows as above; reuse `formatMlbGameDate`-style local formatter (or shared date helper) for `YYYY-MM-DD` → long month
- Expand state abbrev in the venue location line only
- Update `WnbaGameInfo.test.tsx` + mapper tests; refresh OpenAPI client if the repo regenerates types from schema

## Success criteria

- Live/final/pregame Summary Game Info shows date, broadcast, venue+location, officials when ESPN provides them
- Missing fields omit rows without breaking the section
- Officials: first ordered official labeled Head Official; no fabricated jersey numbers
- Backend + frontend tests cover normalize/map/render
