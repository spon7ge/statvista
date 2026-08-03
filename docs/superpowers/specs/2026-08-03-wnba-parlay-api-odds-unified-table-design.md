# Unified Parlay API Odds Table Design

**Date:** 2026-08-03  
**Status:** Approved  
**Scope:** WNBA Prop Picks Parlay snapshot persistence only

## Goal

Persist Parlay API prop snapshots into a single table `odds.wnba_parlay_api_odds` instead of per-book tables (`odds.wnba_fanduel`, `odds.wnba_draftkings`, `odds.wnba_caesars`, …, `odds.wnba_*_parlay`).

## Decisions

| Decision | Choice |
|---|---|
| Serve path | Unchanged — Prop Picks US books still from **live Parlay** |
| Persist target | One table: `odds.wnba_parlay_api_odds` |
| Old per-book tables | Stop **new Parlay writes**; do **not** drop tables (Sharp FD/DK, scraper PP/UD, history) |
| Pinnacle | Not written from Parlay (Selenium owns `odds.wnba_pinnacle`) |
| League | WNBA Prop Picks path only |

## Schema

```sql
CREATE TABLE IF NOT EXISTS odds.wnba_parlay_api_odds (
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

CREATE INDEX IF NOT EXISTS odds_wnba_parlay_api_odds_league_scraped_at_idx
    ON odds.wnba_parlay_api_odds (league, scraped_at DESC);
```

Row shape matches today’s per-book Parlay rows, plus `sportsbook`.

## Books persisted

Same allowlist as current `PARLAY_PROP_SPORTSBOOKS` (no Pinnacle):

`fanduel`, `draftkings`, `caesars`, `betmgm`, `bet365`, `prizepicks`, `underdog`, `betr`, `novig`, `sleeper`, `betrivers`

Main lines only (existing `select_parlay_main_lines` / mapper behavior).

## Code changes

1. **Migration** `025_odds_wnba_parlay_api_odds.sql` — create table + index.
2. **Mapper** — include `sportsbook` on each row; prefer a single multi-book mapper used by the loader.
3. **Loader** — `maybe_persist_parlay_props` upserts once into `wnba_parlay_api_odds`; throttle via `MAX(scraped_at)` on that table only.
4. **Remove** Parlay use of `_PARLAY_BOOK_TABLES` per-book targets.
5. **Leave alone** — Prop Picks live Parlay fetch; Selenium Pinnacle; scraper `wnba_prizepicks` / `wnba_underdogs`; Sharp persist into `wnba_fanduel` / `wnba_draftkings` if still used.

## Out of scope

- Serving Prop Picks from the unified snapshot
- Dropping old per-book tables
- NBA parity table
- Changing Parlay API request shape or frontend

## Success criteria

- Parlay persist path writes only to `odds.wnba_parlay_api_odds`
- Pinnacle never appears in that persist path
- Existing Prop Picks response behavior unchanged (live Parlay + PP/UD/Pinnacle snapshot attach)
- Unit tests cover mapper sportsbook column, single-table upsert, throttle, and pinnacle exclusion
