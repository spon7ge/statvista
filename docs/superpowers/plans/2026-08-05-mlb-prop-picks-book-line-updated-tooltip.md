# MLB Prop Picks Book Line Updated Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/mlb/prop_picks` expand, show each sportsbook cell’s absolute “Last updated …” on hover (native `title`), remove inline relative ages and the DFS footer age, and wrap the five book cells into two rows.

**Architecture:** Frontend-only. Reuse `MlbPropBookQuote.changed_at` already returned by `GET /api/mlb/props/today`. Pass board `lastUpdatedAt` into expand cells as fallback. Format tooltips with existing `formatMlbPropPicksUpdatedAt`. No API, OpenAPI, or scraper changes.

**Tech Stack:** React + Vitest + Testing Library, existing Tailwind, native `title` attribute

**Spec:** `docs/superpowers/specs/2026-08-05-mlb-prop-picks-book-line-updated-tooltip-design.md`

## Global Constraints

- Board “Last updated …” stays React Query `dataUpdatedAt` (already wired on `MlbPropPicksPage`)
- Per-book field remains `changed_at` (no rename to `last_updated`)
- Tooltip copy: `Last updated {formatMlbPropPicksUpdatedAt(ms)}`
- Fallback order: valid `quote.changed_at` → board `lastUpdatedAt` → omit `title`
- “No line” cells: no `title`
- Book grid: `grid grid-cols-2 gap-2 sm:grid-cols-3` (not `lg:grid-cols-5`)
- Remove expand footer “DFS line updated …”
- Product name: **statvista**
- Do not commit secrets (e.g. `.session_cookie.txt`)

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Resolve tooltip ms; `BookQuoteCell` `title`; wire `lastUpdatedAt`; two-row grid; drop relative age + DFS footer |
| `frontend/src/features/mlb/league/MlbPropPicksList.test.tsx` | Tooltip, fallback, removal, grid class tests |
| `docs/superpowers/specs/2026-08-05-mlb-prop-picks-book-line-updated-tooltip-design.md` | Spec (already approved; set Status → Implemented when done) |

`MlbPropPicksPage` already passes `lastUpdatedAt={dataUpdatedAt \|\| undefined}` — no page change unless wiring is broken.

---

### Task 1: Book-cell tooltip + expand cleanup

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.test.tsx`
- Modify: `docs/superpowers/specs/2026-08-05-mlb-prop-picks-book-line-updated-tooltip-design.md` (Status → Implemented at end)

**Interfaces:**
- Consumes: `ApiMlbPropBookQuote.changed_at`, `MlbPropPicksListProps.lastUpdatedAt`, `formatMlbPropPicksUpdatedAt(ms: number): string`
- Produces: `resolveBookLastUpdatedMs(changedAt: string | null | undefined, boardLastUpdatedAt: number | undefined): number | null` (exported for tests or kept module-private — prefer export next to `formatMlbPropPicksUpdatedAt` for unit-testability)

- [ ] **Step 1: Write failing tests**

In `MlbPropPicksList.test.tsx`, import `formatMlbPropPicksUpdatedAt` (and `resolveBookLastUpdatedMs` if exported). Add:

```tsx
it("sets book cell title from quote.changed_at on expand", async () => {
  const user = userEvent.setup();
  const boardMs = Date.parse("2026-08-05T20:00:00Z");
  render(
    <MlbPropPicksList
      props={[judge]}
      format="power"
      legs={4}
      breakevenPct={54.3}
      lastUpdatedAt={boardMs}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Aaron Judge/i }));
  const expanded = screen.getByTestId("mlb-prop-row-expand");
  const px = within(expanded).getByText("ProphetX").closest("div");
  expect(px).toHaveAttribute(
    "title",
    `Last updated ${formatMlbPropPicksUpdatedAt(Date.parse("2026-08-05T19:50:00Z"))}`,
  );
  expect(within(expanded).queryByText(/ago/i)).not.toBeInTheDocument();
  expect(within(expanded).queryByText(/DFS line updated/i)).not.toBeInTheDocument();
});

it("falls back book cell title to board lastUpdatedAt when changed_at is null", async () => {
  const user = userEvent.setup();
  const boardMs = Date.parse("2026-08-05T20:00:00Z");
  const withNullChanged = row({
    player_name: "Aaron Judge",
    books: {
      ...judge.books,
      prophetx: {
        side: "over",
        fair_pct: 58.5,
        american: -140,
        changed_at: null,
        role: null,
      },
    },
  });
  render(
    <MlbPropPicksList
      props={[withNullChanged]}
      format="power"
      legs={4}
      breakevenPct={54.3}
      lastUpdatedAt={boardMs}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Aaron Judge/i }));
  const expanded = screen.getByTestId("mlb-prop-row-expand");
  const px = within(expanded).getByText("ProphetX").closest("div");
  expect(px).toHaveAttribute(
    "title",
    `Last updated ${formatMlbPropPicksUpdatedAt(boardMs)}`,
  );
});

it("lays out expand books on two rows (not five-across)", async () => {
  const user = userEvent.setup();
  render(
    <MlbPropPicksList
      props={[judge]}
      format="power"
      legs={4}
      breakevenPct={54.3}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Aaron Judge/i }));
  const expanded = screen.getByTestId("mlb-prop-row-expand");
  const booksGrid = within(expanded).getByText("ProphetX").closest(".grid");
  expect(booksGrid?.className).toMatch(/grid-cols-2/);
  expect(booksGrid?.className).toMatch(/sm:grid-cols-3/);
  expect(booksGrid?.className).not.toMatch(/lg:grid-cols-5/);
});
```

Also add a small unit test for the resolver if exported:

```tsx
import { resolveBookLastUpdatedMs } from "./MlbPropPicksList";

describe("resolveBookLastUpdatedMs", () => {
  it("prefers changed_at over board", () => {
    expect(
      resolveBookLastUpdatedMs("2026-08-05T19:50:00Z", Date.parse("2026-08-05T20:00:00Z")),
    ).toBe(Date.parse("2026-08-05T19:50:00Z"));
  });
  it("falls back to board when changed_at null or invalid", () => {
    const board = Date.parse("2026-08-05T20:00:00Z");
    expect(resolveBookLastUpdatedMs(null, board)).toBe(board);
    expect(resolveBookLastUpdatedMs("not-a-date", board)).toBe(board);
  });
  it("returns null when neither available", () => {
    expect(resolveBookLastUpdatedMs(null, undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- --run src/features/mlb/league/MlbPropPicksList.test.tsx`

Expected: FAIL — missing `title` / still showing relative age or DFS footer / still `lg:grid-cols-5` / missing `resolveBookLastUpdatedMs`.

- [ ] **Step 3: Implement helper + UI**

In `MlbPropPicksList.tsx`:

1. Add and export:

```tsx
export function resolveBookLastUpdatedMs(
  changedAt: string | null | undefined,
  boardLastUpdatedAt: number | undefined,
): number | null {
  if (changedAt) {
    const ms = Date.parse(changedAt);
    if (!Number.isNaN(ms)) return ms;
  }
  if (boardLastUpdatedAt != null && !Number.isNaN(boardLastUpdatedAt)) {
    return boardLastUpdatedAt;
  }
  return null;
}
```

2. Update `BookQuoteCell` to accept `lastUpdatedAt?: number` and set `title` when a quote exists:

```tsx
function BookQuoteCell({
  bookKey,
  quote,
  lastUpdatedAt,
}: {
  bookKey: string;
  quote: ApiMlbPropBookQuote | null;
  lastUpdatedAt?: number;
}) {
  const updatedMs = quote
    ? resolveBookLastUpdatedMs(quote.changed_at, lastUpdatedAt)
    : null;
  const title =
    updatedMs != null
      ? `Last updated ${formatMlbPropPicksUpdatedAt(updatedMs)}`
      : undefined;

  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded-md bg-[#45484d] px-2 py-1.5 text-center"
      title={title}
    >
      {/* label unchanged */}
      {quote ? (
        <>
          <span className="font-mono text-[18px] text-white/90">
            {sideLabel(quote.side)}{" "}
            {quote.fair_pct !== null ? formatFair(quote.fair_pct) : "—"}
          </span>
          <span className="text-[14px] text-white/40">
            {quote.american !== null ? formatAmericanOdds(quote.american) : "—"}
          </span>
        </>
      ) : (
        <span className="text-[14px] text-white/20">No line</span>
      )}
    </div>
  );
}
```

3. `ExpandedPanel` / `PropPickCard`: accept `lastUpdatedAt?: number`, pass into each `BookQuoteCell`. Change books grid to:

```tsx
<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
```

4. Remove the DFS footer span (`DFS line updated …`). Keep edge spans + `fair_explain`.

5. In the list map, pass `lastUpdatedAt` into `PropPickCard`.

6. Remove `formatAge` if it becomes unused (delete the function).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- --run src/features/mlb/league/MlbPropPicksList.test.tsx`

Expected: PASS (all tests in file).

- [ ] **Step 5: Mark spec Implemented**

In `docs/superpowers/specs/2026-08-05-mlb-prop-picks-book-line-updated-tooltip-design.md`, set `Status: Implemented`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mlb/league/MlbPropPicksList.tsx \
  frontend/src/features/mlb/league/MlbPropPicksList.test.tsx \
  docs/superpowers/specs/2026-08-05-mlb-prop-picks-book-line-updated-tooltip-design.md
git commit -m "$(cat <<'EOF'
feat(frontend): per-book last-updated tooltip on MLB prop expand

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Keep board Last updated | Unchanged (page already wires it) |
| Hover title from `changed_at` | Task 1 |
| Absolute format via `formatMlbPropPicksUpdatedAt` | Task 1 |
| Fallback to board `lastUpdatedAt` | Task 1 |
| No title on “No line” | Task 1 |
| Remove inline relative age | Task 1 |
| Remove DFS footer age | Task 1 |
| Two-row book grid | Task 1 |
| No API/scraper changes | N/A (explicit non-goals) |

## Self-review

- No placeholders; helper signature and test assertions are concrete.
- `judge.books.prophetx.changed_at` in fixtures is `"2026-08-05T19:50:00Z"` — matches Step 1 expected title.
- Title is on the cell root `div` (same node as `closest("div")` from “ProphetX” label’s parent) — if DOM nesting fails the query, prefer `getByText("ProphetX").parentElement` or add `data-testid={`mlb-prop-book-${bookKey}`}` on the cell root and assert that instead (acceptable plan tweak during implementation if needed).
