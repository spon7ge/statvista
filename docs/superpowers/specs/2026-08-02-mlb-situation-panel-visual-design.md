# MLB situation panel visual refresh

Date: 2026-08-02  
Status: Approved  
Scope: Restyle the right column of `MlbLiveSituation` (`SituationPanel`) to match the provided mockup  
Audience: Frontend implementers of `MlbLiveSituation.tsx`

## Goal

Make the live-game **situation / call-value** column look like the reference mockup: compact diamond + count dots, a bordered Call Value card, then tight AT BAT / ON DECK / PITCHING blocks — without adding RE288, Statcast, or leverage-index data.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Restyle `SituationPanel` in place (no new API, no component split) |
| Call value content | ESPN win-% stakes only (`label` + `homeWinDelta`) |
| Call value chrome | Match mockup card layout; substitute ESPN fields for RE288/LI copy |
| Pitch zone (left) | Unchanged in this slice |
| Data / schema | No backend or OpenAPI changes |

## Non-goals

- RE288 / runs-at-stake / leverage-index engine or fake placeholders
- Refactor into separate files (`MlbBaseDiamond`, etc.)
- Changing pitch-zone layout or live-situation grid
- Attribution beyond existing ESPN / Stats sources already on the page

---

## 1. Layout (top → bottom)

Single `GameSection` column, compact vertical stack:

1. **Game state row** — diamond left, balls/strikes/outs dots right (left-aligned counts, not `justify-between` stretch).
2. **Call Value card** — only when `winProbability.stakes` is present; omit the whole card when null.
3. **Players** — AT BAT block, compact ON DECK line, PITCHING block.
4. **Drop** the standalone `latestPlayText` line from this panel (play text already lives in PBP / pitch list). If play context is needed later, it can return in a follow-up.

Spacing: tight gaps (~`space-y-3` / `gap-3`), smaller section padding (`!p-2.5`–`!p-3`).

---

## 2. Game state row

### Diamond

- Keep rotated-square base markers (1st / 2nd / 3rd).
- Occupied = filled red; empty = stroke only.
- Slightly smaller than current if needed so it sits flush with the count stack.

### Count dots

| Label | Total | Filled color |
| --- | --- | --- |
| Balls | 3 (show three slots; cap fill at 3 even if API sends 4) | white when filled |
| Strk | 2 | white when filled |
| Out | 2 | red when filled |

Mockup uses 3 / 2 / 2 slots (not 4 / 3 / 3). Match that visual convention.

Labels: short title case / abbrev as mockup (`Balls`, `Strk`, `Out`), muted gray, small caps tracking.

---

## 3. Call Value card

Bordered rounded container (`border border-white/10`, quiet surface — no new card chrome beyond the border).

| Region | Content |
| --- | --- |
| Header left | `CALL VALUE` (small uppercase muted) |
| Header right | Badge from abs win-% points, e.g. `2 pts` or `2.1 pts` from `\|homeWinDelta\| × 100` — red/pink muted pill (not “LI”) |
| Body primary | Prefer `stakes.label` as the main line (e.g. `≈ 4 pts win%` or existing backend label). Large/emphasis on the numeric portion when easy to parse; otherwise whole label at strong weight |
| Body secondary | Optional one-liner: signed home win delta in plain language, e.g. `home −2.1 pts` / `home +2.1 pts` from `homeWinDelta` — muted |
| Footer | `Data: ESPN win probability` (small muted) — **not** RE288 / Statcast |

When stakes are missing: render nothing (no empty card shell).

---

## 4. Player blocks

### AT BAT / PITCHING

- Label: small uppercase muted (`AT BAT`, `PITCHING`)
- Name: bold white
- Stats line: muted mono/tabular — `hand` · `summary` when present (e.g. `R · .280 AVG`). Hand stays on the stats line, not beside the name.

### ON DECK

- Single compact line: `ON DECK` (bold/white or muted label) + name + `· hand · summary` muted — matches mockup density.
- Omit entirely when `onDeck` is null.

Null players: omit that block (same as today for missing cards).

---

## 5. Tests

Update `MlbLiveSituation.test.tsx`:

- Still asserts at-bat name.
- Assert Call Value chrome when fixture has stakes (e.g. `CALL VALUE`, badge or label text).
- Do not require RE288 / LI strings.

No new backend tests.

---

## 6. Out of scope follow-ups

- Structured stakes fields (`runs_at_stake`, `leverage_index`) if a real engine is added later.
- Extracting presentational subcomponents.
- Syncing count-dot totals with official 4/3/3 baseball maxima if product prefers accuracy over mockup look.

---

## Approval

- [x] User reviewed this spec
- [x] Ready for implementation plan
