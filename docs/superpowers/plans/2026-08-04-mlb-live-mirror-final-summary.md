# MLB Live Mirror Final Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the live `/mlb/games/:gamePk` center to mirror final Summary | Box, with pitch zone above the play feed and linescore (inn runs) at the top of the right rail.

**Architecture:** Add `MlbLiveCenter` modeled on `MlbFinalCenter`. Upgrade `MlbLiveBroadcastHeader` to final-style slabs + Summary | Box tabs (no winner emphasis; live status + pulse). Reuse final play feed, linescore card, team stats, box score, win prob, and hit chart. Drop matchup panel, team-toggle batters, and the below-fold viz row from the live page path. No API changes.

**Tech Stack:** React 19, TypeScript, Vitest/RTL, Tailwind, existing `frontend/src/components/mlb/*`

## Global Constraints

- Live branch only; final and scheduled unchanged
- Pitch zone above play feed on Summary left
- Linescore at top of Summary right rail (no W/L/S while live / when decisions null)
- No winner ring or winner score-size split on live
- Reuse final components where possible; do not invent a shared status-agnostic center in this change
- No backend / OpenAPI changes
- Share button is non-functional UI affordance only
- Product name remains **statvista** in any user-facing copy
- Follow `md/claude.md` and existing `frontend/src/components/mlb/` patterns
- Branding / page ↔ API: update `md/system-design.md` live game-detail wording only if the row text becomes inaccurate

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/components/mlb/MlbLiveBroadcastHeader.tsx` | Final-style header + live pulse + Summary \| Box tabs |
| `frontend/src/components/mlb/MlbLiveBroadcastHeader.test.tsx` | Header + tabs coverage |
| `frontend/src/components/mlb/MlbLiveCenter.tsx` | Live Summary/Box composition |
| `frontend/src/components/mlb/MlbLiveCenter.test.tsx` | Layout order + tab switching |
| `frontend/src/pages/MlbGameDetailPage.tsx` | Wire live branch to `MlbLiveCenter` |
| `frontend/src/pages/MlbGameDetailPage.test.tsx` | Assert new live composition; drop old shell asserts |
| `frontend/src/components/mlb/testFixtures.ts` | Ensure live fixture has `gameDateLabel` when useful for header tests |
| `md/system-design.md` | Only if live game-detail description needs a one-line refresh |

---

### Task 1: Upgrade `MlbLiveBroadcastHeader` to final-style + tabs

**Files:**
- Modify: `frontend/src/components/mlb/MlbLiveBroadcastHeader.tsx`
- Modify: `frontend/src/components/mlb/MlbLiveBroadcastHeader.test.tsx`
- Modify: `frontend/src/components/mlb/testFixtures.ts` (set `mlbLiveDetail.gameDateLabel` to `"Today"`)

**Interfaces:**
- Consumes: `MlbGameDetailView` from `./types`
- Produces:
  - `export type LiveTab = "summary" | "box"`
  - `MlbLiveBroadcastHeader({ detail, activeTab, onTabChange }: { detail: MlbGameDetailView; activeTab: LiveTab; onTabChange: (tab: LiveTab) => void })`
  - Root `data-testid="mlb-broadcast-header"` (keep existing id for page tests)
  - Tablist `aria-label="Live game details"`
  - Tab ids: `mlb-live-summary-tab`, `mlb-live-box-tab`
  - Panel ids referenced via `aria-controls`: `mlb-live-summary-panel`, `mlb-live-box-panel`
- Score slabs: final-style layout (logo centered, record + abbrev, large score) with **no** `data-winner` / winner ring / score-size split
- Status row: `gameDateLabel` (left), live `statusLabel` with red pulse when `status === "live" || status === "halftime"` (center), Share button (right)

- [ ] **Step 1: Update live fixture date label**

In `testFixtures.ts`, set `mlbLiveDetail.gameDateLabel` from `null` to `"Today"`.

- [ ] **Step 2: Rewrite failing header tests**

Replace `MlbLiveBroadcastHeader.test.tsx` with:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbLiveBroadcastHeader } from "./MlbLiveBroadcastHeader";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLiveBroadcastHeader", () => {
  it("renders date, live status with pulse, scores, records chrome, and tabs", () => {
    const onTabChange = vi.fn();
    render(
      <MlbLiveBroadcastHeader
        detail={mlbLiveDetail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(mlbLiveDetail.statusLabel)).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbLiveDetail.away.score)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(String(mlbLiveDetail.home.score)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: /live game details/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /summary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /box/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-score-slab-away")).toHaveAttribute(
      "data-winner",
      "false",
    );
    expect(screen.queryByTestId("mlb-live-score-slab-home")).toHaveAttribute(
      "data-winner",
      "false",
    );
  });

  it("calls onTabChange when Box is selected", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <MlbLiveBroadcastHeader
        detail={mlbLiveDetail}
        activeTab="summary"
        onTabChange={onTabChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /box/i }));
    expect(onTabChange).toHaveBeenCalledWith("box");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveBroadcastHeader.test.tsx`

Expected: FAIL (missing `activeTab` / tabs / new slab testids)

- [ ] **Step 4: Implement header**

Rewrite `MlbLiveBroadcastHeader.tsx` by adapting `MlbFinalBroadcastHeader.tsx`:

- Export `LiveTab = "summary" | "box"`
- Keep root `data-testid="mlb-broadcast-header"`
- Status center: pulse + `statusLabel` in `text-red-400` when in progress (copy pulse pattern from current live header)
- Date left: `detail.gameDateLabel ?? ""`
- Share button identical to final (lucide `Share2`, aria-label Share)
- `ScoreSlab` like final but always `isWinner={false}` / `data-winner="false"`; use testids `mlb-live-score-slab-away|home` and `mlb-live-logo-away|home`
- Tablist aria-label `"Live game details"`; ids `mlb-live-${tab}-tab` / controls `mlb-live-${tab}-panel`

Do **not** call `resolveWinner` for emphasis (may omit helper entirely).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveBroadcastHeader.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveBroadcastHeader.tsx \
  frontend/src/components/mlb/MlbLiveBroadcastHeader.test.tsx \
  frontend/src/components/mlb/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): upgrade live broadcast header to Summary/Box chrome

EOF
)"
```

---

### Task 2: Add `MlbLiveCenter` (Summary with pitch zone + right rail)

**Files:**
- Create: `frontend/src/components/mlb/MlbLiveCenter.tsx`
- Create: `frontend/src/components/mlb/MlbLiveCenter.test.tsx`

**Interfaces:**
- Consumes:
  - `MlbLiveBroadcastHeader`, `LiveTab` from `./MlbLiveBroadcastHeader`
  - `MlbLiveSituation` `variant="pitchZone"`
  - `MlbFinalPlayFeed`, `MlbFinalLinescoreCard`, `MlbFinalTeamStats`
  - `MlbBoxScore`, `MlbWinProbability`, `MlbHitChart`
  - `MlbGameDetailView`
- Produces: `MlbLiveCenter({ detail }: { detail: MlbGameDetailView })`
  - Root `data-testid="mlb-live-center"`
  - Summary panel id `mlb-live-summary-panel`; Box panel id `mlb-live-box-panel`

**Summary DOM order (required):**

Left column: `mlb-live-situation` then `mlb-final-play-feed`  
Right column: `mlb-final-linescore-card` → `mlb-final-team-stats` → `mlb-game-flow` → `mlb-hit-chart`

Grid classes match final:  
`grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]`

- [ ] **Step 1: Write failing center tests**

Create `MlbLiveCenter.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbLiveCenter } from "./MlbLiveCenter";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbLiveCenter", () => {
  it("renders Summary with pitch zone above play feed and linescore atop right rail", async () => {
    const user = userEvent.setup();
    render(<MlbLiveCenter detail={mlbLiveDetail} />);

    const root = screen.getByTestId("mlb-live-center");
    expect(root).toBeInTheDocument();
    expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();

    const summary = screen.getByRole("tabpanel", { name: /summary/i });
    const pitchZone = within(summary).getByTestId("mlb-live-situation");
    const playFeed = within(summary).getByTestId("mlb-final-play-feed");
    const linescore = within(summary).getByTestId("mlb-final-linescore-card");
    const teamStats = within(summary).getByTestId("mlb-final-team-stats");
    const gameFlow = within(summary).getByTestId("mlb-game-flow");
    const hitChart = within(summary).getByTestId("mlb-hit-chart");

    expect(
      pitchZone.compareDocumentPosition(playFeed) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      linescore.compareDocumentPosition(teamStats) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      teamStats.compareDocumentPosition(gameFlow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gameFlow.compareDocumentPosition(hitChart) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.queryByTestId("mlb-live-matchup")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-box-score")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /box/i }));

    expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-box-score-layout")).toHaveClass(
      "grid-cols-2",
    );
    expect(screen.queryByTestId("mlb-final-play-feed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-situation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-game-flow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-hit-chart")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveCenter.test.tsx`

Expected: FAIL (module not found / component missing)

- [ ] **Step 3: Implement `MlbLiveCenter`**

Create `MlbLiveCenter.tsx` modeled on `MlbFinalCenter.tsx`:

```tsx
import { useState } from "react";
import { MlbBoxScore } from "./MlbBoxScore";
import {
  MlbLiveBroadcastHeader,
  type LiveTab,
} from "./MlbLiveBroadcastHeader";
import { MlbFinalLinescoreCard } from "./MlbFinalLinescoreCard";
import { MlbFinalPlayFeed } from "./MlbFinalPlayFeed";
import { MlbFinalTeamStats } from "./MlbFinalTeamStats";
import { MlbHitChart } from "./MlbHitChart";
import { MlbLiveSituation } from "./MlbLiveSituation";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "./types";

export function MlbLiveCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<LiveTab>("summary");

  return (
    <div data-testid="mlb-live-center" className="space-y-4">
      <MlbLiveBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {activeTab === "summary" ? (
        <div
          id="mlb-live-summary-panel"
          role="tabpanel"
          aria-labelledby="mlb-live-summary-tab"
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <div className="space-y-4">
            <MlbLiveSituation detail={detail} variant="pitchZone" />
            <MlbFinalPlayFeed detail={detail} />
          </div>
          <div className="space-y-4">
            <MlbFinalLinescoreCard detail={detail} />
            <MlbFinalTeamStats detail={detail} />
            <MlbWinProbability detail={detail} compact />
            <MlbHitChart detail={detail} />
          </div>
        </div>
      ) : (
        <div
          id="mlb-live-box-panel"
          role="tabpanel"
          aria-labelledby="mlb-live-box-tab"
        >
          <MlbBoxScore detail={detail} sideBySide />
        </div>
      )}
    </div>
  );
}
```

If `mlbLiveDetail` lacks `teamStats` and the team-stats test fails, extend the live fixture with a minimal `teamStats` pair copied from `mlbFinalDetail.teamStats` (or a slim subset). Prefer fixture fix over weakening the test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveCenter.test.tsx`

Expected: PASS

Also run: `cd frontend && npx vitest run src/components/mlb/MlbFinalCenter.test.tsx`

Expected: PASS (final unchanged)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveCenter.tsx \
  frontend/src/components/mlb/MlbLiveCenter.test.tsx \
  frontend/src/components/mlb/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): add live Summary/Box center mirroring final

EOF
)"
```

---

### Task 3: Wire live branch on `MlbGameDetailPage` + update page tests

**Files:**
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx`
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx`
- Modify: `md/system-design.md` (only if the `/mlb/games/:gamePk` row still implies the old live shell — refresh to “live Summary/Box center”)

**Interfaces:**
- Consumes: `MlbLiveCenter` from `@/components/mlb/MlbLiveCenter`
- Live branch return shape:

```tsx
<div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
  {chrome}
  <MlbLiveCenter detail={detail} />
</div>
```

- Remove live-only imports that become unused: `MlbLiveBroadcastHeader`, `MlbLiveMatchupPanel`, `MlbLiveSituation`, `MlbLinescore`, `MlbPlayByPlay`, `MlbTeamToggleBatters`, `MlbBoxScore`, `MlbWinProbability`, `MlbHitChart` (keep any still used by other branches — currently final uses `MlbFinalCenter` only; scheduled uses pregame)

- [ ] **Step 1: Update failing page test expectations**

In `MlbGameDetailPage.test.tsx`, change the live test to:

```tsx
it("shows live center sections and attribution for live MLB games", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => mlbDetail("live", ["statsapi", "espn"]),
  });
  renderPage();
  expect(await screen.findByTestId("mlb-live-center")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-broadcast-header")).toBeInTheDocument();
  expect(
    screen.getByRole("tablist", { name: /live game details/i }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("mlb-live-situation")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-final-play-feed")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-final-linescore-card")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
  expect(screen.queryByTestId("mlb-live-viz-row")).not.toBeInTheDocument();
  expect(screen.queryByTestId("mlb-live-matchup")).not.toBeInTheDocument();
  expect(screen.getByText(/Data: MLB Stats API · ESPN/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Top 3rd/i)).toHaveLength(1);
  expect(screen.getAllByText(/Fenway Park/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
    "href",
    "/",
  );
});
```

If the page mock payload lacks fields needed for play feed / linescore / team stats, extend `mlbDetail("live", …)` in that test file (or shared helper) with the same additive fields the live fixture uses — only what the new assertions require.

- [ ] **Step 2: Run page test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/MlbGameDetailPage.test.tsx`

Expected: FAIL on new Summary assertions / still finding `mlb-live-viz-row` or matchup

- [ ] **Step 3: Wire the page**

In `MlbGameDetailPage.tsx`:

1. Add `import { MlbLiveCenter } from "@/components/mlb/MlbLiveCenter";`
2. Replace the live return body (the block that currently builds `data-testid="mlb-live-center"` inline) with `<MlbLiveCenter detail={detail} />`
3. Delete unused imports listed above
4. Keep `chrome`, scheduled, halftime, and final branches unchanged

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd frontend && npx vitest run \
  src/pages/MlbGameDetailPage.test.tsx \
  src/components/mlb/MlbLiveCenter.test.tsx \
  src/components/mlb/MlbLiveBroadcastHeader.test.tsx \
  src/components/mlb/MlbFinalCenter.test.tsx
```

Expected: all PASS

- [ ] **Step 5: Refresh system-design row if needed**

If `md/system-design.md` page table still describes the old live shell vaguely, update the `/mlb/games/:gamePk` UI cell to mention live Summary/Box center (pitch zone above play feed). Skip if already accurate enough.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/MlbGameDetailPage.tsx \
  frontend/src/pages/MlbGameDetailPage.test.tsx \
  md/system-design.md
git commit -m "$(cat <<'EOF'
feat(mlb): wire live game detail to Summary/Box center

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Final-style header, live pulse, no winner emphasis | Task 1 |
| Summary \| Box tabs | Task 1–2 |
| Pitch zone above play feed | Task 2 |
| Linescore top of right rail | Task 2 |
| Team stats, win prob, hit chart in Summary right | Task 2 |
| Box side-by-side | Task 2 |
| Drop matchup / team-toggle / below-fold viz row | Task 2–3 |
| Page wiring + polling unchanged | Task 3 |
| No API changes | All tasks (frontend only) |
| Final unchanged | Task 2 regression run |

## Self-review notes

- No TBD/placeholder steps; concrete test + implementation code included
- `LiveTab` / panel ids consistent across Tasks 1–3
- Kept `mlb-broadcast-header` testid for continuity with page tests
- Reusing `mlb-final-*` child testids on the live path is intentional (reuse final components); do not rename those components in this plan
