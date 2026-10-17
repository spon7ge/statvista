# Prop Board Line Logo Odds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stack the Line column on MLB, WNBA, and NBA prop boards so the anchor line sits above the selected book’s logo and American odds.

**Architecture:** Each league’s `*PropPicksTable` already has a local `BookMark`, `postedAmerican` (PrizePicks → `-137`), and `formatAmericanOdds`. Replace the single-line Line `<td>` with a two-row stack; leave Odds, API, and `?book=` alone. No shared Line cell package.

**Tech Stack:** React 19, Vitest, Testing Library, Tailwind utility classes already used by Odds chips (`inline-flex items-center gap-1`).

## Global Constraints

- Product name in any new copy is **statvista**.
- Do not change board API, schemas, or `?book=` behavior.
- Do not change the Odds column.
- Do not add a shared Line cell module across leagues.
- PrizePicks missing American is still **-137** via existing `postedAmerican`.
- Other books with missing American show **—** on the bottom row (still with `BookMark`).
- Line cell stays plain (no outbound link).
- Spacing on the bottom row matches Odds chips: `inline-flex items-center gap-1`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` | Stack Line cell for MLB |
| `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx` | Assert line + American + PrizePicks mark; non-PP dash |
| `frontend/src/features/basketball/league/WnbaPropPicksTable.tsx` | Same stack for WNBA |
| `frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx` | Same assertions |
| `frontend/src/features/nba/league/NbaPropPicksTable.tsx` | Same stack for NBA |
| `frontend/src/features/nba/league/NbaPropPicksTable.test.tsx` | New table tests (NBA has page tests only today) |
| `md/system-design.md` | Line copy on `/mlb|wnba|nba/prop_picks` rows |

---

### Task 1: MLB Line cell stacks logo + odds

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` (Line `<td>` ~493–501)
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: local `BookMark`, `postedAmerican`, `formatAmericanOdds`, `bookDisplayName`; `row.line`, `row.anchor.book`, `row.anchor.american`.
- Produces: `data-testid="line-cell"` with top text = line number and bottom row = BookMark + American (or —).

- [ ] **Step 1: Write the failing tests**

In `MlbPropPicksTable.test.tsx`, extend the existing `"renders board columns and no dfs tabs"` test so the line cell also has the PrizePicks mark:

```tsx
const lineCell = screen.getByTestId("line-cell");
expect(lineCell).toHaveTextContent("1.5");
expect(lineCell).toHaveTextContent("-137");
expect(
  lineCell.querySelector('svg[aria-label="PrizePicks"]'),
).toBeTruthy();
```

Add the same SVG assertion inside `"puts the PrizePicks American in the line cell with no de-vig percent"` after the `-137` check.

Add a new test for a non-PrizePicks anchor with null American:

```tsx
it("stacks the anchor book mark and em dash when American is missing", () => {
  render(
    <MlbPropPicksTable
      rows={[
        fixtureRow({
          anchor: {
            book: "draftkings",
            american: null,
            url: null,
            line: 1.5,
            devig_pct: null,
            over_american: null,
            under_american: null,
          },
        }),
      ]}
    />,
  );
  const lineCell = screen.getByTestId("line-cell");
  expect(lineCell).toHaveTextContent("1.5");
  expect(lineCell).toHaveTextContent("—");
  expect(
    lineCell.querySelector('svg[aria-label="DraftKings"]'),
  ).toBeTruthy();
  expect(lineCell).not.toHaveTextContent("-137");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/features/mlb/league/MlbPropPicksTable.test.tsx
```

Expected: FAIL — PrizePicks / DraftKings SVG not found inside `line-cell` (odds text may still pass from the old single-line layout).

- [ ] **Step 3: Implement the stacked Line cell**

In `MlbPropPicksTable.tsx`, replace the Line `<td>` body (the `{row.line}{" "}` / ternary block) with:

```tsx
<td
  className={`px-2 py-2 font-mono text-sm text-c3 ${ROW_BOX_MIDDLE}`}
  data-testid="line-cell"
>
  {(() => {
    const displayAmerican = postedAmerican(
      row.anchor.book,
      row.anchor.american,
    );
    const oddsText =
      displayAmerican == null
        ? "—"
        : formatAmericanOdds(displayAmerican);
    return (
      <div className="flex flex-col gap-0.5">
        <span>{row.line}</span>
        <span className="inline-flex items-center gap-1">
          <BookMark
            book={row.anchor.book}
            label={bookDisplayName(row.anchor.book)}
          />
          <span className="font-mono text-[12px] text-c3">
            {oddsText}
          </span>
        </span>
      </div>
    );
  })()}
</td>
```

Keep the existing `td` className and `data-testid`. Do not wrap the stack in an `<a>`.

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
Stack MLB prop Line as logo and odds.

EOF
)"
```

---

### Task 2: WNBA Line cell stacks logo + odds

**Files:**
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksTable.tsx` (Line `<td>` ~493–501)
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: local `BookMark`, `postedAmerican`, `formatAmericanOdds`, `bookDisplayName`; `row.line`, `row.anchor.book`, `row.anchor.american`.
- Produces: same `line-cell` contract as Task 1 (WNBA fixtures use line `18.5`).

- [ ] **Step 1: Write the failing tests**

In `WnbaPropPicksTable.test.tsx`, extend `"renders board columns and no dfs tabs"`:

```tsx
const lineCell = screen.getByTestId("line-cell");
expect(lineCell).toHaveTextContent("18.5");
expect(lineCell).toHaveTextContent("-137");
expect(
  lineCell.querySelector('svg[aria-label="PrizePicks"]'),
).toBeTruthy();
```

Add the same SVG assertion in `"puts the PrizePicks American in the line cell with no de-vig percent"` and in `"renders the composite cell and remaining column headers"` after the existing `-137` check (composite test currently only asserts `18.5` on line — keep `-137` and add the SVG).

Add:

```tsx
it("stacks the anchor book mark and em dash when American is missing", () => {
  render(
    <WnbaPropPicksTable
      rows={[
        fixtureRow({
          anchor: {
            book: "draftkings",
            american: null,
            url: null,
            line: 18.5,
            devig_pct: null,
            over_american: null,
            under_american: null,
          },
        }),
      ]}
    />,
  );
  const lineCell = screen.getByTestId("line-cell");
  expect(lineCell).toHaveTextContent("18.5");
  expect(lineCell).toHaveTextContent("—");
  expect(
    lineCell.querySelector('svg[aria-label="DraftKings"]'),
  ).toBeTruthy();
  expect(lineCell).not.toHaveTextContent("-137");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/features/basketball/league/WnbaPropPicksTable.test.tsx
```

Expected: FAIL — PrizePicks / DraftKings SVG not inside `line-cell`.

- [ ] **Step 3: Implement the stacked Line cell**

Same replacement as Task 1 Step 3, in `WnbaPropPicksTable.tsx` (identical JSX; file already imports `bookDisplayName` and defines `BookMark` / `postedAmerican`).

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
Stack WNBA prop Line as logo and odds.

EOF
)"
```

---

### Task 3: NBA Line cell stacks logo + odds

**Files:**
- Modify: `frontend/src/features/nba/league/NbaPropPicksTable.tsx` (Line `<td>` ~493–501)
- Create: `frontend/src/features/nba/league/NbaPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: local `BookMark`, `postedAmerican`, `formatAmericanOdds`, `bookDisplayName`; `ApiNbaPropBoardRow`.
- Produces: same `line-cell` contract; new focused table tests (page tests stay as-is).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/nba/league/NbaPropPicksTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApiNbaPropBoardRow } from "@/shared/lib/api";
import { NbaPropPicksTable } from "./NbaPropPicksTable";

function fixtureRow(
  over: Partial<ApiNbaPropBoardRow> = {},
): ApiNbaPropBoardRow {
  return {
    player_name: "Jayson Tatum",
    headshot_url: null,
    team_abbrev: "BOS",
    opponent_abbrev: "NYK",
    home_away: "away",
    stat: "points",
    market_label: "Over 27.5 Points",
    side: "over",
    line: 27.5,
    game_id: "401810001",
    game_start_at: "2026-10-23T23:30:00Z",
    anchor: {
      book: "prizepicks",
      american: -137,
      url: null,
      line: 27.5,
      devig_pct: null,
      over_american: -137,
      under_american: -137,
    },
    books: [{ book: "draftkings", american: -110, url: null, line: 27.5 }],
    ip_pct: 55,
    opp_def_rank: null,
    opp_def_label: null,
    opp_pace_rank: null,
    opp_pace_label: null,
    hit_l5: 80,
    hit_l10: 70,
    hit_l15: 60,
    hit_h2h: 50,
    ...over,
  };
}

describe("NbaPropPicksTable", () => {
  it("stacks the PrizePicks mark under the line number", () => {
    render(<NbaPropPicksTable rows={[fixtureRow()]} />);
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("27.5");
    expect(lineCell).toHaveTextContent("-137");
    expect(
      lineCell.querySelector('svg[aria-label="PrizePicks"]'),
    ).toBeTruthy();
  });

  it("stacks the anchor book mark and em dash when American is missing", () => {
    render(
      <NbaPropPicksTable
        rows={[
          fixtureRow({
            anchor: {
              book: "draftkings",
              american: null,
              url: null,
              line: 27.5,
              devig_pct: null,
              over_american: null,
              under_american: null,
            },
          }),
        ]}
      />,
    );
    const lineCell = screen.getByTestId("line-cell");
    expect(lineCell).toHaveTextContent("27.5");
    expect(lineCell).toHaveTextContent("—");
    expect(
      lineCell.querySelector('svg[aria-label="DraftKings"]'),
    ).toBeTruthy();
    expect(lineCell).not.toHaveTextContent("-137");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npm test -- src/features/nba/league/NbaPropPicksTable.test.tsx
```

Expected: FAIL — PrizePicks / DraftKings SVG not inside `line-cell` (or layout still single-line).

- [ ] **Step 3: Implement the stacked Line cell**

Same replacement as Task 1 Step 3, in `NbaPropPicksTable.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd frontend && npm test -- src/features/nba/league/NbaPropPicksTable.test.tsx
```

Expected: PASS

Also smoke the page suite (unchanged contract, still uses the table):

```bash
cd frontend && npm test -- src/pages/NbaPropPicksPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  frontend/src/features/nba/league/NbaPropPicksTable.tsx \
  frontend/src/features/nba/league/NbaPropPicksTable.test.tsx
git commit -m "$(cat <<'EOF'
Stack NBA prop Line as logo and odds.

EOF
)"
```

---

### Task 4: Document Line stack in system-design

**Files:**
- Modify: `md/system-design.md` (rows for `/wnba/prop_picks`, `/nba/prop_picks`, `/mlb/prop_picks`)

**Interfaces:**
- Consumes: approved Line wording from `docs/superpowers/specs/2026-10-16-prop-board-line-logo-odds-design.md`.
- Produces: page ↔ API table Line copy that matches the UI.

- [ ] **Step 1: Update the three prop_picks rows**

In each of the three table cells that currently say:

```text
Line (anchor number + American; PrizePicks -137)
```

replace with:

```text
Line (stacked: anchor number above selected book logo + American; PrizePicks -137)
```

Do not edit Odds, IP, filters, or hook/API columns.

- [ ] **Step 2: Confirm the three rows**

Run:

```bash
rg -n "Line \(stacked: anchor number above selected book logo" md/system-design.md
```

Expected: exactly three matches (WNBA, NBA, MLB).

Run:

```bash
rg -n "Line \(anchor number \+ American" md/system-design.md
```

Expected: no matches on those three prop_picks rows.

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md
git commit -m "$(cat <<'EOF'
Document stacked prop Line cells in system-design.

EOF
)"
```

---
