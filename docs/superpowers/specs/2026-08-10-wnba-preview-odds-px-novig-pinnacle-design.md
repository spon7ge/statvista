# WNBA Preview multi-book odds + remove matchups odds

Date: 2026-08-10  
Status: Implemented  
Product: **statvista**

Related:

- MLB Preview boards: [2026-08-10-mlb-preview-odds-all-books-design.md](./2026-08-10-mlb-preview-odds-all-books-design.md)
- WNBA matchup Preview chrome: [2026-08-10-wnba-mlb-parity-matchup-preview-design.md](./2026-08-10-wnba-mlb-parity-matchup-preview-design.md)
- WNBA ProphetX scraper (JSON-only v1): [2026-08-08-wnba-prophetx-scraper-design.md](./2026-08-08-wnba-prophetx-scraper-design.md)

## Goal

1. On `/games/:espnEventId` **Preview**, the Odds board stacks **ProphetX → Novig → Pinnacle** (same books/order as MLB Preview `book_boards`).
2. Wire WNBA ProphetX **team** snapshots into Supabase so the API can serve them.
3. On `/wnba/matchups`, **remove team odds** from cards (no pill, no odds fetch/merge for that page).

Projected starters remain RotoWire (unchanged).

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Mirror MLB odds module: `book_boards` on `GET /api/wnba/odds/today` |
| Preview books | ProphetX → Novig → Pinnacle only; omit missing books |
| Preview columns | Keep existing WNBA board: Money · Total · Spread per book block |
| Matchups cards | Remove odds UI entirely; stop `useWnbaOdds` / `mergeMatchupOdds` on the matchups page |
| `games[]` on odds/today | Keep for soft fallback when `book_boards` empty (Preview only); matchups no longer consume it |
| Sharp DK/FD | Not on Preview boards (same as MLB) |
| ProphetX props table | Optional same-pass if upsert helper is shared; **team table is required** for Preview |
| Out of scope | New scrapers; Prop Picks changes; NBA; changing RotoWire starters |

## Architecture

```
Scrapers
  wnba_prophetx → odds.wnba_prophetx_team  (new; replace stub load_supabase)
  wnba_novig    → odds.wnba_novig_team     (existing)
  wnba_pinnacle → odds.wnba_pinnacle_team  (existing)

GET /api/wnba/odds/today
  book_boards: stacked PX / Novig / Pinnacle games
  games[]: legacy / fallback merge (Preview only if book_boards empty)

/games/:espnEventId Preview
  useWnbaOdds → collectWnbaOddsBookBoards prefers book_boards
  WnbaGameOddsBoard renders one block per book

/wnba/matchups
  Scoreboard only — no odds merge, no odds pill
```

## Backend

### Migration

Add `db/migrations/037_odds_wnba_prophetx_team.sql` mirroring `odds.mlb_prophetx_team` (league, event_id, away/home, start_time, market_type, side, team, points, american_price, stake, scraped_at, fetched_at + unique snapshot index + league/scraped_at index).

Optionally add `odds.wnba_prophetx` (props) in the same migration if the scraper upserts both; Preview does not require props rows.

### Snapshots + scraper

- Map `fetch_latest_prophetx_team("wnba")` → `odds.wnba_prophetx_team` in `odds_snapshots.py`.
- Replace `wnba_prophetx.load_supabase_snapshots` stub with real upsert (follow `mlb_prophetx` pattern / shared load helpers).

### Odds API

Extend `WnbaOddsResponse` with `book_boards: list[WnbaOddsGame]` (default empty).

Assemble like MLB:

1. Fetch latest team rows for ProphetX, Novig, Pinnacle (soft-fail each source → empty list).
2. Normalize each to `WnbaOddsGame` with `sportsbook` set.
3. `book_boards = collect_book_boards(px, novig, pin)` ordered ProphetX → Novig → Pinnacle.
4. `games[]` may keep existing preference-merge for fallback; Preview must prefer `book_boards`.

OpenAPI trio after schema change.

## Frontend

- `collectWnbaOddsBookBoards`: if `response.book_boards?.length`, filter those for the matchup; else fall back to `games[]` (today’s behavior).
- Matchups page: remove odds query and merge; `MatchupGameCard` never receives `odds` from that page (can leave component support for null odds).
- Update matchups / odds-board tests; update `md/system-design.md` page ↔ API notes.

## Error handling

- Per-source snapshot/normalize failure → that book omitted from `book_boards`.
- All books empty → Preview Odds section uses existing empty/pending UI; do not 500 `/odds/today`.
- Missing ProphetX table until migration applied → fetch returns []; Preview still shows Novig/Pinnacle when present.

## Testing

- Migration / `fetch_latest_prophetx_team("wnba")` mapping.
- Scraper upsert writes team rows (unit with mocked client).
- Odds API: `book_boards` order and soft-fail; OpenAPI check.
- Frontend: Preview prefers `book_boards`; matchups renders without odds pill / without odds fetch.

## Non-goals

- Showing DK/FD on WNBA Preview boards
- Keeping matchups odds with a different book preference
- Reworking moneyline/total/spread tile layout beyond consuming multi-book boards
