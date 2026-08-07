# MLB Prop Picks — Parlay `*_alternate` market keys

Date: 2026-08-06  
Status: Approved for planning  
Related: `2026-08-05-mlb-prop-picks-design.md`, `2026-08-05-mlb-prop-picks-parlay-cmp-books-design.md`, `2026-08-06-mlb-prophetx-alt-lines-design.md`

## Goal

On `/mlb/prop_picks`, attach Parlay Novig / DraftKings / FanDuel (fair) and comparison books when the selected DFS line matches a Parlay **alternate** quote that arrives as `market_key` ending in `_alternate` (e.g. `player_total_bases_alternate` at line 1.5 while the main key quotes 2.5).

## Context

MLB props already index Parlay by exact `(player, stat, side, line)` and do **not** call `select_parlay_main_lines`. The live gap is mapping: `canonical_stat_key_from_sharp_mlb` returns `None` for `…_alternate` keys after stripping `player_`/`batter_`/`pitcher_`, so those rows never enter the index.

ProphetX alts are already handled separately (`is_main` on scrape). Skipping Parlay `is_main` here is intentional: when a sharp exchange has a read, ProphetX already signals which line is main on the same DFS row. Cmp-only Parlay/Pinnacle quotes do not drive recommended side today.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | MLB Prop Picks Parlay attach only |
| Fix | Strip trailing `_alternate` in `canonical_stat_key_from_sharp_mlb` before alias lookup |
| Line match | Unchanged exact DFS line |
| Parlay `is_main` | Deferred (no schema/UI) |
| WNBA | Untouched — still `select_parlay_main_lines` upstream |
| Persist | Parlay → Supabase main-line-only path unchanged |

## Fix

In `backend/app/domains/mlb/prop_stat_keys.py` → `canonical_stat_key_from_sharp_mlb`:

1. `_norm(market_key)`
2. If the string ends with `_alternate`, strip that suffix once
3. Existing prefix + alias logic unchanged

Examples:

- `player_total_bases_alternate` → `total_bases`
- `batter_strikeouts_alternate` → `batter_strikeouts`
- `player_total_bases` → `total_bases` (no change)

### Suffix verification (pre-impl)

Repo Parlay fixtures today only include bare keys (`player_total_bases`, `player_points`, …) — no multi-day Parlay dumps on disk. Before coding:

1. Fetch a live `GET /v1/sports/baseball_mlb/props` sample (or capture a fixture from it).
2. Collect distinct `market_key` values that look like alts.
3. Confirm the only alt suffix in use is `_alternate` (not `_alt` / `_alts` / etc.). Parlay docs document `*_alternate`.

If another suffix appears, extend the strip list in the same function and document it in this spec.

## Tests

Minimum:

1. **Mapper — main + multi-alt:** `player_total_bases`, `player_total_bases_alternate` (and a second alt key if present) all resolve to `total_bases`.
2. **Index — multi-line:** `_index_parlay` with Novig rows at 1.5 and 2.5 both index; DFS at 1.5 attaches the 1.5 quote.
3. **Regression — main only:** bare `player_total_bases` still maps; no-alt board behavior unchanged.
4. **WNBA untouched:** existing WNBA / `select_parlay_main_lines` tests still pass; this change does not route WNBA through the MLB mapper for filtering.

## Rollout check

After deploy, on a few consecutive MLB prop boards:

- Count rows with `source_tier == no_sharp_read` before vs after (same slate window / similar DFS set).
- Note how many newly resolve fair % via Parlay (Novig/DK/FD) at the DFS line.

Record the before/after counts in the PR or a short follow-up note — do not rely on “tests pass” alone.

## Out of scope

- WNBA Prop Picks alt support / relaxing `select_parlay_main_lines`
- Parlay → Supabase snapshot persist (still main-line-only)
- Parlay `is_main` labels on expand
- Closest-line matching across books
- Changing ProphetX / Pinnacle scrape behavior

## Success criteria

1. Parlay `*_alternate` market keys map to the same canonical stats as their main keys.
2. DFS rows whose line only exists on Parlay as an alt can attach fair/cmp quotes at that exact line.
3. WNBA main-line filtering and MLB main-key mapping remain unchanged.
4. Unit tests cover mapper + index attach; rollout count documents production impact.
