# MLB Final Game Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `/mlb/games/:gamePk` is `final`, show header + linescore → box score → three-column game flow / hit chart / scoring plays; leave live and scheduled layouts unchanged.

**Architecture:** Add `MlbScoringPlays` (scoring-only panel extracted from `MlbPlayByPlay`) and `MlbFinalCenter` (composition). `MlbGameDetailPage` branches `final` to the new center; `live` keeps the stacked center; `scheduled` keeps the thin stub.

**Tech Stack:** React 19, Vitest + Testing Library, existing `GameSection` / MLB detail components, TanStack Query hook unchanged.

## Global Constraints

- Final only — do not change live stacked order or live-only panels
- No backend / OpenAPI / schema / hook polling changes
- Reuse `MlbGameHeader`, `MlbLinescore`, `MlbBoxScore`, `MlbWinProbability`, `MlbHitChart`
- Trio uses `lg:grid-cols-3`; stacks below `lg`
- Remove stub copy `Final — live center for completed games coming soon`

## File map

| File | Role |
| --- | --- |
| `frontend/src/components/mlb/MlbScoringPlays.tsx` | Scoring-plays panel + shared `MlbPlayList` |
| `frontend/src/components/mlb/MlbScoringPlays.test.tsx` | Scoring rows / empty state |
| `frontend/src/components/mlb/MlbPlayByPlay.tsx` | Use shared list; keep live 2-col PBP + scoring |
| `frontend/src/components/mlb/MlbFinalCenter.tsx` | Final composition; `data-testid="mlb-final-center"` |
| `frontend/src/components/mlb/MlbFinalCenter.test.tsx` | Section presence / order smoke |
| `frontend/src/pages/MlbGameDetailPage.tsx` | Branch `final` → FinalCenter |
| `frontend/src/pages/MlbGameDetailPage.test.tsx` | Final asserts final-center, not stub |
| `docs/superpowers/specs/2026-08-02-mlb-final-game-detail-design.md` | Spec (already written) |

---

### Task 1: Extract `MlbScoringPlays` + shared play list

**Files:**
- Create: `frontend/src/components/mlb/MlbScoringPlays.tsx`
- Create: `frontend/src/components/mlb/MlbScoringPlays.test.tsx`
- Modify: `frontend/src/components/mlb/MlbPlayByPlay.tsx`
- Test: `frontend/src/components/mlb/MlbPlayByPlay.test.tsx` (must still pass)

**Interfaces:**
- Consumes: `MlbGameDetailView`, `MlbPlay` from `./types`
- Produces:
  - `export function MlbPlayList({ plays, empty }: { plays: MlbPlay[]; empty: string }): JSX.Element`
  - `export function MlbScoringPlays({ detail }: { detail: MlbGameDetailView }): JSX.Element` with `data-testid="mlb-scoring-plays"`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/mlb/MlbScoringPlays.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbScoringPlays } from "./MlbScoringPlays";
import { mlbLiveDetail } from "./testFixtures";

describe("MlbScoringPlays", () => {
  it("renders scoring play text and score", () => {
    render(<MlbScoringPlays detail={mlbLiveDetail} />);
    expect(screen.getByTestId("mlb-scoring-plays")).toBeInTheDocument();
    expect(screen.getByText("Scoring plays")).toBeInTheDocument();
    expect(screen.getByText("Freeman homers (1)")).toBeInTheDocument();
    expect(screen.getByText("0-1")).toBeInTheDocument();
  });

  it("shows empty copy when there are no scoring plays", () => {
    render(
      <MlbScoringPlays detail={{ ...mlbLiveDetail, scoringPlays: [] }} />,
    );
    expect(screen.getByText("No scoring plays yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/mlb/MlbScoringPlays.test.tsx`

Expected: FAIL — module / export not found

- [ ] **Step 3: Implement `MlbScoringPlays` and shared list**

Create `frontend/src/components/mlb/MlbScoringPlays.tsx`:

```tsx
import { GameSection } from "@/components/game/GameSection";
import type { MlbGameDetailView, MlbPlay } from "./types";

function EventBadge({ event }: { event: string | null }) {
  if (!event) return null;
  const isHr = event.toUpperCase() === "HR";
  return (
    <span
      className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isHr ? "bg-red-500/15 text-red-400" : "bg-white/10 text-white/50"
      }`}
    >
      {event}
    </span>
  );
}

export function MlbPlayList({
  plays,
  empty,
}: {
  plays: MlbPlay[];
  empty: string;
}) {
  if (plays.length === 0) {
    return <p className="text-xs text-white/40">{empty}</p>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      {plays.map((play) => (
        <li
          key={play.id}
          className={`flex items-start gap-1.5 rounded-md px-1.5 py-1 ${
            play.scoring ? "bg-white/5" : ""
          }`}
        >
          <EventBadge event={play.event} />
          <span className="min-w-0 flex-1 text-white/80">{play.text}</span>
          {play.scoring ? (
            <span className="shrink-0 font-mono font-semibold text-white tabular-nums">
              {play.awayScore}-{play.homeScore}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MlbScoringPlays({ detail }: { detail: MlbGameDetailView }) {
  return (
    <GameSection className="!p-3" data-testid="mlb-scoring-plays">
      <h2 className="mb-2 text-sm font-semibold text-white">Scoring plays</h2>
      <MlbPlayList
        plays={detail.scoringPlays}
        empty="No scoring plays yet"
      />
    </GameSection>
  );
}
```

- [ ] **Step 4: Refactor `MlbPlayByPlay` to use shared list + `MlbScoringPlays`**

Replace `frontend/src/components/mlb/MlbPlayByPlay.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import { MlbPlayList, MlbScoringPlays } from "./MlbScoringPlays";
import type { MlbGameDetailView } from "./types";

type HalfKey = `${number}-${"top" | "bottom"}`;

function halfKey(inning: number, half: "top" | "bottom"): HalfKey {
  return `${inning}-${half}`;
}

function halfLabel(inning: number, half: "top" | "bottom"): string {
  const side = half === "top" ? "Top" : "Bot";
  return `${side} ${inning}`;
}

export function MlbPlayByPlay({ detail }: { detail: MlbGameDetailView }) {
  const halves = useMemo(() => {
    const seen = new Map<HalfKey, { inning: number; half: "top" | "bottom" }>();
    for (const play of detail.plays) {
      const key = halfKey(play.inning, play.half);
      if (!seen.has(key)) {
        seen.set(key, { inning: play.inning, half: play.half });
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      return a.half === b.half ? 0 : a.half === "top" ? -1 : 1;
    });
  }, [detail.plays]);

  const currentHalf: HalfKey | null = (() => {
    const inning = detail.linescore?.currentInning;
    const half = detail.linescore?.inningHalf;
    if (inning != null && half) return halfKey(inning, half);
    if (halves.length > 0) {
      const last = halves[halves.length - 1];
      return halfKey(last.inning, last.half);
    }
    return null;
  })();

  const [selectedHalf, setSelectedHalf] = useState<HalfKey | null>(null);
  const activeHalf = selectedHalf ?? currentHalf;

  const chronological = detail.plays.filter(
    (play) => halfKey(play.inning, play.half) === activeHalf,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="mlb-play-by-play">
      <GameSection className="!p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Play-by-play</h2>
          <div className="flex flex-wrap items-center gap-0.5">
            {halves.map(({ inning, half }) => {
              const key = halfKey(inning, half);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedHalf(key)}
                  aria-pressed={activeHalf === key}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    activeHalf === key
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {halfLabel(inning, half)}
                </button>
              );
            })}
          </div>
        </div>
        <MlbPlayList plays={chronological} empty="No plays this half" />
      </GameSection>

      <MlbScoringPlays detail={detail} />
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
cd frontend && npm test -- src/components/mlb/MlbScoringPlays.test.tsx src/components/mlb/MlbPlayByPlay.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/mlb/MlbScoringPlays.tsx \
  frontend/src/components/mlb/MlbScoringPlays.test.tsx \
  frontend/src/components/mlb/MlbPlayByPlay.tsx
git commit -m "feat(mlb): extract scoring plays panel for reuse"
```

---

### Task 2: `MlbFinalCenter` composition

**Files:**
- Create: `frontend/src/components/mlb/MlbFinalCenter.tsx`
- Create: `frontend/src/components/mlb/MlbFinalCenter.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView`; child components from Task 1 + existing MLB panels
- Produces: `export function MlbFinalCenter({ detail }: { detail: MlbGameDetailView }): JSX.Element` with `data-testid="mlb-final-center"`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/mlb/MlbFinalCenter.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbFinalCenter } from "./MlbFinalCenter";
import { mlbLiveDetail } from "./testFixtures";

const finalDetail = {
  ...mlbLiveDetail,
  status: "final" as const,
  statusLabel: "Final",
};

describe("MlbFinalCenter", () => {
  it("renders header, linescore, box score, then archive trio", () => {
    render(<MlbFinalCenter detail={finalDetail} />);
    const root = screen.getByTestId("mlb-final-center");
    expect(root).toBeInTheDocument();

    expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-scoring-plays")).toBeInTheDocument();

    expect(screen.queryByTestId("mlb-play-by-play")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/mlb/MlbFinalCenter.test.tsx`

Expected: FAIL — module not found

- [ ] **Step 3: Implement `MlbFinalCenter`**

Create `frontend/src/components/mlb/MlbFinalCenter.tsx`:

```tsx
import { MlbBoxScore } from "./MlbBoxScore";
import { MlbGameHeader } from "./MlbGameHeader";
import { MlbHitChart } from "./MlbHitChart";
import { MlbLinescore } from "./MlbLinescore";
import { MlbScoringPlays } from "./MlbScoringPlays";
import { MlbWinProbability } from "./MlbWinProbability";
import type { MlbGameDetailView } from "./types";

export function MlbFinalCenter({ detail }: { detail: MlbGameDetailView }) {
  return (
    <div data-testid="mlb-final-center" className="space-y-4">
      <MlbGameHeader detail={detail} />
      <MlbLinescore detail={detail} />
      <MlbBoxScore detail={detail} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
        <MlbScoringPlays detail={detail} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/components/mlb/MlbFinalCenter.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbFinalCenter.tsx \
  frontend/src/components/mlb/MlbFinalCenter.test.tsx
git commit -m "feat(mlb): add final game center layout"
```

---

### Task 3: Wire `MlbGameDetailPage` final branch

**Files:**
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx`
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx`

**Interfaces:**
- Consumes: `MlbFinalCenter` from Task 2
- Produces: Page renders `mlb-final-center` when `detail.status === "final"`; scheduled still thin; live unchanged

- [ ] **Step 1: Update the failing page test**

In `frontend/src/pages/MlbGameDetailPage.test.tsx`, replace the final-game test:

```tsx
  it("shows final center for final MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mlbDetail("final", ["statsapi", "espn"]),
    });
    renderPage();
    expect(await screen.findByTestId("mlb-final-center")).toBeInTheDocument();
    expect(
      screen.queryByText("Final — live center for completed games coming soon"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-center")).not.toBeInTheDocument();
    expect(screen.getByText(/Data: MLB Stats API · ESPN/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
```

Keep the scheduled and live tests unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/pages/MlbGameDetailPage.test.tsx`

Expected: FAIL — still shows stub / no `mlb-final-center`

- [ ] **Step 3: Wire the page**

Update `frontend/src/pages/MlbGameDetailPage.tsx`:

1. Add import:

```tsx
import { MlbFinalCenter } from "@/components/mlb/MlbFinalCenter";
```

2. Change `notLiveMessage` to scheduled-only (or inline `"Not live yet"` and delete the helper):

```tsx
function notLiveMessage(status: MlbGameDetailView["status"]): string {
  if (status === "final") {
    // Final uses MlbFinalCenter; this helper is only for scheduled/thin states.
    return "Not live yet";
  }
  return "Not live yet";
}
```

Prefer deleting the helper and inlining `"Not live yet"` in the scheduled branch.

3. Replace the single non-live branch with explicit status handling. Full `export function MlbGameDetailPage` body after mapping:

```tsx
  const detail = mapMlbGameDetail(data);

  if (detail.status === "scheduled" || detail.status === "halftime") {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <BackLink />
        <CompactMlbHeader detail={detail} />
        <p className="text-sm text-white/60">Not live yet</p>
      </div>
    );
  }

  const chrome = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <BackLink />
      <p className="text-xs text-white/45">
        <span
          className={
            detail.status === "live" ? "text-red-400" : "text-white/80"
          }
        >
          {detail.statusLabel}
        </span>
        {detail.venue ? (
          <>
            <span className="mx-1.5 text-white/30" aria-hidden>
              ·
            </span>
            <span>{detail.venue}</span>
          </>
        ) : null}
        <span className="mx-1.5 text-white/30" aria-hidden>
          ·
        </span>
        <span className="text-white/40">
          {attributionLabel(detail.sources)}
        </span>
      </p>
    </div>
  );

  if (detail.status === "final") {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        {chrome}
        <MlbFinalCenter detail={detail} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      {chrome}
      <div data-testid="mlb-live-center" className="space-y-4">
        <MlbGameHeader detail={detail} />
        <MlbLinescore detail={detail} />
        <MlbLiveSituation detail={detail} />
        <MlbPlayByPlay detail={detail} />
        <MlbBoxScore detail={detail} />
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
      </div>
    </div>
  );
```

Remove unused `notLiveMessage` if fully inlined.

- [ ] **Step 4: Run page + related tests**

Run:

```bash
cd frontend && npm test -- src/pages/MlbGameDetailPage.test.tsx src/components/mlb/MlbFinalCenter.test.tsx src/components/mlb/MlbScoringPlays.test.tsx src/components/mlb/MlbPlayByPlay.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MlbGameDetailPage.tsx \
  frontend/src/pages/MlbGameDetailPage.test.tsx
git commit -m "feat(mlb): show final archive center on completed games"
```

---

### Task 4: Verification + system-design note

**Files:**
- Modify (light): `docs/superpowers/specs/2026-08-02-website-api-system-design.md` — only the MLB game-detail one-liner if it still says live-only / thin final

**Interfaces:**
- Consumes: completed Tasks 1–3
- Produces: Green targeted test run; docs match behavior

- [ ] **Step 1: Update website API system design mention**

In `docs/superpowers/specs/2026-08-02-website-api-system-design.md`, find the MLB game detail route row / tree note that says live-only or thin not-live for final, and update to:

- `/mlb/games/:gamePk` — live center when live; final archive center when final; thin “Not live yet” when scheduled

Exact wording can match surrounding table style; do not rewrite the whole doc.

- [ ] **Step 2: Run full frontend MLB-related tests**

Run:

```bash
cd frontend && npm test -- src/pages/MlbGameDetailPage.test.tsx src/components/mlb/
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-02-website-api-system-design.md
git commit -m "docs: note MLB final archive center on game detail"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Final layout: header + linescore → box → trio | Task 2–3 |
| Trio: game flow \| hit chart \| scoring plays | Task 2 |
| Extract `MlbScoringPlays`; live PBP still shares list | Task 1 |
| Live layout unchanged | Task 3 (live branch untouched content) |
| Scheduled thin “Not live yet” | Task 3 |
| Remove final stub message | Task 3 |
| Page tests for final-center | Task 3 |
| No API/hook changes | All tasks (frontend-only) |
| Docs mention | Task 4 |
