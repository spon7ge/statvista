# Prop board Line cell — logo + odds

Date: 2026-10-16  
Status: Approved (design)  
Applies to: `/mlb/prop_picks`, `/wnba/prop_picks`, `/nba/prop_picks`  
Amends the Line column copy in the anchor-book prop board specs. Does not change the API.

## Goal

The Line column shows the anchor line on its own row, then the selected book’s logo and that side’s American odds on the row below. The Odds column stays other matching books only.

## Decisions

| Topic | Choice |
| --- | --- |
| Leagues | MLB, WNBA, and NBA research tables. Same Line layout in each league’s `*PropPicksTable`. |
| Layout | Stacked. Top: line number. Bottom: book logo (`BookMark`) + American odds. |
| PrizePicks | Missing American is still **-137** on the bottom row. |
| Other books missing American | Bottom row shows —. |
| Link | Plain stack. No new outbound link in the Line cell. |
| Odds column | Unchanged. |
| API / schemas | Unchanged. |

## UI

In `MlbPropPicksTable.tsx`, `WnbaPropPicksTable.tsx`, and `NbaPropPicksTable.tsx`, replace the single-line Line cell with:

```
[line number]
[BookMark] [American odds]
```

Reuse each table’s existing `BookMark` and `formatAmericanOdds` / PrizePicks `-137` helpers. Spacing matches the Odds chips’ logo + text gap (`inline-flex items-center gap-1` on the bottom row).

## Docs and tests

- Update the three prop-picks page rows in `md/system-design.md` so Line is described as: stacked anchor line number above the selected book’s logo + American (PrizePicks -137).
- Extend each league’s table/page tests so `line-cell` still contains the line number and American text, and the bottom row includes the book mark (SVG or short label) for the anchor book.

## Out of scope

- Backend board assembly and `?book=` behavior
- Odds column chip layout
- A shared Line cell package across leagues
