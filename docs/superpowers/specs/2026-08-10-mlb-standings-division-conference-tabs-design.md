# MLB standings Division / Conference tabs

Date: 2026-08-10  
Status: Approved (pending implementation)  
Related: `docs/superpowers/specs/2026-08-07-mlb-standings-design.md`

## Goal

On `/mlb/standings`, add **Division** and **Conference** tabs under the existing navy standings header so users can switch between the current six-division layout and full American / National League tables.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | MLB standings page only; WNBA / NBA unchanged |
| Tab labels | **Division** \| **Conference** (Conference = full AL / NL league tables) |
| Default tab | Division |
| Data | Frontend-only; reuse `GET /api/mlb/standings` — no backend/schema change |
| Conference ranking | Sort each league’s teams by `pct` desc, then `wins` desc; recompute `#` and `GB` vs league leader |
| URL state | None in v1 (local React state) |
| Tab chrome | Same underline tablist pattern as MLB Prop Picks / Final Summary\|Box |
| Card UI | Reuse division card table styling for conference league tables |

## Architecture

```
MlbStandingsPage
  ├── LeagueSubnav
  ├── MlbStandingsHeader (season + Division|Conference tabs)
  └── MlbStandingsGrid (view = division | conference)
        ├── division → AL/NL sections → 3× MlbStandingsDivisionCard each
        └── conference → 2× league cards (AL, NL) from derived rows
```

### Derivation (conference)

For each league in `leagues`:

1. Flatten `divisions[].teams` into one list (dedupe by `team_id` if needed).
2. Sort by numeric `pct` descending, then `wins` descending.
3. Assign `rank` = 1…N in that order.
4. Recompute `gb` relative to the first team using standard games-back:
   `((leader.wins - team.wins) + (team.losses - leader.losses)) / 2`
   — leader shows `-`; others show one decimal when half-game (e.g. `1.5`), else integer string when whole.
5. Keep `wl`, `pct`, `l10`, `streak`, logos/abbrevs from the source row.

Pure helper (e.g. `buildMlbConferenceStandings(leagues)`) kept unit-tested and free of React.

## UI

### Header tabs

- Place a centered `role="tablist"` under the navy banner (inside `MlbStandingsHeader` wrapper, matching Prop Picks spacing).
- Tabs: Division, Conference; `aria-selected` / `aria-controls` wired to the grid panel.
- Active: white text + white bottom border; inactive: muted white.

### Division view

Unchanged from current page: AL then NL section titles, three division cards each, same columns.

### Conference view

- No outer “American League” / “National League” section titles above a multi-card grid (the card titles are the section).
- Two cards side by side when space allows (`grid-cols-1` → `lg:grid-cols-2`):
  - **American League** — up to 15 teams
  - **National League** — up to 15 teams
- Same columns as division cards: `#`, Team, `W-L`, `PCT`, `GB`, `L10`, Strk.
- Prefer generalizing the existing table card to accept `{ key, label, teams }` so division and conference share one presentational component (or thin wrappers).

### States

| State | Behavior |
| --- | --- |
| Loading / error / empty | Same as today for both tabs |
| Conference with empty league | Card still renders with “No data” |
| Tab switch | Instant; no refetch |

## Testing

- Header: tablist with Division + Conference; Division selected by default; click selects Conference.
- Helper: sort order, GB for leader `-`, half-game GB, empty input.
- Grid: Division still shows division labels (e.g. AL East); Conference shows two league cards with recomputed ranks.
- Page wiring: switching tabs updates visible grid without breaking loading/error.

## Out of scope

- Wild-card standings tab
- Backend `leagueRank` / `leagueGamesBack` fields
- URL query sync (`?view=conference`)
- Season switcher
- WNBA standings changes

## Success criteria

- Standings header exposes Division and Conference tabs.
- Division matches current behavior.
- Conference shows full AL and NL tables ranked league-wide with recomputed `#` / `GB`.
- No API or schema changes.
