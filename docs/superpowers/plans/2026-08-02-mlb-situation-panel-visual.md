# MLB Situation Panel Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `SituationPanel` in `MlbLiveSituation.tsx` to match the mockup (diamond + counts, ESPN Call Value card, compact player blocks) with no API changes.

**Architecture:** In-place restyle of the existing right-column panel. Call Value uses `winProbability.stakes` (`label` + `homeWinDelta`) only. Count dots use mockup slot totals 3/2/2.

**Tech Stack:** React 19, Vitest + Testing Library, existing `GameSection` / `GAME_SECTION_SURFACE` patterns.

## Global Constraints

- No RE288 / Statcast / leverage-index copy or fake placeholders
- No backend / OpenAPI / schema changes
- Pitch zone (left column) unchanged
- Omit Call Value card when `stakes` is null
- Drop standalone `latestPlayText` from this panel

## File map

| File | Role |
| --- | --- |
| `frontend/src/components/mlb/MlbLiveSituation.tsx` | Restyle `SituationPanel` + helpers |
| `frontend/src/components/mlb/MlbLiveSituation.test.tsx` | Assert Call Value chrome + at-bat name |
| `docs/superpowers/specs/2026-08-02-mlb-situation-panel-visual-design.md` | Spec (already written) |

---

### Task 1: Failing tests for Call Value chrome

**Files:**
- Modify: `frontend/src/components/mlb/MlbLiveSituation.test.tsx`
- Modify: `frontend/src/components/mlb/MlbLiveSituation.tsx` (Task 2)

**Interfaces:**
- Consumes: `mlbLiveDetail` fixture (`winProbability.stakes.label === "On this pitch"`, `homeWinDelta: -2.1`)
- Produces: Tests expecting `CALL VALUE`, a pts badge derived from delta, and ESPN footer

- [ ] **Step 1: Write the failing test**

Replace `MlbLiveSituation.test.tsx` with:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbLiveSituation } from "./MlbLiveSituation";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLiveSituation", () => {
  it("renders at-bat name and ESPN call value card from stakes", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} />);
    expect(screen.getByText("Mookie Betts")).toBeInTheDocument();
    expect(screen.getByText("CALL VALUE")).toBeInTheDocument();
    expect(screen.getByText(/2\.1\s*pts/i)).toBeInTheDocument();
    expect(screen.getByText("On this pitch")).toBeInTheDocument();
    expect(screen.getByText(/Data:\s*ESPN win probability/i)).toBeInTheDocument();
  });

  it("uses compact count labels and on-deck line", () => {
    render(<MlbLiveSituation detail={mlbLiveDetail} />);
    expect(screen.getByText("Strk")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByText(/ON DECK/i)).toBeInTheDocument();
    expect(screen.getByText(/Freddie Freeman/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/mlb/MlbLiveSituation.test.tsx`
Expected: FAIL — missing `CALL VALUE` / badge / ESPN footer / `Strk`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveSituation.test.tsx
git commit -m "test(mlb): assert situation panel call value chrome"
```

---

### Task 2: Restyle SituationPanel

**Files:**
- Modify: `frontend/src/components/mlb/MlbLiveSituation.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView.situation`, `winProbability?.stakes`
- Produces: Mockup layout; helper `formatStakesBadge(delta: number): string` → e.g. `"2.1 pts"`

- [ ] **Step 1: Implement panel restyle**

Update helpers and `SituationPanel` in `MlbLiveSituation.tsx`:

1. `CountDots`: labels `Balls` / `Strk` / `Out`; totals **3 / 2 / 2**; balls+strikes filled `bg-white`, outs filled `bg-red-400`; empty `bg-transparent` with `ring-1 ring-white/30` (or `border`) to match hollow dots.
2. Game state row: `flex items-start gap-4` (diamond then counts), not stretched `justify-between`.
3. `CallValueCard({ stakes })`:
   - Header: `CALL VALUE` + badge `formatStakesBadge(Math.abs(stakes.homeWinDelta))`
   - Primary: `stakes.label`
   - Secondary: `home ${stakes.homeWinDelta >= 0 ? "+" : ""}${(stakes.homeWinDelta * 100).toFixed(1)} pts` (delta is already in fraction win% — fixture uses `-2.1` which appears to be **points already**, not fraction; check fixture)

**Delta units note:** Fixture `homeWinDelta: -2.1` and bridge stores raw ESPN delta then label uses `delta * 100`. Confirm in `mapMlbGameDetail` / schema whether UI `homeWinDelta` is fraction (−0.021) or points (−2.1). Badge must use points for display: if value is fraction, multiply by 100; if already points (abs > 1 common), use as-is. Implement:

```ts
function stakesPoints(delta: number): number {
  // ESPN bridge stores fractional win%; mapper may pass through.
  // Treat |delta| <= 1 as fraction, else already points.
  return Math.abs(delta) <= 1 ? Math.abs(delta) * 100 : Math.abs(delta);
}

function formatStakesBadge(delta: number): string {
  const pts = stakesPoints(delta);
  const text = Number.isInteger(pts) ? String(pts) : pts.toFixed(1);
  return `${text} pts`;
}
```

Verify against fixture `-2.1` → badge `2.1 pts`.

4. Players: AT BAT / PITCHING with hand+summary on muted mono line; ON DECK single line `ON DECK {name} · {hand} · {summary}`.
5. Remove `latestPlayText` from panel.
6. Compact padding: `GameSection className="!p-2.5 space-y-3"`.

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/components/mlb/MlbLiveSituation.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveSituation.tsx frontend/src/components/mlb/MlbLiveSituation.test.tsx
git commit -m "feat(mlb): restyle situation panel to call-value mockup"
```

---

### Task 3: Mark spec approved + verify

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-mlb-situation-panel-visual-design.md` (status → Approved)

- [ ] **Step 1: Update spec status checkboxes**

Set `Status: Approved` and check approval boxes.

- [ ] **Step 2: Run related MLB situation tests**

Run: `cd frontend && npm test -- src/components/mlb/MlbLiveSituation.test.tsx src/components/mlb/MlbPitchZone.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-02-mlb-situation-panel-visual-design.md
git commit -m "docs: approve MLB situation panel visual design"
```
