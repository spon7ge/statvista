# Backend domain reorg design

Date: 2026-08-04  
Status: Approved for planning  
Scope: `backend/app/` package layout, ML surface teardown, OpenAPI contract for kept paths  
Product: **statvista**

## Goal

Reorganize the FastAPI backend from horizontal layers (`routes/` + `schemas/` + `services/` with sport prefixes) into vertical domains (`wnba`, `mlb`, `betting`, `research`) plus a `providers/` boundary for third-party HTTP — without changing URLs or handler names for any endpoint the site still uses.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Execution style | Incremental commits (one migration step per commit) |
| Fifth domain for bare DB routes | `domains/research/` (`games`, `players`, `matchups`) |
| API versioning | Package reorg only; **no `/v1` path prefix** in this work |
| Tests location | Keep `backend/tests/`; update imports only |
| ML product surface | **Full teardown** — no `domains/ml/` |
| OpenAPI golden | Snapshot **after** ML teardown; subsequent steps must not change kept paths |

## Non-goals

- Mounting `/api/v1/...` or dual-mount aliases
- Co-locating tests under `domains/*/tests/`
- Adding new test suites (separate follow-up after providers + one domain land)
- Changing vendor request/response behavior beyond move + typed provider boundaries
- Frontend UI work beyond regenerating `frontend/openapi.json` / `api.schema.d.ts` after teardown
- Deleting Airflow/dbt/`ml.*` warehouse tables (API surface only)

---

## 1. Target tree

```text
backend/app/
  main.py
  core/
    config.py
    db.py
    errors.py              # shared exception → HTTP mapping
  api/
    deps.py                # shared FastAPI dependencies
    router.py              # assembles domain routers; paths stay /api/...
  domains/
    wnba/
      __init__.py
      routes.py
      schemas.py           # or thin re-exports if file grows large
      scoreboard.py
      game_detail.py
      standings.py
      leaders.py
      player.py
      futures.py
      props.py
      odds.py
      team_names.py
    mlb/
      __init__.py
      routes.py
      schemas.py
      scoreboard.py
      game_detail.py
      lineups.py
      lineup_matchup.py
      odds.py
      team_names.py
    betting/
      __init__.py
      routes.py            # props, slates (not live-props / live-slates)
      schemas.py
      odds_snapshots.py    # Supabase snapshot reads (DB, not HTTP)
      parlay_odds.py       # domain assembly over providers
      parlay_props.py
      dfs_attach.py
      prop_stat_keys.py
    research/
      __init__.py
      routes.py            # games, players, matchups (no prediction payloads)
      schemas.py
  providers/
    __init__.py
    base.py                # shared HTTP: timeouts, retry hooks
    espn/                  # from mlb_espn_bridge, wnba_espn_roster
    mlb_stats/             # from mlb_stats_people
    rotowire/              # from wnba_rotowire_lineups
    pinnacle/              # from pinnacle_team_odds
    parlay/                # from parlay_client
    sharp/                 # from sharp_odds, sharp_props (SharpAPI HTTP)
  openapi_export.py
```

`health` stays under `api/` (or a tiny `api/routes/health.py` included by `router.py`) — not a domain.

---

## 2. Invariants

1. **Dependency direction:** `api` → `domains` → `providers` → `core`. Nothing lower imports upward.
2. **Domains do not import each other.** Shared helpers go in `core/` or stay inside the domain that owns them (`betting` owns `prop_stat_keys` / `dfs_attach`).
3. **Domains and providers never import FastAPI.** HTTP mapping lives in `routes.py` + `api/deps.py` + `core/errors.py`.
4. **All third-party HTTP goes through `providers/`.** Constructing a vendor URL in a domain module is a bug.
5. **Providers return typed data, not raw vendor JSON blobs** at the domain boundary (internal parsing may still use dicts until typed models exist).
6. **Schemas are Pydantic request/response models only** — no DB access, no business logic.
7. **One `routes.py` per domain** until it exceeds ~300 lines; then split into a `routes/` package.
8. **`__init__.py` everywhere**, including new packages (and today’s missing `services/__init__.py` until `services/` is emptied).
9. **Kept public HTTP surface:** URL path, HTTP method, route handler function name, and OpenAPI tags must not change (preserves FastAPI `operationId` → TS client).

---

## 3. ML teardown (intentional contract shrink)

Remove from the API (unmount and delete modules/schemas as appropriate):

| Surface | Notes |
|---------|--------|
| `/api/predictions*` | Standalone ML router |
| `/api/features/{prop}` | Standalone features router |
| `/api/models/{model_id}/accuracy` | Accuracy router |
| `/api/performance` | Performance router |
| `/api/live-props` | Live prop predictions dashboard |
| `/api/live-slates` | Live slates dashboard |
| Games prediction attachments | `/api/games/{date}/predictions`, `/with-predictions`, and prediction fields inside slate/with-props bundles as applicable |
| Player prediction attachments | `include_predictions` / `MLPredictionSummary` on player profile |
| Schemas | `ml_prediction.py`, `prediction.py` (compat alias), `live_prop.py`, `live_slate.py`, `accuracy.py`, `performance.py`, and unused feature prediction bits |

**Rationale:** The website no longer uses ML. Generated `frontend/src/lib/api.schema.d.ts` is the only in-repo consumer of these paths; no React components import them.

**Docs:** Update `backend/README.md` (and `md/system-design.md` page ↔ API table if it lists these routes).

After teardown, export OpenAPI and treat that file as the **golden** contract for all later move steps.

---

## 4. Placement map (kept code)

### `domains/wnba/`

From `api/routes/wnba_*.py`, `schemas/wnba_*.py`, `services/wnba_*.py` (domain logic only). Prefix stripped (`wnba_leaders.py` → `leaders.py`).

Vendor pieces leave for providers: `wnba_espn_roster`, `wnba_rotowire_lineups`.

### `domains/mlb/`

From `mlb_*` routes/schemas/services. Prefix stripped. Vendor: `mlb_espn_bridge`, `mlb_stats_people` → providers.

### `domains/betting/`

| Module | Role |
|--------|------|
| `props`, `slates` routes | DB-backed book lines |
| `odds_snapshots` | Supabase snapshot reads |
| `parlay_odds`, `parlay_props` | Cross-sport odds/prop assembly over providers |
| `dfs_attach`, `prop_stat_keys` | Betting helpers (not `core/`, not providers) |

HTTP clients → providers: `parlay_client` → `parlay/`; `pinnacle_team_odds` → `pinnacle/`; `sharp_odds` + `sharp_props` → `sharp/`. Domain `odds` / `parlay_*` modules call providers.

### `domains/research/`

Bare DB routes: `games`, `players`, `matchups` — after prediction fields/endpoints are stripped.

### `providers/`

| Package | Source today |
|---------|----------------|
| `espn/` | `mlb_espn_bridge`, `wnba_espn_roster` |
| `mlb_stats/` | `mlb_stats_people` |
| `rotowire/` | `wnba_rotowire_lineups` |
| `pinnacle/` | `pinnacle_team_odds` |
| `parlay/` | `parlay_client` |
| `sharp/` | `sharp_odds`, `sharp_props` |
| `base.py` | New shared HTTP client helpers |

`odds_snapshots` stays in `betting/` (Supabase/DB only). Only modules that call external vendor HTTP belong in `providers/`.

---

## 5. Migration order

Use `git mv` for file moves. After **each** step: import `app.main:app` → boot → export OpenAPI → diff vs post-teardown golden → `GET /api/health` → run existing `backend/tests` (minus deleted-route tests removed in 0b).

| Step | Focus |
|------|--------|
| **0** | Optional: commit current `frontend/openapi.json` as pre-teardown baseline |
| **0b** | ML teardown + strip prediction attachments; delete obsolete tests; export OpenAPI golden; regenerate TS types; update README |
| **1** | `services/__init__.py`, `core/errors.py`, `api/deps.py` — no moves |
| **2** | Extract `providers/` (+ `base.py`); wire domain services to new imports |
| **3** | `domains/mlb/` |
| **4** | `domains/wnba/` |
| **5** | `domains/betting/` + `domains/research/` |
| **6** | `api/router.py` assembles routers; thin `main.py`; delete emptied `services/` / old `api/routes/*` / old `schemas/*` as they empty |

**Follow-ups (not this project):** `/api/v1` dual-mount; co-located domain tests; new provider unit tests.

---

## 6. OpenAPI & frontend contract

- **Kept paths:** byte-stable relative to post-0b golden (paths, methods, `operationId`s, schemas still referenced by kept routes).
- **Removed paths:** expected diff only in step 0b.
- Regenerate via existing `openapi_export.py` / `npm run generate:api` after 0b and after the final step.
- `REQUIRED_FRONTEND_PATHS` in `openapi_export.py` already lists WNBA/MLB live paths only — leave that list intact unless a required path is renamed (it must not be).

---

## 7. Error handling & deps (step 1)

- `core/errors.py`: map domain/provider exceptions to HTTPException (or register exception handlers) so routes stay thin.
- `api/deps.py`: shared FastAPI dependencies (DB session helpers if introduced; keep minimal if today routes call `app.core.db` directly — do not force a deps rewrite in the same step as moves).

Prefer adding the files and using them opportunistically; do not rewrite every route to deps in step 1.

---

## 8. Success criteria

- [ ] No `domains/ml/`; ML/live-prop/live-slate/prediction API surface gone
- [ ] Target package tree in place with `__init__.py` everywhere
- [ ] Dependency direction holds (spot-check imports)
- [ ] Post-move OpenAPI matches post-0b golden for all kept operations
- [ ] `/api/health` OK; existing non-deleted tests pass
- [ ] `backend/README.md` (and system-design table if needed) reflect new layout and removed endpoints
- [ ] Frontend OpenAPI types regenerated after teardown

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Renaming route handlers changes TS `operationId` | Never rename handlers; diff OpenAPI every step |
| Domains accidentally import each other during moves | Grep for `from app.domains.` cross-imports in CI/review |
| Provider extract changes caching/timeouts | Move first; behavior-preserving; `base.py` can wrap existing call sites without changing defaults |
| `games`/`players` still reference ML schemas after teardown | Strip in 0b before any package move |
| Large unreviewable PR | One step = one commit; do not mix teardown with mlb move |
