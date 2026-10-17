# Prop Board Anchor Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anchor the MLB and WNBA prop boards on one book (default PrizePicks), show other books only when the player, prop type, and line match, and drop the DFS column and Team filter.

**Architecture:** `GET /api/{mlb|wnba}/props/board?book=` clusters each book's main by `(player_key, stat, round_line)`. Rows exist only for clusters that contain the anchor. `anchor` is that book's chip. `books` is the other quotes in that same cluster with a price for the side. `ip_pct` averages those Americans, using -137 when PrizePicks has none. The page stores the choice in `?book=` and refetches. Game, proposition, side, hit rate, and name still filter in the browser.

**Tech Stack:** FastAPI, Pydantic, pytest. React 19, React Router 7, TanStack Query, Vitest, Testing Library. OpenAPI export → `frontend/openapi.json` → `npm run generate:api`.

## Global Constraints

- Valid `book` ids, lowercase, exact: `prophetx`, `novig`, `pinnacle`, `draftkings`, `fanduel`, `betmgm`, `caesars`, `bet365`, `kalshi`, `fliff`, `prizepicks`, `underdog`.
- Omitted `book` means `prizepicks`. Any other value is HTTP 422 with `Cache-Control: no-store`.
- A known book with no quotes returns 200 and `rows: []`.
- Each book contributes its main line only. Do not add alt ladders.
- Another book appears only from the same cluster: same `player_key`, same stat, same `round_line` (one decimal), with a price for that side.
- PrizePicks missing American is `-137` on the chip and inside `ip_pct`.
- `ip_pct` is the integer average raw implied percent of the anchor American plus every matching book's American for that side. No de-vig.
- Do not change `GET /api/*/props/today` or game-detail Props.
- Do not add a shared MLB/WNBA board module.
- Enrichment failures stay 200 with the existing warnings.
- Board cache stays 15 minutes and does not refetch on window focus.
- Product name in any new copy is statvista.

---

## File structure

| File | Responsibility |
| --- | --- |
| `backend/app/domains/mlb/schemas_prop_board.py` | MLB row gains required `anchor`; `dfs` is removed |
| `backend/app/domains/mlb/prop_board.py` | Resolve `book`, emit anchor rows, identical-line chips, IP |
| `backend/app/domains/mlb/routes.py` | `book` query and 422 |
| `backend/app/domains/wnba/schemas_prop_board.py` | Same row contract |
| `backend/app/domains/wnba/prop_board.py` | Same assembly |
| `backend/app/domains/wnba/routes.py` | Same query |
| `backend/tests/test_mlb_prop_board.py` | Anchor, match rule, IP, empty book |
| `backend/tests/test_mlb_prop_board_schema.py` | `anchor` required, `dfs` gone |
| `backend/tests/test_wnba_prop_board.py` | WNBA twin of the MLB board tests |
| `backend/tests/test_wnba_prop_board_schema.py` | WNBA schema |
| `backend/tests/integration/test_mlb_prop_board_db.py` | PrizePicks 2.0 no longer inherits a 1.5 sportsbook |
| `frontend/src/shared/lib/api.ts` | `fetchMlbPropBoard(book)` / `fetchWnbaPropBoard(book)` |
| `frontend/src/features/mlb/hooks/useMlbPropBoard.ts` | Query key includes `book` |
| `frontend/src/features/basketball/hooks/useWnbaPropBoard.ts` | Same |
| `frontend/src/features/mlb/league/filterMlbPropBoard.ts` | Drop team and book-chip trimming |
| `frontend/src/features/basketball/league/filterWnbaPropBoard.ts` | Same |
| `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` | Line shows number + American; no DFS column |
| `frontend/src/features/basketball/league/WnbaPropPicksTable.tsx` | Same |
| `frontend/src/pages/MlbPropPicksPage.tsx` | `?book=` is the anchor |
| `frontend/src/pages/LeaguePropPicksPage.tsx` | WNBA `?book=` |
| `md/system-design.md` | Page and API rows |

`orderedDfsBooks` / `DFS_CHIP_ORDER` exist only to paint the DFS column. Delete them from both `sort*PropBoard.ts` files when the tables stop importing them. Leave `orderedBoardBooks` and `BOOK_CHIP_ORDER`.

---

### Task 1: MLB board rows follow the anchor book

**Files:**
- Modify: `backend/app/domains/mlb/schemas_prop_board.py`
- Modify: `backend/app/domains/mlb/prop_board.py`
- Test: `backend/tests/test_mlb_prop_board.py`
- Test: `backend/tests/test_mlb_prop_board_schema.py`
- Test: `backend/tests/integration/test_mlb_prop_board_db.py`

**Interfaces:**
- Consumes: `cluster_quotes`, `consensus_ip_pct`, `BOOK_CHIP_ORDER`, `BoardQuote`, `round_line` from `app.domains.mlb.prop_board_cluster`.
- Produces: `UnknownBoardBookError`, `resolve_board_book(book: str | None) -> str`, `get_mlb_prop_board(book: str | None = None) -> MlbPropBoardResponse`. Every returned row has `anchor: MlbPropBoardBookChip` and no `dfs`. `books` excludes the anchor and excludes any quote whose line is not the cluster line.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/test_mlb_prop_board_schema.py`, replace the `dfs` assertions in `test_board_row_requires_side_and_line` with an `anchor` chip. Construct the row with:

```python
anchor=MlbPropBoardBookChip(book="prizepicks", american=-137, line=1.5),
```

Replace:

```python
assert row.dfs == []
dumped = row.model_dump()
assert dumped["dfs"] == []
assert "dfs" in dumped
```

with:

```python
assert row.anchor.book == "prizepicks"
assert row.anchor.american == -137
dumped = row.model_dump()
assert "dfs" not in dumped
assert dumped["anchor"]["book"] == "prizepicks"
```

In `backend/tests/test_mlb_prop_board.py`, add this test under the existing assembler tests. Keep the monkeypatch style those tests already use (`collect_board_quotes` and `load_enrichment`).

```python
@pytest.mark.asyncio
async def test_anchor_book_keeps_only_identical_player_stat_and_line(monkeypatch):
    from app.domains.mlb.prop_board_cluster import consensus_ip_pct

    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="draftkings",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=2.5,
            book="fanduel",
            over_american=-108,
            under_american=-112,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="runs",
            line=1.5,
            book="draftkings",
            over_american=-120,
            under_american=-110,
        ),
    ]
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: quotes)
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )

    prizepicks = await get_mlb_prop_board()
    assert {row.line for row in prizepicks.rows} == {1.5}
    assert {row.stat for row in prizepicks.rows} == {"hits"}
    over = next(row for row in prizepicks.rows if row.side == "over")
    assert over.anchor.book == "prizepicks"
    assert over.anchor.american == -137
    assert [chip.book for chip in over.books] == ["draftkings"]
    assert over.books[0].line == 1.5
    assert over.ip_pct == consensus_ip_pct([-137, -110])

    draftkings = await get_mlb_prop_board("draftkings")
    assert {(row.stat, row.line) for row in draftkings.rows} == {
        ("hits", 1.5),
        ("runs", 1.5),
    }
    hits = next(
        row
        for row in draftkings.rows
        if row.stat == "hits" and row.line == 1.5 and row.side == "over"
    )
    assert hits.anchor.book == "draftkings"
    assert hits.anchor.american == -110
    assert [chip.book for chip in hits.books] == ["prizepicks"]
    assert hits.books[0].american == -137
    assert hits.ip_pct == consensus_ip_pct([-110, -137])


@pytest.mark.asyncio
async def test_unknown_board_book_raises(monkeypatch):
    from app.domains.mlb.prop_board import UnknownBoardBookError

    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: [])
    with pytest.raises(UnknownBoardBookError):
        await get_mlb_prop_board("not-a-book")


@pytest.mark.asyncio
async def test_known_book_with_no_quotes_returns_empty_rows(monkeypatch):
    monkeypatch.setattr("app.domains.mlb.prop_board.collect_board_quotes", lambda: [])
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.load_enrichment",
        lambda *_: ({}, {}, [], set()),
    )
    body = await get_mlb_prop_board("fanduel")
    assert body.rows == []
```

FanDuel's 2.5 quote is a different line, so `book=draftkings` does not include `("hits", 2.5)`.

Update these existing tests in the same file so they describe the new contract (they will fail until Step 3):

`test_assembler_splits_lines_and_null_ip_for_dfs_only` — PrizePicks is 2.0 and ProphetX is 1.5. Expect `lines == [2.0]`, `over.anchor.american == -137`, `over.books == []`, `over.ip_pct == consensus_ip_pct([-137])`. Delete the assertions that ProphetX sits on that row at line 1.5 and that `ip_pct == 52`.

`test_assembler_splits_dfs_and_sportsbook_lines` — Pinnacle is 20.5 and must not appear. Expect one line, 19.5. `over.anchor.book == "prizepicks"` and `over.anchor.american == -137`. `over.books` book ids are `["prophetx", "underdog"]` in that order. Pinnacle is absent. `over.ip_pct == consensus_ip_pct([-137, -110, -105])`.

`test_chips_skip_books_without_american_on_that_side` — anchor is PrizePicks at -137 on both sides. Over `books` are `draftkings` then `fanduel`. Under `books` are `draftkings` only. Delete every `row.dfs` assertion.

`test_assembler_omits_sportsbook_only_rows` — default `get_mlb_prop_board()` still returns `rows == []` because the only quote is FanDuel. Add a second call `await get_mlb_prop_board("fanduel")` and assert one over row, `anchor.book == "fanduel"`, `anchor.american == -108`, `books == []`, and no under row (under American is null).

`test_assembler_market_label_chips_and_sort` — Betts over `books` stay `["prophetx", "draftkings"]` because those quotes share the PrizePicks line. Recompute `ip_pct` with `consensus_ip_pct([-137, -110, -115])` instead of `53`.

- [ ] **Step 2: Run the new test to verify it fails**

Run from the repo root:

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_mlb_prop_board.py::test_anchor_book_keeps_only_identical_player_stat_and_line backend/tests/test_mlb_prop_board_schema.py::test_board_row_requires_side_and_line -v
```

Expected: FAIL. Schema still has `dfs` and no `anchor`. `get_mlb_prop_board` does not accept a book argument, or it still attaches the FanDuel 2.5 main onto the PrizePicks row.

- [ ] **Step 3: Implement the MLB assembler**

In `backend/app/domains/mlb/schemas_prop_board.py`:

- Delete the `dfs` field on `MlbPropBoardRow`.
- Add `anchor: MlbPropBoardBookChip` (required, no default).
- Change the `ip_pct` comment to: average raw implied of the anchor American and matching books on this side.
- Change the chip `line` comment to: this book's main; on a board row it equals the row line.

In `backend/app/domains/mlb/prop_board.py` add:

```python
class UnknownBoardBookError(ValueError):
    """`book` is not a board book id."""


PRIZEPICKS_AMERICAN = -137


def resolve_board_book(book: str | None) -> str:
    if book is None:
        return "prizepicks"
    if book not in BOOK_CHIP_ORDER:
        raise UnknownBoardBookError(book)
    return book


def _side_american(quote: BoardQuote, side: Side) -> int | None:
    raw = quote.over_american if side == "over" else quote.under_american
    if raw is None and quote.book == "prizepicks":
        return PRIZEPICKS_AMERICAN
    return raw


def _chip_for_quote(quote: BoardQuote, side: Side) -> MlbPropBoardBookChip | None:
    american = _side_american(quote, side)
    if american is None:
        return None
    return MlbPropBoardBookChip(
        book=quote.book,
        american=american,
        url=quote.url,
        line=quote.line,
        over_american=_side_american(quote, "over"),
        under_american=_side_american(quote, "under"),
        devig_pct=None,
    )


def _anchor_and_matches(
    cluster: Cluster,
    side: Side,
    anchor_book: str,
) -> tuple[MlbPropBoardBookChip | None, list[MlbPropBoardBookChip]]:
    by_book = {quote.book: quote for quote in cluster.quotes}
    anchor_quote = by_book.get(anchor_book)
    if anchor_quote is None:
        return None, []
    anchor = _chip_for_quote(anchor_quote, side)
    if anchor is None:
        return None, []
    books: list[MlbPropBoardBookChip] = []
    for book in BOOK_CHIP_ORDER:
        if book == anchor_book:
            continue
        quote = by_book.get(book)
        if quote is None:
            continue
        chip = _chip_for_quote(quote, side)
        if chip is not None:
            books.append(chip)
    return anchor, books
```

Replace the existing `_chip_for_quote` (the one that takes `allow_missing_american`). Delete `_chips_for_side` and `_sportsbook_mains` after confirming nothing else in this file calls them.

Change `get_mlb_prop_board` to:

```python
async def get_mlb_prop_board(book: str | None = None) -> MlbPropBoardResponse:
    anchor_book = resolve_board_book(book)
    warnings: list[str] = []
    quotes = collect_board_quotes()
    warnings.extend(getattr(collect_board_quotes, "warnings", []) or [])

    clusters = [
        cluster
        for cluster in cluster_quotes(quotes)
        if any(quote.book == anchor_book for quote in cluster.quotes)
    ]
    loaded = load_enrichment(clusters)
    if inspect.isawaitable(loaded):
        loaded = await loaded
    player_ctx, ranks, extra_warnings, missing_person = loaded
    warnings.extend(extra_warnings)

    rows: list[MlbPropBoardRow] = []
    for cluster in clusters:
        ctx = player_ctx.get(cluster.player_key) or {}
        opponent = ctx.get("opponent_abbrev")
        def_r, def_l, pace_r, pace_l = def_and_pace_ranks(
            cluster.stat, opponent, ranks
        )
        group = "pitching" if is_pitcher_stat(cluster.stat) else "hitting"
        splits = ctx.get(f"splits_{group}") or []
        splits_prev = ctx.get(f"splits_{group}_prev") or []
        skip_hits = cluster.player_key in missing_person
        for side in ("over", "under"):
            if skip_hits:
                l5 = l10 = l15 = h2h = None
            else:
                l5, l10, l15 = hit_rates(cluster.stat, side, cluster.line, splits)
                h2h = h2h_rate(
                    cluster.stat,
                    side,
                    cluster.line,
                    splits + splits_prev,
                    opponent,
                )
            anchor, book_chips = _anchor_and_matches(cluster, side, anchor_book)
            if anchor is None:
                continue
            rows.append(
                MlbPropBoardRow(
                    player_name=cluster.player_name,
                    headshot_url=ctx.get("headshot_url"),
                    team_abbrev=ctx.get("team_abbrev"),
                    opponent_abbrev=opponent,
                    home_away=ctx.get("home_away"),
                    stat=cluster.stat,
                    market_label=_market_label(side, cluster.line, cluster.stat),
                    side=side,
                    line=cluster.line,
                    game_pk=ctx.get("game_pk"),
                    game_start_at=ctx.get("game_start_at"),
                    anchor=anchor,
                    books=book_chips,
                    ip_pct=consensus_ip_pct(
                        [anchor.american, *[chip.american for chip in book_chips]]
                    ),
                    opp_def_rank=def_r,
                    opp_def_label=def_l,
                    opp_pace_rank=pace_r,
                    opp_pace_label=pace_l,
                    hit_l5=l5,
                    hit_l10=l10,
                    hit_l15=l15,
                    hit_h2h=h2h,
                )
            )

    rows.sort(key=_row_sort_key)
    return MlbPropBoardResponse(
        as_of=datetime.now(timezone.utc),
        warnings=warnings,
        rows=rows,
    )
```

Drop unused imports (`DFS_CHIP_ORDER`, `SPORTSBOOK_CHIP_ORDER` if nothing else in the file references them).

Import `BOOK_CHIP_ORDER` from `prop_board_cluster` if it is not already imported.

In `backend/tests/integration/test_mlb_prop_board_db.py`, update `test_prizepicks_extra_line_has_null_ip`. PrizePicks is 2.0 and ProphetX is 1.5, so the PrizePicks row must not carry ProphetX. Replace the `dfs` / `ip_pct == 52` / `px["line"] == 1.5` assertions with:

```python
from app.domains.mlb.prop_board_cluster import consensus_ip_pct

assert lines == [2.0]
over = next(row for row in body["rows"] if row["side"] == "over")
assert over["anchor"]["book"] == "prizepicks"
assert over["anchor"]["american"] == -137
assert over["books"] == []
assert over["ip_pct"] == consensus_ip_pct([-137])
assert "dfs" not in over
```

Leave `test_prophetx_and_draftkings_share_line_chips` as it is: those books share 1.5 with PrizePicks, so they stay on `books`.

- [ ] **Step 4: Run the MLB board tests**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_mlb_prop_board.py backend/tests/test_mlb_prop_board_schema.py -q
```

Expected: PASS.

Integration file, only if Postgres for that suite is already available:

```bash
PYTHONPATH=backend python -m pytest backend/tests/integration/test_mlb_prop_board_db.py::test_prizepicks_extra_line_has_null_ip backend/tests/integration/test_mlb_prop_board_db.py::test_prophetx_and_draftkings_share_line_chips -q
```

Expected: PASS. If the integration database is not configured, say so and do not treat that as a unit-test failure.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_prop_board.py backend/app/domains/mlb/prop_board.py backend/tests/test_mlb_prop_board.py backend/tests/test_mlb_prop_board_schema.py backend/tests/integration/test_mlb_prop_board_db.py
git commit -m "$(cat <<'EOF'
Anchor MLB prop board rows on one book's line.

Odds from another book stay on the row only when the player, prop, and line match.
EOF
)"
```

---

### Task 2: MLB route accepts `book`

**Files:**
- Modify: `backend/app/domains/mlb/routes.py` (the `mlb_props_board` handler)
- Test: `backend/tests/test_mlb_prop_board.py`

**Interfaces:**
- Consumes: `get_mlb_prop_board(book: str | None)`, `UnknownBoardBookError`.
- Produces: `GET /api/mlb/props/board?book=` returns the assembler result. Omitted `book` calls `get_mlb_prop_board(None)`. Unknown `book` is 422.

- [ ] **Step 1: Write the failing route tests**

Add to `backend/tests/test_mlb_prop_board.py`:

```python
def test_mlb_props_board_route_passes_book(monkeypatch):
    seen: dict[str, str | None] = {}

    async def fake(book: str | None = None):
        from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse

        seen["book"] = book
        return MlbPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[])

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board?book=draftkings")
    assert res.status_code == 200
    assert seen["book"] == "draftkings"


def test_mlb_props_board_route_rejects_unknown_book(monkeypatch):
    async def fake(book: str | None = None):
        from app.domains.mlb.prop_board import UnknownBoardBookError

        raise UnknownBoardBookError(book or "")

    monkeypatch.setattr(routes, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board?book=not-a-book")
    assert res.status_code == 422
    assert res.headers["cache-control"] == "no-store"
```

The existing `test_mlb_props_board_route_returns_200` monkeypatches `get_mlb_prop_board` with `async def fake():`. Change that fake to `async def fake(book: str | None = None):` so the new signature still satisfies it. Assert `res.status_code == 200` for the no-query call.

- [ ] **Step 2: Run the route test to verify it fails**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_passes_book backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_rejects_unknown_book -v
```

Expected: FAIL. The handler ignores `book`, and the unknown-book request is not 422.

- [ ] **Step 3: Wire the query param**

In `backend/app/domains/mlb/routes.py`, import `UnknownBoardBookError` from `app.domains.mlb.prop_board`. Replace the handler:

```python
@router.get("/mlb/props/board", response_model=MlbPropBoardResponse)
async def mlb_props_board(
    response: Response,
    book: str | None = Query(default=None),
) -> MlbPropBoardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_prop_board(book)
    except UnknownBoardBookError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"unknown book: {exc}",
            headers=_NO_STORE,
        ) from exc
```

- [ ] **Step 4: Run the route tests**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_returns_200 backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_passes_book backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_rejects_unknown_book -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/routes.py backend/tests/test_mlb_prop_board.py
git commit -m "$(cat <<'EOF'
Accept a book query on the MLB prop board route.

An unknown book returns 422. Omitting the query still loads PrizePicks.
EOF
)"
```

---

### Task 3: WNBA board rows follow the anchor book

**Files:**
- Modify: `backend/app/domains/wnba/schemas_prop_board.py`
- Modify: `backend/app/domains/wnba/prop_board.py`
- Test: `backend/tests/test_wnba_prop_board.py`
- Test: `backend/tests/test_wnba_prop_board_schema.py`

**Interfaces:**
- Consumes: WNBA `cluster_quotes`, `consensus_ip_pct`, `BOOK_CHIP_ORDER`, `BoardQuote`.
- Produces: `UnknownBoardBookError`, `resolve_board_book(book: str | None) -> str`, `get_wnba_prop_board(book: str | None = None) -> WnbaPropBoardResponse`. Same chip rule as MLB. WNBA rows use `game_id`, not `game_pk`. WNBA enrichment returns `(player_ctx, extra_warnings, missing_person)` with no ranks tuple.

- [ ] **Step 1: Write the failing tests**

Mirror Task 1's schema edit in `backend/tests/test_wnba_prop_board_schema.py` using `WnbaPropBoardBookChip`. `anchor.book == "prizepicks"`, `anchor.american == -137`, `"dfs" not in dumped`.

Add the same three tests to `backend/tests/test_wnba_prop_board.py`, importing `get_wnba_prop_board` and `consensus_ip_pct` from the WNBA modules. Use stat `"points"` instead of `"hits"` and `"rebounds"` instead of `"runs"` so the quotes match a basketball prop. Player name `"Wilson"`, `player_key="aja wilson"`. Expected DraftKings set:

```python
assert {(row.stat, row.line) for row in draftkings.rows} == {
    ("points", 1.5),
    ("rebounds", 1.5),
}
```

Apply the same assertion edits Task 1 lists to the WNBA copies of `test_assembler_splits_lines_and_null_ip_for_dfs_only`, `test_assembler_splits_dfs_and_sportsbook_lines`, `test_chips_skip_books_without_american_on_that_side`, `test_assembler_omits_sportsbook_only_rows`, and the market-label IP assertion. WNBA `load_enrichment` in those tests returns a 3-tuple `({}, [], set())`, not a 4-tuple. Keep that.

- [ ] **Step 2: Run the new test to verify it fails**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_wnba_prop_board.py::test_anchor_book_keeps_only_identical_player_stat_and_line backend/tests/test_wnba_prop_board_schema.py::test_board_row_requires_side_and_line -v
```

Expected: FAIL because `anchor` does not exist yet.

- [ ] **Step 3: Implement the WNBA assembler**

Copy the MLB helpers into `backend/app/domains/wnba/prop_board.py` with these substitutions:

- `MlbPropBoardBookChip` → `WnbaPropBoardBookChip`
- `MlbPropBoardRow` → `WnbaPropBoardRow`
- `get_mlb_prop_board` → `get_wnba_prop_board`
- Schema module path `app.domains.wnba.schemas_prop_board`
- Cluster imports from `app.domains.wnba.prop_board_cluster`

`get_wnba_prop_board` keeps the current enrichment unpack:

```python
player_ctx, extra_warnings, missing_person = loaded
```

There is no `def_and_pace_ranks` call. Hit rates stay:

```python
splits = ctx.get("splits") or []
splits_prev = ctx.get("splits_prev") or []
l5, l10, l15 = hit_rates(cluster.stat, side, cluster.line, splits)
h2h = h2h_rate(cluster.stat, side, cluster.line, splits + splits_prev, opponent)
```

The row sets `game_id=ctx.get("game_id")` and does not set `game_pk` or the opp-rank fields. `ip_pct` uses the same `consensus_ip_pct([anchor.american, *[chip.american for chip in book_chips]])`.

Delete WNBA `_chips_for_side` and `_sportsbook_mains` after the new helpers replace them. Remove `dfs` from `WnbaPropBoardRow` and add required `anchor: WnbaPropBoardBookChip`.

- [ ] **Step 4: Run the WNBA board tests**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_wnba_prop_board.py backend/tests/test_wnba_prop_board_schema.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/wnba/schemas_prop_board.py backend/app/domains/wnba/prop_board.py backend/tests/test_wnba_prop_board.py backend/tests/test_wnba_prop_board_schema.py
git commit -m "$(cat <<'EOF'
Anchor WNBA prop board rows on one book's line.

Matching odds use the same player, prop, and line as the selected book.
EOF
)"
```

---

### Task 4: WNBA route accepts `book`

**Files:**
- Modify: `backend/app/domains/wnba/routes.py` (the `wnba_props_board` handler)
- Test: `backend/tests/test_wnba_prop_board.py`

**Interfaces:**
- Consumes: `get_wnba_prop_board(book: str | None)`, WNBA `UnknownBoardBookError`.
- Produces: `GET /api/wnba/props/board?book=` with the same 200 / 422 contract as MLB.

- [ ] **Step 1: Write the failing route tests**

Add the Task 2 route tests to `backend/tests/test_wnba_prop_board.py`, pointed at `/api/wnba/props/board` and `WnbaPropBoardResponse`. Update the existing 200-route fake to `async def fake(book: str | None = None)`.

- [ ] **Step 2: Run the route test to verify it fails**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_wnba_prop_board.py::test_wnba_props_board_route_passes_book backend/tests/test_wnba_prop_board.py::test_wnba_props_board_route_rejects_unknown_book -v
```

Expected: FAIL with 200 on the unknown book, or the fake never seeing `book`.

- [ ] **Step 3: Wire the query param**

Import `UnknownBoardBookError` from `app.domains.wnba.prop_board`. Replace `wnba_props_board`:

```python
@router.get("/wnba/props/board", response_model=WnbaPropBoardResponse)
async def wnba_props_board(
    response: Response,
    book: str | None = Query(default=None),
) -> WnbaPropBoardResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_prop_board(book)
    except UnknownBoardBookError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"unknown book: {exc}",
            headers=_NO_STORE,
        ) from exc
```

`Query` and `HTTPException` are already imported in this routes module. `_NO_STORE` is already defined.

- [ ] **Step 4: Run the route tests**

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_wnba_prop_board.py::test_wnba_props_board_route_returns_200 backend/tests/test_wnba_prop_board.py::test_wnba_props_board_route_passes_book backend/tests/test_wnba_prop_board.py::test_wnba_props_board_route_rejects_unknown_book -q
```

Expected: PASS. The existing test name is `test_wnba_props_board_route_returns_200` if that is the current name; if the function has a different name, use the test that GETs `/api/wnba/props/board` with no query.

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/wnba/routes.py backend/tests/test_wnba_prop_board.py
git commit -m "$(cat <<'EOF'
Accept a book query on the WNBA prop board route.

An unknown book returns 422. Omitting the query still loads PrizePicks.
EOF
)"
```

---

### Task 5: OpenAPI and the board fetch clients

**Files:**
- Modify: `frontend/openapi.json` (generated)
- Modify: `backend/openapi-golden.json` (copy of the export)
- Modify: `frontend/src/shared/lib/api.schema.d.ts` (generated)
- Modify: `frontend/src/shared/lib/api.ts`
- Test: `frontend/src/shared/lib/api.test.ts`

**Interfaces:**
- Consumes: the query param and `anchor` field from Tasks 2 and 4.
- Produces: `fetchMlbPropBoard(book?: string)` and `fetchWnbaPropBoard(book?: string)`. Default argument `"prizepicks"`. Request path `/api/mlb/props/board?book=prizepicks` (and the WNBA twin). `ApiMlbPropBoardRow` and `ApiWnbaPropBoardRow` include `anchor` and omit `dfs`.

- [ ] **Step 1: Write the failing client tests**

In `frontend/src/shared/lib/api.test.ts`, change the MLB test named `GETs /api/mlb/props/board with no query string` so it expects:

```typescript
expect(fetchMock).toHaveBeenCalledWith(
  "/api/mlb/props/board?book=prizepicks",
  expect.objectContaining({
    headers: { Accept: "application/json" },
    cache: "no-store",
  }),
);
```

Add:

```typescript
it("GETs /api/mlb/props/board for the selected book", async () => {
  vi.stubEnv("VITE_API_BASE_URL", undefined);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ as_of: "2026-08-23T00:00:00Z", rows: [], warnings: [] }),
  });
  const { fetchMlbPropBoard } = await import("./api");
  await fetchMlbPropBoard("draftkings");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/mlb/props/board?book=draftkings",
    expect.objectContaining({ cache: "no-store" }),
  );
});
```

Do the same for the WNBA test that expects `/api/wnba/props/board` with no query string: default URL `?book=prizepicks`, plus a `draftkings` case.

- [ ] **Step 2: Run the client tests to verify they fail**

```bash
cd frontend && npm test -- src/shared/lib/api.test.ts
```

Expected: FAIL because the URL has no `book` query.

- [ ] **Step 3: Export the schema and send `book`**

From the repo root:

```bash
PYTHONPATH=backend python -c "from app.openapi_export import export_openapi; export_openapi()"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

In `frontend/src/shared/lib/api.ts`:

```typescript
export async function fetchMlbPropBoard(
  book = "prizepicks",
): Promise<ApiMlbPropBoardResponse> {
  const qs = new URLSearchParams({ book });
  const res = await fetch(`${API_BASE}/api/mlb/props/board?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB prop board request failed: ${res.status}`);
  }
  return res.json();
}
```

```typescript
export async function fetchWnbaPropBoard(
  book = "prizepicks",
): Promise<ApiWnbaPropBoardResponse> {
  const qs = new URLSearchParams({ book });
  const res = await fetch(`${API_BASE}/api/wnba/props/board?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`WNBA prop board request failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run the client tests and the API check**

```bash
cd frontend && npm test -- src/shared/lib/api.test.ts && npm run check:api
```

Expected: tests PASS and `check:api` exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts
git commit -m "$(cat <<'EOF'
Send the anchor book on prop board requests.

The OpenAPI contract replaces the DFS chip list with the anchor chip.
EOF
)"
```

---

### Task 6: MLB page uses `?book=` and drops DFS and Team

**Files:**
- Modify: `frontend/src/features/mlb/hooks/useMlbPropBoard.ts`
- Modify: `frontend/src/features/mlb/hooks/useMlbPropBoard.test.tsx`
- Modify: `frontend/src/features/mlb/league/filterMlbPropBoard.ts`
- Modify: `frontend/src/features/mlb/league/filterMlbPropBoard.test.ts`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksFilters.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksFilters.test.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx`
- Modify: `frontend/src/features/mlb/league/sortMlbPropBoard.ts`
- Modify: `frontend/src/pages/MlbPropPicksPage.tsx`
- Modify: `frontend/src/pages/MlbPropPicksPage.test.tsx`

**Interfaces:**
- Consumes: `fetchMlbPropBoard(book?: string)` and `ApiMlbPropBoardRow.anchor`.
- Produces: `mlbPropBoardQueryOptions(book = "prizepicks")`, `useMlbPropBoard(book = "prizepicks")`, `prefetchMlbPropBoard(client)` which prefetches `prizepicks`. `MLB_PROP_BOARD_QUERY_KEY` becomes a function `(book: string) => ["mlb", "props", "board", book]`. `filterMlbPropBoardRows` takes `{ query, markets, sides, games }` and does not read `teams`, `books`, or `dfs`.

- [ ] **Step 1: Write the failing UI tests**

Hook test: `useMlbPropBoard("draftkings")` calls `fetchMlbPropBoard` with `"draftkings"` and stores data at `["mlb", "props", "board", "draftkings"]`. `prefetchMlbPropBoard` still fills `["mlb", "props", "board", "prizepicks"]`. `useMlbPropBoard()` with no argument uses `"prizepicks"`.

Filter tests to delete or replace:

- Delete `filters by team and player substring`'s team half. Keep a player-substring assertion.
- Delete `excludes rows with a null team when a team filter is active`.
- Replace `filters by bookmaker and keeps only selected book chips`, `drops rows with no posted American odds`, `omits sportsbook-only rows with no PrizePicks or Underdog line`, `keeps a sportsbook whose main line differs from the DFS line`, `filters PrizePicks on dfs and clears Odds`, and `filters DraftKings on books and clears DFS` with one test:

```typescript
it("keeps rows the server already anchored and does not trim odds", () => {
  const rows = [
    row({
      books: [
        { book: "draftkings", american: -110, url: null, line: 1.5 },
        { book: "fanduel", american: -108, url: null, line: 1.5 },
      ],
    }),
  ];
  const out = filterMlbPropBoardRows(rows, {
    query: "",
    markets: new Set(),
    sides: new Set(),
    games: new Set(),
  });
  expect(out).toHaveLength(1);
  expect(out[0].books.map((chip) => chip.book)).toEqual([
    "draftkings",
    "fanduel",
  ]);
});
```

Update every fixture in that file: replace `dfs: [...]` with

```typescript
anchor: { book: "prizepicks", american: -137, url: null, line: 1.5 },
```

Remove `collectMlbBoardBookmakerOptions` expectations. Bookmaker options are no longer derived from rows.

Filters test `renders Game, Team, Bookmaker, ...`: expect no button named `Team`. Expect a button named `Bookmaker (PrizePicks)` when `selectedBooks` is `new Set(["prizepicks"])`. Pass `single` behavior by clicking PrizePicks again only if the component test mounts the control; the page test below covers the URL.

Table test `renders board columns and no dfs tabs`: `expect(screen.queryByText("DFS")).not.toBeInTheDocument()`. Line cell for a fixture whose `anchor.american` is `-137` and `line` is `1.5` has text content that includes `1.5` and `-137`. A books chip whose `line` is `2.5` is not rendered; a chip whose `line` is `1.5` is rendered. Delete the DFS PrizePicks `-137` cell test. The American now lives in the line cell.

Page test: render at `/mlb/prop_picks` and expect `mockUseMlbPropBoard` to have been called with `"prizepicks"`. There is no button named `Team`. Open Bookmaker and choose DraftKings; the hook is then called with `"draftkings"`. Render at `/mlb/prop_picks?book=draftkings` and expect the first call to be `"draftkings"`. Delete `filters the board by team via MlbPropPicksFilters`. Replace `filters the board by bookmaker and shows only that book's odds` with the URL assertion above. The server, not the client, decides which odds chips exist, so the page test must not expect the client to strip a chip.

Fixture shape used by the page and table tests:

```typescript
anchor: {
  book: "prizepicks",
  american: -137,
  url: null,
  line: 1.5,
  devig_pct: null,
  over_american: -137,
  under_american: -137,
},
```

Remove `dfs` from those fixtures.

- [ ] **Step 2: Run the page test to verify it fails**

```bash
cd frontend && npm test -- src/pages/MlbPropPicksPage.test.tsx src/features/mlb/league/MlbPropPicksTable.test.tsx
```

Expected: FAIL. The hook is called with no arguments, the DFS header is present, and fixtures still require `dfs`.

- [ ] **Step 3: Implement the MLB page**

`useMlbPropBoard.ts`:

```typescript
export function mlbPropBoardQueryKey(book: string) {
  return ["mlb", "props", "board", book] as const;
}

export function mlbPropBoardQueryOptions(book = "prizepicks") {
  return queryOptions({
    queryKey: mlbPropBoardQueryKey(book),
    queryFn: () => fetchMlbPropBoard(book),
    staleTime: MLB_PROP_BOARD_STALE_MS,
    refetchInterval: MLB_PROP_BOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useMlbPropBoard(book = "prizepicks") {
  return useQuery(mlbPropBoardQueryOptions(book));
}

export function prefetchMlbPropBoard(client: QueryClient) {
  return client.prefetchQuery(mlbPropBoardQueryOptions("prizepicks"));
}
```

Delete the old `MLB_PROP_BOARD_QUERY_KEY` constant. Update the hook test import to `mlbPropBoardQueryKey`.

`filterMlbPropBoard.ts`: remove `teams` and `books` from `MlbPropBoardFilterSelection`. Remove `collectMlbBoardBookmakerOptions`. Replace `filterMlbPropBoardRows` with a `filter` (not `flatMap`) that applies game, query, market, and side only, and returns the original row:

```typescript
export function filterMlbPropBoardRows(
  rows: ApiMlbPropBoardRow[],
  {
    query,
    markets,
    sides,
    games,
  }: MlbPropBoardFilterSelection,
): ApiMlbPropBoardRow[] {
  const q = query.trim().toLowerCase();
  const marketFilter = markets ?? new Set<string>();
  const sideFilter = sides ?? new Set<MlbPropBoardSide>();
  const gameFilter = games ?? new Set<string>();
  return rows.filter((row) => {
    if (gameFilter.size > 0) {
      if (row.game_pk == null || !gameFilter.has(String(row.game_pk))) {
        return false;
      }
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return false;
    if (marketFilter.size > 0 && !marketFilter.has(row.stat)) return false;
    if (sideFilter.size > 0 && !sideFilter.has(row.side)) return false;
    return true;
  });
}
```

`MlbPropPicksFilters.tsx`: delete `teams`, `selectedTeams`, and `onTeamsChange` from the props and delete `teamControl`. Bookmaker uses `single`:

```tsx
<MultiSelectFilter
  label="Bookmaker"
  tone={tone}
  single
  options={books}
  selected={selectedBooks}
  onChange={onBooksChange ?? (() => {})}
/>
```

Render Bookmaker even when it is the only control. `books` is always the fixed list, so drop the `books.length > 0` guard.

`sortMlbPropBoard.ts`: delete `DFS_CHIP_ORDER` and `orderedDfsBooks`.

`MlbPropPicksTable.tsx`: columns are Proposition, Line, Odds, IP, L5, L10, L15, H2H. Delete `DfsCell` and the DFS `<td>`. Line cell:

```tsx
<td
  className={`px-2 py-2 font-mono text-sm text-c3 ${ROW_BOX_MIDDLE}`}
  data-testid="line-cell"
>
  {row.line}{" "}
  {row.anchor.american == null
    ? "—"
    : formatAmericanOdds(row.anchor.american)}
</td>
```

`OddsCell` keeps reading `row.books` only.

`MlbPropPicksPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CHROME_PAGE_RIGHT, CHROME_PAGE_X } from "@/app/layouts/chrome";
import { useMlbPropBoard } from "@/features/mlb/hooks/useMlbPropBoard";
import { MlbPropPicksFilters } from "@/features/mlb/league/MlbPropPicksFilters";
import { MlbPropPicksHeader } from "@/features/mlb/league/MlbPropPicksHeader";
import { MlbPropPicksTable } from "@/features/mlb/league/MlbPropPicksTable";
import { bookDisplayName } from "@/features/mlb/lib/mlbBookLabels";
import {
  collectMlbBoardGameOptions,
  collectMlbBoardPropositionOptions,
  filterMlbPropBoardRows,
  type MlbHitRateWindow,
  type MlbPropBoardSide,
} from "@/features/mlb/league/filterMlbPropBoard";
import { BOOK_CHIP_ORDER } from "@/features/mlb/league/sortMlbPropBoard";

const BOOK_OPTIONS = BOOK_CHIP_ORDER.map((value) => ({
  value,
  label: bookDisplayName(value),
}));

export function MlbPropPicksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookParam = searchParams.get("book");
  const book = bookParam ?? "prizepicks";
  const { data, isLoading, isError } = useMlbPropBoard(book);
  const [query, setQuery] = useState("");
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSides, setSelectedSides] = useState<Set<MlbPropBoardSide>>(
    () => new Set(),
  );
  const [selectedGames, setSelectedGames] = useState<Set<string>>(
    () => new Set(),
  );
  const [hitRate, setHitRate] = useState<MlbHitRateWindow | null>(null);

  const rows = data?.rows ?? [];
  const markets = useMemo(() => collectMlbBoardPropositionOptions(rows), [rows]);
  const games = useMemo(() => collectMlbBoardGameOptions(rows), [rows]);
  const filtered = useMemo(
    () =>
      filterMlbPropBoardRows(rows, {
        query,
        markets: selectedMarkets,
        sides: selectedSides,
        games: selectedGames,
      }),
    [rows, query, selectedMarkets, selectedSides, selectedGames],
  );

  function selectBook(next: Set<string>) {
    const chosen = [...next][0];
    const params = new URLSearchParams(searchParams);
    if (!chosen || chosen === "prizepicks") params.delete("book");
    else params.set("book", chosen);
    setSearchParams(params, { replace: true });
  }

  function clearFilters() {
    setQuery("");
    setSelectedMarkets(new Set());
    setSelectedSides(new Set());
    setSelectedGames(new Set());
    setHitRate(null);
    selectBook(new Set());
  }

  const showBoardError = isError && !data;
  const showBoardFilters = !isLoading && !showBoardError;

  return (
    <div className="space-y-0 pb-8">
      <section
        className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X} ${CHROME_PAGE_RIGHT}`}
      >
        <MlbPropPicksHeader>
          {showBoardFilters ? (
            <MlbPropPicksFilters
              tone="pill"
              query={query}
              onQueryChange={setQuery}
              onClear={clearFilters}
              markets={markets}
              selectedMarkets={selectedMarkets}
              onMarketsChange={setSelectedMarkets}
              selectedSides={selectedSides}
              onSidesChange={(next) =>
                setSelectedSides(
                  new Set(
                    [...next].filter(
                      (side): side is MlbPropBoardSide =>
                        side === "over" || side === "under",
                    ),
                  ),
                )
              }
              books={BOOK_OPTIONS}
              selectedBooks={new Set([book])}
              onBooksChange={selectBook}
              games={games}
              selectedGames={selectedGames}
              onGamesChange={setSelectedGames}
              hitRate={hitRate}
              onHitRateChange={setHitRate}
            />
          ) : null}
        </MlbPropPicksHeader>
        <MlbPropPicksTable
          rows={filtered}
          isLoading={isLoading}
          isError={showBoardError}
          hitRateWindow={hitRate}
        />
      </section>
    </div>
  );
}
```

`showBoardFilters` no longer requires `rows.length > 0`, so an empty successful book still shows Bookmaker.

`MlbPropPicksFilters` clear-button visibility currently ORs `selectedTeams` and `selectedBooks`. Drop the team term. Treat the default PrizePicks selection as not a reason to show Clear by itself: show Clear when query, markets, sides, games, or hit rate are set, or when `selectedBooks` is a non-empty set whose only member is not `prizepicks`.

- [ ] **Step 4: Run the MLB frontend tests**

```bash
cd frontend && npm test -- src/features/mlb/hooks/useMlbPropBoard.test.tsx src/features/mlb/league/filterMlbPropBoard.test.ts src/features/mlb/league/MlbPropPicksFilters.test.tsx src/features/mlb/league/MlbPropPicksTable.test.tsx src/pages/MlbPropPicksPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/hooks/useMlbPropBoard.ts frontend/src/features/mlb/hooks/useMlbPropBoard.test.tsx frontend/src/features/mlb/league/filterMlbPropBoard.ts frontend/src/features/mlb/league/filterMlbPropBoard.test.ts frontend/src/features/mlb/league/MlbPropPicksFilters.tsx frontend/src/features/mlb/league/MlbPropPicksFilters.test.tsx frontend/src/features/mlb/league/MlbPropPicksTable.tsx frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx frontend/src/features/mlb/league/sortMlbPropBoard.ts frontend/src/pages/MlbPropPicksPage.tsx frontend/src/pages/MlbPropPicksPage.test.tsx
git commit -m "$(cat <<'EOF'
Show MLB props for the book in the page URL.

The line cell carries that book's price, and identical lines are the only other odds.
EOF
)"
```

---

### Task 7: WNBA page uses `?book=` and drops DFS and Team

**Files:**
- Modify: `frontend/src/features/basketball/hooks/useWnbaPropBoard.ts`
- Modify: `frontend/src/features/basketball/hooks/useWnbaPropBoard.test.tsx`
- Modify: `frontend/src/features/basketball/league/filterWnbaPropBoard.ts`
- Modify: `frontend/src/features/basketball/league/filterWnbaPropBoard.test.ts`
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx`
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksFilters.test.tsx`
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksTable.tsx`
- Modify: `frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx`
- Modify: `frontend/src/features/basketball/league/sortWnbaPropBoard.ts`
- Modify: `frontend/src/pages/LeaguePropPicksPage.tsx`
- Modify: `frontend/src/pages/LeaguePropPicksPage.test.tsx`

**Interfaces:**
- Consumes: `fetchWnbaPropBoard(book?: string)` and `ApiWnbaPropBoardRow.anchor`.
- Produces: `wnbaPropBoardQueryKey(book)`, `useWnbaPropBoard(book = "prizepicks")`, `prefetchWnbaPropBoard` for `prizepicks`. `filterWnbaPropBoardRows` uses `game_id` and the same four filters as MLB.

- [ ] **Step 1: Write the failing UI tests**

Repeat Task 6's test edits with WNBA names. Query key is `["wnba", "props", "board", book]`. Game filtering still uses `row.game_id`. Page path is `/wnba/prop_picks`. The page component is `LeaguePropPicksPage`. Labels come from `@/features/basketball/lib/wnbaBookLabels`. American formatting stays `formatAmericanOdds` from `@/features/basketball/lib/wnbaOddsBoard`.

- [ ] **Step 2: Run the page test to verify it fails**

```bash
cd frontend && npm test -- src/pages/LeaguePropPicksPage.test.tsx src/features/basketball/league/WnbaPropPicksTable.test.tsx
```

Expected: FAIL on the DFS header, the missing `book` argument, or `dfs` fixtures.

- [ ] **Step 3: Implement the WNBA page**

Apply the Task 6 hook, filter, table, sort, and filter-component edits under the basketball paths.

`filterWnbaPropBoardRows` game check:

```typescript
if (gameFilter.size > 0) {
  if (row.game_id == null || !gameFilter.has(String(row.game_id))) {
    return false;
  }
}
```

`LeaguePropPicksPage.tsx` is the Task 6 page with these names: `useWnbaPropBoard`, `WnbaPropPicksFilters`, `WnbaPropPicksHeader`, `WnbaPropPicksTable`, `bookDisplayName` from `wnbaBookLabels`, collectors and types from `filterWnbaPropBoard`, `BOOK_CHIP_ORDER` from `sortWnbaPropBoard`, and `WnbaPropBoardSide`. Delete `collectWnbaBoardTeamOptions` and `collectWnbaBoardBookmakerOptions`.

- [ ] **Step 4: Run the WNBA frontend tests**

```bash
cd frontend && npm test -- src/features/basketball/hooks/useWnbaPropBoard.test.tsx src/features/basketball/league/filterWnbaPropBoard.test.ts src/features/basketball/league/WnbaPropPicksFilters.test.tsx src/features/basketball/league/WnbaPropPicksTable.test.tsx src/pages/LeaguePropPicksPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/basketball/hooks/useWnbaPropBoard.ts frontend/src/features/basketball/hooks/useWnbaPropBoard.test.tsx frontend/src/features/basketball/league/filterWnbaPropBoard.ts frontend/src/features/basketball/league/filterWnbaPropBoard.test.ts frontend/src/features/basketball/league/WnbaPropPicksFilters.tsx frontend/src/features/basketball/league/WnbaPropPicksFilters.test.tsx frontend/src/features/basketball/league/WnbaPropPicksTable.tsx frontend/src/features/basketball/league/WnbaPropPicksTable.test.tsx frontend/src/features/basketball/league/sortWnbaPropBoard.ts frontend/src/pages/LeaguePropPicksPage.tsx frontend/src/pages/LeaguePropPicksPage.test.tsx
git commit -m "$(cat <<'EOF'
Show WNBA props for the book in the page URL.

The line cell carries that book's price, and identical lines are the only other odds.
EOF
)"
```

---

### Task 8: Document the anchor board

**Files:**
- Modify: `md/system-design.md`

**Interfaces:**
- Consumes: the shipped route and page behavior from Tasks 2, 4, 6, and 7.
- Produces: the `/wnba/prop_picks` and `/mlb/prop_picks` table cells, the two `GET /props/board` bullets, and the prop-picks data-flow block describe the anchor book.

- [ ] **Step 1: Update the page rows**

Replace the `/wnba/prop_picks` cell's description with:

`Sportsbook research table. One row per player + prop type + anchor-book line + side. Default book PrizePicks (omit ?book=). Columns Proposition, Line (anchor number + American; PrizePicks -137), Odds (other books with the same player, prop type, and line; this side; logo + line + American), IP (average raw implied of the anchor and those matches; the anchor's own implied probability when the line is unique), L5/L10/L15, H2H. Filters: Game, Bookmaker (single select, fixed book list, stored in ?book=), Proposition, Over/Under, Hit rate, player search. No DFS column. No Team filter.`

Hook cell: `useWnbaPropBoard(book)`. API cell: `GET /api/wnba/props/board?book=`. Notes cell: `Client filterWnbaPropBoardRows (game + market + side + name). Bookmaker refetches. Default sort unchanged. 30 rows per page. Empty copy "No board yet". Empty book still shows Bookmaker.`

Write the same paragraph for `/mlb/prop_picks` with `useMlbPropBoard(book)` and `GET /api/mlb/props/board?book=`.

- [ ] **Step 2: Update the API bullets and the data-flow block**

Replace the `GET /api/wnba/props/board` bullet with:

`wnba.prop_board. Query book defaults to prizepicks. Unknown book is 422. Rows exist only when that book posted the player and prop at that line. anchor is that book's chip (PrizePicks missing American is -137). books lists other quotes in the same player+stat+line cluster for this side. dfs is removed. ip_pct averages the anchor and those matches. 200 with warnings when enrichment fails. 200 and rows [] when the book posted nothing.`

Write the MLB bullet the same way for `mlb.prop_board`.

Replace the data-flow block so both pages call `useWnbaPropBoard(book)` / `useMlbPropBoard(book)`, request `GET /api/{league}/props/board?book=`, keep clusters that contain that book, and stop attaching a different line onto the row. Sidebar prefetch uses `book=prizepicks`.

In the "Prop picks" cross-cutting paragraph, replace "server builds DFS-anchored rows" with "server builds rows for the anchor book on `/props/board`". Leave the `/props/today` snapshot sentences unchanged.

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md
git commit -m "$(cat <<'EOF'
Document prop boards as anchor-book research tables.

Odds match the selected book's player, prop, and line.
EOF
)"
```

---

## Self-review

Spec coverage:

- Default PrizePicks and one-book switch: Tasks 1, 2, 6.
- Identical player, prop type, and line: Task 1 test `test_anchor_book_keeps_only_identical_player_stat_and_line` and the WNBA twin in Task 3. FanDuel 2.5 is excluded from a DraftKings 1.5 row. A different stat at 1.5 is a different row only when that book is the anchor.
- IP consensus versus unique line: `consensus_ip_pct` of the anchor plus matches, which is the single price when `books` is empty.
- PrizePicks -137: `_side_american`.
- DFS column and Team filter removed: Tasks 6 and 7.
- `?book=`, cache key, prefetch: Tasks 5, 6, and 7.
- 422 and empty 200: Tasks 1, 2, and 4.
- Hit rates stay on the anchor line because enrichment runs on the filtered clusters and `hit_rates` receives `cluster.line`.
- Docs: Task 8.
- Out of scope held: no `/props/today` edits, no alt ladders, no shared package, no NBA board.

Placeholder scan: no TBD, TODO, or open-ended "handle edge cases" steps. Task 7 names every WNBA file and the `game_id` filter. The hook and page substitutions are listed in that task; the shared chip rule is the code in Task 1.

Type consistency: `get_mlb_prop_board(book: str | None = None)`, `get_wnba_prop_board(book: str | None = None)`, `fetchMlbPropBoard(book = "prizepicks")`, `fetchWnbaPropBoard(book = "prizepicks")`, `useMlbPropBoard(book = "prizepicks")`, `useWnbaPropBoard(book = "prizepicks")`, row field `anchor`.
