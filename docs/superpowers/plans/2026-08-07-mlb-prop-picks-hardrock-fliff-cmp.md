# MLB Prop Picks Hard Rock & Fliff Cmp Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hard Rock and Fliff as Parlay comparison-only quotes on MLB prop picks expand (never fair/edge).

**Architecture:** Extend `MlbPropBooks` + `_PARLAY_CMP_BOOKS` with `hardrock` / `fliff`. Fair books unchanged. Sync OpenAPI/types; render two new expand cells after Fanatics.

**Tech Stack:** FastAPI/Pydantic, ParlayAPI, React/Vitest, OpenAPI

**Spec:** `docs/superpowers/specs/2026-08-07-mlb-prop-picks-hardrock-fliff-cmp-design.md`

## Global Constraints

- Keys: `hardrock`, `fliff`
- Both `role: "comparison"`; never enter `compute_fair`
- `_PARLAY_FAIR_BOOKS` unchanged: `novig`, `fanduel`, `draftkings`
- Exact DFS line match only
- Expand order after Fanatics: Hard Rock → Fliff
- WNBA unchanged; no new scrapers
- Product name: **statvista**

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_props.py` | Add `hardrock`, `fliff` on `MlbPropBooks` |
| `backend/app/domains/mlb/props.py` | Extend `_PARLAY_CMP_BOOKS`; assemble cmp quotes |
| `backend/tests/test_mlb_props.py` | Extend cmp attach test |
| `backend/openapi-golden.json` + `frontend/openapi.json` + `api.schema.d.ts` | Schema sync |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Labels + BookQuoteCells |
| Frontend test fixtures | Null fields + expand label asserts |
| Spec status → Implemented | |

---

### Task 1: Backend schema + Parlay cmp index

**Files:** schemas_props.py, props.py, test_mlb_props.py, OpenAPI artifacts

- [x] **Step 1:** Extend `test_parlay_cmp_books_attach_without_driving_fair` with `hardrock` / `fliff` Parlay rows and assert `role == "comparison"`.
- [x] **Step 2:** Add optional fields on `MlbPropBooks`; extend `_PARLAY_CMP_BOOKS`; assemble via `_cmp_quote`.
- [x] **Step 3:** `PYTHONPATH=backend pytest backend/tests/test_mlb_props.py::test_parlay_cmp_books_attach_without_driving_fair -v` PASS
- [x] **Step 4:** `PYTHONPATH=.:backend python -c "from app.openapi_export import export_openapi; export_openapi()"` then copy/sync frontend openapi + `npm run generate:api`
- [ ] **Step 5:** Commit backend + OpenAPI (when user asks / at finish)

### Task 2: Frontend expand cells

**Files:** MlbPropPicksList.tsx (+ tests), filter fixtures

- [x] **Step 1:** Add `hardrock`/`fliff: null` to test fixtures; assert expand shows Hard Rock / Fliff.
- [x] **Step 2:** BOOK_LABELS + BookQuoteCells after Fanatics.
- [x] **Step 3:** `cd frontend && npm test -- --run MlbPropPicksList.test.tsx filterMlbPropPicks.test.ts` PASS
- [x] **Step 4:** Spec Status → Implemented; update `md/system-design.md` prop_picks note if it lists books

## Spec coverage

| Requirement | Task |
| --- | --- |
| Schema fields | 1 |
| Cmp role / fair isolation | 1 |
| OpenAPI/types | 1 |
| Expand UI order + labels | 2 |
| Tests | 1–2 |
