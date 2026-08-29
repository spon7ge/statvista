# MLB Prop Board DFS Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **DFS** column on `/mlb/prop_picks` for PrizePicks/Underdog at the row’s exact line, and keep **Odds** as sportsbooks only at that same number.

**Architecture:** `GET /api/mlb/props/board` still clusters sportsbook mains ∪ DFS mains by `(player_key, stat, line)`. Split `_chips_for_side` so `row.dfs` is PrizePicks/Underdog and `row.books` is sportsbooks. The table inserts DFS between Line and Odds. Clustering, IP, L5–L15, and `GET /api/mlb/props/today` stay unchanged.

**Tech Stack:** FastAPI + Pydantic, pytest, React 19 + Vite + Vitest + Testing Library, existing OpenAPI export (`PYTHONPATH=.:backend python3 scripts/export_openapi.py` then `cp frontend/openapi.json backend/openapi-golden.json` then `cd frontend && npm run generate:api`).

**Spec:** `docs/superpowers/specs/2026-08-28-mlb-prop-board-dfs-column-design.md`

## Global Constraints

- Product name in user-facing copy: **statvista**
- Do **not** change `GET /api/mlb/props/today` or game-detail Props tabs
- WNBA `/wnba/prop_picks` is out of scope
- No PrizePicks / Underdog **tabs** on `/mlb/prop_picks`
- Row grain unchanged: `player + canonical stat + exact line + side`
- Line seed unchanged: sportsbook mains ∪ PrizePicks/Underdog mains; no alt ladders
- DFS fills only when PrizePicks or Underdog posted **this row’s** line; otherwise `—`
- Pinnacle 20.5 still appears when PrizePicks is 19.5 (two rows)
- DFS chips: logo + American; PrizePicks UI **-137**; `devig_pct` always null; no de-vig `%` in the DFS cell
- Odds chips: sportsbooks only; American + de-vig `%` when two-way
- IP unchanged; DFS never sets IP
- DFS header is **not** a sort key
- Board still **200** when enrichments fail
- OpenAPI must stay in sync (`export_openapi` + `npm run generate:api`)
- Tests ship with code; TDD per task
- Brand / docs: follow `md/claude.md` (small modules, typed, early validation)

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_prop_board.py` | Add `dfs` on `MlbPropBoardRow` |
| `backend/app/domains/mlb/prop_board_cluster.py` | `DFS_CHIP_ORDER` / sportsbook order (no clustering change) |
| `backend/app/domains/mlb/prop_board.py` | Split chips into `dfs` vs `books`; emit row if either list is nonempty |
| `backend/tests/test_mlb_prop_board_schema.py` | Default `dfs: []` |
| `backend/tests/test_mlb_prop_board.py` | Assembler split + existing chip assertions |
| `backend/tests/integration/test_mlb_prop_board_db.py` | PrizePicks extra line lives in `dfs` |
| `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts` | `dfs` on board row |
| `frontend/src/features/mlb/league/filterMlbPropBoard.ts` | Posted chips + book trim on `dfs` ∪ `books` |
| `frontend/src/features/mlb/league/sortMlbPropBoard.ts` | DFS chip order; Odds sort stays first sportsbook American |
| `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` | DFS column between Line and Odds |
| `md/system-design.md` | `/mlb/prop_picks` page ↔ API row |

---

### Task 1: Schema `dfs` + OpenAPI + fixture defaults

**Files:**
- Modify: `backend/app/domains/mlb/schemas_prop_board.py`
- Modify: `backend/tests/test_mlb_prop_board_schema.py`
- Modify: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`
- Modify fixtures to include `dfs: []`: `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx`, `frontend/src/features/mlb/league/filterMlbPropBoard.test.ts`, `frontend/src/pages/MlbPropPicksPage.test.tsx`

**Interfaces:**
- Consumes: existing `MlbPropBoardBookChip`
- Produces: `MlbPropBoardRow.dfs: list[MlbPropBoardBookChip] = Field(default_factory=list)` (same chip shape as `books`)

- [ ] **Step 1: Write the failing schema test**

Add to `backend/tests/test_mlb_prop_board_schema.py` inside `test_board_row_requires_side_and_line` (after constructing `row` without passing `dfs`):

```python
    assert row.dfs == []
    dumped = row.model_dump()
    assert dumped["dfs"] == []
    assert "dfs" in dumped
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_prop_board_schema.py::test_board_row_requires_side_and_line -v`

Expected: FAIL — `dfs` missing on the model / dumped dict.

- [ ] **Step 3: Add `dfs` on the row schema**

In `backend/app/domains/mlb/schemas_prop_board.py`, on `MlbPropBoardRow` immediately **before** `books`:

```python
    dfs: list[MlbPropBoardBookChip] = Field(default_factory=list)
    books: list[MlbPropBoardBookChip] = Field(default_factory=list)
```

- [ ] **Step 4: Re-run schema test**

Run: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_prop_board_schema.py -v`

Expected: PASS

- [ ] **Step 5: Export OpenAPI and regenerate TS types**

Run from repo root:

```bash
PYTHONPATH=.:backend python3 scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `MlbPropBoardRow` in `frontend/src/shared/lib/api.schema.d.ts` includes `dfs: components["schemas"]["MlbPropBoardBookChip"][];`

- [ ] **Step 6: Add `dfs: []` to board-row fixtures**

In each helper that builds a full `ApiMlbPropBoardRow` (`fixtureRow` / `row`), add `dfs: []` next to `books` so TypeScript still typechecks.

- [ ] **Step 7: Commit**

```bash
git add backend/app/domains/mlb/schemas_prop_board.py backend/tests/test_mlb_prop_board_schema.py frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx frontend/src/features/mlb/league/filterMlbPropBoard.test.ts frontend/src/pages/MlbPropPicksPage.test.tsx
git commit -m "$(cat <<'EOF'
Add dfs chip list to the MLB prop board row schema.

EOF
)"
```

---

### Task 2: Split assembler chips into `dfs` vs `books`

**Files:**
- Modify: `backend/app/domains/mlb/prop_board_cluster.py`
- Modify: `backend/app/domains/mlb/prop_board.py` (`_chips_for_side` and the row-emit loop)
- Modify: `backend/tests/test_mlb_prop_board.py`
- Modify: `backend/tests/integration/test_mlb_prop_board_db.py`

**Interfaces:**
- Consumes: `Cluster`, `BOOK_CHIP_ORDER`, `MlbPropBoardBookChip`, `devig_pct_for_side`
- Produces:
  - `DFS_CHIP_ORDER = ("prizepicks", "underdog")`
  - `SPORTSBOOK_CHIP_ORDER` = current `BOOK_CHIP_ORDER` without those two
  - `_chips_for_side(cluster, side) -> tuple[list[MlbPropBoardBookChip], list[MlbPropBoardBookChip]]`  # (dfs, books)
  - Row emitted when `dfs or books` is nonempty
  - DFS chips: `devig_pct=None`; PrizePicks `american=None` still allowed; Underdog omitted when that side has no American
  - Sportsbook chips: omit when American is missing; `devig_pct` as today

- [ ] **Step 1: Write failing assembler tests**

Append to `backend/tests/test_mlb_prop_board.py` (reuse the existing `monkeypatch` + `get_mlb_prop_board` pattern from `test_assembler_splits_lines_and_null_ip_for_dfs_only`):

```python
@pytest.mark.asyncio
async def test_assembler_splits_dfs_and_sportsbook_lines(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=19.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=19.5,
            book="underdog",
            over_american=-105,
            under_american=-115,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=19.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=20.5,
            book="pinnacle",
            over_american=-108,
            under_american=-112,
        ),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )
    body = await get_mlb_prop_board()
    lines = sorted({r.line for r in body.rows})
    assert lines == [19.5, 20.5]
    over_195 = next(r for r in body.rows if r.line == 19.5 and r.side == "over")
    assert [c.book for c in over_195.dfs] == ["prizepicks", "underdog"]
    assert [c.american for c in over_195.dfs] == [None, -105]
    assert all(c.devig_pct is None for c in over_195.dfs)
    assert [c.book for c in over_195.books] == ["prophetx"]
    assert over_195.books[0].devig_pct == 50
    over_205 = next(r for r in body.rows if r.line == 20.5 and r.side == "over")
    assert over_205.dfs == []
    assert [c.book for c in over_205.books] == ["pinnacle"]
```

- [ ] **Step 2: Run the new test (RED)**

Run: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_prop_board.py::test_assembler_splits_dfs_and_sportsbook_lines -v`

Expected: FAIL — `dfs` empty / PrizePicks still on `books`.

- [ ] **Step 3: Add chip-order constants**

In `backend/app/domains/mlb/prop_board_cluster.py`, after `BOOK_CHIP_ORDER`:

```python
DFS_CHIP_ORDER = ("prizepicks", "underdog")
SPORTSBOOK_CHIP_ORDER = tuple(
    book for book in BOOK_CHIP_ORDER if book not in DFS_CHIP_ORDER
)
```

Leave `BOOK_CHIP_ORDER` itself unchanged (still includes DFS books) so any leftover consumers keep a total order.

- [ ] **Step 4: Split `_chips_for_side` and the emit loop**

Replace `_chips_for_side` in `backend/app/domains/mlb/prop_board.py` with:

```python
def _chip_for_quote(
    quote: BoardQuote,
    side: Side,
    *,
    allow_missing_american: bool,
    include_devig: bool,
) -> MlbPropBoardBookChip | None:
    american = quote.over_american if side == "over" else quote.under_american
    if american is None and not allow_missing_american:
        return None
    return MlbPropBoardBookChip(
        book=quote.book,
        american=american,
        url=quote.url,
        devig_pct=(
            None
            if not include_devig
            else devig_pct_for_side(
                quote.over_american, quote.under_american, side
            )
        ),
    )


def _chips_for_side(
    cluster: Cluster, side: Side
) -> tuple[list[MlbPropBoardBookChip], list[MlbPropBoardBookChip]]:
    by_book = {quote.book: quote for quote in cluster.quotes}
    dfs: list[MlbPropBoardBookChip] = []
    books: list[MlbPropBoardBookChip] = []
    for book in DFS_CHIP_ORDER:
        quote = by_book.get(book)
        if quote is None:
            continue
        chip = _chip_for_quote(
            quote,
            side,
            allow_missing_american=book == "prizepicks",
            include_devig=False,
        )
        if chip is not None:
            dfs.append(chip)
    for book in SPORTSBOOK_CHIP_ORDER:
        quote = by_book.get(book)
        if quote is None:
            continue
        chip = _chip_for_quote(
            quote,
            side,
            allow_missing_american=False,
            include_devig=True,
        )
        if chip is not None:
            books.append(chip)
    return dfs, books
```

Import `DFS_CHIP_ORDER` and `SPORTSBOOK_CHIP_ORDER` from `prop_board_cluster` (keep existing `BOOK_CHIP_ORDER` import only if still used in this file).

In the emit loop, replace:

```python
            chips = _chips_for_side(cluster, side)
            if not chips:
                continue
            rows.append(
                MlbPropBoardRow(
                    ...
                    books=chips,
```

with:

```python
            dfs_chips, book_chips = _chips_for_side(cluster, side)
            if not dfs_chips and not book_chips:
                continue
            rows.append(
                MlbPropBoardRow(
                    ...
                    dfs=dfs_chips,
                    books=book_chips,
```

- [ ] **Step 5: Update existing assembler assertions**

In `test_chips_skip_books_without_american_on_that_side`:

```python
    assert [c.book for c in over.books] == ["draftkings", "fanduel"]
    assert [c.american for c in over.books] == [-115, -108]
    assert [c.book for c in over.dfs] == ["prizepicks"]
    assert [c.american for c in over.dfs] == [None]
    assert [c.book for c in under.books] == ["draftkings"]
    assert [c.american for c in under.books] == [-105]
    assert [c.book for c in under.dfs] == ["prizepicks"]
```

In `test_assembler_splits_lines_and_null_ip_for_dfs_only`, after `dfs = [r for r in body.rows if r.line == 2.0]`:

```python
    assert all(r.books == [] for r in dfs)
    assert all(any(c.book == "prizepicks" for c in r.dfs) for r in dfs)
```

In `backend/tests/integration/test_mlb_prop_board_db.py` `test_prizepicks_extra_line_has_null_ip`:

```python
    assert all(
        any(chip["book"] == "prizepicks" for chip in row["dfs"]) for row in dfs
    )
    assert all(row["books"] == [] for row in dfs)
```

- [ ] **Step 6: Run board tests (GREEN)**

Run:

```bash
PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_prop_board.py backend/tests/test_mlb_prop_board_cluster.py backend/tests/test_mlb_prop_board_schema.py -v
```

Expected: PASS

If integration tests are in the default pytest selection and this environment has the DB, also run `backend/tests/integration/test_mlb_prop_board_db.py`. If that file is skipped without DB fixtures, do not block the task — the assertion change still ships.

- [ ] **Step 7: Commit**

```bash
git add backend/app/domains/mlb/prop_board_cluster.py backend/app/domains/mlb/prop_board.py backend/tests/test_mlb_prop_board.py backend/tests/integration/test_mlb_prop_board_db.py
git commit -m "$(cat <<'EOF'
Split MLB board chips into dfs and sportsbook lists.

EOF
)"
```

---

### Task 3: Client filter and bookmaker options

**Files:**
- Modify: `frontend/src/features/mlb/league/filterMlbPropBoard.ts`
- Modify: `frontend/src/features/mlb/league/filterMlbPropBoard.test.ts`
- Modify: `frontend/src/features/mlb/league/sortMlbPropBoard.ts` (DFS chip order helper only)

**Interfaces:**
- Consumes: `ApiMlbPropBoardRow.dfs` and `.books`
- Produces:
  - `collectMlbBoardBookmakerOptions` unions books from `dfs` and `books`
  - `filterMlbPropBoardRows` trims PrizePicks/Underdog on `dfs` and sportsbooks on `books`; keeps a row if either trimmed list still has a posted chip; PrizePicks counts as posted
  - `DFS_CHIP_ORDER = ["prizepicks", "underdog"] as const`
  - `orderedDfsBooks(dfs)` sorts with that order
  - `firstOddsAmerican` continues to read `row.books` only (sportsbooks)

- [ ] **Step 1: Write failing filter tests**

Replace the “drops rows with no posted American odds” case so PrizePicks lives on `dfs`, and add two cases:

```typescript
  it("drops rows with no posted American odds", () => {
    const rows = [
      row({ player_name: "Aaron Judge", books: [], dfs: [] }),
      row({
        player_name: "Juan Soto",
        books: [{ book: "fanduel", american: null, url: null }],
        dfs: [],
      }),
      row({
        player_name: "Mookie Betts",
        books: [],
        dfs: [{ book: "prizepicks", american: null, url: null }],
      }),
      row({
        player_name: "Freddie Freeman",
        team_abbrev: "LAD",
        books: [{ book: "draftkings", american: -120, url: null }],
        dfs: [],
      }),
    ];
    expect(
      filterMlbPropBoardRows(rows, { teams: new Set(), query: "" }).map(
        (r) => r.player_name,
      ),
    ).toEqual(["Mookie Betts", "Freddie Freeman"]);
  });

  it("filters PrizePicks on dfs and clears Odds", () => {
    const rows = [
      row({
        player_name: "Aaron Judge",
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [{ book: "prophetx", american: -115, url: null }],
      }),
      row({
        player_name: "Mookie Betts",
        team_abbrev: "LAD",
        dfs: [],
        books: [{ book: "draftkings", american: -120, url: null }],
      }),
    ];
    const out = filterMlbPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["prizepicks"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].player_name).toBe("Aaron Judge");
    expect(out[0].dfs.map((chip) => chip.book)).toEqual(["prizepicks"]);
    expect(out[0].books).toEqual([]);
  });

  it("filters DraftKings on books and clears DFS", () => {
    const rows = [
      row({
        player_name: "Aaron Judge",
        dfs: [{ book: "prizepicks", american: null, url: null }],
        books: [{ book: "draftkings", american: -120, url: null }],
      }),
    ];
    const out = filterMlbPropBoardRows(rows, {
      teams: new Set(),
      query: "",
      books: new Set(["draftkings"]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].books.map((chip) => chip.book)).toEqual(["draftkings"]);
    expect(out[0].dfs).toEqual([]);
  });
```

Update `collects unique bookmaker options in chip order` so Underdog is on `dfs`:

```typescript
        row({
          dfs: [{ book: "underdog", american: -105, url: null }],
          books: [{ book: "draftkings", american: -120, url: null }],
        }),
```

Expected options stay `[{ value: "draftkings", label: "DraftKings" }, { value: "underdog", label: "Underdog" }]`.

- [ ] **Step 2: Run filter tests (RED)**

Run: `cd frontend && npm test -- --run src/features/mlb/league/filterMlbPropBoard.test.ts`

Expected: FAIL on PrizePicks-in-`dfs` keep / DK-clears-DFS.

- [ ] **Step 3: Implement filter**

In `frontend/src/features/mlb/league/filterMlbPropBoard.ts`, replace the posted/trim block inside `filterMlbPropBoardRows` with:

```typescript
    const dfs = row.dfs ?? [];
    const postedDfs = dfs.filter(
      (chip) => chip.book === "prizepicks" || chip.american != null,
    );
    const postedBooks = row.books.filter(
      (chip) => chip.american != null,
    );
    const visibleDfs =
      bookFilter.size > 0
        ? postedDfs.filter((chip) => bookFilter.has(chip.book))
        : postedDfs;
    const visibleBooks =
      bookFilter.size > 0
        ? postedBooks.filter((chip) => bookFilter.has(chip.book))
        : postedBooks;
    if (visibleDfs.length === 0 && visibleBooks.length === 0) return [];
    return [{ ...row, dfs: visibleDfs, books: visibleBooks }];
```

In `collectMlbBoardBookmakerOptions`, iterate both lists:

```typescript
    for (const chip of [...(row.dfs ?? []), ...row.books]) {
      if (chip.book) seen.add(chip.book);
    }
```

- [ ] **Step 4: Add `orderedDfsBooks`**

In `frontend/src/features/mlb/league/sortMlbPropBoard.ts`:

```typescript
export const DFS_CHIP_ORDER = ["prizepicks", "underdog"] as const;

export function orderedDfsBooks(
  dfs: ApiMlbPropBoardRow["dfs"],
): ApiMlbPropBoardRow["dfs"] {
  const rank = new Map<string, number>(
    DFS_CHIP_ORDER.map((book, index) => [book, index]),
  );
  return [...dfs].sort((a, b) => {
    const aRank = rank.get(a.book) ?? DFS_CHIP_ORDER.length;
    const bRank = rank.get(b.book) ?? DFS_CHIP_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;
    return a.book.localeCompare(b.book);
  });
}
```

Keep `BOOK_CHIP_ORDER` including prizepicks/underdog so the bookmaker dropdown rank is unchanged.

- [ ] **Step 5: Run filter tests (GREEN)**

Run: `cd frontend && npm test -- --run src/features/mlb/league/filterMlbPropBoard.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mlb/league/filterMlbPropBoard.ts frontend/src/features/mlb/league/filterMlbPropBoard.test.ts frontend/src/features/mlb/league/sortMlbPropBoard.ts
git commit -m "$(cat <<'EOF'
Filter MLB board rows using split dfs and sportsbook chips.

EOF
)"
```

---

### Task 4: DFS table column

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx`

**Interfaces:**
- Consumes: `row.dfs`, `orderedDfsBooks`, existing `BookChip` / `postedAmerican`
- Produces: columns **Proposition | Line | DFS | Odds | IP | L5 | L10 | L15 | H2H**; DFS not sortable; empty DFS `—`; no overflow on DFS; Odds never renders PP/UD; DFS never shows de-vig `%`

- [ ] **Step 1: Write failing table tests**

Update `renders board columns and no dfs tabs` to also expect `DFS` and `Odds`:

```typescript
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.getByText("DFS")).toBeInTheDocument();
    expect(screen.getByText("Odds")).toBeInTheDocument();
```

Move PrizePicks/Underdog cases off Odds:

```typescript
  it("renders PrizePicks in DFS at -137 with no de-vig percent", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            dfs: [{ book: "prizepicks", american: null, url: null }],
            books: [
              {
                book: "prophetx",
                american: -122,
                url: null,
                devig_pct: 54,
              },
            ],
          }),
        ]}
      />,
    );
    const dfs = screen.getByTestId("dfs-cell");
    expect(dfs.querySelector('svg[aria-label="PrizePicks"]')).toBeTruthy();
    expect(within(dfs).getByText("-137")).toBeInTheDocument();
    expect(within(dfs).queryByText("(54%)")).not.toBeInTheDocument();
    const odds = screen.getByTestId("odds-cell");
    expect(odds.querySelector('svg[aria-label="PrizePicks"]')).toBeNull();
    expect(odds).toHaveTextContent("-122 (54%)");
  });

  it("renders em dash in DFS when only a sportsbook line is present", () => {
    render(
      <MlbPropPicksTable
        rows={[
          fixtureRow({
            line: 20.5,
            dfs: [],
            books: [{ book: "pinnacle", american: -108, url: null }],
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("dfs-cell")).toHaveTextContent("—");
    expect(
      screen.getByTestId("odds-cell").querySelector('svg[aria-label="Pinnacle"]'),
    ).toBeTruthy();
  });
```

Change `renders PrizePicks mark and -137 for every PrizePicks chip` and `renders Underdog mark and the dataset American price` to assert `dfs-cell` instead of `odds-cell`, with chips on `dfs`.

Change `shows four odds chips plus overflow and omits DFS American` so `books` is five sportsbooks (add `fanduel`) and `dfs` holds PrizePicks — Odds still shows `+1` and must not contain PrizePicks.

Change the Fliff/Underdog asset-marks test: Underdog belongs in `dfs` on the second row; assert Underdog on `dfs-cell`, not `odds-cell`.

DFS header must not be a sort button: `expect(screen.queryByRole("button", { name: "DFS" })).not.toBeInTheDocument()`.

- [ ] **Step 2: Run table tests (RED)**

Run: `cd frontend && npm test -- --run src/features/mlb/league/MlbPropPicksTable.test.tsx`

Expected: FAIL — no DFS header / PrizePicks still in Odds.

- [ ] **Step 3: Insert the DFS column**

In `MlbPropPicksTable.tsx`:

1. Import `orderedDfsBooks` from `./sortMlbPropBoard`.
2. Change `COLUMNS` to:

```typescript
const COLUMNS: {
  key: MlbPropBoardSortKey | "dfs";
  label: string;
  sortable: boolean;
}[] = [
  { key: "player", label: "Proposition", sortable: true },
  { key: "line", label: "Line", sortable: true },
  { key: "dfs", label: "DFS", sortable: false },
  { key: "odds", label: "Odds", sortable: true },
  { key: "ip", label: "IP", sortable: true },
  { key: "l5", label: "L5", sortable: true },
  { key: "l10", label: "L10", sortable: true },
  { key: "l15", label: "L15", sortable: true },
  { key: "h2h", label: "H2H", sortable: true },
];
```

3. In the header map, if `!column.sortable` render a `<th>` with the label only (no button). `onSort` stays typed as `MlbPropBoardSortKey` and is only called for sortable columns.

4. Add `DfsCell`:

```typescript
function DfsCell({ row }: { row: ApiMlbPropBoardRow }) {
  const chips = orderedDfsBooks(row.dfs ?? []).filter(
    (chip) => postedAmerican(chip.book, chip.american) != null,
  );
  if (chips.length === 0) {
    return (
      <div data-testid="dfs-cell" className="font-mono text-sm text-white">
        —
      </div>
    );
  }
  return (
    <div data-testid="dfs-cell" className="flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <BookChip
          key={chip.book}
          book={chip.book}
          american={chip.american}
          url={chip.url}
          devigPct={null}
        />
      ))}
    </div>
  );
}
```

5. In the row, after the Line `<td>` and before `OddsCell`:

```tsx
                  <td className={`px-2 py-2 ${ROW_BOX_MIDDLE}`}>
                    <DfsCell row={row} />
                  </td>
                  <td className={`px-2 py-2 ${ROW_BOX_MIDDLE}`}>
                    <OddsCell row={row} />
                  </td>
```

`OddsCell` already reads `row.books` only — do not pass `dfs` into it.

- [ ] **Step 4: Run table tests (GREEN)**

Run: `cd frontend && npm test -- --run src/features/mlb/league/MlbPropPicksTable.test.tsx src/features/mlb/league/filterMlbPropBoard.test.ts src/pages/MlbPropPicksPage.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/league/MlbPropPicksTable.tsx frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx
git commit -m "$(cat <<'EOF'
Show PrizePicks and Underdog in a DFS column on the MLB board.

EOF
)"
```

---

### Task 5: System design page ↔ API row

**Files:**
- Modify: `md/system-design.md` (`/mlb/prop_picks` table row and `GET /api/mlb/props/board` API row)

**Interfaces:**
- Consumes: shipped board contract (`dfs` + `books`)
- Produces: docs that match the live table

- [ ] **Step 1: Update `md/system-design.md`**

`/mlb/prop_picks` row: columns are Proposition, Line, **DFS** (PrizePicks/Underdog logo + American; PrizePicks -137; no de-vig %), Odds (sportsbooks only, logo + American + de-vig % when two-way). Bookmaker filter trims `dfs` or `books` by book; drop rows with no posted chip in either list. Still no PrizePicks/Underdog tabs.

`GET /api/mlb/props/board` row: sportsbook + DFS mains clustered by exact line; `dfs` vs `books` chip lists; IP / ranks / L5–L15; 200 even when enrichments fail.

- [ ] **Step 2: Commit**

```bash
git add md/system-design.md
git commit -m "$(cat <<'EOF'
Document the MLB prop board DFS column in system design.

EOF
)"
```

---

## Self-review vs spec

| Spec requirement | Task |
| --- | --- |
| DFS column between Line and Odds | 4 |
| No DFS tabs | 4 (existing “no tabs” test kept) |
| Exact-line clustering / sportsbook-only extra lines | 2 (19.5 vs 20.5 test) |
| DFS fill only at this line | 2 + 4 (`—` on 20.5) |
| PP + UD same line → both in `dfs` | 2 |
| Odds = sportsbooks only | 2 + 4 |
| PrizePicks UI -137, no de-vig % | 2 (`devig_pct` null) + 4 (`devigPct={null}`) |
| IP unchanged | 2 (existing IP tests untouched except chip lists) |
| DFS not a sort key | 4 |
| Book filter split | 3 |
| OpenAPI | 1 |
| `md/system-design.md` | 5 |
| `GET /api/mlb/props/today` / WNBA / game-detail unchanged | Global constraint; no tasks touch those files |
