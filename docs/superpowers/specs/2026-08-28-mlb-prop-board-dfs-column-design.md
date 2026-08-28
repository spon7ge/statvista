# MLB prop board — DFS column

Date: 2026-08-28  
Status: Approved (design)  
Amends: `docs/superpowers/specs/2026-08-23-mlb-prop-picks-research-table-design.md`  
Does **not** change `GET /api/mlb/props/today`, game-detail Props, or WNBA `/wnba/prop_picks`.

## Goal

On `/mlb/prop_picks`, add a **DFS** column that shows the PrizePicks / Underdog market at this row’s exact line. **Odds** becomes sportsbooks only, attached at that same number (WNBA-style exact-line compare). Sportsbook mains that do not match DFS still appear as their own rows.

## Decisions

| Topic | Choice |
| --- | --- |
| Page | Still `/mlb/prop_picks` table only; **no** PrizePicks / Underdog tabs |
| Row grain | Unchanged: `player + canonical stat + exact line + side` |
| Line seed | Unchanged: sportsbook **mains** ∪ PrizePicks/Underdog **mains**; no alt ladders |
| DFS fill | Chip only when PrizePicks or Underdog posted **this row’s** line; otherwise `—` |
| Split mains | Pinnacle 20.5 and PrizePicks 19.5 → two rows (20.5 DFS empty) |
| Same DFS line | PP and UD both on 19.5 → one row, both chips in DFS |
| DFS chips | Logo + American; PrizePicks UI **-137**; **no** de-vig % |
| Odds chips | Sportsbooks only; logo + American + de-vig % when two-way |
| IP | Unchanged; DFS never sets IP |
| DFS sort | DFS header is **not** a sort key |
| Approach | Backend split: `dfs` vs `books` on `GET /api/mlb/props/board` |

## Architecture

```
/mlb/prop_picks
        │
        ▼
MlbPropPicksPage → useMlbPropBoard (unchanged staleTime / prefetch)
        │
        ▼
GET /api/mlb/props/board
        │
        ├─ cluster (player_key, stat, line) — unchanged
        ├─ emit Over + Under when dfs chips OR sportsbook chips exist
        ├─ row.dfs  = prizepicks, underdog (devig_pct always null)
        └─ row.books = sportsbooks only (devig_pct as today)
```

Clustering and snapshot sources stay in `prop_board.py` / `prop_board_cluster.py`. `_chips_for_side` splits into two lists instead of one mixed `books` array.

## Product surface

Columns:

**Proposition | Line | DFS | Odds | IP | L5 | L10 | L15 | H2H**

Example, same batter Hits:

| Line | DFS | Odds |
| --- | --- | --- |
| 19.5 | PrizePicks **-137** (Underdog if also 19.5) | PX, DK, … at 19.5 with American + de-vig % |
| 20.5 | `—` | Pinnacle (and anyone else at 20.5) |

DFS chip order: PrizePicks, then Underdog. At most two chips — **no** `+N` overflow. Odds overflow (`+N`) stays on Odds only.

Empty DFS, empty Odds after filter, empty IP/L#/H2H: render `—`.

## API

`MlbPropBoardRow` adds `dfs: list[MlbPropBoardBookChip]` (default `[]`).

`MlbPropBoardBookChip` is unchanged (`book`, `american`, `url`, `devig_pct`).

| Field | Contents |
| --- | --- |
| `dfs` | `prizepicks` and/or `underdog` on this exact line and side. `devig_pct` is always `null`. PrizePicks `american` stays `null` in JSON; the table paints **-137**. Underdog uses posted American; omit the UD chip if that side has no American. |
| `books` | Sportsbooks only, current order (ProphetX → … → Fliff). Omit chip if American is missing. `devig_pct` as today. |

Emit a row when **either** list has a chip for that side. PrizePicks-only lines still produce Over and Under rows (`dfs` filled, `books: []`, `ip_pct` null unless a sharp two-way also sits on that number).

OpenAPI export + frontend `generate:api` required. Update `md/system-design.md` `/mlb/prop_picks` row when implementing.

## Filters and sort

`filterMlbPropBoardRows`:

- Bookmaker options come from `dfs` ∪ `books`.
- Selected books trim **the matching list**: PrizePicks/Underdog → `dfs`; sportsbooks → `books`.
- A row stays if the trimmed `dfs` or trimmed `books` still has a posted chip. PrizePicks still counts as posted (`american` may be null).
- Filter PrizePicks only → DFS shows PP, Odds `—`. Filter DraftKings only → Odds shows DK, DFS `—` even if PP was on that line. Filter both → both columns may fill.

Sort: default order unchanged. Odds sort uses the first **sportsbook** American. Other sortable headers unchanged. DFS is not sortable.

## Frontend

- `MlbPropPicksTable`: insert DFS between Line and Odds; reuse `BookChip`; skip de-vig `%` in the DFS cell.
- `filterMlbPropBoard.ts` / `sortMlbPropBoard.ts`: split chip lists; book options include DFS apps from `dfs`.
- Page chrome, pagination (30), prefetch, 15-minute `staleTime`: unchanged.

## Errors

Same as the research-table spec: **200** with `warnings` when enrichments fail. Missing DFS snapshots → empty `dfs` on sportsbook-only rows, not a page error. Empty slate → `rows: []`, “No board yet”.

## Tests

**Backend** (`test_mlb_prop_board.py` / cluster tests)

- PP 19.5 + Pinnacle 20.5 → two lines; 19.5 has `dfs`; 20.5 has `books` only and `dfs: []`.
- PP + UD on the same line → both in `dfs`, neither in `books`.
- DFS-only line → `books: []`, `ip_pct` null, both sides emitted.
- PrizePicks chip `devig_pct` is null; sportsbook two-way still has `devig_pct`.
- Existing IP / chip-order tests updated so `books` no longer contains `prizepicks` / `underdog`.

**Frontend**

- Headers include DFS between Line and Odds.
- DFS cell: PP **-137**, no `(N%)`; Odds cell: sportsbooks with `%` when two-way.
- Pinnacle-only row: DFS `—`.
- Filter PrizePicks-only keeps DFS rows and clears Odds; DK-only keeps sportsbook rows and clears DFS.
- Bookmaker dropdown still lists PrizePicks and Underdog.

## Out of scope

- WNBA `/wnba/prop_picks` player board or tabs
- Game-detail Props / `GET /api/mlb/props/today`
- Alt ladders
- Re-clustering or changing IP
- DFS de-vig %
- Making DFS a sort key
