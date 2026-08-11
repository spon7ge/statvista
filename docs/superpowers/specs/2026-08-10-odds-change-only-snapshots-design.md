# Odds change-only snapshots (storage)

Date: 2026-08-10  
Status: Implemented  
Plan: `docs/superpowers/plans/2026-08-10-odds-change-only-snapshots.md`

## Goal

Stop storing duplicate odds rows when a scrape repeats the same line **and** price for a quote. Keep a change history: insert a new row only when the quote is new or `line`/`points` **or** price fields differ from the latest stored row for that quote. Reclaim space already burned by unchanged full snapshots via a one-time prune.

## Decisions

| Topic | Choice |
| --- | --- |
| Retention model | Change history (not latest-only) |
| What counts as a change | Line/points **or** price fields |
| Scope | All scraper odds loaders in `src/odds/load_snapshots.py` (props + team, MLB + WNBA, including Sharp/Parlay persist paths) |
| Schema / PKs | Unchanged (`scraped_at` stays in unique key) |
| Existing data | One-time prune: keep first row per quote + later rows where compare fields changed |
| Vanished quotes | Out of scope (stale last row may remain) |
| Tombstones / last_seen | Out of scope |
| Sharp/Parlay time throttle | Unchanged (`MAX(scraped_at)` is fine for “did we write recently?”) |

## Problem

Today each scrape upserts a **full board** with a new `scraped_at`. Conflict keys include `line_score`/`points` **and** `scraped_at`, so unchanged quotes always insert. Prop-picks / matchup readers load `WHERE scraped_at = MAX(scraped_at)`, which assumes every scrape writes a complete batch.

## Architecture

```
scraper JSON
  → row mappers (unchanged)
  → dedupe conflict cols (unchanged)
  → filter_unchanged_quotes(df, table_spec)   # NEW
       ├── load latest row per quote identity from odds.<table>
       ├── compare line/points + price fields
       └── drop rows that match latest
  → upsert_df (only kept rows)

API / board readers
  → latest row per quote identity (DISTINCT ON … ORDER BY scraped_at DESC)
  → not max(scraped_at) batch
```

## Quote identity and compare fields

Identity = “same quote” for change detection and for “latest board” reads.  
**Exclude** `scraped_at`, `fetched_at`, line/points, and price fields from identity.  
**Compare** = line/points + price columns present on that table (null-safe equality).

**Write-path date partition:** the change filter appends the **America/New_York calendar date** of `scraped_at` to the identity key used only when deciding skip vs insert. Same line+odds on a new ET date still upserts once; same-day re-scrapes still skip. Board readers keep date-free identity (absolute latest quote).

| Table family | Quote identity (examples) | Compare |
| --- | --- | --- |
| PrizePicks | `league, player_name, stat_type, odds_type` | `line_score` |
| Underdog | `league, player_name, stat_name, side` | `line_score, american_price, payout_multiplier` |
| Pinnacle / Sharp / Parlay book props | `league, player_name, market_type, side` (+ `sportsbook` on unified Parlay table) | `line_score, american_price` |
| Pinnacle team | `league, away_team, home_team, market_type, period, is_alternate, side` | `points, american_price, decimal_price` |
| ProphetX / Novig props | `league, event_id, player_name, stat_name, side` | `line_score, american_price, stake` |
| ProphetX / Novig team | `league, event_id, market_type, side` | `points, american_price, stake` |

Concrete column lists live next to each loader (or a small registry keyed by table name) so writers and readers stay aligned.

### Concurrent alternate lines

Identity **excludes** `line_score`/`points`, so a line move is a change against the previous quote for that market/side. Books that post **many concurrent alts** under the same identity can collapse to one “latest” row in board reads. Tables that already distinguish mains (`is_main`, `is_alternate`, `odds_type`) keep those columns in identity. Full multi-line current boards without collapse are a follow-up (e.g. current+history split), not this change.

## Write path

Implement in `src/odds/load_snapshots.py` (shared helper used by every `load_*_snapshot` / Sharp / Parlay loader):

1. Build DataFrame as today (map rows, coerce floats, `_dedupe_conflict_rows`).
2. Load latest existing rows for the batch’s league(s) with `DISTINCT ON (identity) … ORDER BY identity…, scraped_at DESC`.
3. Keep a candidate row if no prior row exists for that identity **or** any compare field differs (null-safe).
4. Upsert only kept rows; stamp `scraped_at` as today when inserting.
5. Log `kept` / `skipped_unchanged` (and table/league).

If the DB is unreachable for the lookup, fail the load the same way other DB errors do (do not silently insert full duplicates). Optional env kill-switch (e.g. `ODDS_SKIP_CHANGE_FILTER=1`) may bypass the filter for debugging.

## Read path

Update `backend/app/core/odds_snapshots.py` (and any tests asserting max-batch SQL):

- Replace `scraped_at = (SELECT MAX(scraped_at) …)` with **latest row per quote identity**.
- Preserve existing filters (`period = 0`, `is_alternate = false`, market-type allowlists, column lists).
- Throttle helpers in `load_snapshots.py` that only need “last write time” keep `MAX(scraped_at)`.

## One-time prune

Add `scripts/prune_odds_unchanged_snapshots.py`:

- Target all odds scraper tables covered by the loaders.
- Per table: stream/order by identity + `scraped_at` ascending.
- Keep first row per identity; keep subsequent rows only when compare fields differ from the last kept row for that identity.
- Delete others in batches.
- `--dry-run` prints would-delete counts; default dry-run or require `--apply` (prefer explicit `--apply`).

Not invoked automatically from scrapers.

## Testing

- Unit tests for the filter: new quote kept; line change kept; price-only change kept; identical line+price skipped; null price handling.
- Reader/SQL tests: assert per-quote latest semantics (update tests that currently require `MAX(scraped_at)` board SQL).
- Prune: small in-memory or SQL fixture proving duplicates drop while real moves remain.

## Out of scope

- Tombstones / `last_seen_at` when a quote disappears from a scrape
- Schema or primary-key migrations
- Changing Sharp/Parlay persist interval throttles
- Scheduled prune jobs
- Splitting `*_current` vs history tables

## Success criteria

- Re-scraping an unchanged board inserts ~0 new rows (aside from truly new quotes).
- Line or price moves still append history rows.
- Prop-picks / matchup boards still show a full **current** quote set via latest-per-identity reads.
- Dry-run prune reports substantial deletable volume on existing duplicate history; `--apply` reduces table size without removing real moves.
