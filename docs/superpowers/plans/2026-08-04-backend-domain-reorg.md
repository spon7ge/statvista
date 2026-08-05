# Backend Domain Reorg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `backend/app/` into `domains/{wnba,mlb,betting,research}` + `providers/` + thin `api/`, tear down unused ML HTTP surface, and keep all remaining OpenAPI `operationId`s stable.

**Architecture:** Vertical domains own routes + schemas + domain logic. Third-party HTTP lives only in `providers/`. Dependency direction is `api → domains → providers → core`. Domains never import each other or FastAPI (except each domain’s `routes.py`). No `/v1` path prefix in this plan. Tests stay in `backend/tests/`.

**Tech Stack:** FastAPI, Pydantic, pytest, `openapi_export.py` → `frontend/openapi.json` → `openapi-typescript`

**Spec:** `docs/superpowers/specs/2026-08-04-backend-domain-reorg-design.md`

## Global Constraints

- Brand: **statvista** in any new product copy / docs
- Kept paths: URL + HTTP method + **handler function name** + OpenAPI tags must not change
- ML teardown is an intentional OpenAPI shrink; golden file is **post-teardown**
- Use `git mv` for renames/moves
- After every task: import app → export OpenAPI → diff golden → `/api/health` → pytest (non-deleted tests)
- No new test suites in this plan (update imports / delete obsolete tests only)
- Domains do not import each other; vendor HTTP only in `providers/`
- Do not commit `data/props/prizepicks/.session_cookie.txt`

---

## File Structure (end state)

| Path | Responsibility |
| --- | --- |
| `backend/app/main.py` | FastAPI app + CORS; includes `api.router` |
| `backend/app/core/{config,db,errors}.py` | Config, DB, exception→HTTP |
| `backend/app/api/deps.py` | Shared FastAPI deps (minimal) |
| `backend/app/api/router.py` | Assembles domain + health routers under `/api` |
| `backend/app/api/routes/health.py` | `GET /api/health` (stays here) |
| `backend/app/domains/wnba/*` | WNBA live surface |
| `backend/app/domains/mlb/*` | MLB live surface |
| `backend/app/domains/betting/*` | props/slates + odds assembly helpers |
| `backend/app/domains/research/*` | games/players/matchups (no predictions) |
| `backend/app/providers/{base,espn,mlb_stats,rotowire,pinnacle,parlay,sharp}/` | Vendor HTTP |
| `backend/app/openapi_export.py` | Export + `REQUIRED_FRONTEND_PATHS` |
| `frontend/openapi.json` + `src/lib/api.schema.d.ts` | Regenerated after teardown + final |
| `backend/tests/*` | Existing tests; imports updated |
| `backend/README.md`, `md/system-design.md` | Docs reflect removals + layout |

### Shared verify snippet (run after every task)

```bash
# from repo root
export PYTHONPATH=.:backend

python -c "from app.main import app; print('routes', len(app.routes))"

python -c "from app.openapi_export import export_openapi; print(export_openapi())"

# After Task 1 (post-teardown golden exists):
diff -u backend/openapi-golden.json frontend/openapi.json
# Expected: empty (no output) for Tasks 2–7

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/health
# Expected: 200 (when server running) OR skip if using TestClient in pytest only

cd backend && python -m pytest -q
# Expected: all remaining tests PASS
```

Save golden once after Task 1:

```bash
cp frontend/openapi.json backend/openapi-golden.json
git add backend/openapi-golden.json frontend/openapi.json frontend/src/lib/api.schema.d.ts
```

---

### Task 1: ML teardown + OpenAPI golden

**Files:**
- Delete: `backend/app/api/routes/predictions.py`
- Delete: `backend/app/api/routes/features.py`
- Delete: `backend/app/api/routes/accuracy.py`
- Delete: `backend/app/api/routes/performance.py`
- Delete: `backend/app/api/routes/live_props.py`
- Delete: `backend/app/api/routes/live_slates.py`
- Delete: `backend/app/schemas/ml_prediction.py`
- Delete: `backend/app/schemas/prediction.py`
- Delete: `backend/app/schemas/live_prop.py`
- Delete: `backend/app/schemas/live_slate.py`
- Delete: `backend/app/schemas/accuracy.py`
- Delete: `backend/app/schemas/performance.py`
- Modify: `backend/app/main.py` (unmount deleted routers)
- Modify: `backend/app/api/routes/games.py` (strip prediction endpoints + slate predictions)
- Modify: `backend/app/schemas/game.py` (drop `GameWithPredictions`, drop `GameSlate.predictions`)
- Modify: `backend/app/api/routes/players.py` (drop predictions query + SQL)
- Modify: `backend/app/schemas/player.py` (drop `MLPredictionSummary`, `PlayerProfile.predictions`)
- Modify: `backend/app/schemas/feature.py` (keep `PlayerSummary` / `PlayerListResponse` only; delete `MLFeatureRow`)
- Modify: `backend/app/schemas/__init__.py` (drop ML exports)
- Modify: `backend/README.md`, `md/system-design.md`
- Create: `backend/openapi-golden.json` (copy of exported OpenAPI after teardown)
- Update: `frontend/openapi.json`, `frontend/src/lib/api.schema.d.ts`

**Interfaces:**
- Consumes: existing `Game`, `PropLine`, `PlayerProfile` shapes minus prediction fields
- Produces: post-teardown OpenAPI golden; kept handlers unchanged in name

- [ ] **Step 1: Unmount ML routers in `main.py`**

Remove imports and `include_router` calls for: `predictions`, `features`, `accuracy`, `performance`, `live_props`, `live_slates`. Keep all WNBA/MLB/props/slates/games/players/matchups/health routers.

Also update the FastAPI `description=` string to stop advertising ML/live-prop endpoints.

- [ ] **Step 2: Strip games prediction surface**

In `backend/app/schemas/game.py`, replace contents with:

```python
"""Pydantic schemas for /games/{date} endpoint."""
from __future__ import annotations

import datetime

from pydantic import BaseModel

from app.schemas.prop import PropLine


class Game(BaseModel):
    game_date: datetime.date
    game_id: str | None = None
    event_id: int | None = None
    home_team_abbrev: str
    away_team_abbrev: str
    season_year: str | None = None
    source: str | None = None

    model_config = {"from_attributes": True}


class GameWithProps(Game):
    props: list[PropLine] = []


class GameSlate(BaseModel):
    game_date: datetime.date
    games: list[Game]
    props: list[PropLine] = []
```

In `games.py`:
- Remove `from app.schemas.ml_prediction import MLPrediction`
- Remove `_PREDICTIONS_SQL`
- Delete handlers `get_game_predictions` and `get_games_with_predictions`
- Change `get_game_slate` to:

```python
@router.get("/games/{date}/slate", response_model=GameSlate)
def get_game_slate(date: str) -> GameSlate:
    """Combined games + props for a full slate view."""
    _validate_date(date)
    games = get_games(date)
    props = get_game_props(date)
    return GameSlate(
        game_date=datetime.date.fromisoformat(date),
        games=games,
        props=props,
    )
```

Do **not** rename remaining handlers (`get_todays_games`, `get_games`, `get_game_props`, `get_game_slate`, `get_games_with_props`).

- [ ] **Step 3: Strip player predictions**

In `player.py` schema: delete `MLPredictionSummary`; remove `predictions` from `PlayerProfile`.

In `players.py`:
- Remove `_PREDICTIONS_SQL` (or whatever SQL selects from `ml.predictions`)
- Remove `include_predictions` query param
- Build `PlayerProfile` without `predictions=`
- Keep handler names `search_players` and `get_player` exactly (do not rename)

- [ ] **Step 4: Slim `feature.py` + `schemas/__init__.py`**

Keep only:

```python
"""Player list helpers used by /players (not ML feature tables)."""
from __future__ import annotations

from pydantic import BaseModel


class PlayerSummary(BaseModel):
    player_id: int
    player_name: str
    normalized_name: str
    team_abbreviation: str | None = None
    team_name: str | None = None
    career_game_count: int | None = None

    model_config = {"from_attributes": True}


class PlayerListResponse(BaseModel):
    count: int
    players: list[PlayerSummary]
```

(Match field names to the current `PlayerSummary` / `PlayerListResponse` in `feature.py` — copy exactly, drop `MLFeatureRow` only.)

Update `schemas/__init__.py` to export only non-ML symbols still used.

- [ ] **Step 5: Delete ML route/schema modules**

Delete the twelve files listed under **Files** above.

- [ ] **Step 6: Update docs**

In `backend/README.md`: remove tables/sections for predictions, features, accuracy, performance, live-props, live-slates; remove prediction query-param docs; note research routes no longer attach ML.

In `md/system-design.md`: remove claims that live-props/predictions remain mounted; say they were removed 2026-08-04.

- [ ] **Step 7: Export OpenAPI + regenerate TS + save golden**

```bash
export PYTHONPATH=.:backend
python -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Verify removed paths are gone:

```bash
python - <<'PY'
import json
from pathlib import Path
paths = json.loads(Path("frontend/openapi.json").read_text())["paths"]
gone = [
    "/api/predictions",
    "/api/predictions/today",
    "/api/predictions/player/{player_id}",
    "/api/features/{prop}",
    "/api/models/{model_id}/accuracy",
    "/api/performance",
    "/api/live-props",
    "/api/live-slates",
    "/api/games/{date}/predictions",
    "/api/games/{date}/with-predictions",
]
missing_ok = [p for p in gone if p not in paths]
assert len(missing_ok) == len(gone), f"still present: {set(gone)-set(missing_ok)}"
for p in ("/api/wnba/scoreboard/today", "/api/mlb/scoreboard/today", "/api/health"):
    assert p in paths, p
print("teardown openapi ok")
PY
```

- [ ] **Step 8: Run tests**

```bash
cd backend && python -m pytest -q
```

Expected: PASS. If any test imported deleted modules, delete or rewrite that test file in this same task (only tests that targeted deleted routes).

- [ ] **Step 9: Commit**

```bash
git add backend/app backend/openapi-golden.json backend/README.md md/system-design.md frontend/openapi.json frontend/src/lib/api.schema.d.ts backend/tests
git commit -m "$(cat <<'EOF'
refactor(api): remove unused ML and live-prop HTTP surface

Drop predictions/features/accuracy/performance/live-props/live-slates and
prediction attachments on games/players so the OpenAPI golden matches the
site that no longer uses ML.
EOF
)"
```

---

### Task 2: Scaffolding — `__init__.py`, `errors.py`, `deps.py`

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/core/errors.py`
- Create: `backend/app/api/deps.py`

**Interfaces:**
- Produces:
  - `class AppError(Exception): status_code: int; detail: str`
  - `def register_exception_handlers(app: FastAPI) -> None` in `errors.py`
  - Empty-but-documented `deps.py` (placeholder for shared Depends; no forced rewrite)

- [ ] **Step 1: Add `services/__init__.py`**

```python
"""Domain/provider modules (being migrated to domains/ and providers/)."""
```

- [ ] **Step 2: Add `core/errors.py`**

```python
"""Shared application errors and FastAPI exception handlers."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, detail: str, *, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
```

- [ ] **Step 3: Register handlers in `main.py`**

```python
from app.core.errors import register_exception_handlers

# after app = FastAPI(...)
register_exception_handlers(app)
```

- [ ] **Step 4: Add `api/deps.py`**

```python
"""Shared FastAPI dependencies.

Routes may keep calling ``app.core.db`` directly; migrate to Depends here
incrementally — do not rewrite all routes in the scaffolding step.
"""
```

- [ ] **Step 5: Verify + commit**

```bash
export PYTHONPATH=.:backend
python -c "from app.main import app; from app.core.errors import AppError; print('ok')"
python -c "from app.openapi_export import export_openapi; export_openapi()"
diff -u backend/openapi-golden.json frontend/openapi.json
cd backend && python -m pytest -q
```

Expected: empty diff; tests PASS.

```bash
git add backend/app/services/__init__.py backend/app/core/errors.py backend/app/api/deps.py backend/app/main.py
git commit -m "$(cat <<'EOF'
chore(api): add services package init, AppError handlers, and deps stub

Scaffold pieces required before provider/domain moves without changing
the HTTP surface.
EOF
)"
```

---

### Task 3: Extract `providers/`

**Files:**
- Create: `backend/app/providers/__init__.py`
- Create: `backend/app/providers/base.py`
- Create: `backend/app/providers/espn/__init__.py`
- Create: `backend/app/providers/mlb_stats/__init__.py`
- Create: `backend/app/providers/rotowire/__init__.py`
- Create: `backend/app/providers/pinnacle/__init__.py`
- Create: `backend/app/providers/parlay/__init__.py`
- Create: `backend/app/providers/sharp/__init__.py`
- Move via `git mv`:
  - `services/mlb_espn_bridge.py` → `providers/espn/mlb_bridge.py`
  - `services/wnba_espn_roster.py` → `providers/espn/wnba_roster.py`
  - `services/mlb_stats_people.py` → `providers/mlb_stats/people.py`
  - `services/wnba_rotowire_lineups.py` → `providers/rotowire/wnba_lineups.py`
  - `services/pinnacle_team_odds.py` → `providers/pinnacle/team_odds.py`
  - `services/parlay_client.py` → `providers/parlay/client.py`
  - `services/sharp_odds.py` → `providers/sharp/odds.py`
  - `services/sharp_props.py` → `providers/sharp/props.py`
- Modify: all importers (services, routes, tests) to new paths
- Optionally re-export old names from thin shims **only if** needed mid-task — prefer updating imports in the same commit

**Interfaces:**
- Produces (import paths):
  - `app.providers.espn.mlb_bridge`
  - `app.providers.espn.wnba_roster`
  - `app.providers.mlb_stats.people`
  - `app.providers.rotowire.wnba_lineups`
  - `app.providers.pinnacle.team_odds`
  - `app.providers.parlay.client` (`parlay_get` unchanged)
  - `app.providers.sharp.odds` / `app.providers.sharp.props`
- `base.py` produces:

```python
DEFAULT_TIMEOUT_SECONDS = 8.0

def http_client(**kwargs):
    """Return httpx.Client with default timeout; kwargs override."""
    import httpx
    timeout = kwargs.pop("timeout", DEFAULT_TIMEOUT_SECONDS)
    return httpx.Client(timeout=timeout, **kwargs)
```

Do **not** change Sharp/ESPN URLs, TTLs, or public function names inside moved modules in this task — move + fix imports only. Optional: switch one call site to `providers.base` later; not required here.

- [ ] **Step 1: Create package dirs + `base.py` + `__init__.py` files**

- [ ] **Step 2: `git mv` the eight vendor modules** as listed above

- [ ] **Step 3: Fix internal imports inside moved files**

Example: `pinnacle/team_odds.py` previously imported `app.services.sharp_odds` → `app.providers.sharp.odds`.

`parlay_props.py` / `dfs_attach.py` / `mlb_game_detail.py` / etc. still under `services/` for now — update them to provider paths.

- [ ] **Step 4: Fix tests**

Update every `from app.services.mlb_espn_bridge` (and siblings) in `backend/tests/` to the new provider module path. Function names under test stay the same.

- [ ] **Step 5: Verify + commit**

```bash
export PYTHONPATH=.:backend
python -c "from app.main import app; from app.providers.sharp.odds import SHARP_ODDS_URL; print('ok')"
python -c "from app.openapi_export import export_openapi; export_openapi()"
diff -u backend/openapi-golden.json frontend/openapi.json
cd backend && python -m pytest -q
```

```bash
git add backend/app backend/tests
git commit -m "$(cat <<'EOF'
refactor(api): extract third-party HTTP clients into providers/

Move ESPN, MLB Stats, RotoWire, Pinnacle, Parlay, and Sharp clients behind
app.providers so domain modules stop owning vendor URLs.
EOF
)"
```

---

### Task 4: `domains/mlb/`

**Files:**
- Create: `backend/app/domains/__init__.py`
- Create: `backend/app/domains/mlb/__init__.py`
- Create: `backend/app/domains/mlb/routes.py` (consolidated MLB routers)
- Create: `backend/app/domains/mlb/schemas.py` (re-export or merge mlb schemas)
- `git mv` services → domain modules (prefix strip):
  - `mlb_scoreboard.py` → `domains/mlb/scoreboard.py`
  - `mlb_game_detail.py` → `domains/mlb/game_detail.py`
  - `mlb_lineups.py` → `domains/mlb/lineups.py`
  - `mlb_lineup_matchup.py` → `domains/mlb/lineup_matchup.py`
  - `mlb_odds.py` → `domains/mlb/odds.py`
  - `mlb_team_names.py` → `domains/mlb/team_names.py`
- `git mv` schemas: `schemas/mlb_*.py` → merge into `domains/mlb/schemas.py` **or** keep as `domains/mlb/schemas_*.py` re-exported from `schemas.py` — prefer single `schemas.py` if total &lt; ~400 lines; else `schemas/` package
- Delete old `api/routes/mlb_*.py` after consolidating into `domains/mlb/routes.py`
- Modify: `main.py` to include `domains.mlb.routes.router`

**Interfaces:**
- Produces: `from app.domains.mlb.routes import router` with same path strings (`/mlb/scoreboard/today`, etc.) and **same handler function names** as today’s route modules
- Domain modules must not import FastAPI
- `routes.py` is the only MLB FastAPI surface

- [ ] **Step 1: Create `domains/` + `domains/mlb/` packages**

- [ ] **Step 2: Move service modules with `git mv` + fix imports** (`providers.*`, sibling mlb modules)

- [ ] **Step 3: Move/merge schemas; update imports in domain + tests**

- [ ] **Step 4: Build `routes.py`**

Concatenate the four current route modules (`mlb_scoreboard`, `mlb_odds`, `mlb_game_detail`, `mlb_lineups`) into one `APIRouter` **or** one module that defines `router = APIRouter()` and includes sub-routers **without changing route paths/tags/handler names**.

Pattern:

```python
from fastapi import APIRouter
from app.domains.mlb import scoreboard as scoreboard_svc
# ... keep each @router.get handler body identical ...

router = APIRouter()
# paste handlers from old mlb_scoreboard.py, mlb_odds.py, etc.
```

Critical: copy decorator paths and `def` names exactly from:

- `backend/app/api/routes/mlb_scoreboard.py`
- `backend/app/api/routes/mlb_odds.py`
- `backend/app/api/routes/mlb_game_detail.py`
- `backend/app/api/routes/mlb_lineups.py`

- [ ] **Step 5: Wire `main.py`**

```python
from app.domains.mlb.routes import router as mlb_router
app.include_router(mlb_router, prefix="/api")
```

Remove old `mlb_*` route imports.

- [ ] **Step 6: Update tests** that import `app.services.mlb_*` → `app.domains.mlb.*`

- [ ] **Step 7: Verify + commit**

```bash
export PYTHONPATH=.:backend
python -c "from app.openapi_export import export_openapi; export_openapi()"
diff -u backend/openapi-golden.json frontend/openapi.json
cd backend && python -m pytest -q
```

```bash
git add backend/app backend/tests
git commit -m "$(cat <<'EOF'
refactor(api): move MLB surface into domains.mlb

Collapse sport-prefixed MLB routes/services/schemas into one domain package
with prefix-stripped module names.
EOF
)"
```

---

### Task 5: `domains/wnba/`

**Files:**
- Create: `backend/app/domains/wnba/__init__.py`
- Create: `backend/app/domains/wnba/routes.py`
- Create: `backend/app/domains/wnba/schemas.py` (merge/re-export)
- `git mv` (prefix strip):
  - `wnba_scoreboard.py` → `domains/wnba/scoreboard.py`
  - `wnba_game_detail.py` → `domains/wnba/game_detail.py`
  - `wnba_standings.py` → `domains/wnba/standings.py`
  - `wnba_leaders.py` → `domains/wnba/leaders.py`
  - `wnba_player.py` → `domains/wnba/player.py`
  - `wnba_futures.py` → `domains/wnba/futures.py`
  - `wnba_props.py` service if any → `domains/wnba/props.py` (check: props logic may live mainly in routes + betting helpers)
  - `wnba_team_names.py` → `domains/wnba/team_names.py`
- Move `schemas/wnba_*.py` into domain
- Delete old `api/routes/wnba_*.py`
- Wire `main.py`

**Interfaces:**
- Same as Task 4 for WNBA paths/handlers
- `wnba` must not import `domains.mlb` or `domains.betting`
- If `wnba` props/odds need betting helpers (`dfs_attach`, `parlay_props`), **either** keep those calls via importing `domains.betting` (**forbidden**) **or** leave shared helpers in `services/` until Task 6 moves them and invert: betting may be called from routes only by composing in `routes.py` after both exist

**Import rule for Task 5 interim:** If `wnba_props` currently imports `dfs_attach` / `parlay_props` from `services/`, keep those imports as `app.services.*` until Task 6 moves them to `domains.betting` and update to `app.domains.betting.*`. Do **not** have `domains.wnba` import `domains.betting` for logic modules — if needed, call betting functions from `domains/wnba/routes.py` only after Task 6, **or** keep a temporary `services/` bridge deleted in Task 6.

Practical approach for Task 5: move WNBA domain modules; leave `from app.services.dfs_attach` / `parlay_props` / `odds_snapshots` imports pointing at still-present `services/` files until Task 6.

- [ ] **Steps 1–7:** Mirror Task 4 for WNBA (move → consolidate routes → wire main → fix tests → openapi diff empty → pytest → commit)

```bash
git commit -m "$(cat <<'EOF'
refactor(api): move WNBA surface into domains.wnba

Collapse sport-prefixed WNBA routes/services/schemas into one domain package
with prefix-stripped module names.
EOF
)"
```

---

### Task 6: `domains/betting/` + `domains/research/`

**Files:**
- Create: `backend/app/domains/betting/__init__.py`, `routes.py`, `schemas.py`
- Create: `backend/app/domains/research/__init__.py`, `routes.py`, `schemas.py`
- `git mv` into betting:
  - `odds_snapshots.py`, `parlay_odds.py`, `parlay_props.py`, `dfs_attach.py`, `prop_stat_keys.py`
  - schemas: `prop.py`, and any odds-related non-sport schemas still shared
- `git mv` / consolidate into research:
  - route logic from `games.py`, `players.py`, `matchups.py`
  - schemas: `game.py`, `player.py`, `matchup.py`, slim `feature.py` player-list types → research schemas
- Delete emptied `api/routes/{props,slates,games,players,matchups}.py`
- Update WNBA imports that still pointed at `app.services.dfs_attach` etc. → `app.domains.betting.*`
- Ensure `domains/wnba` domain **logic** modules do not import `domains.betting`; if `parlay_props` is invoked from a WNBA route today, keep that call in `domains/wnba/routes.py` importing betting **only if** unavoidable — preferred: betting functions called from betting routes; WNBA props route already under wnba. Inspect `wnba_props` route: if it calls `parlay_props`, that call stays in `wnba/routes.py` importing `app.domains.betting.parlay_props` — **this violates “domains don’t import each other.”**

**Resolve cross-domain call (required in this task):**

If `wnba/routes.py` would need `domains.betting`, instead:
1. Move the orchestration function that both need into `domains/betting/` (props assembly is betting), and have `wnba/routes.py` call a **betting** public function for `/api/wnba/props/today`, **or**
2. Keep thin adapter in `providers` / shared module under `betting` and pass results into wnba route handlers defined in betting — **Rejected:** would move WNBA URL ownership.

**Chosen resolution:** Allow **routes-only** composition in `api/router` level is wrong. Spec forbids domain→domain. So: extract any shared pure helpers used by both into `domains/betting/prop_stat_keys.py` / `dfs_attach.py`, and have **`domains/wnba/props.py`** (logic) live under wnba but **duplicate is bad**. Better: `dfs_attach` + `prop_stat_keys` stay in `betting/`; `wnba/props.py` service module that currently imports them should **move into `betting/`** if it is really “attach DFS quotes,” while `GET /api/wnba/props/today` handler remains in `wnba/routes.py` and imports from `app.domains.betting.parlay_props` —

Spec says domains must not import each other. Strict reading: `wnba/routes.py` is part of `domains/wnba`, so it cannot import betting.

**Strict fix used by this plan:** Introduce `app.api.v1` composition — out of scope. Instead put **cross-sport prop assembly** callables in `domains/betting/` and register the `/api/wnba/props/today` **handler in `betting/routes.py`** with the **same path and function name** as today. Same for any WNBA odds route that is purely parlay/sharp assembly. Scoreboard/leaders/etc. stay in wnba.

Before moving, classify each WNBA route:

| Route module | Owner domain |
| --- | --- |
| scoreboard, game_detail, standings, leaders, player, futures | `wnba` |
| odds, props (if they only wrap sharp/parlay/dfs) | prefer `betting` routes with unchanged `/api/wnba/...` paths |

If `wnba_odds` / `wnba_props` are thin wrappers, implement their handlers in `domains/betting/routes.py` (paths still `/wnba/odds/today` etc.). Document that in the commit message.

- [ ] **Step 1: Inventory imports** from current `wnba_odds.py` / `wnba_props.py` and apply the ownership table above

- [ ] **Step 2: Move betting modules + routes (`props`, `slates`, plus wnba odds/props handlers if classified betting)**

- [ ] **Step 3: Move research routes/schemas (`games`, `players`, `matchups`)**

- [ ] **Step 4: Delete empty `services/` modules; remove `services/` package if empty**

- [ ] **Step 5: Update all tests imports**

- [ ] **Step 6: Verify + commit**

```bash
diff -u backend/openapi-golden.json frontend/openapi.json
cd backend && python -m pytest -q
```

```bash
git commit -m "$(cat <<'EOF'
refactor(api): add domains.betting and domains.research

House cross-sport odds/props helpers and DB research routes in dedicated
domains; keep /api/wnba odds/props handler paths stable.
EOF
)"
```

---

### Task 7: Central `api/router.py` + cleanup

**Files:**
- Create: `backend/app/api/router.py`
- Modify: `backend/app/main.py` (thin)
- Delete: emptied `backend/app/api/routes/__init__.py` cruft; keep `health.py`
- Delete: emptied `backend/app/schemas/` if fully migrated (or leave a deprecated shim package that re-exports from domains for one release — **prefer delete** and fix imports)
- Delete: `backend/app/services/` if empty
- Modify: `backend/README.md` (describe new layout)
- Modify: `md/system-design.md` if backend tree is documented
- Final: regenerate `frontend/openapi.json` + `api.schema.d.ts` (should match golden)

**Interfaces:**
- Produces:

```python
# backend/app/api/router.py
from fastapi import APIRouter

from app.api.routes import health
from app.domains.betting.routes import router as betting_router
from app.domains.mlb.routes import router as mlb_router
from app.domains.research.routes import router as research_router
from app.domains.wnba.routes import router as wnba_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(research_router)
api_router.include_router(betting_router)
api_router.include_router(wnba_router)
api_router.include_router(mlb_router)
```

```python
# main.py
from app.api.router import api_router
from app.core.errors import register_exception_handlers
# ...
app.include_router(api_router, prefix="/api")
```

- [ ] **Step 1: Add `api/router.py` and thin `main.py`**

- [ ] **Step 2: Remove dead packages/shims**

- [ ] **Step 3: Grep for forbidden imports**

```bash
# domains must not import FastAPI except routes.py
python - <<'PY'
from pathlib import Path
root = Path("backend/app/domains")
bad = []
for path in root.rglob("*.py"):
    if path.name == "routes.py":
        continue
    text = path.read_text()
    if "fastapi" in text.lower():
        bad.append(str(path))
assert not bad, bad
print("no fastapi outside routes.py")
PY

# no domain-to-domain imports
python - <<'PY'
from pathlib import Path
import re
root = Path("backend/app/domains")
pat = re.compile(r"from app\.domains\.(\w+)")
bad = []
for path in root.rglob("*.py"):
    owner = path.parts[path.parts.index("domains") + 1]
    for m in pat.finditer(path.read_text()):
        if m.group(1) != owner:
            bad.append((str(path), m.group(0)))
assert not bad, bad
print("no cross-domain imports")
PY
```

- [ ] **Step 4: Final verify**

```bash
export PYTHONPATH=.:backend
python -c "from app.openapi_export import export_openapi; export_openapi()"
diff -u backend/openapi-golden.json frontend/openapi.json
cd frontend && npm run generate:api && git diff --exit-code -- src/lib/api.schema.d.ts
cd ../backend && python -m pytest -q
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(api): assemble domain routers via api.router

Thin main.py, finish package cleanup, and confirm OpenAPI matches the
post-ML-teardown golden file.
EOF
)"
```

---

## Out of scope (do not do in this plan)

- `/api/v1` dual-mount
- Moving tests under `domains/*/tests/`
- New provider unit tests / behavior changes
- Deleting warehouse `ml.*` tables or Airflow DAGs

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| ML full teardown | Task 1 |
| OpenAPI golden after teardown | Task 1 |
| `services/__init__`, `errors`, `deps` | Task 2 |
| `providers/` + `base.py` + sharp | Task 3 |
| `domains/mlb/` | Task 4 |
| `domains/wnba/` | Task 5 |
| `domains/betting` + `research` | Task 6 |
| `api/router.py`, no `/v1` | Task 7 |
| Tests stay in `backend/tests/` | All |
| Domains don’t import each other | Tasks 6–7 grep |
| Docs update | Tasks 1, 7 |
