# Prop board Proposition — drop matchup next to name

Date: 2026-10-16  
Status: Approved (design)  
Applies to: `/mlb/prop_picks`, `/wnba/prop_picks`, `/nba/prop_picks`  
Does not change the API or filters.

## Goal

The Proposition column shows the player name and market label only. The game matchup string next to the name (e.g. `NYY @ BOS`) is removed. Users still narrow by game with the Game filter.

## Decisions

| Topic | Choice |
| --- | --- |
| Leagues | MLB, WNBA, and NBA. Same change in each `*PropPicksTable` `CompositeCell`. |
| Keep | Headshot/logo stack, player name (`board-row-name`), market label (`board-row-market`). |
| Remove | Matchup text and the separator dot (`board-row-matchup`). |
| Game filter | Unchanged. |
| API / schemas | Unchanged. Team abbrevs may still arrive on the row for filtering and logos. |

## UI

In `MlbPropPicksTable.tsx`, `WnbaPropPicksTable.tsx`, and `NbaPropPicksTable.tsx`, simplify `CompositeCell` so the headline row is only the player name. Drop the `{matchup ? …}` branch. `formatMatchup` may be deleted if unused after that.

## Docs and tests

- Optionally clarify in `md/system-design.md` that Proposition is player name + market (no matchup beside the name). Only needed if current copy implies otherwise.
- Update each league’s table tests: remove `board-row-matchup` expectations; keep name and market assertions.

## Out of scope

- Backend board assembly
- Game filter behavior
- Shared Proposition cell package across leagues
