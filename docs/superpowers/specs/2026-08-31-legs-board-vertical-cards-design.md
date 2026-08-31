# Legs board — vertical PLAY cards

Date: 2026-08-31  
Status: Approved  
Product: statvista  
Related: `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md`; `docs/superpowers/specs/2026-08-30-wnba-legs-design.md`

## Goal

Strip research / timestamp / payouts chrome from `/mlb/legs` and `/wnba/legs`. Put **breakeven: x%** on the format/size chip row. Each PLAY is a vertical card (headshot, matchup, player, market line). Click still expands the book audit.

## Non-goals

- Pricer, packer, payouts, Over-only markets
- Ranked leftover PLAY, overlapping cards
- Multi-column Prop Picks grid
- NBA Legs

## Decisions

| Topic | Choice |
| --- | --- |
| Surface | Shared `features/legs/LegsBoard` (MLB + WNBA) |
| Removed copy | “Recommended entries…”, `Generated …`, “Assumed payouts · base required margin…”, “PLAY break-even …”, format difficulty notes |
| Break-even | Far right of the format + size chip row: `breakeven: 54.1%` from `base_break_even` |
| Closed card | Headshot (initials fallback) → matchup (`NYY @ BOS`) → player name → `Stolen Bases 0.5 Under 93.2% +39.1` |
| Click | Same `<details>` audit as today (sharp anchor, books, hold, weight) |
| Photo | `LegsPlay.headshot_url` from ESPN roster already loaded by the assembler. `null` → initials |
| Entry heading | Keep “Entry N” |

## API

`LegsPlay.headshot_url: str | None`. Assemblers copy `roster[player].headshot_url`. Missing roster → `null`. OpenAPI regen.

## Success criteria

1. Those five chrome strings are gone.
2. Chip row shows `breakeven: {base_break_even as 1 decimal %}`.
3. Packed PLAY shows photo or initials, matchup, name, market/line/side/fair/margin.
4. Click still reveals the book audit.
5. WNBA board is the same component; no WNBA-only chrome.
