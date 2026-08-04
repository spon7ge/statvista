# MLB live game first-viewport restructure (broadcast shell)

Date: 2026-08-03  
Status: Approved for planning

## Goal

Restructure the **live** branch of `/mlb/games/:gamePk` so the **first viewport** matches the provided broadcast-style screenshot (high fidelity), while leaving pitch zone, play-by-play, win probability, and hit chart **below** as they are today.

Scheduled and final game layouts are out of scope.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Live first viewport only; secondary panels unchanged below |
| Visual fidelity | High — colored split score slabs, large logos, matchup row, pill team toggle |
| Data | Reuse existing `MlbGameDetail` / mapped view models (no API changes) |
| Approach | Restructure composition; extract/reuse linescore + situation data into new shell pieces |
| Scheduled / final | Unchanged |

## First-viewport layout

```
┌──────────────────────────────────────────────────────────┐
│ Status: "Top/Bot {N} · {outs} outs"            [share?]  │
├────────────────────────────┬─────────────────────────────┤
│ Away color slab            │ Home color slab             │
│ logo · abbrev · record*    │ record* · abbrev · logo     │
│ large score                │ large score                 │
├────────────────────────────┴─────────────────────────────┤
│ Matchup card                         │ Linescore card    │
│ Batter | diamond+count+outs | Pitcher│ 1–9 + R H E       │
├──────────────────────────────────────────────────────────┤
│ [ Away team | Home team ] pill toggle                    │
│ Batters table: AB R H RBI HR SB BB K                     │
└──────────────────────────────────────────────────────────┘
… existing MlbPitchZone / MlbPlayByPlay / MlbWinProbability / MlbHitChart …
```

\* Record shown when available from scoreboard/detail payload; omit if missing.

### Desktop (≥ lg)

- Status strip full width.
- Split score header: two equal colored columns.
- Mid row: matchup (~60%) | linescore (~40%).
- Batters toggle + table full width.

### Mobile

- Stack: status → split scores (still side-by-side if space allows, else stacked) → matchup → linescore → toggle + batters.

## Components (planned)

| Piece | Responsibility |
| --- | --- |
| `MlbLiveBroadcastHeader` (new or replace `MlbGameHeader` live usage) | Status line + split colored score slabs |
| `MlbLiveMatchupPanel` (refactor from `MlbLiveSituation` situation half) | Batter / diamond / pitcher; no pitch zone in this card |
| `MlbLinescore` | Reuse; restyle for card-in-mid-row; highlight current half-inning |
| `MlbTeamToggleBoxScore` (new mode of `MlbBoxScore` or wrapper) | Pill toggle; show one team’s batters table; columns match screenshot |

Pitch zone stays in the lower live section (current `MlbLiveSituation` pitch-zone half can move below or remain in a secondary row — not in the first-viewport matchup card).

## Visual rules

- Away/home slab backgrounds use `team.color` (darken/overlay for readability if needed).
- Scores large, high-contrast white (or near-white) mono.
- Bases diamond: occupied bases filled; outs as three dots; count as `balls - strikes`.
- Team toggle: selected pill filled light, unselected muted — match screenshot pattern.
- Keep StatVista page chrome (back link, etc.) above this shell; shell itself is high-fidelity.

## Out of scope

- API / backend changes
- Scheduled and final page redesign
- Changing win-prob / hit-chart / PBP behavior below the fold
- Share button functionality (optional UI affordance only if trivial; no new share backend)

## Success criteria

1. Live game first viewport visually matches the reference composition (split scores, matchup+diamond, linescore, toggle batters).
2. Lower live panels still render without regression.
3. Existing live polling / data mapping unchanged.
4. Mobile stacks without horizontal overflow.
