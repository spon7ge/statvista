# WNBA Boxscore Tab + Split Team Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the WNBA live/final tab from Box to Boxscore and render away/home box scores as two stacked separate cards.

**Architecture:** Update the broadcast header label only (keep tab id `"box"`). Refactor `BoxScore` so each team table sits in its own `GameSection`, stacked away → home inside a lightweight wrapper. Preserve existing grid/DNP behavior.

**Tech Stack:** React, Vitest, Testing Library, existing `GameSection` UI.

## Global Constraints

- Stacked layout only (away above home)—not side-by-side.
- Keep internal tab id `"box"`; change visible label to **Boxscore**.
- No backend / API changes.
- Product name remains **statvista**.
- Commits only when the user explicitly requests them; skip commit steps otherwise.
- Spec: `docs/superpowers/specs/2026-08-10-wnba-boxscore-split-cards-design.md`

## File map

| File | Role |
| --- | --- |
| `frontend/src/features/basketball/game/WnbaBroadcastHeader.tsx` | Tab label |
| `frontend/src/features/basketball/game/WnbaBroadcastHeader.test.tsx` | Tab assertions |
| `frontend/src/features/basketball/game/BoxScore.tsx` | Split team cards |
| `frontend/src/features/basketball/game/BoxScore.test.tsx` | Card structure asserts |
| `frontend/src/features/basketball/game/WnbaLiveCenter.test.tsx` | Click Boxscore |
| `frontend/src/features/basketball/game/WnbaFinalCenter.test.tsx` | Click Boxscore |
| `frontend/src/features/basketball/game/WnbaInGameCenter.tsx` | Comment only (optional) |

---

### Task 1: Rename tab label to Boxscore

**Files:**
- Modify: `frontend/src/features/basketball/game/WnbaBroadcastHeader.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaBroadcastHeader.test.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaLiveCenter.test.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaFinalCenter.test.tsx`

**Interfaces:**
- Consumes: existing `activeTab: "summary" | "box"`
- Produces: visible tab name **Boxscore**

- [ ] **Step 1: Update failing header/center tests**

In `WnbaBroadcastHeader.test.tsx`:

- Change expectations from `/box/i` to `/^boxscore$/i` (or `{ name: /boxscore/i }` matching MLB).
- Rename test titles that say `Summary|Box` → `Summary|Boxscore` and `when Box tab is clicked` → `when Boxscore tab is clicked`.
- Click helper: `getByRole("tab", { name: /boxscore/i })`.

In `WnbaLiveCenter.test.tsx` / `WnbaFinalCenter.test.tsx`, replace any `getByRole("tab", { name: /^box$/i })` or `/box/i` with `/boxscore/i`. Update test titles mentioning “Box tab”.

- [ ] **Step 2: Run tests — expect fail**

```bash
cd frontend && npx vitest run \
  src/features/basketball/game/WnbaBroadcastHeader.test.tsx \
  src/features/basketball/game/WnbaLiveCenter.test.tsx \
  src/features/basketball/game/WnbaFinalCenter.test.tsx
```

Expected: FAIL on missing Boxscore label (still shows Box).

- [ ] **Step 3: Change label in header**

In `WnbaBroadcastHeader.tsx`:

```tsx
{tab === "summary" ? "Summary" : "Boxscore"}
```

Optionally update the comment `no Summary|Box tabs` → `no Summary|Boxscore tabs`.

Do **not** change tab id `"box"` or `aria-controls` / panel ids.

- [ ] **Step 4: Re-run tests — PASS**

Same vitest command as Step 2.

- [ ] **Step 5: Commit (only if user requested)**

```bash
git add frontend/src/features/basketball/game/WnbaBroadcastHeader.tsx \
  frontend/src/features/basketball/game/WnbaBroadcastHeader.test.tsx \
  frontend/src/features/basketball/game/WnbaLiveCenter.test.tsx \
  frontend/src/features/basketball/game/WnbaFinalCenter.test.tsx
git commit -m "$(cat <<'EOF'
feat(wnba): rename game tab Box to Boxscore

EOF
)"
```

---

### Task 2: Split BoxScore into two stacked team cards

**Files:**
- Modify: `frontend/src/features/basketball/game/BoxScore.tsx`
- Modify: `frontend/src/features/basketball/game/BoxScore.test.tsx`

**Interfaces:**
- Consumes: `detail.boxScore`, `detail.away`, `detail.home`
- Produces: wrapper `wnba-box-score` with per-team `wnba-box-team-away` / `wnba-box-team-home` GameSections

- [ ] **Step 1: Rewrite BoxScore tests for split cards**

Replace/extend tests:

```tsx
it("renders away and home in separate stacked GameSections", () => {
  render(
    <BoxScore
      detail={buildGameDetailFixture({
        boxScore: {
          columns: ["MIN", "PTS"],
          away: [
            { name: "Kayla Thornton", didNotPlay: false, values: ["25", "6"] },
          ],
          home: [
            { name: "Alyssa Thomas", didNotPlay: false, values: ["30", "12"] },
          ],
        },
      })}
    />,
  );

  const root = screen.getByTestId("wnba-box-score");
  expect(root).toHaveClass("space-y-4");

  const away = screen.getByTestId("wnba-box-team-away");
  const home = screen.getByTestId("wnba-box-team-home");
  expect(away.tagName.toLowerCase()).toBe("section");
  expect(home.tagName.toLowerCase()).toBe("section");
  expect(away).toHaveClass("rounded-xl", "bg-[#1c1e22]", "!p-3");
  expect(home).toHaveClass("rounded-xl", "bg-[#1c1e22]", "!p-3");
  expect(away).not.toBe(home);
  expect(
    away.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  expect(within(away).getByText("Kayla Thornton")).toBeInTheDocument();
  expect(within(home).getByText("Alyssa Thomas")).toBeInTheDocument();
});

it("omits empty team card and still wraps the other", () => {
  render(
    <BoxScore
      detail={buildGameDetailFixture({
        boxScore: {
          columns: ["MIN", "PTS"],
          away: [
            { name: "Kayla Thornton", didNotPlay: false, values: ["25", "6"] },
          ],
          home: [],
        },
      })}
    />,
  );
  expect(screen.getByTestId("wnba-box-team-away")).toBeInTheDocument();
  expect(screen.queryByTestId("wnba-box-team-home")).not.toBeInTheDocument();
});
```

Keep DNP / null-data coverage from the existing file (adapt “quiet GameSection” assert to use `getByTestId("wnba-box-team-away")`).

Import `within` from `@testing-library/react` if needed.

- [ ] **Step 2: Run BoxScore tests — expect fail**

```bash
cd frontend && npx vitest run src/features/basketball/game/BoxScore.test.tsx
```

Expected: FAIL missing `wnba-box-score` / separate sections.

- [ ] **Step 3: Implement split cards**

Refactor `BoxScore.tsx` roughly to:

```tsx
function TeamBoxScore({
  team,
  players,
  columns,
  testId,
}: {
  team: GameDetailTeam;
  players: GameDetailBoxScorePlayer[];
  columns: string[];
  testId: string;
}) {
  return (
    <GameSection data-testid={testId} className="!p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="size-5 object-contain" />
        ) : null}
        <span className="font-semibold" style={{ color: team.color }}>
          {team.abbrev}
        </span>
        <span className="font-medium text-white/90">{team.name}</span>
      </div>
      {/* existing grid header + player rows unchanged */}
    </GameSection>
  );
}

export function BoxScore({ detail }: { detail: GameDetail }) {
  const boxScore = detail.boxScore;
  if (!boxScore) return null;
  if (boxScore.away.length === 0 && boxScore.home.length === 0) return null;

  return (
    <div data-testid="wnba-box-score" className="space-y-4">
      {boxScore.away.length > 0 ? (
        <TeamBoxScore
          testId="wnba-box-team-away"
          team={detail.away}
          players={boxScore.away}
          columns={boxScore.columns}
        />
      ) : null}
      {boxScore.home.length > 0 ? (
        <TeamBoxScore
          testId="wnba-box-team-home"
          team={detail.home}
          players={boxScore.home}
          columns={boxScore.columns}
        />
      ) : null}
    </div>
  );
}
```

Preserve `STAT_COLS`, DNP column blanking, and value rendering exactly as today.

- [ ] **Step 4: Run related tests — PASS**

```bash
cd frontend && npx vitest run \
  src/features/basketball/game/BoxScore.test.tsx \
  src/features/basketball/game/WnbaLiveCenter.test.tsx \
  src/features/basketball/game/WnbaFinalCenter.test.tsx \
  src/features/basketball/game/WnbaBroadcastHeader.test.tsx
```

- [ ] **Step 5: Commit (only if user requested)**

```bash
git add frontend/src/features/basketball/game/BoxScore.tsx \
  frontend/src/features/basketball/game/BoxScore.test.tsx
git commit -m "$(cat <<'EOF'
feat(wnba): split box score into stacked per-team cards

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| Tab label **Boxscore** | 1 |
| Keep tab id `"box"` | 1 |
| Two separate GameSections, stacked away→home | 2 |
| Optional logo in header | 2 |
| Preserve columns/DNP | 2 |
| Null/empty → null | 2 |
