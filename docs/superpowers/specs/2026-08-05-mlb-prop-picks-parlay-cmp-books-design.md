# MLB Prop Picks — Parlay comparison books on expand

Date: 2026-08-05  
Status: Implemented

> **Note (2026-08-08):** [Soft Consensus](2026-08-08-mlb-prop-picks-soft-consensus-design.md) supersedes “cmp never sets fair” when Tier 1/2 are empty — soft/cmp books (incl. Pinnacle) can drive Tier 3 fair; expand cells still use `role: "comparison"`.

## Goal

On `/mlb/prop_picks` expand, show five additional sportsbook quotes from ParlayAPI as **comparison-only** cells (same treatment as Pinnacle): Caesars, Kalshi, bet365, BetMGM, Fanatics. They never enter fair %, edge, or source-tier logic.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | MLB prop picks expand only |
| Role | All five `role: "comparison"` (show `(cmp)` badge) |
| Fair stack | Unchanged — Tier 1 PX+Novig → Tier 2 DK+FD → No Sharp Read |
| Line match | Exact DFS line only (existing `_book_quote` / index key) |
| Parlay fetch | Keep unfiltered props GET; client-side keeplist |
| Parlay keys | `caesars`, `kalshi`, `bet365`, `betmgm`, `fanatics` (per Parlay docs) |
| Pinnacle | Still from Supabase snapshot; still `(cmp)` |
| Out of scope | Fair/edge changes, WNBA columns, Kalshi `/event-markets`, dedicated scrapers for these five |

## Data model

Extend `MlbPropBooks` with:

- `caesars: MlbPropBookQuote | None`
- `kalshi: MlbPropBookQuote | None`
- `bet365: MlbPropBookQuote | None`
- `betmgm: MlbPropBookQuote | None`
- `fanatics: MlbPropBookQuote | None`

`MlbPropBookQuote` unchanged (`side`, `fair_pct`, `american`, `changed_at`, `role`).

### Backend indexing (`backend/app/domains/mlb/props.py`)

- Keep `_PARLAY_FAIR_BOOKS = ("novig", "fanduel", "draftkings")` for fair assembly.
- Add `_PARLAY_CMP_BOOKS = ("caesars", "kalshi", "bet365", "betmgm", "fanatics")`.
- `_index_parlay` indexes **union** of fair + cmp books (same side/line exact-match keys).
- When building `MlbPropBooks`, attach cmp quotes with `role="comparison"`.
- `_fair_driving_changed_at` / `compute_fair` callers unchanged (still only PX/Novig/DK/FD).

### Timestamps

Parlay `changed_at` remains request-time approximation (existing v1 limitation). Expand hover tooltip continues to use `changed_at` with board `lastUpdatedAt` fallback.

## UI

Expand book cell order:

1. ProphetX  
2. Novig  
3. DraftKings  
4. FanDuel  
5. Pinnacle (cmp)  
6. Caesars (cmp)  
7. Kalshi (cmp)  
8. bet365 (cmp)  
9. BetMGM (cmp)  
10. Fanatics (cmp)

Keep existing expand grid: `grid-cols-2 sm:grid-cols-3`. Labels in `BOOK_LABELS`. Missing quote → “No line” (no tooltip).

## Contract / types

- Update OpenAPI golden + `frontend/openapi.json`
- Regenerate `frontend/src/shared/lib/api.schema.d.ts`
- Verify with `npm run check:api` (frontend)

## Testing

**Backend** (`test_mlb_props.py` or equivalent):

- Parlay rows for a cmp book at the DFS line appear on the row with `role == "comparison"`.
- Presence of only cmp books (no PX/Novig/DK/FD) still yields `no_sharp_read` / no fair from those books.
- Fair path with Novig/DK/FD unchanged when cmp books also present.

**Frontend** (`MlbPropPicksList.test.tsx`):

- Expand shows Caesars / Kalshi / bet365 / BetMGM / Fanatics labels.
- `(cmp)` badge present for those cells when quote has `role: "comparison"`.

## Success criteria

- Expand shows up to ten book cells in the order above.
- New five never move fair/edge/tier.
- OpenAPI + frontend types in sync.
- WNBA prop picks behavior unchanged.
