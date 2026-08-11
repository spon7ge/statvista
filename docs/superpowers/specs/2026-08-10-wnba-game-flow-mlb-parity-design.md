# WNBA Game Flow MLB Parity

## Goal

Align the WNBA live/final Summary win-probability panel with MLB’s **Game flow** UI: rename the section, remove nested team stats under the chart, and match MLB chrome. Keep the separate Team Stats card above the chart.

## Non-goals

- Removing or changing `WnbaTeamStatsCard`
- Sharing a cross-league GameFlow component
- Backend / API changes to `win_probability.team_stats`
- Changing WNBA timeline labels (`Q{n} {clock}`)

## Current state

On WNBA live/final Summary (`WnbaInGameCenter`):

1. `WnbaQuarterScoreCard`
2. `WnbaTeamStatsCard` (separate card; uses `winProbability.teamStats`)
3. `WinProbabilityPanel` — titled **Win probability**, with a nested **Team stats** block under the chart

MLB’s `MlbWinProbability` is titled **Game flow**, chart-only (no nested team stats), with larger heading/labels and short unavailable copy. Separate team stats live in `MlbFinalTeamStats`.

## Design

### Component: `WinProbabilityPanel`

| Aspect | Change |
| --- | --- |
| Title | **Game flow** (`text-[18px] font-semibold text-white`) |
| Nested team stats | Remove entirely |
| Empty / null state | Copy: `Win probability unavailable` (MLB wording) |
| Chrome | Keep `GameSection className="!p-3"`; add `data-testid="wnba-game-flow"` |
| Chart % labels | White fill, ~18px / semibold (match MLB), not team-colored 11px |
| Scrub markers | Slightly larger circles (~4px radius) to match MLB |
| Clock label | Keep WNBA `Q{n} {clock}` |
| Layout placement | Unchanged: still under `WnbaTeamStatsCard` in Summary right column |

### Data

- Keep `GameDetailWinProbability.teamStats` on the type and mapper — still consumed by `WnbaTeamStatsCard`.
- Panel ignores `teamStats` for rendering.

### Tests

Update `WinProbabilityPanel.test.tsx` and any center/router assertions that expect:

- Heading **Win probability** → **Game flow**
- Nested **Team stats** / Field goal % under the panel → absent from the panel
- Prefer asserting `data-testid="wnba-game-flow"` where useful

`WnbaTeamStatsCard` tests and Summary order tests that look for the separate Team Stats card stay as-is.

### Files

- `frontend/src/features/basketball/game/WinProbabilityPanel.tsx`
- `frontend/src/features/basketball/game/WinProbabilityPanel.test.tsx`
- Related center/router tests if they assert the old heading or nested stats

## Success criteria

- WNBA Summary shows separate Team Stats card, then a chart-only **Game flow** section
- No team-stats UI inside the Game flow panel
- Visual chrome reads like MLB Game flow while keeping WNBA clock labels
