# MLB Prop Picks — Parlay `*_alternate` market keys

Date: 2026-08-06  
Status: Implemented  
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

### Suffix verification

Live sample skipped; shipped docs-documented `_alternate` only.

Implementation strips the single trailing `_alternate` suffix in `canonical_stat_key_from_sharp_mlb` (no `_alt`, `_alts`, or other variants added). Parlay API docs document `*_alternate` as the alt key form.

## Tests

Minimum:

1. **Mapper — main + multi-alt:** `player_total_bases`, `player_total_bases_alternate` (and a second alt key if present) all resolve to `total_bases`.
2. **Index — multi-line:** `_index_parlay` with Novig rows at 1.5 and 2.5 both index; DFS at 1.5 attaches the 1.5 quote.
3. **Regression — main only:** bare `player_total_bases` still maps; no-alt board behavior unchanged.
4. **WNBA untouched:** existing WNBA / `select_parlay_main_lines` tests still pass; this change does not route WNBA through the MLB mapper for filtering.

## Rollout (ops)

After deploy, for 2–3 MLB prop boards:

1. Count `source_tier == no_sharp_read` before deploy (or from a pre-deploy snapshot).
2. Recount after deploy on a comparable slate.
3. Note how many newly resolved rows attach via Parlay (Novig/DK/FD) at the DFS line.
4. Paste before/after counts in the PR description or a follow-up note.

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
