# MLB prop board — DFS column

Date: 2026-08-28  
Status: Approved (design)  
Amends: `docs/superpowers/specs/2026-08-23-mlb-prop-picks-research-table-design.md`  
Does **not** change `GET /api/mlb/props/today`, game-detail Props, or WNBA `/wnba/prop_picks`.

## Goal

On `/mlb/prop_picks`, add a **DFS** column that shows the PrizePicks / Underdog market at this row’s exact line. **Odds** shows each sportsbook’s **own main for this side** (logo + that book’s line + American). Implied % lives in **IP**. Rows without PrizePicks or Underdog are omitted.

## Decisions

| Topic | Choice |
| --- | --- |
| Page | Still `/mlb/prop_picks` table only; **no** PrizePicks / Underdog tabs |
| Row grain | DFS-anchored: `player + canonical stat + DFS line + side`. Sportsbook-only clusters are omitted. |
| Line seed | Unchanged: sportsbook **mains** ∪ PrizePicks/Underdog **mains**; no alt ladders |
| DFS fill | Chip only when PrizePicks or Underdog posted **this row’s** line; otherwise `—` |
| Split mains | Pinnacle 20.5 and PrizePicks 19.5 → **one** DFS row at 19.5; Pinnacle’s 20.5 main sits in Odds on that row |
| Same DFS line | PP and UD both on 19.5 → one row, both chips in DFS |
| DFS chips | Logo + American; PrizePicks UI **-137**; **no** de-vig % |
| Odds | Sportsbooks only; this side only: logo + `{book.line}` + American. Implied % lives in **IP**, not on each chip. Book line may differ from the DFS / Line column. |
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
        ├─ skip sportsbook-only clusters when DFS exists for that player+stat
        ├─ emit Over + Under when dfs chips OR sportsbook chips exist
        ├─ row.dfs  = prizepicks, underdog at this DFS line (devig_pct always null)
        └─ row.books = each sportsbook's player+stat main (line / over / under may differ)
```

Clustering and snapshot sources stay in `prop_board.py` / `prop_board_cluster.py`. `_chips_for_side` splits into two lists; DFS rows attach `_sportsbook_mains` for the same player+stat.

## Product surface

Columns:

**Proposition | Line | DFS | Odds | IP | L5 | L10 | L15 | H2H**

Example, same batter Hits, PrizePicks 19.5, Pinnacle main 20.5:

| DFS | Odds |
| --- | --- |
| PrizePicks **-137** (Underdog if also 19.5) | Over row: PX `19.5 -110`; Pinnacle `20.5 -108`. Under row: that side only. |

DFS chip order: PrizePicks, then Underdog. At most two chips — **no** `+N` overflow. Odds overflow (`+N`) stays on Odds only.

Empty DFS, empty Odds after filter, empty IP/L#/H2H: render `—`.

## API

`MlbPropBoardRow` adds `dfs: list[MlbPropBoardBookChip]` (default `[]`).

`MlbPropBoardBookChip` adds `line`, `over_american`, `under_american` (sportsbook main for this player+stat).

| Field | Contents |
| --- | --- |
| `dfs` | `prizepicks` and/or `underdog` on this exact line and side. `devig_pct` is always `null`. PrizePicks `american` stays `null` in JSON; the table paints **-137**. Underdog uses posted American; omit the UD chip if that side has no American. |
| `books` | Sportsbooks only, current order (ProphetX → … → Fliff). On a DFS row, each book's **main** for this player+stat (any line). `american` is this row's side; `line` / `over_american` / `under_american` are the book's two-way main. |

Emit a row when **either** list has a chip for that side. PrizePicks-only lines still produce Over and Under rows (`dfs` filled, `books: []`, `ip_pct` null unless a two-way sits on the DFS line).

OpenAPI export + frontend `generate:api` required. Update `md/system-design.md` `/mlb/prop_picks` row when implementing.

## Filters and sort

`filterMlbPropBoardRows`:

- Bookmaker options come from `dfs` ∪ `books`.
- Selected books trim **the matching list**: PrizePicks/Underdog → `dfs`; sportsbooks → `books`.
- A row stays if the trimmed `dfs` or trimmed `books` still has a posted chip. PrizePicks still counts as posted (`american` may be null). A sportsbook is posted if this side's `american` is set.
- Filter PrizePicks only → DFS shows PP, Odds `—`. Filter DraftKings only → Odds shows DK, DFS `—` even if PP was on that line. Filter both → both columns may fill.

Sort: default order unchanged. Odds sort uses the first **sportsbook** American. Other sortable headers unchanged. DFS is not sortable.

## Frontend

- `MlbPropPicksTable`: insert DFS between Line and Odds; DFS uses `BookChip`; Odds is this side only: logo + book line + American + implied %.
- `filterMlbPropBoard.ts` / `sortMlbPropBoard.ts`: split chip lists; book options include DFS apps from `dfs`.
- Page chrome, pagination (30), prefetch, 15-minute `staleTime`: unchanged.

## Errors

Same as the research-table spec: **200** with `warnings` when enrichments fail. Missing DFS snapshots → empty `dfs` on sportsbook-only rows, not a page error. Empty slate → `rows: []`, “No board yet”.

## Tests

**Backend** (`test_mlb_prop_board.py` / cluster tests)

- PP 19.5 + Pinnacle 20.5 → **one** line 19.5; Pinnacle chip `line == 20.5` on that row's `books`.
- PP + UD on the same line → both in `dfs`, neither in `books`.
- DFS-only line → sportsbook mains still attach on `books` when they exist for the player+stat (possibly a different number); `ip_pct` null unless a two-way sits on the DFS line.
- PrizePicks chip `devig_pct` is null; sportsbook chips also leave `devig_pct` null. Odds UI shows raw implied from American.
- Existing IP / chip-order tests updated so `books` no longer contains `prizepicks` / `underdog`.

**Frontend**

- Headers include DFS between Line and Odds.
- DFS cell: PP **-137**, no `(N%)`.
- Odds cell: this side only, e.g. `1.5 -128 (54%)` for a book whose main differs from the DFS line; opposite American is not shown.
- Pinnacle-only row (no DFS for that player+stat): omitted.
- Filter PrizePicks-only keeps DFS rows and clears Odds; DK-only keeps sportsbook rows and clears DFS.
- Bookmaker dropdown still lists PrizePicks and Underdog.

## Out of scope

- WNBA `/wnba/prop_picks` player board or tabs
- Game-detail Props / `GET /api/mlb/props/today`
- Alt ladders
- Re-clustering or changing IP
- DFS de-vig %
- Making DFS a sort key
