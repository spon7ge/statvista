# MLB live matchup + pitch zone high-fidelity redesign

Date: 2026-08-04  
Status: Approved for planning  
Reference: ESPN-style live card screenshot (Vilade @ Romano — matchup + pitch zone)  
Builds on: live Summary|Box center (`MlbLiveCenter`)

## Goal

Restyle the live Summary **left column** so the at-bat experience matches the ESPN-style screenshot: matchup card (headshots, bases, outs, count, batter/pitcher lines) stacked above a pitch-zone card (batter silhouette, zone grid, numbered pitches, multi-column pitch footer with spin). Keep play feed below that stack. Right rail, Box tab, and broadcast header stay as they are today.

## Decisions

| Topic | Choice |
| --- | --- |
| Placement | **A** — Left Summary column: matchup → pitch zone → play feed |
| Fidelity | **A** — High fidelity (layout + headshots + spin + silhouette) |
| Approach | **1** — Additive API fields + restyle existing `MlbLiveMatchupPanel` / `MlbPitchZone` |
| Right rail / Box / header | Unchanged |
| Surfaces | Keep statvista `GAME_SECTION_SURFACE` cards (rounded dark panels), not a new design system |
| Missing data | Omit fields/blocks; never invent spin, headshots, or stats |

## Layout

```
┌─ Live Summary (≥ lg) ─────────────────────────────────────┐
│ Left ~55%                         │ Right ~45%            │
│  ┌─ Matchup card ──────────────┐  │ Linescore             │
│  │ Batting logo  diamond  Pitch│  │ Team stats            │
│  │ Headshot name   outs  Head  │  │ Win prob              │
│  │ pos · AB line   count  IP…  │  │ Hit chart             │
│  └─────────────────────────────┘  │                       │
│  ┌─ Pitch zone card ───────────┐  │                       │
│  │ Batter SVG │ zone + pitches │  │                       │
│  │ Pitch footer cards (1…n)    │  │                       │
│  └─────────────────────────────┘  │                       │
│  Play feed (Scoring | All)        │                       │
└───────────────────────────────────┴───────────────────────┘
```

Mobile: same vertical order in the left stack; right rail stacks below as today.

## Components

| Piece | Change |
| --- | --- |
| `MlbLiveCenter` | Insert `MlbLiveMatchupPanel` above pitch zone (currently pitch-zone-only via `MlbLiveSituation`) |
| `MlbLiveMatchupPanel` | Restyle to screenshot: Batting/Pitching labels + logos; center diamond + white outs dots + large count; headshots; short name + position/hand; batter AB / pitcher IP ER K BB from existing `summary` (parse or display as-is) |
| `MlbPitchZone` | Restyle: remove “Pitch zone” title chrome if needed; batter silhouette SVG left of zone; home-plate cue; numbered markers (green ball / strike contrast); horizontal pitch footer cards with result, mph + type, optional spin line |
| `MlbLiveSituation` | Prefer composing matchup + `MlbPitchZone` directly in `MlbLiveCenter` (drop pitchZone-only wrapper on this path) so order is explicit |
| Final / scheduled | Untouched |

### Headshot UX

- Prefer MLB static headshot URL from player id.
- On image error → generic silhouette/placeholder (same asset family as batter figure if practical).
- No headshot id → show placeholder immediately.

### Pitch marker colors

- Ball / non-strike → green (screenshot accent).
- Strike / foul → red (or existing strike fill); keep numbered white/black text readable.

## Data / API (additive)

No new endpoints. Extend normalize in `backend/app/services/mlb_game_detail.py` + schemas; regenerate OpenAPI / frontend types; map in `mapMlbGameDetail.ts`.

| Field | Source | UI |
| --- | --- | --- |
| `MlbPlayerCard.id: int \| null` | Person `id` already resolved in `_situation` | Stable key; build headshot URL |
| `MlbPlayerCard.headshot_url: str \| null` | `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{id}/headshot/67/current` (or equivalent mlbstatic pattern already used in ecosystem) | Matchup portraits |
| `MlbPitch.spin_rate: float \| int \| null` | `pitchData.breaks.spinRate` | Footer “Spin: {n} rpm” |
| `MlbPitch.spin_direction: float \| int \| null` | `pitchData.breaks.spinDirection` | Footer “, {n} deg” |

Existing fields reused: balls/strikes/outs/runners, pitch `type` / `mph` / `result` / `zone_x` / `zone_y` / `is_strike`, player `name` / `hand` / `summary`, team logos/colors, box score position lookup (already in matchup panel).

### Pitcher / batter summary lines

Reuse existing `summary` strings from boxscore normalize (`_batter_card_summary`, `_pitcher_card_summary`). Display them under the name (screenshot: `0-2`, `0.2 IP 2 ER 2 K 1 BB`). Do not invent a second stats parser unless current summaries are empty/wrong in practice — then fix normalize in the same change.

## Edge cases

- No situation → omit matchup and pitch zone; play feed still shows.
- No pitches → zone empty + empty footer (or single “awaiting pitch” muted line).
- Missing spin → hide spin row only.
- Missing headshot / load fail → placeholder.
- Extra-inning / many pitches → footer wraps or horizontal scroll within the card; zone still plots all with coords.

## Testing

- Backend: normalize tests for `id` / `headshot_url` on situation cards; `spin_rate` / `spin_direction` from mutated `pitchData.breaks`.
- Frontend: `MlbLiveCenter` asserts matchup above pitch zone above play feed.
- Matchup: headshot img (or placeholder), count, outs, bases, batting/pitching labels.
- Pitch zone: numbered markers; footer shows mph/type; spin when present; omit spin when null.
- Final center regressions unchanged.
- OpenAPI regenerate + map types include new fields.

## Out of scope

- Changing final Summary layout
- Restoring team-toggle batters or mid-row linescore
- Share / social
- Full Statcast break lengths / induced break charts
- Licensed photo CDN beyond mlbstatic person headshots
- Replacing win prob / hit chart / play feed chrome

## Success criteria

1. Live Summary left column visually matches the screenshot composition (matchup over pitch zone).
2. Headshots and spin appear when Stats API provides them; degrade cleanly when not.
3. Play feed remains below; right rail and Box unchanged.
4. Polling / gamePk route wiring unchanged aside from composition and additive fields.
5. Mobile stacks without horizontal overflow of the page chrome.
