# MLB Prop Picks Parlay Comparison Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Caesars, Kalshi, bet365, BetMGM, and Fanatics as Parlay comparison-only quotes on MLB prop expand (never fair/edge).

**Architecture:** Extend `MlbPropBooks` + Parlay index keeplist (`_PARLAY_CMP_BOOKS`). Fair books stay Novig/FD/DK. Sync OpenAPI/types; render five new `(cmp)` cells in expand UI.

**Tech Stack:** FastAPI/Pydantic, ParlayAPI, React/Vitest, OpenAPI

**Spec:** `docs/superpowers/specs/2026-08-05-mlb-prop-picks-parlay-cmp-books-design.md`

## Global Constraints

- Keys: `caesars`, `kalshi`, `bet365`, `betmgm`, `fanatics`
- All five `role: "comparison"`; never enter `compute_fair`
- `_PARLAY_FAIR_BOOKS` unchanged: `novig`, `fanduel`, `draftkings`
- Exact DFS line match only
- Expand order: PX → Novig → DK → FD → Pinnacle → Caesars → Kalshi → bet365 → BetMGM → Fanatics
- WNBA unchanged; no new scrapers
- Product name: **statvista**

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_props.py` | Add five fields on `MlbPropBooks` |
| `backend/app/domains/mlb/props.py` | `_PARLAY_CMP_BOOKS`; index + assemble with `role=comparison` |
| `backend/tests/test_mlb_props.py` | Cmp attach + fair isolation tests |
| `backend/openapi-golden.json` (+ export path used by project) | Schema sync |
| `frontend/openapi.json` + `api.schema.d.ts` | Types |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Labels + BookQuoteCells |
| `frontend/src/features/mlb/league/MlbPropPicksList.test.tsx` | Expand label/(cmp) asserts |
| Spec status → Implemented | |

---

### Task 1: Backend schema + Parlay cmp index

**Files:** schemas_props.py, props.py, test_mlb_props.py, OpenAPI artifacts

- [ ] **Step 1:** Failing test — Parlay `caesars` row at DFS line → `books.caesars.role == "comparison"`; only-cmp Parlay does not set fair from caesars.
- [ ] **Step 2:** Add five optional fields on `MlbPropBooks`.
- [ ] **Step 3:** `_PARLAY_CMP_BOOKS`; `_index_parlay` uses fair∪cmp; assemble with `role="comparison"`.
- [ ] **Step 4:** `PYTHONPATH=backend pytest backend/tests/test_mlb_props.py -v` PASS
- [ ] **Step 5:** Export/sync OpenAPI (follow repo script; `cd frontend && npm run generate:api`)
- [ ] **Step 6:** Commit backend + OpenAPI

### Task 2: Frontend expand cells

**Files:** MlbPropPicksList.tsx (+ test), fixtures in tests

- [ ] **Step 1:** Failing expand test for new labels + `(cmp)`
- [ ] **Step 2:** BOOK_LABELS + five BookQuoteCells after Pinnacle
- [ ] **Step 3:** `npm test -- --run MlbPropPicksList.test.tsx` PASS
- [ ] **Step 4:** Spec Status → Implemented; commit

---

## Spec coverage

| Requirement | Task |
| --- | --- |
| Five schema fields | 1 |
| Cmp role / fair isolation | 1 |
| OpenAPI/types | 1 |
| Expand UI order + labels | 2 |
| Tests | 1–2 |
