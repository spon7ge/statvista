# MLB final header + half-inning play cards (visual polish)

Date: 2026-08-03  
Status: Approved for planning  
Parent: `docs/superpowers/specs/2026-08-03-mlb-final-broadcast-summary-design.md`  
References: user screenshots (All Plays half-inning cards; split outcome header)

## Goal

Polish the shipped final Summary shell so it matches updated references:

1. **Outcome header** — split team slabs with scores toward center; **Summary | Box** tabs in the **middle** of the header (not a separate row below).
2. **Play feed** — group plays into half-inning cards tinted with the batting team’s color; description + outcome pill + optional Statcast row.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Refine existing `MlbFinalBroadcastHeader`, `MlbFinalPlayFeed`, `MlbFinalCenter` |
| Player portraits | **Omit** |
| Play-row action icons | **Omit** |
| Tab placement | Center column of header; remove under-header tablist |
| Scoring / All toggle | Keep above the grouped cards |

## Header layout

```
[ Today · Final · share ]

┌── away slab ────┬─ Summary | Box ─┬──── home slab ──┐
│ logo (left)     │   tabs center   │     logo (right)│
│ record  ABBR    │                 │  ABBR  record   │
│         SCORE   │                 │  SCORE          │
└─────────────────┴─────────────────┴─────────────────┘
```

- Away slab: team color; logo toward outer left; record + abbrev + large score toward center.
- Home slab: mirrored (logo outer right; abbrev + record + score toward center).
- Center column: Summary | Box tab controls (owned by `MlbFinalCenter` via `activeTab` / `onTabChange` props on the header).
- Remove the separate tab row currently under the header in `MlbFinalCenter`.

## Play feed layout

- Group chronologically by `(inning, half)`.
- Each group = rounded card; background = batting team color (top → away, bottom → home) with dark overlay for readability.
- Card title: `Top 1st` / `Bottom 1st` (ordinal half-inning label).
- Play row: description, outcome pill, optional `mph` / `ft` / `deg` when present.
- No portraits; no ESPN action icons.
- Scoring Plays filter still applies before grouping.

## Out of scope

- Live / scheduled changes
- Headshots / Savant
- Wiring share
- Changing linescore, team stats, box, win-prob, hit chart behavior

## Success criteria

1. Summary | Box appear centered in the outcome header; no duplicate tab row below.
2. All Plays (and Scoring) render as half-inning team-colored cards matching the reference composition (minus portraits/icons).
3. Existing final data fields and below-fold panels still work.
4. Tests updated for header tab placement and grouped play cards.
