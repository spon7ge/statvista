# MLB Prop Picks Soft Consensus + Filter Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Soft Consensus (Tier 3 equal average of soft/cmp books including Pinnacle when Tier 1/2 empty) and remove MLB Prop Picks Tier + Fresh-vs-stale filters.

**Architecture:** Extend `compute_fair` with `_tier3` over soft book keys; pass those exact-line fair%s into `side_books` from `props.py` (still attach expand quotes as `role: comparison`). Simplify frontend filter state/UI. Sync OpenAPI + docs.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vitest · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-mlb-prop-picks-soft-consensus-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Tier 1/2 unchanged (PX+Novig → DK+FD)
- Tier 3 only when Tier 1+2 empty; equal average of available: `caesars`, `kalshi`, `bet365`, `betmgm`, `fanatics`, `hardrock`, `fliff`, `pinnacle`
- Badge / enum: `soft_consensus` (Soft Consensus)
- Exact line only; ≥1 soft book required for Tier 3
- Expand quote `role` stays `comparison` for soft/Pinnacle
- Remove Tier dropdown + Fresh sharp vs stale DFS only toggle; keep Stat/Team/Side/Clear
- OpenAPI sync after schema/enum change

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/prop_fair.py` | `SourceTier` + `_tier3` + `compute_fair` |
| `backend/tests/test_mlb_prop_fair.py` | Tier 3 unit tests |
| `backend/app/domains/mlb/props.py` | Feed soft/Pinnacle into side_books; fair-driving timestamps for soft |
| `backend/tests/test_mlb_props.py` | Soft-only → soft_consensus; PX still wins; update pinnacle-only test |
| OpenAPI trio | Enum |
| `frontend/.../filterMlbPropPicks.ts` (+test) | Drop tiers / freshVsStale |
| `frontend/.../MlbPropPicksFilters.tsx` (+test) | UI cleanup |
| `frontend/src/pages/MlbPropPicksPage.tsx` (+test if needed) | Drop filter state |
| `md/system-design.md` + design Status | Docs |

---

### Task 1: `compute_fair` Tier 3 Soft Consensus

**Files:**
- Modify: `backend/app/domains/mlb/prop_fair.py`
- Modify: `backend/tests/test_mlb_prop_fair.py`

**Interfaces:**
- Produces: `SourceTier` includes `"soft_consensus"`
- Produces: `SOFT_FAIR_BOOKS: tuple[str, ...] = ("caesars", "kalshi", "bet365", "betmgm", "fanatics", "hardrock", "fliff", "pinnacle")`
- Produces: `_tier3(side_books) -> FairResult | None`
- `compute_fair`: Tier1 → Tier2 → Tier3 → no_sharp_read

- [ ] **Step 1: Failing tests**

```python
def test_soft_consensus_single_book():
    r = compute_fair(
        {
            "prophetx": None,
            "novig": None,
            "draftkings": None,
            "fanduel": None,
            "pinnacle": 55.0,
        }
    )
    assert r.source_tier == "soft_consensus"
    assert r.fair_pct == 55.0
    assert "pinnacle" in r.fair_explain.lower()


def test_soft_consensus_equal_average():
    r = compute_fair(
        {
            "prophetx": None,
            "novig": None,
            "draftkings": None,
            "fanduel": None,
            "caesars": 50.0,
            "pinnacle": 56.0,
            "betmgm": 53.0,
        }
    )
    assert r.source_tier == "soft_consensus"
    assert r.fair_pct == 53.0  # (50+56+53)/3


def test_tier1_still_beats_soft_books():
    r = compute_fair(
        {
            "prophetx": 58.0,
            "novig": None,
            "draftkings": None,
            "fanduel": None,
            "pinnacle": 40.0,
            "caesars": 41.0,
        }
    )
    assert r.source_tier == "sharp_single_source"
    assert r.fair_pct == 58.0


def test_tier2_still_beats_soft_books():
    r = compute_fair(
        {
            "prophetx": None,
            "novig": None,
            "draftkings": 55.0,
            "fanduel": None,
            "pinnacle": 40.0,
        }
    )
    assert r.source_tier == "mid_tier_fallback"
    assert r.fair_pct == 55.0
```

- [ ] **Step 2: Run — expect FAIL**

`cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_prop_fair.py -k soft_consensus -v`

- [ ] **Step 3: Implement**

```python
SOFT_FAIR_BOOKS: tuple[str, ...] = (
    "caesars",
    "kalshi",
    "bet365",
    "betmgm",
    "fanatics",
    "hardrock",
    "fliff",
    "pinnacle",
)

# SourceTier Literal += "soft_consensus"

def _tier3(side_books: SideBooks) -> FairResult | None:
    present = [
        (book, side_books[book])
        for book in SOFT_FAIR_BOOKS
        if side_books.get(book) is not None
    ]
    if not present:
        return None
    fair = round(sum(v for _, v in present) / len(present), 1)
    names = ", ".join(b for b, _ in present)
    return FairResult(
        fair_pct=fair,
        source_tier="soft_consensus",
        confidence_chips=[],
        sample_chips=[],
        fair_explain=f"Soft books avg ({len(present)}): {names}.",
    )


def compute_fair(side_books: SideBooks) -> FairResult:
    tier1 = _tier1(side_books)
    if tier1 is not None:
        return tier1
    tier2 = _tier2(side_books)
    if tier2 is not None:
        return tier2
    tier3 = _tier3(side_books)
    if tier3 is not None:
        return tier3
    return FairResult(
        fair_pct=None,
        source_tier="no_sharp_read",
        confidence_chips=[],
        sample_chips=[],
        fair_explain="No Tier 1/2/3 books available.",
    )
```

- [ ] **Step 4: Run full fair suite — PASS**

`cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_prop_fair.py -q`

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/prop_fair.py backend/tests/test_mlb_prop_fair.py
git commit -m "$(cat <<'EOF'
feat(mlb): add Soft Consensus tier to prop fair odds

EOF
)"
```

---

### Task 2: Wire soft/Pinnacle into `side_books` + recency timestamps

**Files:**
- Modify: `backend/app/domains/mlb/props.py`
- Modify: `backend/tests/test_mlb_props.py`

**Interfaces:**
- Consumes: `SOFT_FAIR_BOOKS` / `compute_fair` from Task 1
- `_side_fair_books` already maps whatever indexes are passed — extend `fair_book_indexes` in `_assemble_rows` to include each `_PARLAY_CMP_BOOKS` entry + `pinnacle`
- Expand assembly: keep `_cmp_quote` / pinnacle `role="comparison"`
- Update `_fair_driving_changed_at` for `soft_consensus` to max timestamp among soft indexes that contributed (pass cmp indexes + pinnacle)

- [ ] **Step 1: Failing / update assemble tests**

Replace/extend `test_pinnacle_is_comparison_only_and_exact_line`:

```python
def test_pinnacle_only_drives_soft_consensus(monkeypatch):
    # same fixtures as old pinnacle-only test
    ...
    assert row.books.pinnacle is not None
    assert row.books.pinnacle.role == "comparison"
    assert row.source_tier == "soft_consensus"
    assert row.fair_pct is not None
    assert row.edge_pct is not None


def test_soft_parlay_cmp_only_drives_soft_consensus(monkeypatch):
    # DFS board + only caesars (or betmgm) on exact line via Parlay stub
    # assert source_tier == soft_consensus; books.caesars.role == comparison
```

Keep a test that PX present → still `sharp_*` even if soft books exist.

- [ ] **Step 2: Implement wiring**

In `_assemble_rows`:

```python
from app.domains.mlb.prop_fair import SOFT_FAIR_BOOKS  # or duplicate tuple locally if preferred to avoid export churn — prefer import

fair_book_indexes = {
    "prophetx": prophetx_idx,
    **{book: parlay_by_book.get(book, {}) for book in _PARLAY_FAIR_BOOKS},
    **{book: parlay_by_book.get(book, {}) for book in _PARLAY_CMP_BOOKS},
    "pinnacle": pinnacle_idx,
}
```

Extend `_fair_driving_changed_at` signature to accept soft indexes (or a dict) and:

```python
if source_tier == "soft_consensus":
    candidates = soft_indexes  # cmp + pinnacle
elif source_tier == "mid_tier_fallback":
    candidates = (dk_idx, fd_idx)
else:
    candidates = (prophetx_idx, novig_idx)
```

- [ ] **Step 3: Run**

`cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_props.py tests/test_mlb_prop_fair.py -q`

- [ ] **Step 4: Commit**

```bash
git add backend/app/domains/mlb/props.py backend/tests/test_mlb_props.py
git commit -m "$(cat <<'EOF'
feat(mlb): feed soft books into Soft Consensus fair assembly

EOF
)"
```

---

### Task 3: OpenAPI regen

**Files:** `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

- [ ] **Step 1:**

```bash
PYTHONPATH=.:backend python3 scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `soft_consensus` in SourceTier / MlbPropRow enums across all three.

- [ ] **Step 2: Commit**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
chore(api): regenerate OpenAPI for soft_consensus source tier

EOF
)"
```

---

### Task 4: Remove Tier + Fresh-vs-stale filters (frontend)

**Files:**
- Modify: `frontend/src/features/mlb/league/filterMlbPropPicks.ts`
- Modify: `frontend/src/features/mlb/league/filterMlbPropPicks.test.ts`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksFilters.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksFilters.test.tsx`
- Modify: `frontend/src/pages/MlbPropPicksPage.tsx`
- Modify: `frontend/src/pages/MlbPropPicksPage.test.tsx` (if it asserts Tier/Fresh controls)

**Interfaces:**
- `MlbPropFilterSelection` = `{ stats, teams, sides }` only
- Remove `MLB_SOURCE_TIER_OPTIONS` export if unused (or keep labels map only if list needs it — prefer delete)
- Keep `FRESH_VS_STALE_DFS_CHIP` only if unused after filter removal — delete if nothing references it
- Filters UI: Stat, Team, Side, Clear only

- [ ] **Step 1: Update filter unit tests** — remove tier / freshVsStale cases; assert filter ignores those fields.

- [ ] **Step 2: Update Filters component + page state** — drop props `selectedTiers`, `freshVsStaleOnly`, handlers; simplify `hasActive`.

- [ ] **Step 3: Run**

```bash
cd frontend && npm test -- \
  src/features/mlb/league/filterMlbPropPicks.test.ts \
  src/features/mlb/league/MlbPropPicksFilters.test.tsx \
  src/pages/MlbPropPicksPage.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/mlb/league/filterMlbPropPicks.ts \
  frontend/src/features/mlb/league/filterMlbPropPicks.test.ts \
  frontend/src/features/mlb/league/MlbPropPicksFilters.tsx \
  frontend/src/features/mlb/league/MlbPropPicksFilters.test.tsx \
  frontend/src/pages/MlbPropPicksPage.tsx \
  frontend/src/pages/MlbPropPicksPage.test.tsx
git commit -m "$(cat <<'EOF'
refactor(mlb): drop prop picks Tier and Fresh-vs-stale filters

EOF
)"
```

---

### Task 5: Docs

**Files:**
- Modify: `md/system-design.md` — MLB prop picks: Soft Consensus Tier 3; filters Stat/Team/Side only
- Modify: `docs/superpowers/specs/2026-08-08-mlb-prop-picks-soft-consensus-design.md` → Status: Implemented
- Optional note on older prop-picks design that Soft Consensus supersedes “cmp never sets fair” for empty Tier 1/2

- [ ] **Step 1: Edit docs**

- [ ] **Step 2: Final verify**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_prop_fair.py tests/test_mlb_props.py -q
cd ../frontend && npm run check:api && npm test -- \
  src/features/mlb/league/filterMlbPropPicks.test.ts \
  src/features/mlb/league/MlbPropPicksFilters.test.tsx \
  src/pages/MlbPropPicksPage.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md docs/superpowers/specs/2026-08-08-mlb-prop-picks-soft-consensus-design.md
git commit -m "$(cat <<'EOF'
docs(mlb): mark Soft Consensus prop fair shipped in system-design

EOF
)"
```

---

## Spec coverage

| Requirement | Task |
| --- | --- |
| Soft Consensus Tier 3 avg (+ Pinnacle) | 1–2 |
| Tier 1/2 unchanged | 1 |
| Expand role stays comparison | 2 |
| Remove Tier + Fresh filters | 4 |
| OpenAPI + system-design | 3, 5 |
