# MLB Prop Picks — per-book “Last updated” hover tooltip

Date: 2026-08-05  
Status: Approved for planning

## Goal

On `/mlb/prop_picks`, keep the board-level “Last updated …” stamp (props API poll time). On expand, each sportsbook quote cell shows that book’s own absolute last-updated time on hover — not the board stamp — so manually scraped sources with different scrape times are distinguishable.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Frontend expand UX only |
| Per-book timestamp field | Reuse existing `MlbPropBookQuote.changed_at` (no rename, no new API field) |
| Board stamp | Unchanged — React Query `dataUpdatedAt` via `formatMlbPropPicksUpdatedAt` |
| Inline relative age on book cells | Remove |
| Expand “DFS line updated …” footer | Remove |
| Tooltip trigger | Native `title` (hover in / mouse-out out; no tooltip library) |
| Tooltip copy | `Last updated {absolute}` matching board stamp format (e.g. `Aug 5, 8:47 PM`) |
| Null / unparseable `changed_at` | Fall back to board `lastUpdatedAt` |
| “No line” cells | No tooltip |
| Book grid layout | Two rows (not five-across): `grid-cols-2 sm:grid-cols-3` → 3 + 2 on wider widths |
| Out of scope | API rename to `last_updated`, Parlay true move-time persistence, collapsed-card changes, WNBA prop picks |

## Current data (unchanged)

- Snapshot books (ProphetX, Pinnacle): `changed_at` from that row’s `scraped_at` (updates when that source is re-scraped / latest snapshot batch).
- Parlay books (Novig, DraftKings, FanDuel): `changed_at` ≈ request time when Parlay is fetched (existing v1 limitation; documented elsewhere).
- Board “Last updated”: last successful `GET /api/mlb/props/today` client fetch.

## UI

### Board header / list caption

Unchanged. `MlbPropPicksList` continues to show `Last updated {formatMlbPropPicksUpdatedAt(lastUpdatedAt)}` when `lastUpdatedAt` is set.

### Expanded book cells

`BookQuoteCell` with a quote:

- Visible: book label, side + fair, american odds only (drop `· {formatAge(...)}`).
- `title={`Last updated ${formatMlbPropPicksUpdatedAt(ms)}`}` where:
  1. `ms = Date.parse(quote.changed_at)` if valid, else
  2. board `lastUpdatedAt` if provided, else
  3. omit `title` only if neither is available (should be rare when list has a successful fetch).

`BookQuoteCell` with no quote: unchanged “No line”; no `title`.

Wire `lastUpdatedAt` from `MlbPropPicksList` → `PropPickCard` → `ExpandedPanel` → `BookQuoteCell`.

### Expand footer

Remove the `DFS line updated {formatAge(row.dfs.changed_at)}` span. Keep recommended / alt edge lines and `fair_explain`.

### Book grid

Replace `grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5` with `grid grid-cols-2 gap-2 sm:grid-cols-3` so five books wrap to two rows (3 + 2 at `sm+`).

## Architecture

```
MlbPropPicksPage
  └── MlbPropPicksList(lastUpdatedAt=dataUpdatedAt)
        └── PropPickCard
              └── ExpandedPanel(lastUpdatedAt)
                    └── BookQuoteCell(quote, lastUpdatedAt)
                          title ← changed_at | lastUpdatedAt fallback
```

No backend, OpenAPI, or scraper changes.

## Testing

`MlbPropPicksList.test.tsx`:

- Expand a row with `books.prophetx.changed_at` set → cell `title` matches absolute format from that ISO time.
- Expand with `changed_at: null` and `lastUpdatedAt` passed → `title` uses board fallback.
- Expand does not render relative age fragments or “DFS line updated”.
- Book grid container class includes `sm:grid-cols-3` and does not include `lg:grid-cols-5`.

## Success criteria

- Board “Last updated” still reflects API poll time.
- Hovering a filled book cell shows that book’s absolute last-updated (or board fallback).
- Expand no longer shows inline relative ages or DFS footer age.
- Five book cells lay out on two rows at `sm+`.
