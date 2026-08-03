# Unified WNBA Parlay API Odds Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Parlay Prop Picks snapshots into one table `odds.wnba_parlay_api_odds` instead of per-book tables, without changing the live Prop Picks serve path.

**Architecture:** Migration adds a sportsbook-keyed prop table matching existing book-row columns. Mapper emits `sportsbook` on each row; loader upserts once and throttles on that table’s `MAX(scraped_at)`. Pinnacle stays out of Parlay persist.

**Tech Stack:** Postgres/Supabase migrations, Python (`src/odds/snapshot_rows.py`, `src/odds/load_snapshots.py`), pytest.

## Global Constraints

- Prop Picks US books continue to come from live Parlay (persist-only change).
- Do not drop old per-book tables.
- Do not write Pinnacle from Parlay.
- Do not change scraper PP/UD or Selenium Pinnacle tables.
- Commit only when the user asks.

---

## File map

| File | Responsibility |
|---|---|
| `db/migrations/025_odds_wnba_parlay_api_odds.sql` | Create `odds.wnba_parlay_api_odds` |
| `src/odds/snapshot_rows.py` | Multi-book mapper with `sportsbook` column |
| `src/odds/load_snapshots.py` | Single-table load + throttle |
| `src/scrapers/tests/odds/test_snapshot_rows.py` | Mapper tests |
| `src/scrapers/tests/odds/test_load_snapshots.py` | Persist / throttle tests |
| `docs/superpowers/specs/2026-08-03-wnba-parlay-api-odds-unified-table-design.md` | Spec (already written) |
| System design doc (if it lists per-book Parlay persist) | Short note update |

---

### Task 1: Migration

**Files:**
- Create: `db/migrations/025_odds_wnba_parlay_api_odds.sql`

- [x] **Step 1: Add migration** matching the approved schema (PK includes `sportsbook`; index on `(league, scraped_at DESC)`).

- [ ] **Step 2: Commit** (only if user asked)

---

### Task 2: Mapper includes sportsbook / multi-book helper

**Files:**
- Modify: `src/odds/snapshot_rows.py`
- Modify: `src/scrapers/tests/odds/test_snapshot_rows.py`

- [x] **Step 1: Failing test** — rows from Parlay mapper include `sportsbook`; multi-book helper emits mixed books and skips pinnacle when books allowlist excludes it.

- [x] **Step 2: Implement** — keep `parlay_props_to_book_rows` but always set `sportsbook` on each row; add `parlay_props_to_api_odds_rows(rows, *, league, scraped_at, books=...)` that concatenates per-book main-line rows for the allowlist.

- [x] **Step 3: Run** `pytest src/scrapers/tests/odds/test_snapshot_rows.py -q` — pass.

---

### Task 3: Loader writes only unified table

**Files:**
- Modify: `src/odds/load_snapshots.py`
- Modify: `src/scrapers/tests/odds/test_load_snapshots.py`

- [x] **Step 1: Failing tests** — `maybe_persist_parlay_props` upserts only `wnba_parlay_api_odds`; counts still keyed by book; pinnacle absent; `latest_parlay_props_scraped_at` / throttle use the unified table.

- [x] **Step 2: Implement**
  - Replace `_PARLAY_BOOK_TABLES` with `PARLAY_PROP_SPORTSBOOKS` tuple (no table map) and `_PARLAY_API_ODDS_TABLE = "wnba_parlay_api_odds"`.
  - Conflict cols: `sportsbook, league, player_name, market_type, side, line_score, scraped_at`.
  - `load_parlay_api_odds_snapshot(...)` maps all books once and upserts.
  - `maybe_persist_parlay_props` uses that loader; return per-book counts derived from mapped rows (or from upsert grouping).
  - `latest_parlay_props_scraped_at` → `_latest_scraped_at("wnba_parlay_api_odds", league)`.
  - Remove / stop using `load_parlay_book_snapshot` for Prop Picks path (delete or leave unused — prefer delete if only Parlay used it).

- [x] **Step 3: Run** `pytest src/scrapers/tests/odds/test_load_snapshots.py src/scrapers/tests/odds/test_snapshot_rows.py -q` — pass.

---

### Task 4: Docs touch-up

**Files:**
- Modify relevant mention in `docs/superpowers/specs/2026-08-02-website-api-system-design.md` and/or older Parlay design if it claims per-book Parlay upserts for Prop Picks.

- [x] **Step 1: Update** one short note: Parlay persist → `odds.wnba_parlay_api_odds`; serve path unchanged.

- [x] **Step 2: Run** targeted pytest again if any code changed; otherwise done.

---

### Task 5: Verification

- [x] **Step 1:** `pytest src/scrapers/tests/odds/test_load_snapshots.py src/scrapers/tests/odds/test_snapshot_rows.py -q`
- [x] **Step 2:** Confirm no Prop Picks serve-path code now reads the new table (grep).
