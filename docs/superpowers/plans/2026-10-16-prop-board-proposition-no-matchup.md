# Prop Board Proposition Without Matchup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the game matchup string next to the player name in the Proposition column on MLB, WNBA, and NBA prop boards.

**Architecture:** Each league’s `*PropPicksTable` `CompositeCell` currently renders `player_name` then a separator + `formatMatchup` result. Delete that branch and the unused `formatMatchup` helper. Game filter and API stay as-is. No shared composite package.

**Tech Stack:** React 19, Vitest, Testing Library.

## Global Constraints

- Product name in any new copy is **statvista**.
- Do not change board API, schemas, or Game filter behavior.
- Do not add a shared Proposition cell module across leagues.
- Keep headshot/logo, `board-row-name`, and `board-row-market`.
- Remove `board-row-matchup` and the separator dot from the headline.
- Team abbrevs may still arrive on the row for logos and Game filter.
- Skip `md/system-design.md` unless Proposition copy currently implies a matchup beside the name (it does not today).

---

## File structure

| File | Responsibility |
| --- | --- |
| `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` | Drop matchup from MLB `CompositeCell`; delete `formatMatchup` |
| `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx` | Assert no `board-row-matchup` |
| `frontend/src/features/basketball/league/WnbaPropPicksTable.tsx` | Same for WNBA |
| `frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx` | Same assertions |
| `frontend/src/features/nba/league/NbaPropPicksTable.tsx` | Same for NBA |
| `frontend/src/features/nba/league/NbaPropPicksTable.test.tsx` | Assert no matchup |

---

### Task 1: MLB Proposition drops matchup

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` (`formatMatchup` ~88–93; `CompositeCell` ~310–349)
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: `row.player_name`, `row.market_label`, `PlayerIcon`.
- Produces: `CompositeCell` with `board-row-name` + `board-row-market` only; no `board-row-matchup`.

- [ ] **Step 1: Write the failing tests**

In `"renders the composite cell and remaining column headers"`, replace the matchup assertion:

```tsx
expect(screen.getByTestId("board-row-name")).toHaveTextContent("Aaron Judge");
expect(screen.getByTestId("board-row-name")).toHaveClass("font-bold");
expect(screen.queryByTestId("board-row-matchup")).not.toBeInTheDocument();
const market = screen.getByTestId("board-row-market");
```

Replace the entire `"renders home matchups as opponent @ team"` test with:

```tsx
it("does not show a matchup next to the player name", () => {
  render(
    <MlbPropPicksTable
      rows={[
        fixtureRow({
          home_away: "home",
          team_abbrev: "NYY",
          opponent_abbrev: "BOS",
        }),
      ]}
    />,
  );
  expect(screen.getByTestId("board-row-name")).toHaveTextContent("Aaron Judge");
  expect(screen.queryByTestId("board-row-matchup")).not.toBeInTheDocument();
  expect(screen.queryByText("BOS @ NYY")).not.toBeInTheDocument();
  expect(screen.queryByText("NYY @ BOS")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/features/mlb/league/MlbPropPicksTable.test.tsx
```

Expected: FAIL — `board-row-matchup` still present (or matchup text still in document).

- [ ] **Step 3: Remove matchup from CompositeCell**

Delete `formatMatchup` entirely from `MlbPropPicksTable.tsx`.

Replace `CompositeCell` with:

```tsx
function CompositeCell({ row }: { row: ApiMlbPropBoardRow }) {
  return (
    <div className="flex min-w-[14rem] items-center gap-2.5">
      <PlayerIcon row={row} />
      <div className="min-w-0 grow truncate">
        <div
          data-testid="board-row-headline"
          className="flex min-w-0 items-center gap-1.5"
        >
          <span
            data-testid="board-row-name"
            className="min-w-0 truncate font-bold text-c3"
          >
            {row.player_name}
          </span>
        </div>
        <p
          data-testid="board-row-market"
          className="truncate text-sm font-bold text-c3"
        >
          {row.market_label}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd frontend && npm test -- src/features/mlb/league/MlbPropPicksTable.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  frontend/src/features/mlb/league/MlbPropPicksTable.tsx \
  frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx
git commit -m "$(cat <<'EOF'
Drop matchup from MLB prop Proposition cell.

EOF
)"
```

---

### Task 2: WNBA Proposition drops matchup

**Files:**
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksTable.tsx` (`formatMatchup` ~88–93; `CompositeCell` ~310–349)
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: `row.player_name`, `row.market_label`, `PlayerIcon`.
- Produces: same Proposition contract as Task 1 (WNBA fixtures).

- [ ] **Step 1: Write the failing tests**

In `"renders the composite cell and remaining column headers"`, replace the matchup line:

```tsx
expect(screen.getByTestId("board-row-name")).toHaveTextContent("Caitlin Clark");
expect(screen.getByTestId("board-row-matchup")).toHaveTextContent("IND @ NYL");
```

with:

```tsx
expect(screen.getByTestId("board-row-name")).toHaveTextContent("Caitlin Clark");
expect(screen.queryByTestId("board-row-matchup")).not.toBeInTheDocument();
expect(screen.queryByText("IND @ NYL")).not.toBeInTheDocument();
```

Keep the existing `board-row-market` / line / IP assertions that follow.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/features/basketball/league/WnbaPropPicksTable.test.tsx
```

Expected: FAIL — `board-row-matchup` still present.

- [ ] **Step 3: Remove matchup from CompositeCell**

Delete `formatMatchup` from `WnbaPropPicksTable.tsx`.

Replace `CompositeCell` with:

```tsx
function CompositeCell({ row }: { row: ApiWnbaPropBoardRow }) {
  return (
    <div className="flex min-w-[14rem] items-center gap-2.5">
      <PlayerIcon row={row} />
      <div className="min-w-0 grow truncate">
        <div
          data-testid="board-row-headline"
          className="flex min-w-0 items-center gap-1.5"
        >
          <span
            data-testid="board-row-name"
            className="min-w-0 truncate font-bold text-c3"
          >
            {row.player_name}
          </span>
        </div>
        <p
          data-testid="board-row-market"
          className="truncate text-sm font-bold text-c3"
        >
          {row.market_label}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd frontend && npm test -- src/features/basketball/league/WnbaPropPicksTable.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  frontend/src/features/basketball/league/WnbaPropPicksTable.tsx \
  frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx
git commit -m "$(cat <<'EOF'
Drop matchup from WNBA prop Proposition cell.

EOF
)"
```

---

### Task 3: NBA Proposition drops matchup

**Files:**
- Modify: `frontend/src/features/nba/league/NbaPropPicksTable.tsx` (`formatMatchup` ~88–93; `CompositeCell` ~310–349)
- Modify: `frontend/src/features/nba/league/NbaPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: `row.player_name`, `row.market_label`, `PlayerIcon`.
- Produces: same Proposition contract as Task 1 (NBA fixtures).

- [ ] **Step 1: Write the failing test**

Add to `NbaPropPicksTable.test.tsx` inside the existing `describe`:

```tsx
it("does not show a matchup next to the player name", () => {
  render(<NbaPropPicksTable rows={[fixtureRow()]} />);
  expect(screen.getByTestId("board-row-name")).toHaveTextContent("Jayson Tatum");
  expect(screen.getByTestId("board-row-market")).toHaveTextContent(
    "Over 27.5 Points",
  );
  expect(screen.queryByTestId("board-row-matchup")).not.toBeInTheDocument();
  expect(screen.queryByText("BOS @ NYK")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/features/nba/league/NbaPropPicksTable.test.tsx
```

Expected: FAIL — `board-row-matchup` still present (or `BOS @ NYK` still rendered).

- [ ] **Step 3: Remove matchup from CompositeCell**

Delete `formatMatchup` from `NbaPropPicksTable.tsx`.

Replace `CompositeCell` with:

```tsx
function CompositeCell({ row }: { row: ApiNbaPropBoardRow }) {
  return (
    <div className="flex min-w-[14rem] items-center gap-2.5">
      <PlayerIcon row={row} />
      <div className="min-w-0 grow truncate">
        <div
          data-testid="board-row-headline"
          className="flex min-w-0 items-center gap-1.5"
        >
          <span
            data-testid="board-row-name"
            className="min-w-0 truncate font-bold text-c3"
          >
            {row.player_name}
          </span>
        </div>
        <p
          data-testid="board-row-market"
          className="truncate text-sm font-bold text-c3"
        >
          {row.market_label}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd frontend && npm test -- src/features/nba/league/NbaPropPicksTable.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  frontend/src/features/nba/league/NbaPropPicksTable.tsx \
  frontend/src/features/nba/league/NbaPropPicksTable.test.tsx
git commit -m "$(cat <<'EOF'
Drop matchup from NBA prop Proposition cell.

EOF
)"
```

---
