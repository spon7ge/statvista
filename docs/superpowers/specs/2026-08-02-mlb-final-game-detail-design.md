# MLB final game detail (`/mlb/games/:gamePk`)

Date: 2026-08-02  
Status: Approved for planning  
Scope: Unlock a final-game archive layout on the existing MLB game detail page  
Audience: Implementers of `MlbGameDetailPage` and related `components/mlb/*` composition

## Goal

When an MLB game is `final`, replace the thin “coming soon” stub with a full archive center: matchup header + linescore (team stats), box score, then game flow / hit chart / scoring plays side by side. Live layout stays as it is today. Scheduled stays the thin “Not live yet” page.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | **Final only** — live stacked layout unchanged |
| Team stats | Linescore (innings + R/H/E) under matchup header — not a new comparative stats panel |
| Architecture | Dedicated `MlbFinalCenter` composition component (Approach 2) |
| Trio row | `MlbWinProbability` \| `MlbHitChart` \| scoring-plays-only panel |
| Scoring plays | Extract `MlbScoringPlays` from `MlbPlayByPlay` so final does not pull half-inning PBP |
| API / hooks | Unchanged — same `useMlbGameDetail` + mapped detail |
| Theme | Existing `GAME_SECTION_SURFACE` / HoopVista quiet surfaces |
| Responsive | Trio stacks vertically below `lg`; box score already stacks |

## Non-goals

- Changing live layout (situation, full PBP, stacked order)
- New backend fields or ESPN/Stats API work
- Comparative “team stats” panel beyond linescore R/H/E
- Visual redesign of individual charts beyond layout composition (polish only if required for the three-column row)
- Scheduled preview content
- Park-specific wall geometry beyond existing hit chart
- WNBA game detail changes

---

## 1. Page status branches

```text
MlbGameDetailPage
  ├─ scheduled → Compact header + “Not live yet” (unchanged)
  ├─ live      → mlb-live-center stacked panels (unchanged)
  └─ final     → mlb-final-center (new)
```

Remove the final stub copy: `Final — live center for completed games coming soon`.

---

## 2. Final layout

Top → bottom:

1. **Chrome** — Back link + attribution (`Data: MLB Stats API` / `· ESPN` when present), same pattern as live
2. **Team stats** — `MlbGameHeader` + `MlbLinescore` (status label already shows Final)
3. **Box score** — `MlbBoxScore` (away | home batting + pitching)
4. **Archive trio** — three equal columns on large screens:
   - Game flow (`MlbWinProbability`)
   - Hit chart (`MlbHitChart`)
   - Scoring plays (`MlbScoringPlays`)

**Omitted on final:** `MlbLiveSituation`, full half-inning `MlbPlayByPlay`.

```text
┌─────────────────────────────────────────────────────┐
│ ← Back · Final · Venue · Data: MLB Stats API · ESPN │
├─────────────────────────────────────────────────────┤
│ MlbGameHeader                                       │
│ MlbLinescore                                        │
├─────────────────────────────────────────────────────┤
│ MlbBoxScore (away | home)                           │
├─────────────────┬─────────────────┬─────────────────┤
│ Game flow       │ Hit chart       │ Scoring plays   │
└─────────────────┴─────────────────┴─────────────────┘
```

---

## 3. Components

| Piece | Role |
| --- | --- |
| `MlbFinalCenter` | Composition wrapper; `data-testid="mlb-final-center"` |
| `MlbScoringPlays` | Scoring-plays list only (shared list UI with `MlbPlayByPlay`) |
| Existing panels | Header, linescore, box, win probability, hit chart — reuse as-is |

`MlbPlayByPlay` should consume the shared list helper / `MlbScoringPlays` internals so live scoring-plays UI does not diverge.

---

## 4. Testing

| Area | Expectation |
| --- | --- |
| `MlbGameDetailPage.test.tsx` | Final renders `mlb-final-center`; no stub message; no live-center; scheduled still thin |
| `MlbScoringPlays` (or extracted list) | Renders scoring rows / empty state |
| Live tests | Unchanged expectations for stacked live center |

---

## 5. Success criteria

- Opening a final `/mlb/games/:gamePk` shows header → linescore → box score → three-column archive row
- Live games keep today’s stacked order and live-only panels
- Scheduled games still show “Not live yet”
- No API schema or polling changes required for this slice
