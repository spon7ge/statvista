# MLB Live Broadcast Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the live `/mlb/games/:gamePk` first viewport into a high-fidelity broadcast shell (split scores, matchup+diamond, linescore, team-toggle batters) while keeping pitch zone / PBP / win prob / hit chart below.

**Architecture:** Add focused live-shell components; compose them in `MlbGameDetailPage` live branch. Reuse existing `MlbGameDetailView` data. Extend batter rows with `hr` / `sb` from Stats API when wiring the screenshot columns. Do not change scheduled/final layouts.

**Tech Stack:** React, TypeScript, Vitest/RTL, Tailwind, existing MLB detail types/mappers

## Global Constraints

- Live first viewport only; secondary panels unchanged below
- High-fidelity visuals (colored slabs, large logos, pill toggle)
- No API contract break except additive batter fields (`hr`, `sb`)
- Scheduled / final pages unchanged
- Mobile stacks without horizontal overflow
- Follow existing `frontend/src/components/mlb/` patterns and tests

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/components/mlb/MlbLiveBroadcastHeader.tsx` | Status strip + split colored score slabs |
| `frontend/src/components/mlb/MlbLiveMatchupPanel.tsx` | Batter \| diamond/count \| pitcher (no pitch zone) |
| `frontend/src/components/mlb/MlbTeamToggleBatters.tsx` | Pill toggle + one batters table |
| `frontend/src/pages/MlbGameDetailPage.tsx` | Compose shell + lower panels |
| `backend/.../mlb_game_detail.py` + schemas | Add `hr` / `sb` on batter rows |
| `frontend/.../types.ts` + `mapMlbGameDetail.ts` | Pass through `hr` / `sb` |

---

### Task 1: Additive batter fields `hr` / `sb`

**Files:**
- Modify: `backend/app/schemas/mlb_game_detail.py` (`MlbBatterRow`)
- Modify: `backend/app/services/mlb_game_detail.py` (`_batter_row`)
- Modify: `frontend/src/components/mlb/types.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.ts`
- Modify: `backend/tests/test_mlb_game_detail_normalize.py` (or equivalent)
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.test.ts` / fixtures as needed

**Interfaces:**
- Produces: `MlbBatterRow` includes `hr: number | null`, `sb: number | null` from Stats `batting.homeRuns` / `batting.stolenBases`

- [ ] **Step 1: Extend backend schema + mapper**

```python
# MlbBatterRow fields
hr: int | None = None
sb: int | None = None

# in _batter_row:
hr=_int_or_none(batting.get("homeRuns")),
sb=_int_or_none(batting.get("stolenBases")),
```

- [ ] **Step 2: Mirror on frontend types + mapMlbGameDetail**

- [ ] **Step 3: Update normalize/map tests**

Run: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -q`  
Run: `cd frontend && npx vitest run src/components/mlb/mapMlbGameDetail.test.ts`

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/mlb_game_detail.py backend/app/services/mlb_game_detail.py backend/tests frontend/src/components/mlb/types.ts frontend/src/components/mlb/mapMlbGameDetail.ts frontend/src/components/mlb/mapMlbGameDetail.test.ts frontend/src/components/mlb/testFixtures.ts
git commit -m "feat: include HR and SB on MLB box-score batter rows"
```

---

### Task 2: `MlbLiveBroadcastHeader`

**Files:**
- Create: `frontend/src/components/mlb/MlbLiveBroadcastHeader.tsx`
- Create: `frontend/src/components/mlb/MlbLiveBroadcastHeader.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView` (`statusLabel`, `away`, `home`, `linescore` for outs if needed)
- Produces: status line + two colored score slabs (away left, home right)

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MlbLiveBroadcastHeader } from "./MlbLiveBroadcastHeader";
import { liveDetailFixture } from "./testFixtures"; // use existing live fixture

it("renders split scores and status", () => {
  render(<MlbLiveBroadcastHeader detail={liveDetailFixture} />);
  expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();
  expect(screen.getByText(String(liveDetailFixture.away.score))).toBeInTheDocument();
  expect(screen.getByText(String(liveDetailFixture.home.score))).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement header**

Layout:
- Top: centered/left status text from `detail.statusLabel`; optional share button as non-functional `<button type="button" aria-label="Share">` only if trivial (no backend).
- Grid `grid-cols-2`: each slab `style={{ backgroundColor: team.color }}` with dark overlay (`bg-black/25` or similar) for text contrast.
- Content: logo (large ~12–14), abbrev, score (huge mono). Record omitted unless already on team type (do not invent).

- [ ] **Step 3: Run test — PASS**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveBroadcastHeader.test.tsx`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveBroadcastHeader.tsx frontend/src/components/mlb/MlbLiveBroadcastHeader.test.tsx
git commit -m "feat: add MLB live broadcast split-score header"
```

---

### Task 3: `MlbLiveMatchupPanel`

**Files:**
- Create: `frontend/src/components/mlb/MlbLiveMatchupPanel.tsx`
- Create: `frontend/src/components/mlb/MlbLiveMatchupPanel.test.tsx`
- Optionally extract shared `BaseDiamond` / outs dots from `MlbLiveSituation.tsx` into a small shared module to avoid duplication — preferred if copy would exceed ~40 lines.

**Interfaces:**
- Consumes: `detail.situation`, team logos/colors for batter/pitcher sides
- Produces: three-column matchup card (batter | diamond+count+outs | pitcher)

- [ ] **Step 1: Failing test — renders batter/pitcher names and count**

- [ ] **Step 2: Implement panel**

- Left: batter name, position if in name/summary, `atBat.summary`
- Center: bases diamond (occupied filled white or team accent), outs dots, count as `{balls} - {strikes}`
- Right: pitcher name, hand, `pitching.summary`
- No pitch zone, no CALL VALUE in this card

- [ ] **Step 3: Tests pass; commit**

```bash
git commit -m "feat: add MLB live matchup panel with diamond and count"
```

---

### Task 4: `MlbTeamToggleBatters`

**Files:**
- Create: `frontend/src/components/mlb/MlbTeamToggleBatters.tsx`
- Create: `frontend/src/components/mlb/MlbTeamToggleBatters.test.tsx`

**Interfaces:**
- Consumes: `detail.away`, `detail.home`, `detail.boxScore`
- Produces: pill toggle (default batting team: if `inningHalf === "top"` show away, else home — or default away); batters table columns `AB R H RBI HR SB BB K`

- [ ] **Step 1: Failing test — toggle switches visible team name and rows**

- [ ] **Step 2: Implement**

```tsx
const COLS = ["AB", "R", "H", "RBI", "HR", "SB", "BB", "K"] as const;
// values from batter.ab, r, h, rbi, hr, sb, bb, so
```

Pill UI: selected white/light fill, unselected muted. Use team **names** (Padres / Diamondbacks) from `team.name` (shorten to last word if needed for space).

- [ ] **Step 3: Tests pass; commit**

```bash
git commit -m "feat: add team-toggle batters table for MLB live shell"
```

---

### Task 5: Compose live page first viewport

**Files:**
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx`
- Modify/add: page-level test if present (`MlbGameDetailPage` tests) or extend an existing live-center test

**Interfaces:**
- Consumes: Tasks 2–4 components + existing `MlbLinescore`, `MlbLiveSituation` (pitch zone path), etc.

- [ ] **Step 1: Restructure live return**

```tsx
<div data-testid="mlb-live-center" className="space-y-4">
  <MlbLiveBroadcastHeader detail={detail} />
  <div className="grid gap-4 lg:grid-cols-5">
    <div className="lg:col-span-3">
      <MlbLiveMatchupPanel detail={detail} />
    </div>
    <div className="lg:col-span-2">
      <MlbLinescore detail={detail} />
    </div>
  </div>
  <MlbTeamToggleBatters detail={detail} />

  {/* secondary — unchanged order conceptually */}
  <MlbLiveSituation detail={detail} pitchZoneOnly /> {/* or render MlbPitchZone + strip situation duplicate */}
  <MlbPlayByPlay detail={detail} />
  <MlbBoxScore detail={detail} /> {/* keep full dual box incl pitchers below */}
  <div data-testid="mlb-live-viz-row" className="grid ...">
    <MlbWinProbability ... />
    <MlbHitChart ... />
  </div>
</div>
```

**Avoid duplicate situation UI:** Prefer adding `variant?: "full" | "pitchZone"` to `MlbLiveSituation`, or render `MlbPitchZone` alone below. Do not show two diamonds.

- [ ] **Step 2: Soften duplicate chrome** — live page chrome already shows status; broadcast header also shows status. Keep page Back + attribution; broadcast header owns the in-game “Top 9 · 0 outs” line. Avoid triple status labels — trim redundant red status from old `MlbGameHeader` (no longer used on live).

- [ ] **Step 3: Run frontend mlb tests**

Run: `cd frontend && npx vitest run src/components/mlb src/pages/MlbGameDetailPage.test.tsx`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: compose MLB live broadcast shell as first viewport"
```

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Split colored score header | Task 2 |
| Matchup + diamond | Task 3 |
| Linescore beside matchup | Task 5 |
| Team toggle batters (+ HR/SB cols) | Tasks 1 + 4 |
| Secondary panels below | Task 5 |
| Live only | Task 5 (scheduled/final untouched) |

## Placeholder scan

None. Record omitted if not on team model. Share button optional/non-functional.
