# MLB Game Preview Player Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PrizePicks-anchored Line/Over/Under category cards on MLB game Preview (best book odds + book name), plus in-page PrizePicks/Underdog tabs using the same grid, fed by `GET /api/mlb/props/game/{gamePk}`.

**Architecture:** New thin game-props assembly reuses today’s DFS board + book `SideIndex`es, filters by roster `team_abbrev` to the matchup, and picks best Over/Under American odds across all books at the exact DFS line. Frontend shares `MlbGamePropsGrid` on Preview and DFS tabs; Preview row click switches to PrizePicks.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vite · TanStack Query · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-mlb-game-preview-props-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Pregame only; tabs: Preview · Away · Home · PrizePicks · Underdog
- Line anchor: PrizePicks on Preview + PrizePicks tab; Underdog on Underdog tab
- Best odds: highest American per side across prophetx → novig → kalshi → draftkings → fanduel → pinnacle → betmgm → betonline (tie → earlier in that list)
- Show more collapses to 5 rows
- Soft-fail props section; never break Preview lineups/odds
- No EV/edge chips; no Novig watermark; no deep-link highlight v1
- OpenAPI sync: `scripts/export_openapi.py` + `frontend` `npm run generate:api`
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_props.py tests/test_mlb_prop_stat_keys.py -q`
- Verify frontend: targeted Vitest on new/changed game files + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_props.py` | Grid response models |
| `backend/app/domains/mlb/schemas.py` | Re-export new schemas |
| `backend/app/domains/mlb/prop_stat_keys.py` | `GAME_PROP_CATEGORY_ORDER` + export `display_stat_label` usage |
| `backend/app/domains/mlb/game_props.py` | Best-quote helpers + `get_mlb_props_for_game` |
| `backend/app/domains/mlb/routes.py` | `GET /mlb/props/game/{game_pk}` |
| `backend/app/openapi_export.py` | Add path to `REQUIRED_MLB_PATHS` |
| `backend/tests/test_mlb_game_props.py` | Unit + route tests |
| `backend/tests/test_mlb_prop_stat_keys.py` | Category order smoke |
| `frontend/openapi.json` / `api.schema.d.ts` / `backend/openapi-golden.json` | Contract |
| `frontend/src/shared/lib/api.ts` | `fetchMlbGameProps` |
| `frontend/src/features/mlb/hooks/useMlbGameProps.ts` | TanStack Query hook |
| `frontend/src/features/mlb/lib/mlbBookLabels.ts` | Shared book display names |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | Import shared labels (replace private map) |
| `frontend/src/features/mlb/game/MlbGamePropsGrid.tsx` | Category card grid UI |
| `frontend/src/features/mlb/game/MlbGamePropsGrid.test.tsx` | Grid + Show more + click |
| `frontend/src/features/mlb/game/MlbPregameBroadcastHeader.tsx` | Extend `PregameTab` + tab buttons |
| `frontend/src/features/mlb/game/MlbPregameBroadcastHeader.test.tsx` | New tabs |
| `frontend/src/features/mlb/game/MlbPregameCenter.tsx` | Wire grid + DFS panels |
| `frontend/src/features/mlb/game/MlbPregameCenter.test.tsx` | Click → PrizePicks; tab fetch |
| `md/system-design.md` | Page ↔ API row update |
| Spec status → Implemented (after ship) | |

---

### Task 1: Schemas + category order + best-quote helpers

**Files:**
- Create: `backend/app/domains/mlb/schemas_game_props.py`
- Modify: `backend/app/domains/mlb/schemas.py` (re-export)
- Modify: `backend/app/domains/mlb/prop_stat_keys.py`
- Create: `backend/app/domains/mlb/game_props.py` (helpers only in this task)
- Create: `backend/tests/test_mlb_game_props.py`
- Modify: `backend/tests/test_mlb_prop_stat_keys.py`

**Interfaces:**
- Produces:
  - `MlbGamePropBestQuote(american: int, book: str)`
  - `MlbGamePropPlayer(player_name, team_abbrev, headshot_url, line, over, under)`
  - `MlbGamePropCategory(stat: str, label: str, players: list[MlbGamePropPlayer])`
  - `MlbGamePropsResponse(as_of, app, game_pk, away_abbrev, home_abbrev, categories, error)`
  - `BOOK_PRIORITY: tuple[str, ...] = ("prophetx", "novig", "kalshi", "draftkings", "fanduel", "pinnacle", "betmgm", "betonline")`
  - `GAME_PROP_CATEGORY_ORDER: tuple[str, ...]` in `prop_stat_keys.py`
  - `pick_best_quote(candidates: list[tuple[str, int]]) -> MlbGamePropBestQuote | None`
  - `best_side_quote(indexes: dict[str, SideIndex], *, norm_player: str, stat_key: str, side: str, line: float) -> MlbGamePropBestQuote | None`
  - `group_game_prop_categories(players_by_stat: dict[str, list[MlbGamePropPlayer]]) -> list[MlbGamePropCategory]`

- [ ] **Step 1: Write failing tests for pick_best_quote + category order**

Add to `backend/tests/test_mlb_game_props.py`:

```python
from app.domains.mlb.game_props import pick_best_quote, best_side_quote, group_game_prop_categories
from app.domains.mlb.schemas_game_props import MlbGamePropPlayer
from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label


def test_pick_best_quote_highest_american():
    q = pick_best_quote([("fanduel", -110), ("draftkings", -105), ("novig", -120)])
    assert q is not None
    assert q.american == -105
    assert q.book == "draftkings"


def test_pick_best_quote_tie_uses_book_priority():
    # Same american; prophetx before draftkings in BOOK_PRIORITY
    q = pick_best_quote([("draftkings", 100), ("prophetx", 100)])
    assert q is not None
    assert q.book == "prophetx"


def test_pick_best_quote_empty():
    assert pick_best_quote([]) is None


def test_best_side_quote_reads_indexes():
    indexes = {
        "draftkings": {("judge", "home_runs", "over", 0.5): {"american": 250}},
        "fanduel": {("judge", "home_runs", "over", 0.5): {"american": 270}},
        "prophetx": {},
    }
    q = best_side_quote(
        indexes, norm_player="judge", stat_key="home_runs", side="over", line=0.5
    )
    assert q is not None
    assert q.american == 270
    assert q.book == "fanduel"


def test_group_game_prop_categories_stable_order():
    players = {
        "hits": [
            MlbGamePropPlayer(
                player_name="A", team_abbrev="NYY", headshot_url=None,
                line=1.5, over=None, under=None,
            )
        ],
        "home_runs": [
            MlbGamePropPlayer(
                player_name="B", team_abbrev="BOS", headshot_url=None,
                line=0.5, over=None, under=None,
            )
        ],
    }
    cats = group_game_prop_categories(players)
    assert [c.stat for c in cats] == ["home_runs", "hits"]
    assert cats[0].label == display_stat_label("home_runs")
```

Add to `backend/tests/test_mlb_prop_stat_keys.py`:

```python
def test_game_prop_category_order_includes_core_hitting():
    from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER
    assert "home_runs" in GAME_PROP_CATEGORY_ORDER
    assert "hits" in GAME_PROP_CATEGORY_ORDER
    assert "total_bases" in GAME_PROP_CATEGORY_ORDER
    assert GAME_PROP_CATEGORY_ORDER.index("home_runs") < GAME_PROP_CATEGORY_ORDER.index("hits")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_props.py tests/test_mlb_prop_stat_keys.py::test_game_prop_category_order_includes_core_hitting -v`

Expected: FAIL (import / attribute errors)

- [ ] **Step 3: Implement schemas, order, helpers**

Create `backend/app/domains/mlb/schemas_game_props.py`:

```python
"""Response schemas for GET /api/mlb/props/game/{game_pk}."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbGamePropBestQuote(BaseModel):
    model_config = _RESPONSE_CONFIG
    american: int
    book: str


class MlbGamePropPlayer(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_name: str
    team_abbrev: str | None = None
    headshot_url: str | None = None
    line: float
    over: MlbGamePropBestQuote | None = None
    under: MlbGamePropBestQuote | None = None


class MlbGamePropCategory(BaseModel):
    model_config = _RESPONSE_CONFIG
    stat: str
    label: str
    players: list[MlbGamePropPlayer] = Field(default_factory=list)


class MlbGamePropsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    as_of: str
    app: str
    game_pk: str
    away_abbrev: str
    home_abbrev: str
    categories: list[MlbGamePropCategory] = Field(default_factory=list)
    error: str | None = None
```

Re-export from `schemas.py` the same way other MLB schemas are exported.

In `prop_stat_keys.py` add (after `_LABELS`):

```python
# Display order for game Preview / DFS category cards.
GAME_PROP_CATEGORY_ORDER: tuple[str, ...] = (
    "home_runs",
    "hits",
    "hits_runs_rbis",
    "total_bases",
    "rbis",
    "runs",
    "singles",
    "doubles",
    "triples",
    "stolen_bases",
    "walks",
    "batter_strikeouts",
    "pitcher_strikeouts",
    "hits_allowed",
    "walks_allowed",
    "earned_runs_allowed",
    "runs_allowed",
    "pitching_outs",
    "pitches_thrown",
    "plate_appearances",
)
```

Create `backend/app/domains/mlb/game_props.py` with:

```python
from __future__ import annotations

from typing import Any

from app.domains.mlb.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label
from app.domains.mlb.props import SideIndex, _line_key  # prefer local _line_key copy if importing private is frowned on
from app.domains.mlb.schemas_game_props import (
    MlbGamePropBestQuote,
    MlbGamePropCategory,
    MlbGamePropPlayer,
)

BOOK_PRIORITY: tuple[str, ...] = (
    "prophetx",
    "novig",
    "kalshi",
    "draftkings",
    "fanduel",
    "pinnacle",
    "betmgm",
    "betonline",
)

_PRIORITY_RANK = {book: i for i, book in enumerate(BOOK_PRIORITY)}


def pick_best_quote(candidates: list[tuple[str, int]]) -> MlbGamePropBestQuote | None:
    """Pick highest American odds; ties break by BOOK_PRIORITY order."""
    if not candidates:
        return None
    best_book, best_american = max(
        candidates,
        key=lambda item: (item[1], -_PRIORITY_RANK.get(item[0], 999)),
    )
    return MlbGamePropBestQuote(american=best_american, book=best_book)


def best_side_quote(
    indexes: dict[str, SideIndex],
    *,
    norm_player: str,
    stat_key: str,
    side: str,
    line: float,
) -> MlbGamePropBestQuote | None:
    line_k = round(float(line), 2)
    side_key = (norm_player, stat_key, side, line_k)
    candidates: list[tuple[str, int]] = []
    for book in BOOK_PRIORITY:
        hit = indexes.get(book, {}).get(side_key)
        if not hit:
            continue
        american = hit.get("american")
        if american is None:
            continue
        try:
            candidates.append((book, int(american)))
        except (TypeError, ValueError):
            continue
    return pick_best_quote(candidates)


def group_game_prop_categories(
    players_by_stat: dict[str, list[MlbGamePropPlayer]],
) -> list[MlbGamePropCategory]:
    ordered: list[MlbGamePropCategory] = []
    seen: set[str] = set()
    for stat in GAME_PROP_CATEGORY_ORDER:
        players = players_by_stat.get(stat)
        if not players:
            continue
        ordered.append(
            MlbGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
        seen.add(stat)
    for stat, players in sorted(players_by_stat.items()):
        if stat in seen or not players:
            continue
        ordered.append(
            MlbGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
    return ordered
```

**Note:** Prefer duplicating a local `_line_key` in `game_props.py` instead of importing `props._line_key` if tests/linters ban private imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_props.py tests/test_mlb_prop_stat_keys.py::test_game_prop_category_order_includes_core_hitting -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_game_props.py backend/app/domains/mlb/schemas.py backend/app/domains/mlb/prop_stat_keys.py backend/app/domains/mlb/game_props.py backend/tests/test_mlb_game_props.py backend/tests/test_mlb_prop_stat_keys.py
git commit -m "feat(mlb): add game props schemas and best-quote helpers"
```

---

### Task 2: Assemble `get_mlb_props_for_game` + HTTP route

**Files:**
- Modify: `backend/app/domains/mlb/game_props.py`
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/app/openapi_export.py`
- Modify: `backend/tests/test_mlb_game_props.py`

**Interfaces:**
- Consumes: Task 1 helpers; `props._build_board`, `_index_snapshot_rows`, Odds API fetch, roster index, `get_mlb_game_detail` / `is_valid_mlb_game_pk`
- Produces:
  - `async def get_mlb_props_for_game(*, game_pk: str, app: str) -> MlbGamePropsResponse`
  - Raises `LookupError` for unknown game; `ValueError` for bad app
  - Route: `GET /api/mlb/props/game/{game_pk}?app=prizepicks|underdog`

- [ ] **Step 1: Write failing assembly + route tests**

Extend `backend/tests/test_mlb_game_props.py`. Reuse `_side` / `_odds` helpers copied from `backend/tests/test_mlb_props.py` (or import if you extract them). Board bucket keys from `_build_board` are `(norm_player, stat_key, line)` with `bucket["player_name"]`.

```python
import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.domains.mlb import game_props as gp
from app.main import app
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.odds_api.mlb_props import OddsApiMlbNormalized


async def _async_return(value):
    return value


async def _async_raise_lookup(*_a, **_k):
    raise LookupError("missing")


def _side(player, stat, side, line, american):
    key = (player.strip().casefold(), stat, side, round(float(line), 2))
    return key, {"american": american, "changed_at": None}


def _fake_detail(away="NYY", home="BOS"):
    return SimpleNamespace(
        away=SimpleNamespace(abbrev=away),
        home=SimpleNamespace(abbrev=home),
    )


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_filters_teams_and_both_sides(monkeypatch):
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(
        gp, "get_mlb_game_detail", lambda pk: _async_return(_fake_detail())
    )

    pp_board = [
        {
            "player_name": "Aaron Judge",
            "stat_type": "Home Runs",
            "line_score": 0.5,
            "odds_type": "standard",
        },
        {
            "player_name": "Juan Soto",
            "stat_type": "Hits",
            "line_score": 1.5,
            "odds_type": "standard",
        },
        {
            "player_name": "Bryce Harper",
            "stat_type": "Hits",
            "line_score": 1.5,
            "odds_type": "standard",
        },
    ]
    jo, joq = _side("Aaron Judge", "home_runs", "over", 0.5, 250)
    ju, juq = _side("Aaron Judge", "home_runs", "under", 0.5, -140)
    fo, foq = _side("Aaron Judge", "home_runs", "over", 0.5, 270)
    book_indexes = {
        "draftkings": {jo: joq, ju: juq},
        "fanduel": {fo: foq},
        "novig": {},
        "kalshi": {},
        "betmgm": {},
        "betonline": {},
    }
    odds = OddsApiMlbNormalized(
        prizepicks_board=pp_board,
        book_indexes=book_indexes,
        as_of=None,
        unavailable=False,
    )

    async def fake_odds(**_k):
        return odds

    monkeypatch.setattr(gp, "fetch_mlb_props_normalized", fake_odds)
    monkeypatch.setattr(gp, "fetch_latest_underdog", lambda league="mlb": [])
    monkeypatch.setattr(gp, "fetch_latest_prophetx", lambda league="mlb": [])
    monkeypatch.setattr(gp, "fetch_latest_pinnacle", lambda league="mlb": [])
    monkeypatch.setattr(
        gp,
        "get_mlb_player_index",
        lambda: _async_return(
            {
                norm_player_name("Aaron Judge"): {
                    "team_abbrev": "NYY",
                    "headshot_url": "http://judge",
                    "position": "OF",
                },
                norm_player_name("Juan Soto"): {
                    "team_abbrev": "BOS",
                    "headshot_url": None,
                    "position": "OF",
                },
                norm_player_name("Bryce Harper"): {
                    "team_abbrev": "PHI",
                    "headshot_url": None,
                    "position": "OF",
                },
            }
        ),
    )

    # If assembly imports _build_board from props, also clear props cache if used.
    res = await gp.get_mlb_props_for_game(game_pk="746123", app="prizepicks")
    names = {
        p.player_name
        for c in res.categories
        for p in c.players
    }
    assert "Aaron Judge" in names
    assert "Juan Soto" in names
    assert "Bryce Harper" not in names
    judge = next(
        p for c in res.categories for p in c.players if p.player_name == "Aaron Judge"
    )
    assert judge.over is not None
    assert judge.over.american == 270
    assert judge.over.book == "fanduel"
    assert judge.under is not None
    assert judge.under.american == -140
    assert judge.under.book == "draftkings"


@pytest.mark.asyncio
async def test_get_mlb_props_for_game_unsupported_app():
    with pytest.raises(ValueError, match="unsupported app"):
        await gp.get_mlb_props_for_game(game_pk="746123", app="kalshi")


def test_route_game_props_404(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr(gp, "is_valid_mlb_game_pk", lambda pk: True)
    monkeypatch.setattr(gp, "get_mlb_game_detail", _async_raise_lookup)
    res = client.get("/api/mlb/props/game/99999999?app=prizepicks")
    assert res.status_code == 404


def test_route_game_props_422_bad_app():
    client = TestClient(app)
    res = client.get("/api/mlb/props/game/746123?app=notabook")
    assert res.status_code == 422
```

If the project lacks `pytest.mark.asyncio`, use `asyncio.run(...)` instead (check how other MLB async service tests are written).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_props.py -v`

Expected: FAIL on missing `get_mlb_props_for_game` / route

- [ ] **Step 3: Implement assembly + route**

In `game_props.py` add assembly (sketch):

```python
async def get_mlb_props_for_game(*, game_pk: str, app: str) -> MlbGamePropsResponse:
    if app not in ("prizepicks", "underdog"):
        raise ValueError(f"unsupported app {app!r}")
    if not is_valid_mlb_game_pk(game_pk):
        raise LookupError(game_pk)

    detail = await get_mlb_game_detail(game_pk)  # LookupError → 404
    away = detail.away.abbrev.upper()
    home = detail.home.abbrev.upper()
    now = ...
    error: str | None = None

    # Same fetch pattern as get_mlb_props_today (odds + UD snapshot + PX/Pin indexes)
    # board = _build_board(app, dfs_rows)
    # roster_index = await get_mlb_player_index()
    # indexes = {"prophetx": px, "pinnacle": pin, **odds.book_indexes}

    players_by_stat: dict[str, list[MlbGamePropPlayer]] = {}
    for (norm_player, stat_key, line), bucket in board.items():
        entry = roster_index.get(norm_player) or {}
        team = (entry.get("team_abbrev") or "").upper()
        if team not in {away, home}:
            continue
        over = best_side_quote(indexes, norm_player=norm_player, stat_key=stat_key, side="over", line=line)
        under = best_side_quote(indexes, norm_player=norm_player, stat_key=stat_key, side="under", line=line)
        player = MlbGamePropPlayer(
            player_name=bucket["player_name"],
            team_abbrev=entry.get("team_abbrev"),
            headshot_url=entry.get("headshot_url"),
            line=float(line),
            over=over,
            under=under,
        )
        players_by_stat.setdefault(stat_key, []).append(player)

    # Optional: sort players within category by name
    for lst in players_by_stat.values():
        lst.sort(key=lambda p: p.player_name.casefold())

    return MlbGamePropsResponse(
        as_of=...,
        app=app,
        game_pk=str(game_pk),
        away_abbrev=detail.away.abbrev,
        home_abbrev=detail.home.abbrev,
        categories=group_game_prop_categories(players_by_stat),
        error=error,
    )
```

Inspect `_build_board` return value shape in `props.py` so `bucket["player_name"]` matches real keys (adjust field names to match).

Route in `routes.py`:

```python
@router.get("/mlb/props/game/{game_pk}", response_model=MlbGamePropsResponse)
async def mlb_props_game(
    game_pk: str,
    response: Response,
    app: Literal["prizepicks", "underdog"] = Query(...),
) -> MlbGamePropsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_props_for_game(game_pk=game_pk, app=app)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="game not found", headers=_NO_STORE) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc), headers=_NO_STORE) from exc
```

Add `"/api/mlb/props/game/{game_pk}"` to `REQUIRED_MLB_PATHS` in `openapi_export.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_props.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/game_props.py backend/app/domains/mlb/routes.py backend/app/openapi_export.py backend/tests/test_mlb_game_props.py
git commit -m "feat(mlb): add game-scoped props endpoint with best book odds"
```

---

### Task 3: OpenAPI regen + frontend fetch + hook

**Files:**
- Modify: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts` (via scripts)
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts` (or create if game fetch tests live elsewhere)
- Create: `frontend/src/features/mlb/hooks/useMlbGameProps.ts`
- Create: `frontend/src/features/mlb/hooks/useMlbGameProps.test.tsx` (optional if project hooks are tested; prefer yes)

**Interfaces:**
- Produces:
  - `fetchMlbGameProps({ gamePk, app }: { gamePk: string; app: "prizepicks" | "underdog" }): Promise<ApiMlbGamePropsResponse>`
  - `useMlbGameProps({ gamePk, app, enabled }: { gamePk: string; app: "prizepicks" | "underdog"; enabled?: boolean })`

- [ ] **Step 1: Regenerate OpenAPI artifacts**

```bash
PYTHONPATH=.:backend python3 scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `paths` includes `/api/mlb/props/game/{game_pk}`.

- [ ] **Step 2: Write failing api test**

In `frontend/src/shared/lib/api.test.ts` (follow existing `fetchMlbProps` pattern):

```typescript
it("fetchMlbGameProps calls game props endpoint", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({
      as_of: "2026-08-09T00:00:00Z",
      app: "prizepicks",
      game_pk: "746123",
      away_abbrev: "NYY",
      home_abbrev: "BOS",
      categories: [],
      error: null,
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  await fetchMlbGameProps({ gamePk: "746123", app: "prizepicks" });
  expect(fetchSpy.mock.calls[0][0]).toContain("/api/mlb/props/game/746123");
  expect(String(fetchSpy.mock.calls[0][0])).toContain("app=prizepicks");
});
```

- [ ] **Step 3: Implement fetch + hook**

In `api.ts` (mirror `fetchMlbProps`):

```typescript
export async function fetchMlbGameProps({
  gamePk,
  app,
}: {
  gamePk: string;
  app: "prizepicks" | "underdog";
}): Promise<ApiMlbGamePropsResponse> {
  const url = new URL(`${API_BASE}/api/mlb/props/game/${encodeURIComponent(gamePk)}`);
  url.searchParams.set("app", app);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`mlb game props ${res.status}`);
  return res.json();
}
```

Use the generated schema type name from `api.schema.d.ts` (adjust if export names differ).

`useMlbGameProps.ts`:

```typescript
export function useMlbGameProps({
  gamePk,
  app,
  enabled = true,
}: {
  gamePk: string;
  app: "prizepicks" | "underdog";
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["mlb", "props", "game", gamePk, app],
    queryFn: () => fetchMlbGameProps({ gamePk, app }),
    enabled: Boolean(gamePk) && enabled,
    refetchInterval: 15 * 60_000,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm run check:api && npx vitest run src/shared/lib/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts frontend/src/features/mlb/hooks/useMlbGameProps.ts frontend/src/features/mlb/hooks/useMlbGameProps.test.tsx
git commit -m "feat(mlb): wire fetchMlbGameProps and useMlbGameProps"
```

---

### Task 4: Shared book labels + `MlbGamePropsGrid`

**Files:**
- Create: `frontend/src/features/mlb/lib/mlbBookLabels.ts`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.tsx` (import shared map)
- Create: `frontend/src/features/mlb/game/MlbGamePropsGrid.tsx`
- Create: `frontend/src/features/mlb/game/MlbGamePropsGrid.test.tsx`

**Interfaces:**
- Consumes: `formatAmericanOdds` from `mlbOddsBoard.ts`; API category types
- Produces:
  - `MLB_BOOK_LABELS: Record<string, string>`
  - `bookDisplayName(book: string): string`
  - `MlbGamePropsGrid({ categories, isPending?, error?, onPlayerClick?: (player) => void })`

- [ ] **Step 1: Write failing grid tests**

```tsx
import { render, screen, userEvent } from ...;
import { MlbGamePropsGrid } from "./MlbGamePropsGrid";

const categories = [
  {
    stat: "home_runs",
    label: "Home Runs",
    players: [
      {
        player_name: "A. Judge",
        team_abbrev: "NYY",
        headshot_url: null,
        line: 0.5,
        over: { american: 270, book: "fanduel" },
        under: null,
      },
      // ... 5 more players to exercise Show more
    ],
  },
];

it("renders line, over odds, and book name", () => {
  render(<MlbGamePropsGrid categories={categories} />);
  expect(screen.getByText("Home Runs")).toBeInTheDocument();
  expect(screen.getByText("0.5")).toBeInTheDocument();
  expect(screen.getByText("+270")).toBeInTheDocument();
  expect(screen.getByText("FanDuel")).toBeInTheDocument();
});

it("calls onPlayerClick when a row is clicked", async () => {
  const onPlayerClick = vi.fn();
  render(<MlbGamePropsGrid categories={categories} onPlayerClick={onPlayerClick} />);
  await userEvent.click(screen.getByRole("button", { name: /A\. Judge/i }));
  expect(onPlayerClick).toHaveBeenCalled();
});

it("show more expands beyond 5 rows", async () => {
  // build 6 players; assert 5 visible then Show more reveals 6th
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbGamePropsGrid.test.tsx`

Expected: FAIL module not found

- [ ] **Step 3: Implement labels + grid**

`mlbBookLabels.ts`:

```typescript
export const MLB_BOOK_LABELS: Record<string, string> = {
  prophetx: "ProphetX",
  novig: "Novig",
  kalshi: "Kalshi",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  betonline: "BetOnline",
  pinnacle: "Pinnacle",
};

export function bookDisplayName(book: string): string {
  return MLB_BOOK_LABELS[book] ?? book;
}
```

Replace private `BOOK_LABELS` in `MlbPropPicksList.tsx` with `MLB_BOOK_LABELS` / `bookDisplayName`.

`MlbGamePropsGrid.tsx` structure:
- `grid grid-cols-1 gap-4 lg:grid-cols-2`
- Per category: charcoal card (`rounded-xl border border-white/10 bg-black/40` or match nearby `GameSection` chrome)
- Header row: label + Line/Over/Under
- Rows: avatar, name, line, Over pill, Under pill
- Pill: `formatAmericanOdds(american)` + `bookDisplayName(book)` under it in smaller muted text
- Default visible count `5`; Show more / Show less toggle
- If `onPlayerClick` provided, wrap row in `<button type="button">`
- Pending: short skeleton or “Loading props…”
- Error / empty: “No props available for this matchup”

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbGamePropsGrid.test.tsx src/features/mlb/league/MlbPropPicksList.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/lib/mlbBookLabels.ts frontend/src/features/mlb/league/MlbPropPicksList.tsx frontend/src/features/mlb/game/MlbGamePropsGrid.tsx frontend/src/features/mlb/game/MlbGamePropsGrid.test.tsx
git commit -m "feat(mlb): add MlbGamePropsGrid category cards"
```

---

### Task 5: Wire pregame tabs + Preview click

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbPregameBroadcastHeader.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameBroadcastHeader.test.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.test.tsx`

**Interfaces:**
- Consumes: `useMlbGameProps`, `MlbGamePropsGrid`
- Produces: `PregameTab = "preview" | "away" | "home" | "prizepicks" | "underdog"`

- [ ] **Step 1: Write failing header + center tests**

Header: assert PrizePicks / Underdog tab buttons call `onTabChange`.

Center:
- Mock `fetchMlbGameProps` / `useMlbGameProps`
- On Preview, props grid appears under lineups
- Clicking a prop row sets active tab to PrizePicks (assert PrizePicks panel / tab selected)
- Switching to Underdog requests `app=underdog`

- [ ] **Step 2: Run tests to verify fail**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbPregameBroadcastHeader.test.tsx src/features/mlb/game/MlbPregameCenter.test.tsx`

Expected: FAIL on missing tabs / grid

- [ ] **Step 3: Implement wiring**

Extend header tabs array:

```typescript
export type PregameTab =
  | "preview"
  | "away"
  | "home"
  | "prizepicks"
  | "underdog";

const tabs = [
  { id: "preview" as const, label: "Preview" },
  { id: "away" as const, label: detail.away.name },
  { id: "home" as const, label: detail.home.name },
  { id: "prizepicks" as const, label: "PrizePicks" },
  { id: "underdog" as const, label: "Underdog" },
];
```

In `MlbPregameCenter`:

```typescript
const prizeQuery = useMlbGameProps({
  gamePk: detail.mlbGamePk,
  app: "prizepicks",
  enabled: activeTab === "preview" || activeTab === "prizepicks",
});
const underdogQuery = useMlbGameProps({
  gamePk: detail.mlbGamePk,
  app: "underdog",
  enabled: activeTab === "underdog",
});

// Preview panel:
<>
  <MlbProjectedLineups ... />
  <MlbGamePropsGrid
    categories={prizeQuery.data?.categories ?? []}
    isPending={prizeQuery.isPending}
    error={prizeQuery.isError ? "Failed to load props" : prizeQuery.data?.error}
    onPlayerClick={() => setActiveTab("prizepicks")}
  />
</>

// prizepicks / underdog panels: full-width MlbGamePropsGrid without onPlayerClick
```

Use `detail.mlbGamePk` for `useMlbGameProps({ gamePk: detail.mlbGamePk, ... })`.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbPregameBroadcastHeader.test.tsx src/features/mlb/game/MlbPregameCenter.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbPregameBroadcastHeader.tsx frontend/src/features/mlb/game/MlbPregameBroadcastHeader.test.tsx frontend/src/features/mlb/game/MlbPregameCenter.tsx frontend/src/features/mlb/game/MlbPregameCenter.test.tsx
git commit -m "feat(mlb): show game props on Preview and DFS tabs"
```

---

### Task 6: Docs + spec status

**Files:**
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-08-09-mlb-game-preview-props-design.md` (Status → Implemented)

- [ ] **Step 1: Update system-design page ↔ API table**

On `/mlb/games/:gamePk` row, note Preview Player Props grid + PrizePicks/Underdog tabs powered by `GET /api/mlb/props/game/{gamePk}?app=`; hooks `useMlbGameProps`.

- [ ] **Step 2: Mark spec Implemented**

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md docs/superpowers/specs/2026-08-09-mlb-game-preview-props-design.md
git commit -m "docs: record MLB game preview props wiring"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Preview section under lineups | 5 |
| Category cards Line/Over/Under + book under odds | 4 |
| Click → PrizePicks tab | 5 |
| PrizePicks + Underdog tabs | 5 |
| PrizePicks / Underdog line anchors | 2–3, 5 |
| Best odds all books + tie priority | 1–2 |
| Game-scoped API | 2–3 |
| Show more >5 | 4 |
| Soft empty/error | 4–5 |
| OpenAPI + system-design | 3, 6 |
| Out of scope (EV, Novig mark, highlight, live) | Not planned |

**Placeholder scan:** Cleared — Task 2 includes full stubbed async tests; board bucket uses `player_name` / `stat_key` from `_build_board`.

**Type consistency:** `MlbGamePropsResponse.categories[].players[].over|under` matches grid props; `app` union `prizepicks|underdog` consistent across route, fetch, hook, tabs; frontend game id is `detail.mlbGamePk`.
