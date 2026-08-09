# MLB Prop Picks — Soft Consensus fair + filter cleanup

Date: 2026-08-08  
Status: Implemented  
Brand: **statvista**  
Route: `/mlb/prop_picks`

## Goal

1. Remove the **Tier** dropdown and **Fresh sharp vs stale DFS only** toggle from MLB Prop Picks filters.  
2. When Tier 1 and Tier 2 fair books are empty, compute fair% as an **equal average** of available exact-line soft/cmp books (including **Pinnacle**) — badge **Soft Consensus**.

## Decisions

| Topic | Choice |
| --- | --- |
| Filter cleanup | Remove Tier multiselect + Fresh-vs-stale toggle (and related client filter state) |
| Keep filters | Stat, Team, Side, Clear |
| Fair Tier 1 / 2 | Unchanged (PX+Novig → DK+FD) |
| New Tier 3 | If Tier 1+2 empty: equal average of available exact-line: Caesars, Kalshi, bet365, BetMGM, Fanatics, Hard Rock, Fliff, **Pinnacle** |
| Tier 3 empty | Still `no_sharp_read` / no fair |
| Badge | `soft_consensus` → UI **Soft Consensus** |
| Soft books in Tier 1/2 | Still do not move Tier 1/2 fair (chips / expand only) |
| Exact line | Soft Tier 3 still exact-line only (no closest-line) |
| Sort | Rows with any fair (incl. Soft Consensus) above pure no-read |

## Fair stack

```
compute_fair(side_books):
  Tier 1  ProphetX + Novig          → unchanged
  Tier 2  DraftKings + FanDuel      → unchanged (only if Tier 1 empty)
  Tier 3  equal avg of present:     → NEW (only if Tier 1+2 empty)
          caesars, kalshi, bet365, betmgm, fanatics, hardrock, fliff, pinnacle
  else    no_sharp_read
```

- Minimum for Tier 3: **≥1** available soft book at the exact line.  
- `fair_pct` = round(mean of available soft fair%s, 1).  
- `fair_explain` e.g. `Soft books avg (3): caesars, pinnacle, betmgm.`  
- `source_tier`: `soft_consensus`.

## Wiring

- Pass soft/Pinnacle fair%s into `side_books` for `compute_fair` (today they are assembled as `role: comparison` only).  
- Expand cells may keep displaying those books; when Tier 3 drives fair, explain string names the contributors. Optional: leave quote `role` as `comparison` on expand for visual consistency, or mark fair-driving — prefer **leave role as comparison on expand** so UI chrome stays stable; fair number still comes from Tier 3.

## Filters (frontend)

- Remove `MLB_SOURCE_TIER_OPTIONS` usage / Tier `MultiSelectFilter`.  
- Remove `freshVsStaleOnly` toggle and `FRESH_VS_STALE_CHIP` filter path.  
- Simplify `MlbPropPicksFilterSelection` + page state + tests accordingly.  
- Recency chips may still appear on rows from the API; only the **filter** that isolates `fresh_sharp_vs_stale_dfs` is removed.

## Schema / OpenAPI

- Extend `SourceTier` / API enum with `soft_consensus`.  
- Regen OpenAPI trio + frontend types if the enum is generated.  
- Update system-design MLB prop picks row for Soft Consensus + filter set.

## Out of scope

- Changing Tier 1/2 blend weights or agreement epsilon  
- Closest-line matching  
- Soft books influencing Tier 1/2 fair%  
- WNBA prop picks filters / fair stack  
- Removing recency chips from row display (only the filter toggle goes)

## Testing

- `prop_fair`: Tier 3 avg with 1 / N soft books; Tier 1/2 still preferred when present; empty soft → no_read  
- `props` assemble: soft-only side yields `soft_consensus` fair; PX present still Tier 1  
- Frontend filters: Tier + Fresh toggle absent; Stat/Team/Side/Clear still work  
- List still renders Soft Consensus badge when `source_tier === "soft_consensus"`
