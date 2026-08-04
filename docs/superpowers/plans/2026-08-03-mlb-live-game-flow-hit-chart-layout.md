# MLB live Game flow + Hit chart layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On live `/mlb/game/:gamePk`, put compact Game flow beside Hit chart (2/3–1/3 at `lg+`, stacked below).

**Architecture:** Page-only `lg:grid-cols-3` viz row in `MlbGameDetailPage`. Optional `compact` on `MlbWinProbability` selects height-280 chart geometry from `mlbWinProbabilityPaths` so path math matches the SVG.

**Tech Stack:** React 19, Tailwind, Vitest + Testing Library.

## Global Constraints

- Live only; `MlbFinalCenter` unchanged (no `compact`)
- Compact viewBox height **280**, default **520**, width **640**
- Viz row `data-testid="mlb-live-viz-row"`
- No backend / OpenAPI changes
- Branding: **statvista**

## File map

| File | Role |
| --- | --- |
| `frontend/src/components/mlb/mlbWinProbabilityPaths.ts` | Geometry factory + helpers use active geometry |
| `frontend/src/components/mlb/mlbWinProbabilityPaths.test.ts` | Assert compact `yForPct` / geometry |
| `frontend/src/components/mlb/MlbWinProbability.tsx` | Accept `compact?: boolean`; use selected geometry |
| `frontend/src/components/mlb/MlbWinProbability.test.tsx` | Assert compact vs default viewBox height |
| `frontend/src/pages/MlbGameDetailPage.tsx` | Live viz row grid + `compact` |
| `frontend/src/pages/MlbGameDetailPage.test.tsx` | Assert `mlb-live-viz-row` |

**Spec:** `docs/superpowers/specs/2026-08-03-mlb-live-game-flow-hit-chart-layout-design.md`

---

### Task 1: Compact chart geometry

**Files:**
- Modify: `frontend/src/components/mlb/mlbWinProbabilityPaths.ts`
- Modify: `frontend/src/components/mlb/mlbWinProbabilityPaths.test.ts`

**Interfaces:**
- Produces: `ChartGeometry` type; `getChartGeometry(compact?: boolean)`; `CHART_GEOMETRY` remains default (520); `xForIndex` / `yForPct` / `nearestIndexForClientX` / `buildSeriesPathD` / `buildSplitSeriesPaths` accept optional `geometry?: ChartGeometry` (default `CHART_GEOMETRY`)

- [ ] **Step 1: Write the failing test**

Replace `mlbWinProbabilityPaths.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  getChartGeometry,
  toDisplayPct,
  yForPct,
} from "./mlbWinProbabilityPaths";

describe("mlbWinProbabilityPaths", () => {
  it("converts API 0–1 home_win_pct to display percent", () => {
    expect(toDisplayPct(0.48)).toBe(48);
  });

  it("exposes compact geometry with height 280", () => {
    const compact = getChartGeometry(true);
    expect(compact.height).toBe(280);
    expect(compact.width).toBe(640);
    expect(getChartGeometry(false).height).toBe(520);
  });

  it("maps 50% to vertical midpoint for compact geometry", () => {
    const g = getChartGeometry(true);
    const mid = yForPct(50, g);
    expect(mid).toBe(g.padTop + g.plotHeight / 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/mlb/mlbWinProbabilityPaths.test.ts`  
Expected: FAIL — `getChartGeometry` not exported / arity

- [ ] **Step 3: Implement geometry helpers**

In `mlbWinProbabilityPaths.ts`:

```ts
export type ChartGeometry = {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  plotWidth: number;
  plotHeight: number;
  yLabelX: number;
};

const PAD_LEFT = 20;
const PAD_RIGHT = 72;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const WIDTH = 640;

function buildGeometry(height: number): ChartGeometry {
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  return {
    width: WIDTH,
    height,
    padLeft: PAD_LEFT,
    padRight: PAD_RIGHT,
    padTop: PAD_TOP,
    padBottom: PAD_BOTTOM,
    plotWidth,
    plotHeight,
    yLabelX: PAD_LEFT - 8,
  };
}

export const CHART_GEOMETRY = buildGeometry(520);
export const COMPACT_CHART_GEOMETRY = buildGeometry(280);

export function getChartGeometry(compact = false): ChartGeometry {
  return compact ? COMPACT_CHART_GEOMETRY : CHART_GEOMETRY;
}

export const PLOT_WIDTH = CHART_GEOMETRY.plotWidth;
export const PLOT_HEIGHT = CHART_GEOMETRY.plotHeight;

// Update xForIndex, yForPct, nearestIndexForClientX, buildSeriesPathD
// to take optional geometry (default CHART_GEOMETRY) and use g.padLeft etc.
// buildSplitSeriesPaths(..., geometry?) forwards geometry to buildSeriesPathD.
```

Keep `toDisplayPct` unchanged. Preserve existing path-building behavior when geometry omitted.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npm test -- src/components/mlb/mlbWinProbabilityPaths.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/mlbWinProbabilityPaths.ts frontend/src/components/mlb/mlbWinProbabilityPaths.test.ts
git commit -m "feat(mlb): add compact win-probability chart geometry"
```

---

### Task 2: `MlbWinProbability` compact prop

**Files:**
- Modify: `frontend/src/components/mlb/MlbWinProbability.tsx`
- Modify: `frontend/src/components/mlb/MlbWinProbability.test.tsx`

**Interfaces:**
- Consumes: `getChartGeometry`, helpers with geometry arg
- Produces: `MlbWinProbability({ detail, compact?: boolean })`

- [ ] **Step 1: Write the failing test**

Add to `MlbWinProbability.test.tsx`:

```tsx
  it("uses compact viewBox height when compact is set", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} compact />);
    expect(screen.getByLabelText("Win probability chart")).toHaveAttribute(
      "viewBox",
      "0 0 640 280",
    );
  });

  it("uses default viewBox height without compact", () => {
    render(<MlbWinProbability detail={mlbLiveDetail} />);
    expect(screen.getByLabelText("Win probability chart")).toHaveAttribute(
      "viewBox",
      "0 0 640 520",
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/mlb/MlbWinProbability.test.tsx`  
Expected: FAIL — no `compact` / viewBox still 520 when compact

- [ ] **Step 3: Wire compact into component**

```tsx
export function MlbWinProbability({
  detail,
  compact = false,
}: {
  detail: MlbGameDetailView;
  compact?: boolean;
}) {
  const geometry = getChartGeometry(compact);
  // use geometry for viewBox, midY, paths, scrub X/Y, clock offsets
  // pass geometry into buildSplitSeriesPaths / xForIndex / yForPct / nearestIndexForClientX
}
```

Replace `CHART_GEOMETRY.*` usages with `geometry.*`. Scale clock overlap threshold proportionally if needed (`padTop + 22` still fine at 280).

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npm test -- src/components/mlb/MlbWinProbability.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbWinProbability.tsx frontend/src/components/mlb/MlbWinProbability.test.tsx
git commit -m "feat(mlb): support compact Game flow chart"
```

---

### Task 3: Live page viz row

**Files:**
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx`
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx`

**Interfaces:**
- Consumes: `MlbWinProbability` with `compact`; `MlbHitChart`
- Produces: `data-testid="mlb-live-viz-row"` grid

- [ ] **Step 1: Write the failing test**

In the live success test in `MlbGameDetailPage.test.tsx`, after finding `mlb-live-center`, add:

```tsx
    expect(await screen.findByTestId("mlb-live-viz-row")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/pages/MlbGameDetailPage.test.tsx`  
Expected: FAIL — missing `mlb-live-viz-row`

- [ ] **Step 3: Update live layout**

In the live return of `MlbGameDetailPage.tsx`, replace stacked:

```tsx
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
```

with:

```tsx
        <div
          data-testid="mlb-live-viz-row"
          className="grid items-start gap-4 lg:grid-cols-3"
        >
          <div className="lg:col-span-2">
            <MlbWinProbability detail={detail} compact />
          </div>
          <MlbHitChart detail={detail} />
        </div>
```

- [ ] **Step 4: Run related tests — expect PASS**

Run: `cd frontend && npm test -- src/pages/MlbGameDetailPage.test.tsx src/components/mlb/MlbFinalCenter.test.tsx src/components/mlb/MlbWinProbability.test.tsx src/components/mlb/mlbWinProbabilityPaths.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MlbGameDetailPage.tsx frontend/src/pages/MlbGameDetailPage.test.tsx
git commit -m "feat(mlb): place live Game flow beside Hit chart"
```

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Live `lg:grid-cols-3`, flow `col-span-2` | Task 3 |
| Mobile stack | Task 3 (default grid stack) |
| `compact` height 280 | Tasks 1–2 |
| Final unchanged | Task 3 (no FinalCenter edits) |
| `mlb-live-viz-row` | Task 3 |
| Path helpers use active geometry | Task 1 |
