# MLB Parlay API odds table — persist + snapshot serve

Date: 2026-08-19  
Status: Implemented  
Mirror of: `docs/superpowers/specs/2026-08-03-wnba-parlay-api-odds-unified-table-design.md`  
Related: MLB prop picks player board `2026-08-19-mlb-prop-picks-player-board-design.md`; Parlay Supabase books `2026-08-09-mlb-props-parlay-supabase-design.md`

## Goal

Add `odds.mlb_parlay_api_odds` (WNBA unified-table twin) and change MLB prop assembly so DraftKings / FanDuel / cmp sportsbook quotes come **only** from that Supabase snapshot — no live Parlay fallback for serve. Live Parlay remains the **writer** (throttled side-effect), not the board source of truth.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | A — dedicated `odds.mlb_parlay_api_odds`; write via throttled Parlay fetch side-effect; serve from snapshot only |
| Fallback | None — empty/missing snapshot → empty Parlay book columns + `parlay_unavailable` when appropriate; never assemble from live Parlay rows |
| Schema | Mirror `odds.wnba_parlay_api_odds` (same columns, PK, scraped_at index) |
| Serve books | `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365` |
| DFS / scrapers | PrizePicks, Underdog, ProphetX, Novig, Pinnacle unchanged (existing scrapers / tables) |
| WNBA | Unchanged serve (still live Parlay); persist stays on `odds.wnba_parlay_api_odds` |
| Pinnacle from Parlay | Not written / not served from this table (Selenium owns MLB Pinnacle) |

## Architecture

```
get_mlb_props_today / game props Parlay path
        │
        ├─ Live Parlay fetch (best-effort)
        │     └─ maybe_persist_parlay_props(..., league="mlb")
        │           → odds.mlb_parlay_api_odds  (throttled)
        │
        └─ Serve book indexes / books_main
              ← fetch latest odds.mlb_parlay_api_odds (league=mlb)
              ← NEVER use live Parlay book_indexes for assembly

DFS seed: fetch_latest_prizepicks|underdog("mlb")
PX/Novig/Pinnacle: existing scrapers
```

## Schema

Next migration after `038` (e.g. `039_odds_mlb_parlay_api_odds.sql`):

```sql
CREATE TABLE IF NOT EXISTS odds.mlb_parlay_api_odds (
    sportsbook       TEXT        NOT NULL,
    league           TEXT        NOT NULL,
    player_name      TEXT        NOT NULL,
    market_type      TEXT        NOT NULL,
    stat_category    TEXT,
    side             TEXT        NOT NULL,  -- over | under
    line_score       NUMERIC     NOT NULL,
    american_price   INTEGER     NOT NULL,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        sportsbook, league, player_name, market_type,
        side, line_score, scraped_at
    )
);

CREATE INDEX IF NOT EXISTS odds_mlb_parlay_api_odds_league_scraped_at_idx
    ON odds.mlb_parlay_api_odds (league, scraped_at DESC);
```

## Persist (write)

1. Generalize loader off hard-coded `wnba_parlay_api_odds`:
   - Table name from league: `wnba` → `wnba_parlay_api_odds`, `mlb` → `mlb_parlay_api_odds`
   - Register `mlb_parlay_api_odds` in `quote_specs` (same `_PARLAY_PROPS` identity as WNBA)
2. On successful MLB Parlay fetch (props today and any shared game-props path that already fetches Parlay), call `maybe_persist_parlay_props(rows, league="mlb")`.
3. Books included in the MLB write set must cover serve books, including **kalshi** and **fliff** (not in today’s WNBA `PARLAY_PROP_SPORTSBOOKS` tuple — extend for MLB or pass an MLB-specific books tuple).
4. Main lines only (existing `select_parlay_main_lines` / mapper behavior).
5. Throttle via `MAX(scraped_at)` on `odds.mlb_parlay_api_odds` for `league=mlb` (same env minutes as WNBA unless overridden).
6. Best-effort: persist failures never break the HTTP response.

## Serve (read)

1. Add `fetch_latest_parlay_api_odds("mlb")` (or equivalent) in `odds_snapshots` — latest `scraped_at` snapshot rows for `league=mlb`.
2. Map rows → the same `SideIndex` / main-line structures `_assemble_rows` expects for Parlay books (`draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365`).
3. `get_mlb_props_today` (and game-scoped props that reuse that assembly) **must not** pass live `parlay.book_indexes` into fair/`books`/`books_main` assembly.
4. Empty snapshot:
   - Parlay-sourced book quotes null / NL
   - Set `error` to `parlay_unavailable` when the snapshot is empty (and optionally when live fetch failed *and* snapshot empty — live failure alone does not force empty board if a prior snapshot exists)
5. DFS seed and PX/Novig/Pinnacle scrapers unchanged.

## Errors

| Case | Behavior |
| --- | --- |
| Snapshot has rows | Serve those books; live Parlay used only to refresh table when throttle allows |
| Snapshot empty, live fetch OK | Persist may fill table for *next* request; **this** request still serves empty Parlay books + `parlay_unavailable` (no in-request live fallback) |
| Snapshot empty, live fetch fails | Empty Parlay books + `parlay_unavailable` |
| Persist throttle / skip DB | Serve still from whatever latest snapshot exists |

## Tests

- Migration / table name for `league=mlb`
- `load_parlay_api_odds_snapshot` / `maybe_persist_parlay_props` write `mlb_parlay_api_odds` when `league="mlb"`; WNBA still writes `wnba_parlay_api_odds`
- MLB write books include kalshi/fliff
- `get_mlb_props_today` builds DK/FD/cmp from snapshot stubs; live Parlay `book_indexes` ignored even when populated
- Empty snapshot → `parlay_unavailable` and null Parlay `books` / `books_main` fields
- Change-filter / quote_spec registered for `mlb_parlay_api_odds`

## Docs

- Update `md/system-design.md` `/mlb/prop_picks` (and game props note if needed): Parlay sportsbooks from `odds.mlb_parlay_api_odds`, not live indexes
- Mark this spec Implemented when shipped

## Non-goals

- Serving WNBA prop picks from `wnba_parlay_api_odds`
- Replacing PrizePicks / Underdog / PX / Novig / Pinnacle scrapers
- Dropping live Parlay from the process entirely (still used to refresh the table)
- NBA / shared single-table redesign
- OPEN / BEST columns

## Success criteria

1. `odds.mlb_parlay_api_odds` exists with WNBA-parity shape.
2. MLB Parlay persist writes into that table (throttled); WNBA persist unchanged.
3. `/mlb/prop_picks` Parlay sportsbook columns and `books_main` come only from the snapshot.
4. Empty snapshot never falls back to live Parlay for assembly.
5. Unit tests cover write table routing, serve-from-snapshot, and no-live-fallback.
