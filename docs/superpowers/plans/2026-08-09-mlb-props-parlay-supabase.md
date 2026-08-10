# MLB Props Parlay + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop calling The Odds API for MLB props. Seed PrizePicks/DK/FD from ParlayAPI; attach ProphetX/Novig/Pinnacle from latest Supabase scrapers on `/api/mlb/props/today` and game-preview props.

**Architecture:** Thin MLB Parlay normalizer → PP board + DK/FD side indexes. `fetch_latest_novig` mirrors ProphetX snapshot reads. Fair Tier 1 = PX+Novig; Soft Consensus requires ≥2 soft books (list is Pinnacle-only → dormant). Shrink `MlbPropBooks` to five books.

**Tech Stack:** FastAPI/Python, Parlay HTTP client, Supabase via `odds_snapshots`, pytest, React expand UI, OpenAPI golden

**Spec:** `docs/superpowers/specs/2026-08-09-mlb-props-parlay-supabase-design.md`

## Global Constraints

- Parlay books only: `prizepicks`, `draftkings`, `fanduel`
- Supabase: `mlb_prophetx`, `mlb_novig`, `mlb_pinnacle` (latest `scraped_at`)
- Underdog board unchanged from `mlb_underdogs`
- Remove live: `kalshi`, `betmgm`, `betonline`
- Tier 1: `("prophetx", "novig")`; Soft: `SOFT_FAIR_BOOKS = ("pinnacle",)` with `len(present) >= 2`
- No MLB props path emits `odds_api_unavailable` (use `parlay_unavailable`)
- Domains must not cross-import (MLB stays in `app.domains.mlb` / `app.providers.parlay`)
- Follow `md/claude.md`; update `md/system-design.md` when page ↔ API wiring changes
- Migrations `033`/`034` for Novig already shipped — apply on Supabase before relying on Novig attach

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/domains/mlb/prop_fair.py` | Tier 1 / Soft Consensus rules |
| `backend/app/core/odds_snapshots.py` | `fetch_latest_novig` |
| `backend/app/providers/parlay/mlb_props.py` | Fetch + normalize MLB Parlay → board + book indexes |
| `backend/app/domains/mlb/props.py` | Assemble `/props/today` without Odds API |
| `backend/app/domains/mlb/game_props.py` | Game preview props without Odds API |
| `backend/app/domains/mlb/schemas_props.py` | Shrink `MlbPropBooks` |
| Frontend expand labels + tests | Match five books |
| OpenAPI golden + `md/system-design.md` | Sync |

---

### Task 1: Fair tiers (TDD)

**Files:**
- Modify: `backend/app/domains/mlb/prop_fair.py`
- Modify: `backend/tests/test_mlb_prop_fair.py`

**Interfaces:**
- Consumes: existing `compute_fair`
- Produces: `_TIER1_BOOKS = ("prophetx", "novig")`; Soft Consensus only if `len(present) >= 2`

- [ ] **Step 1: Write failing tests**

```python
def test_tier1_equal_avg_px_novig_no_kalshi():
    r = compute_fair({"prophetx": 60.0, "novig": 54.0, "kalshi": 57.0})
    assert r.fair_pct == 57.0  # (60+54)/2 — kalshi ignored
    assert r.source_tier == "sharp_consensus"

def test_soft_consensus_requires_two_books():
    r = compute_fair({"prophetx": None, "novig": None, "draftkings": None, "fanduel": None, "pinnacle": 55.0})
    assert r.source_tier == "no_sharp_read"
    assert r.fair_pct is None

def test_soft_consensus_two_soft_books_when_configured(monkeypatch):
    import app.domains.mlb.prop_fair as pf
    monkeypatch.setattr(pf, "SOFT_FAIR_BOOKS", ("pinnacle", "betmgm"))
    r = compute_fair({"pinnacle": 55.0, "betmgm": 53.0})
    assert r.source_tier == "soft_consensus"
    assert r.fair_pct == 54.0
```

Update any existing tests that assume Kalshi in Tier 1 or single-book soft consensus.

- [ ] **Step 2: Run — expect FAIL**

Run: `pytest backend/tests/test_mlb_prop_fair.py -v`

- [ ] **Step 3: Implement**

```python
SOFT_FAIR_BOOKS: tuple[str, ...] = ("pinnacle",)
_TIER1_BOOKS: tuple[str, ...] = ("prophetx", "novig")

def _tier3(side_books: SideBooks) -> FairResult | None:
    present = [
        (book, side_books[book])
        for book in SOFT_FAIR_BOOKS
        if side_books.get(book) is not None
    ]
    if len(present) < 2:
        return None
    # ... existing avg / explain
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(mlb): Tier1 PX+Novig; Soft Consensus needs 2+ books"
```

---

### Task 2: `fetch_latest_novig` + shrink `MlbPropBooks` (TDD)

**Files:**
- Modify: `backend/app/core/odds_snapshots.py`
- Modify: `backend/app/domains/mlb/schemas_props.py`
- Modify: `backend/tests/test_mlb_prop_books_schema.py`
- Test: add/extend snapshot fetch tests if present; else unit-test SQL table map via thin helper

**Interfaces:**
- Produces: `fetch_latest_novig(league: str = "mlb") -> list[dict]`  
  Columns: `player_name, stat_name, line_score, side, american_price, scraped_at` from `odds.mlb_novig`
- `MlbPropBooks` fields only: `prophetx`, `novig`, `draftkings`, `fanduel`, `pinnacle`

- [ ] **Step 1: Failing schema test**

```python
EXPECTED = ("prophetx", "novig", "draftkings", "fanduel", "pinnacle")
assert tuple(MlbPropBooks.model_fields.keys()) == EXPECTED
```

- [ ] **Step 2: Implement schema shrink + `fetch_latest_novig`**

Mirror `fetch_latest_prophetx`:

```python
_NOVIG_TABLE = {"mlb": "mlb_novig"}

def fetch_latest_novig(league: str = "mlb") -> list[dict]:
    lg = _normalized_league(league, "mlb")
    table = _NOVIG_TABLE.get(lg, "mlb_novig")
    sql = _latest_snapshot_sql(
        table,
        "player_name, stat_name, line_score, side, american_price, scraped_at",
    )
    return _fetch_rows(sql, lg)
```

Update module docstring to mention Novig.

- [ ] **Step 3: Tests PASS; commit**

```bash
git commit -m "feat(mlb): fetch_latest_novig and shrink MlbPropBooks"
```

---

### Task 3: MLB Parlay props provider (TDD)

**Files:**
- Create: `backend/app/providers/parlay/mlb_props.py`
- Create: `backend/tests/test_parlay_mlb_props.py`
- Create fixture: `backend/tests/fixtures/parlay_mlb_props_minimal.json` (PP + DK + FD rows; ignore extra books)

**Interfaces:**
- Produces dataclass (or NamedTuple):

```python
@dataclass(frozen=True)
class ParlayMlbNormalized:
    prizepicks_board: list[dict[str, Any]]  # same shape as former Odds PP board rows
    book_indexes: dict[str, SideIndex]  # keys: draftkings, fanduel
    as_of: str | None
    unavailable: bool = False
```

- `async def fetch_mlb_parlay_props_normalized(*, timeout: float = 12.0) -> ParlayMlbNormalized`
- Pure `normalize_parlay_mlb_props(rows: list[dict]) -> ParlayMlbNormalized`

**Board row shape** (match what `_build_board` expects for prizepicks today — inspect `props.py` `_build_board` / Odds normalize):  
`player_name`, `stat_type` or already-canonical fields used by `_build_board`. Prefer emitting the same keys Odds PP board used so `_build_board` needs minimal change.

**Rules:**
- Sport: baseball MLB (confirm Parlay `sport` query param used elsewhere — WNBA uses `basketball_wnba`; use `baseball_mlb`)
- Keep bookmakers in `{"prizepicks", "draftkings", "fanduel"}` only
- Map markets via `canonical_stat_key_from_sharp_mlb` (handles `_alternate`)
- Exact line indexing for DK/FD sides `over`/`under`
- On HTTP/key failure: raise or return `unavailable=True` (caller sets `parlay_unavailable`)

- [ ] **Step 1: Fixture + normalize unit tests (no network)**

```python
def test_normalize_builds_pp_board_and_dk_fd_indexes():
    out = normalize_parlay_mlb_props(load_fixture())
    assert any(r["player_name"] == "Shohei Ohtani" for r in out.prizepicks_board)
    assert "draftkings" in out.book_indexes
    assert "novig" not in out.book_indexes
```

- [ ] **Step 2: Implement normalize + fetch using `parlay_get`**

Reuse patterns from `app.domains.betting.parlay_props.fetch_parlay_prop_rows` but MLB markets list from existing MLB allowlist / sharp keys (hits, total_bases, pitcher_strikeouts, …). Prefer a explicit `_MLB_PROP_MARKET_KEYS` tuple of Parlay `player_*` / `batter_*` / `pitcher_*` strings known to work; include `_alternate` variants if Parlay returns them as separate market_key values (canonicalizer strips suffix).

- [ ] **Step 3: Tests PASS; commit**

```bash
git commit -m "feat(mlb): Parlay MLB props normalize for PP/DK/FD"
```

---

### Task 4: Rewire `props.py` assemble (TDD)

**Files:**
- Modify: `backend/app/domains/mlb/props.py`
- Modify: `backend/tests/test_mlb_props.py`

**Interfaces:**
- Replace `fetch_mlb_props_normalized` with `fetch_mlb_parlay_props_normalized`
- Index: prophetx, novig, pinnacle from snapshots; merge Parlay `book_indexes` for dk/fd
- `_assemble_rows` signature: pass `novig_idx` from snapshots (not from odds.book_indexes)
- Error token: `parlay_unavailable`

- [ ] **Step 1: Update tests** — rename Odds mocks to Parlay; assert no Odds API import path needed; Parlay fail + Underdog still returns rows; expand books omit kalshi/betmgm/betonline

- [ ] **Step 2: Implement assemble**

Sketch:

```python
parlay = await fetch_mlb_parlay_props_normalized(...)
# or soft-fail → empty ParlayMlbNormalized(unavailable=True)

if app == "prizepicks":
    dfs_rows = parlay.prizepicks_board
else:
    dfs_rows = fetch_latest_underdog("mlb")

prophetx_idx = _index_snapshot_rows(fetch_latest_prophetx("mlb"), ...)
novig_idx = _index_snapshot_rows(fetch_latest_novig("mlb"), player_field="player_name", stat_field="stat_name")
pinnacle_idx = _index_snapshot_rows(fetch_latest_pinnacle("mlb"), ...)

fair_indexes = {
    "prophetx": prophetx_idx,
    "novig": novig_idx,
    "draftkings": parlay.book_indexes.get("draftkings", {}),
    "fanduel": parlay.book_indexes.get("fanduel", {}),
    "pinnacle": pinnacle_idx,
}
```

Update `_assemble_rows` / `_fair_driving_changed_at` to use this set (drop kalshi/betmgm/betonline).

- [ ] **Step 3: Tests PASS; commit**

```bash
git commit -m "feat(mlb): assemble prop picks from Parlay + scraper snapshots"
```

---

### Task 5: Rewire `game_props.py` (TDD)

**Files:**
- Modify: `backend/app/domains/mlb/game_props.py`
- Modify: `backend/tests/test_mlb_game_props.py`

**Interfaces:**
- Same Parlay + snapshot indexes as league board
- `BOOK_PRIORITY` / best-odds pool: `prophetx`, `novig`, `draftkings`, `fanduel`, `pinnacle` only
- Error: `parlay_unavailable` instead of `odds_api_unavailable`

- [ ] **Step 1: Update tests** to mock Parlay normalize + snapshot fetches

- [ ] **Step 2: Implement; remove Odds API imports**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mlb): game props from Parlay + scraper snapshots"
```

---

### Task 6: Frontend, OpenAPI, system-design

**Files:**
- Modify: `frontend/src/features/mlb/lib/mlbBookLabels.ts`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.tsx` (+ tests)
- Modify: other FE tests fixtures dropping kalshi/betmgm/betonline
- Sync OpenAPI: regenerate or edit `backend/openapi-golden.json` / `frontend/openapi.json` / `api.schema.d.ts` per project convention (match prior Odds API book shrink PRs)
- Modify: `md/system-design.md` `/mlb/prop_picks` + game props rows

**Copy:** Footer/help text should say fair from ProphetX/Novig (then DK/FD); Soft Consensus when 2+ soft books (Pinnacle alone does not).

- [ ] **Step 1: Update FE tests red → green**

- [ ] **Step 2: OpenAPI + system-design**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(mlb): shrink prop book UI and docs for Parlay cutover"
```

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Drop Odds API from MLB props | 4, 5 |
| Parlay PP/DK/FD | 3, 4 |
| Supabase PX/Novig/Pinnacle | 2, 4, 5 |
| Tier 1 / Soft ≥2 | 1 |
| Shrink books schema/UI | 2, 6 |
| `parlay_unavailable` | 4, 5 |
| system-design | 6 |

## Self-review notes

- Novig table must exist in Supabase (`033`/`034`) before production attach works.
- Parlay MLB market key list may need a live sample pass; start from sharp aliases + `_alternate` strip.
- Leave `providers/odds_api/` in tree unused (spec).
