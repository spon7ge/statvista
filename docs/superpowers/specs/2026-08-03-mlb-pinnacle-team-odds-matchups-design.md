# MLB Pinnacle team odds → Supabase → `/mlb/matchups`

Date: 2026-08-03  
Status: Approved for planning

## Goal

Wire Selenium MLB Pinnacle **team** snapshots into the site:

1. Upsert `*_team.json` rows into a new `odds.mlb_pinnacle_team` table.
2. Serve them from `GET /api/mlb/odds/today` (Pinnacle first).
3. Show them on `/mlb/matchups` via the existing merge + card UI.
4. Sharp (DK/FD) fallback per game when Pinnacle has no spread **and** no total — same rule as WNBA.

Player props, Prop Picks, and moneyline-on-cards are out of scope.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Mirror WNBA team-odds path with an MLB-owned table |
| Storage | New `odds.mlb_pinnacle_team` (not reuse/rename WNBA table) |
| Scraper upsert | `mlb_pinnacle.py` calls team snapshot loader after writing JSON |
| Matchup markets | Spread (run line) + total only; `period=0`, `is_alternate=false` |
| Primary source | Latest `odds.mlb_pinnacle_team` snapshot for `league=mlb` |
| Fallback | Sharp `run_line,total_runs` (DK then FD) only when that game lacks Pinnacle spread **and** total |
| Disk fallback | None (Supabase → Sharp only) |
| Frontend | Keep `useMlbOdds` + `mergeMatchupOdds`; Pinnacle caption when `sportsbook === "pinnacle"` |
| Junk scrape rows | Skip non-game events when mapping (e.g. “Away Runs vs Home Runs…”) |
| Out of scope | `odds.mlb_pinnacle` props table, MLB Prop Picks, moneyline on cards |

## Architecture

```
mlb_pinnacle.py (Selenium)
  → data/props/pinnacle/mlb/pinnacle_mlb_{ts}_team.json
  → upsert odds.mlb_pinnacle_team

GET /api/mlb/odds/today
  ├─ Load latest odds.mlb_pinnacle_team (main FG spread + total)
  ├─ Map full team names → MLB abbrevs; emit existing MlbOddsGame DTO
  ├─ For games with no Pinnacle spread AND no total → Sharp row
  └─ Frontend mergeMatchupOdds (unchanged matching rules)
```

Manual / one-off load of an existing `*_team.json` into Supabase is supported by the same loader entrypoint used by the scraper (CLI or function call), so operators can upload today’s file without re-scraping.

## Data model

### `odds.mlb_pinnacle_team` (next migration after 025)

Same shape as `odds.wnba_pinnacle_team` (migration 024):

- Columns: `league`, `matchup_id`, `away_team`, `home_team`, `start_time`, `market_type`, `period`, `is_alternate`, `side`, `team`, `points`, `american_price`, `decimal_price`, `scraped_at`, `fetched_at`
- Unique index on `(league, away_team, home_team, market_type, period, is_alternate, side, points, scraped_at)` with `NULLS NOT DISTINCT`
- Index on `(league, scraped_at DESC)`

Row mapping reuses `selenium_pinnacle_team_to_rows` with `league=mlb`. Loader upserts into **`odds.mlb_pinnacle_team`** only (do not write MLB rows into the WNBA table).

## Backend

- Extend snapshot fetch to read `odds.mlb_pinnacle_team` for `league=mlb` (parallel to existing WNBA fetch).
- Replace or wrap `mlb_odds.get_today_odds` so it:
  1. Builds Pinnacle games from latest team snapshot (spread + total, favorite-style spread side as today for WNBA).
  2. Fetches Sharp as today (`run_line,total_runs`).
  3. Merges with Pinnacle-prefer / Sharp-when-empty-for-that-game (same semantics as `merge_pinnacle_prefer_sharp`).
- Team name → abbrev via existing MLB team-name helpers (not WNBA maps).
- Filter out scrape junk that cannot map to two real MLB teams.

## Frontend

No structural change required if the API keeps the current `MlbOddsResponse` shape. Cards already show a Pinnacle sportsbook caption when `sportsbook === "pinnacle"`.

## Error handling

- Scraper: JSON write always succeeds; Supabase upsert failure logs a warning and does not delete local JSON (same as WNBA).
- API: if Supabase Pinnacle fetch fails or is empty, fall back to Sharp-only for the slate (same resilience as missing Pinnacle for all games).
- No reading of `data/props/pinnacle/mlb/*.json` from the API.

## Testing

- Migration SQL creates table + indexes.
- Loader upserts sample MLB `*_team.json` rows into `odds.mlb_pinnacle_team`.
- Odds service unit tests: Pinnacle-only game, Sharp fallback when Pinnacle empty for a game, junk event skipped.
- Frontend: existing merge tests still pass; add/adjust only if DTO sportsbook labeling needs an MLB-specific case.

## Success criteria

1. Running the MLB Pinnacle scraper (or loader on an existing `*_team.json`) upserts into `odds.mlb_pinnacle_team`.
2. `GET /api/mlb/odds/today` returns Pinnacle spread/total when present; Sharp otherwise per game.
3. `/mlb/matchups` shows those lines with Pinnacle labeling when applicable.
