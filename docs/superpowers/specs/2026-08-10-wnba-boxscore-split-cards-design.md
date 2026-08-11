# WNBA Boxscore Tab + Split Team Cards

## Goal

Rename the WNBA live/final game tab from **Box** to **Boxscore**, and render the box score as two separate stacked cards (away above home)—one `GameSection` per team.

## Non-goals

- Side-by-side desktop layout (user chose stacked)
- MLB-style 18px typography overhaul
- Backend / API changes to `box_score`
- Changing Summary tab content

## Current state

- `WnbaBroadcastHeader` labels the second tab **Box** (`activeTab === "box"`).
- `BoxScore` wraps both team tables in a **single** `GameSection` with `space-y-5`.

## Design

### Tab label

In `WnbaBroadcastHeader.tsx`, display **Boxscore** when `tab === "box"`. Keep internal tab id `"box"` and panel ids (`wnba-box-tab`, `wnba-box-panel`) unchanged unless tests need label-only updates.

Update tests that assert `/^box$/i` or the string `Box` as a tab name to expect **Boxscore**.

### Box score layout

`BoxScore` returns:

```tsx
<div data-testid="wnba-box-score" className="space-y-4">
  {/* away GameSection if players.length > 0 */}
  {/* home GameSection if players.length > 0 */}
</div>
```

Each team card:
- Own `GameSection className="!p-3"` with `data-testid="wnba-box-team-away"` / `wnba-box-team-home`
- Header: optional logo (`logoUrl`) + colored abbrev + team name (existing text hierarchy is fine)
- Existing player grid, columns, and DNP rendering unchanged

Omit the outer shared section. If both teams empty / `boxScore` null → return `null` (unchanged).

### Files

- `frontend/src/features/basketball/game/WnbaBroadcastHeader.tsx` (+ test)
- `frontend/src/features/basketball/game/BoxScore.tsx` (+ test)
- Live/final center tests that click the Box tab by name

## Success criteria

- Tab reads **Boxscore**
- Away and home each appear in a separate card, stacked away → home
- Existing box score stats/DNP behavior preserved
