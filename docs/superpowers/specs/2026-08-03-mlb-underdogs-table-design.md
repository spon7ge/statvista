# MLB Underdog odds table (migration only)

Date: 2026-08-03  
Status: Approved for planning

## Goal

Add a Supabase table for MLB Underdog Fantasy pick'em snapshots, matching the scraper’s pick shape and the existing WNBA Underdog table.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Dedicated `odds.mlb_underdogs` (mirror of `odds.wnba_underdogs`) |
| Migration | `db/migrations/027_odds_mlb_underdogs.sql` |
| Loader / scraper upsert | Out of scope |
| API / frontend | Out of scope |

## Schema

Same columns and constraints as `odds.wnba_underdogs` (migration 019):

| Column | Type | Notes |
| --- | --- | --- |
| `league` | TEXT NOT NULL | `mlb` |
| `player_name` | TEXT NOT NULL | scraper `full_name` |
| `stat_name` | TEXT NOT NULL | scraper `stat_name` |
| `line_score` | NUMERIC NOT NULL | scraper `stat_value` |
| `side` | TEXT NOT NULL | `over` \| `under` (scraper `choice`) |
| `american_price` | INTEGER | nullable |
| `payout_multiplier` | NUMERIC | nullable |
| `line_updated_at` | TIMESTAMPTZ | scraper `updated_at` |
| `scraped_at` | TIMESTAMPTZ NOT NULL | batch scrape time |
| `fetched_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | upsert lineage |

**Primary key:** `(league, player_name, stat_name, side, line_score, scraped_at)`  
**Index:** `(league, scraped_at DESC)`

## Success criteria

1. Migration file creates `odds.mlb_underdogs` with the schema above.
2. No Python/API/frontend changes in this work.

## Out of scope

- `load_underdog_snapshot` routing to the MLB table
- Wiring `mlb_underdog_scraper.py` to upsert
- Prop Picks / MLB props API reads
