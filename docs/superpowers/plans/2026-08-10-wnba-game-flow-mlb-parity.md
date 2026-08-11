# WNBA Game Flow MLB Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WNBA Summary win-probability panel chart-only, titled **Game flow**, with MLB-matching chrome, while keeping the separate Team Stats card.

**Architecture:** Update `WinProbabilityPanel` in place (still used only by `WnbaInGameCenter`). Strip nested team-stats UI, rename heading, tighten empty-state copy and label styling to match `MlbWinProbability`. Leave `WnbaTeamStatsCard` and API `teamStats` mapping untouched. Update panel + center + router tests that assert the old heading or nested stats.

**Tech Stack:** React, Vitest, Testing Library, Tailwind (existing frontend patterns).

## Global Constraints

- Product name remains **statvista** in user-facing copy (unchanged here).
- Keep separate `WnbaTeamStatsCard`; do not remove it from `WnbaInGameCenter`.
- Keep WNBA clock label format `Q{n} {clock}`.
- Do not change backend/API or delete `teamStats` from types/mappers.
- Commits only when the user explicitly requests them; skip commit steps otherwise.

## File map

| File | Role |
| --- | --- |
| `frontend/src/features/basketball/game/WinProbabilityPanel.tsx` | Chart-only Game flow panel |
| `frontend/src/features/basketball/game/WinProbabilityPanel.test.tsx` | Panel unit tests |
| `frontend/src/features/basketball/game/WnbaFinalCenter.test.tsx` | Summary order asserts Game flow |
| `frontend/src/app/AppRouter.test.tsx` | Route-level heading assert |
| Spec (read-only): `docs/superpowers/specs/2026-08-10-wnba-game-flow-mlb-parity-design.md` | Source of truth |

Reference chrome: `frontend/src/features/mlb/game/MlbWinProbability.tsx` (title, unavailable copy, white 18px labels, r=4 dots, `data-testid`).

---

### Task 1: Redefine `WinProbabilityPanel` tests for Game flow

**Files:**
- Modify: `frontend/src/features/basketball/game/WinProbabilityPanel.test.tsx`
- Test: same file

**Interfaces:**
- Consumes: existing `WinProbabilityPanel`, `buildGameDetailFixture`
- Produces: failing expectations for Game flow chrome (no nested team stats)

- [ ] **Step 1: Update the primary module test to expect Game flow and no nested team stats**

Replace the first test body with:

```tsx
it("renders a chart-first Game flow module without nested team stats", () => {
  render(<WinProbabilityPanel detail={buildGameDetailFixture()} />);

  expect(screen.getByTestId("wnba-game-flow")).toBeInTheDocument();
  expect(screen.getByText("Game flow")).toBeInTheDocument();
  expect(screen.getByLabelText("Win probability chart")).toBeInTheDocument();
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
  expect(screen.queryByText("Team stats")).not.toBeInTheDocument();
  expect(screen.queryByText("Field goal %")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Drop Field goal % assertion from the dual-label test**

In `renders dual on-chart labels for the latest point`, remove:

```tsx
expect(screen.getByText("Field goal %")).toBeInTheDocument();
```

Keep chart abbrev/%/clock asserts.

- [ ] **Step 3: Replace stats-only and timeline/stats-only tests**

Delete `renders stats-only data with away/home legend cues`.

Replace `keeps timeline-only and stats-only states renderable` with:

```tsx
it("shows unavailable when timeline is empty even if teamStats exist", () => {
  render(
    <WinProbabilityPanel
      detail={buildGameDetailFixture({
        winProbability: {
          ...buildGameDetailFixture().winProbability!,
          timeline: [],
        },
      })}
    />,
  );

  expect(screen.getByText("Game flow")).toBeInTheDocument();
  expect(screen.getByText("Win probability unavailable")).toBeInTheDocument();
  expect(screen.queryByLabelText("Win probability chart")).not.toBeInTheDocument();
  expect(screen.queryByText("Field goal %")).not.toBeInTheDocument();
});
```

Update the null-data unavailable test copy:

```tsx
expect(screen.getByText("Win probability unavailable")).toBeInTheDocument();
```

Update the GameSection wrapping test heading matcher:

```tsx
const heading = screen.getByRole("heading", { name: /game flow/i });
```

Keep interaction tests (pointer move, slider, muted paths, dense timeline) unchanged except they must still pass after implementation.

- [ ] **Step 4: Run panel tests and confirm they fail on old UI**

Run:

```bash
cd frontend && npx vitest run src/features/basketball/game/WinProbabilityPanel.test.tsx
```

Expected: FAIL on missing `wnba-game-flow` / `Game flow` / still finding `Team stats` or old unavailable copy.

- [ ] **Step 5: Commit (only if user requested commits)**

```bash
git add frontend/src/features/basketball/game/WinProbabilityPanel.test.tsx
git commit -m "$(cat <<'EOF'
test: expect WNBA Game flow panel without nested team stats

EOF
)"
```

---

### Task 2: Implement Game flow chrome in `WinProbabilityPanel`

**Files:**
- Modify: `frontend/src/features/basketball/game/WinProbabilityPanel.tsx`
- Test: `frontend/src/features/basketball/game/WinProbabilityPanel.test.tsx`

**Interfaces:**
- Consumes: `GameDetail`, `winProbability.timeline` only for rendering
- Produces: `WinProbabilityPanel` with `data-testid="wnba-game-flow"`, title **Game flow**, no nested team stats

- [ ] **Step 1: Update null / empty rendering**

Change the `!data` branch to:

```tsx
if (!data) {
  return (
    <GameSection className="!p-3" data-testid="wnba-game-flow">
      <h2 className="text-[18px] font-semibold text-white">Game flow</h2>
      <p className="mt-1.5 text-[18px] text-white/50">
        Win probability unavailable
      </p>
    </GameSection>
  );
}
```

After computing `points` / scrub paths, when `points.length === 0`, render heading + same unavailable paragraph (no team stats). Mirror MLB: chart block only when `points.length > 0`, else unavailable message.

- [ ] **Step 2: Match MLB chart chrome on the success path**

On the main return:

- Outer: `<GameSection className="!p-3" data-testid="wnba-game-flow">`
- Heading: `<h2 className="text-[18px] font-semibold text-white">Game flow</h2>`
- Scrub circles: `r={4}`
- Home/away `%` text: `fill="#FFFFFF"`, `style={{ fontSize: "18px", fontWeight: 600 }}`
- Optional polish (match MLB): `data-testid="wnba-game-flow-home-pct"` / `wnba-game-flow-away-pct` on those texts
- Keep clock text as `` `Q${activePoint.period} ${activePoint.clock}` ``
- **Delete** the entire `{data.teamStats.length > 0 ? ( ... ) : null}` block (lines ~210–274 today)

Do not import or render team-stat bars. Leave `teamStats` on the type unused by this component.

- [ ] **Step 3: Run panel tests**

```bash
cd frontend && npx vitest run src/features/basketball/game/WinProbabilityPanel.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit (only if user requested commits)**

```bash
git add frontend/src/features/basketball/game/WinProbabilityPanel.tsx frontend/src/features/basketball/game/WinProbabilityPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat: align WNBA win probability panel with MLB Game flow

EOF
)"
```

---

### Task 3: Update Summary / router assertions

**Files:**
- Modify: `frontend/src/features/basketball/game/WnbaFinalCenter.test.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`
- Test: those files + `WnbaTeamStatsCard.test.tsx` (sanity; should still pass unchanged)

**Interfaces:**
- Consumes: Game flow heading / `wnba-game-flow` from Task 2
- Produces: center + router tests aligned with new copy

- [ ] **Step 1: Update final center order test**

In `WnbaFinalCenter.test.tsx`, change:

```tsx
const winProb = within(summary).getByText("Win probability");
```

to:

```tsx
const winProb = within(summary).getByTestId("wnba-game-flow");
```

Keep order: quarter → `wnba-team-stats-card` → game flow → game info.

- [ ] **Step 2: Update AppRouter assertion**

In `frontend/src/app/AppRouter.test.tsx` test `renders win probability beneath shot chart and play-by-play`:

```tsx
expect(await screen.findByText("Game flow")).toBeInTheDocument();
expect(screen.getByText("Field goal %")).toBeInTheDocument(); // still via WnbaTeamStatsCard
```

Rename the test description optionally to mention Game flow; keep Field goal % assert (separate card).

- [ ] **Step 3: Run related tests**

```bash
cd frontend && npx vitest run \
  src/features/basketball/game/WinProbabilityPanel.test.tsx \
  src/features/basketball/game/WnbaFinalCenter.test.tsx \
  src/features/basketball/game/WnbaTeamStatsCard.test.tsx \
  src/app/AppRouter.test.tsx
```

Expected: PASS (AppRouter may take longer; only the win-probability case must assert Game flow).

- [ ] **Step 4: Commit (only if user requested commits)**

```bash
git add \
  frontend/src/features/basketball/game/WnbaFinalCenter.test.tsx \
  frontend/src/app/AppRouter.test.tsx
git commit -m "$(cat <<'EOF'
test: assert WNBA Summary Game flow heading and layout

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Title **Game flow** + 18px | Task 2 |
| Remove nested team stats | Task 2 |
| Keep `WnbaTeamStatsCard` | Task 3 (order assert); no center layout change |
| Unavailable copy `Win probability unavailable` | Tasks 1–2 |
| `data-testid="wnba-game-flow"` | Tasks 1–2 |
| White ~18px % labels, larger dots | Task 2 |
| Keep `Q{n} clock` | Task 2 |
| Keep `teamStats` on type/mapper | No code change (intentional) |
| Update panel / center / router tests | Tasks 1, 3 |
