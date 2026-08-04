# MLB Final Header + Half-Inning Play Cards Polish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Summary|Box into the center of the final outcome header and restyle the play feed as half-inning team-colored cards (no portraits/icons).

**Architecture:** Refine `MlbFinalBroadcastHeader` (accept tab props), `MlbFinalPlayFeed` (group by half-inning), and `MlbFinalCenter` (pass tabs into header; remove under-header tablist).

**Tech Stack:** React, TypeScript, Vitest/RTL, Tailwind

## Global Constraints

- Final UI polish only; live/scheduled unchanged
- No portraits; no play-row action icons
- Tabs live in header center; no duplicate tab row below
- Keep Scoring/All toggle above cards
- Follow existing mlb component/test patterns

---

### Task 1: Header with centered Summary|Box tabs

**Files:**
- Modify: `frontend/src/components/mlb/MlbFinalBroadcastHeader.tsx`
- Modify: `frontend/src/components/mlb/MlbFinalBroadcastHeader.test.tsx`
- Modify: `frontend/src/components/mlb/MlbFinalCenter.tsx`
- Modify: `frontend/src/components/mlb/MlbFinalCenter.test.tsx`

**Interfaces:**
```ts
type FinalTab = "summary" | "box";
MlbFinalBroadcastHeader({
  detail,
  activeTab,
  onTabChange,
}: {
  detail: MlbGameDetailView;
  activeTab: FinalTab;
  onTabChange: (tab: FinalTab) => void;
})
```

- [ ] **Step 1: Failing tests** — header renders Summary/Box tabs; FinalCenter has no separate under-header tablist (tabs only inside header testid); clicking Box still shows box score.

- [ ] **Step 2: Implement header layout**

```
grid: away slab | center tabs | home slab
```

Away slab: logo left-bleed, content right-aligned (record ABBR / large score).  
Home slab: mirrored.  
Center: `role="tablist"` with Summary|Box.  
Status strip (Today / Final / share) stays above.

- [ ] **Step 3: Wire FinalCenter** — pass `activeTab`/`onTabChange`; delete the old tab row under the header; keep tabpanels.

- [ ] **Step 4: Run tests + commit**

```bash
cd frontend && npx vitest run src/components/mlb/MlbFinalBroadcastHeader.test.tsx src/components/mlb/MlbFinalCenter.test.tsx
git commit -m "feat: put Summary/Box tabs in MLB final outcome header"
```

---

### Task 2: Half-inning team-colored play cards

**Files:**
- Modify: `frontend/src/components/mlb/MlbFinalPlayFeed.tsx`
- Modify: `frontend/src/components/mlb/MlbFinalPlayFeed.test.tsx`

**Interfaces:**
- Group filtered plays by `${inning}-${half}` preserving chronological order
- Card background = batting team color (top→away, bottom→home)
- Title: `Top 1st` / `Bottom 1st`
- Row: text, outcome pill, optional Statcast; no portraits/icons

- [ ] **Step 1: Failing test** — with two plays same half, one card title; All Plays shows half-inning section with team-colored container (`data-testid` per half optional).

- [ ] **Step 2: Implement grouping + card styles** (solid team color + dark overlay; divider between plays).

- [ ] **Step 3: Run mlb suite + commit**

```bash
cd frontend && npx vitest run src/components/mlb src/pages/MlbGameDetailPage.test.tsx
git commit -m "feat: group MLB final plays into half-inning team cards"
```
