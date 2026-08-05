# MLB live game Summary/Box redesign (mirror final)

Date: 2026-08-04  
Status: Approved for planning  
Reference: Final broadcast Summary shell (`MlbFinalCenter`); user request to mirror final for live with pitch zone above play feed and linescore brought up

## Goal

Restructure the **live** branch of `/mlb/games/:gamePk` so it mirrors the final Summary | Box layout: final-style broadcast header, tabs, play feed, right-rail linescore + team stats + win prob + hit chart. Live-only deltas: keep the **pitch zone above the play feed**, and place **inning runs (linescore)** at the top of the right rail. Drop the current live matchup panel and team-toggle batters from the live branch.

Scheduled and final layouts are out of scope (final unchanged).

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Dedicated `MlbLiveCenter` mirroring `MlbFinalCenter` (do not generalize final into a shared status shell in this change) |
| Visual parity | Reuse final slab/header chrome, Summary \| Box tabs, play feed cards, team stats, Box side-by-side |
| Pitch zone | Live Summary left column, **above** play feed |
| Linescore (inn runs) | Right rail, **top** (same card pattern as final linescore, without W/L/S decisions while live) |
| Winner emphasis | Omit on live (no winner ring / score size split) |
| Live status | Show live `statusLabel` with pulse affordance (same signal as today’s live header) |
| Matchup / team-toggle | **Removed** from live branch |
| API | No backend changes — reuse existing `MlbGameDetail` / mapped view |
| Share | UI affordance only (match final); no share backend |

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ date label          live status (+ pulse)       [share]  │
├────────────────────────────┬─────────────────────────────┤
│ Away slab (team color)     │ Home slab (team color)      │
│ logo · record · abbrev     │ abbrev · record · logo      │
│ large score                │ large score                 │
│ (no winner emphasis)       │ (no winner emphasis)        │
├────────────────────────────┴─────────────────────────────┤
│ [ Summary | Box ] tabs                                   │
├──────────────────────────────────────────────────────────┤
│ Summary (desktop ≥ lg):                                  │
│  Left ~55%: Pitch zone                                   │
│             [Scoring Plays | All Plays] + play cards     │
│  Right ~45%: Linescore (inn runs + RHE)                  │
│              Team Stats comparison                       │
│              Win probability (compact)                   │
│              Hit chart                                   │
│ Box:                                                     │
│  Away batters+pitchers  |  Home batters+pitchers         │
└──────────────────────────────────────────────────────────┘
```

### Desktop (≥ lg)

- Header strip + split slabs full width.
- Summary: two-column grid matching final proportions (`1.1fr` / `0.9fr`).
- Left stacks pitch zone then play feed.
- Right stacks linescore → team stats → win prob → hit chart.
- Box: side-by-side box score (existing final Box behavior).

### Mobile

- Header slabs remain side-by-side when space allows.
- Summary stacks: pitch zone → play feed → linescore → team stats → win prob → hit chart.
- Box: keep side-by-side when width allows (same as final).

## Components

| Piece | Responsibility |
| --- | --- |
| `MlbLiveCenter` | Composition wrapper for live branch (tabs + Summary/Box panels) |
| `MlbLiveBroadcastHeader` | Upgrade to final-style chrome: date label, live status + pulse, share affordance, split slabs with logo/record/abbrev/score; **Summary \| Box** tabs; no winner emphasis |
| Pitch zone | Reuse `MlbLiveSituation` `pitchZone` variant (or `MlbPitchZone` via existing path) above play feed |
| Play feed | Reuse `MlbFinalPlayFeed` (or thin live alias if naming must stay status-neutral later — reuse is fine for v1) |
| Linescore card | Reuse `MlbFinalLinescoreCard` / `MlbLinescore` embedded; decisions row stays empty/omitted when `decisions` absent (live) |
| Team stats | Reuse `MlbFinalTeamStats` |
| Box tab | Reuse `MlbBoxScore` `sideBySide` |
| Win prob / hit chart | Reuse existing compact win prob + hit chart **inside** Summary right rail (not a separate below-fold viz row) |

### Removed from live branch

- `MlbLiveMatchupPanel` mid-row usage
- Mid-row standalone `MlbLinescore` placement
- `MlbTeamToggleBatters`
- Standalone stacked `MlbPlayByPlay` / full `MlbBoxScore` below fold
- Separate `mlb-live-viz-row` below Summary (charts move into Summary right rail like final)

Components may remain in the codebase for tests or future use; they are simply not composed on the live page path.

## Page wiring

`MlbGameDetailPage` live branch becomes:

```text
chrome (back · venue · attribution)
└── MlbLiveCenter(detail)
```

Same pattern as final → `MlbFinalCenter`. Polling via `useMlbGameDetail` unchanged.

## Data / API

No new endpoints or normalize fields. Live already receives plays, linescore, team stats (when present), situation/pitches, win probability, and hit chart through the existing detail payload.

### Edge cases

- Missing situation / pitches → omit pitch zone block; play feed still renders.
- Missing linescore → omit linescore card.
- Missing team stats → omit team stats panel (same as final).
- Empty scoring plays → empty state under Scoring toggle (existing play-feed behavior).
- Missing record → abbrev + score only.
- Share button → non-functional UI affordance only.

## Testing

- `MlbLiveCenter`: default Summary; pitch zone above play feed; linescore in right rail; Box tab shows side-by-side box; matchup / team-toggle not present.
- `MlbLiveBroadcastHeader`: live status + pulse; date label; no winner ring; Summary \| Box tabs.
- `MlbGameDetailPage` live test: assert `mlb-live-center` composition (header, tabs, pitch zone, play feed, linescore, team stats, win prob, hit chart); remove assertions for removed pieces (`mlb-live-viz-row` as separate below-fold row, matchup mid-row, etc.) as needed.
- Final tests unchanged / no final regressions.

## Out of scope

- Changing final layout or components’ final-only behavior
- Scheduled / pregame redesign
- Restoring matchup diamond / batter-pitcher card on live
- API / backend changes
- Share backend / deep-link sharing
- Generalizing final + live into one shared center component (follow-up only)

## Success criteria

1. Live Summary visually mirrors final Summary structure, with pitch zone above the play feed and linescore at the top of the right rail.
2. Live Box tab matches final Box (side-by-side).
3. Old live shell pieces (matchup, team-toggle, below-fold viz row) no longer appear on the live path.
4. Polling and mapped detail data unchanged.
5. Mobile stacks without horizontal overflow.
6. Final branch remains unchanged.
