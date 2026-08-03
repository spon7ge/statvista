# MLB Underdogs Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add migration `027` creating `odds.mlb_underdogs` as a mirror of `odds.wnba_underdogs`.

**Architecture:** Single SQL migration file; no Python/API changes. Schema matches migration 019’s Underdog table with MLB-specific table/index names.

**Tech Stack:** Postgres / Supabase SQL migrations

## Global Constraints

- Table name is exactly `odds.mlb_underdogs`
- Columns and PK match `odds.wnba_underdogs` (019)
- No loader, scraper, API, or frontend changes
- Migration filename: `db/migrations/027_odds_mlb_underdogs.sql`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `db/migrations/027_odds_mlb_underdogs.sql` | Create MLB Underdog snapshot table + index |

---

### Task 1: Create `odds.mlb_underdogs` migration

**Files:**
- Create: `db/migrations/027_odds_mlb_underdogs.sql`

**Interfaces:**
- Consumes: nothing
- Produces: table `odds.mlb_underdogs` with PK and scraped_at index

- [ ] **Step 1: Write the migration file**

```sql
-- 027_odds_mlb_underdogs.sql
-- MLB Underdog Fantasy pick'em scraper snapshot table (schema odds).
-- Mirror of odds.wnba_underdogs (019); full snapshot per scrape.

CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.mlb_underdogs (
    league              TEXT        NOT NULL,  -- mlb
    player_name         TEXT        NOT NULL,
    stat_name           TEXT        NOT NULL,
    line_score          NUMERIC     NOT NULL,
    side                TEXT        NOT NULL,  -- over | under
    american_price      INTEGER,
    payout_multiplier   NUMERIC,
    line_updated_at     TIMESTAMPTZ,
    scraped_at          TIMESTAMPTZ NOT NULL,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (league, player_name, stat_name, side, line_score, scraped_at)
);

CREATE INDEX IF NOT EXISTS odds_mlb_underdogs_league_scraped_at_idx
    ON odds.mlb_underdogs (league, scraped_at DESC);
```

- [ ] **Step 2: Verify against WNBA 019**

Confirm column list, types, nullability, PK, and index pattern match `db/migrations/019_odds_prizepicks_underdog.sql` Underdog section (table/index names use `mlb` instead of `wnba`).

- [ ] **Step 3: Commit**

```bash
git add db/migrations/027_odds_mlb_underdogs.sql
git commit -m "db: add odds.mlb_underdogs for Underdog pick'em snapshots"
```

- [ ] **Step 4 (optional): Apply to Supabase**

If credentials are available:

```bash
# Apply 027 via SUPABASE_DB_URL (same pattern as 026)
```

Not required for plan completion; operator may apply later.

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| `027_odds_mlb_underdogs.sql` | Task 1 |
| Schema mirror of WNBA underdogs | Task 1 |
| No Python/API | Global constraints |

## Placeholder scan

None.
