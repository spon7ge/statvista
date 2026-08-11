# WNBA Game Props MLB UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat WNBA matchup Props list with MLB-style category cards (Line / Over / Under best-book odds), fed by `GET /api/wnba/props/game/{espn_event_id}`.

**Architecture:** Thin WNBA-domain game-props assembly reuses betting’s `get_today_props()`, filters to the matchup’s teams via `canonical_abbrev`, anchors on PrizePicks/Underdog DFS lines, picks best Over/Under American odds across sportsbooks at the exact line, and groups into `categories[]`. Frontend adds `WnbaGamePropsGrid` (MLB twin) and wires it under the existing Props → PrizePicks/Underdog sub-tabs.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vite · TanStack Query · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-wnba-game-props-mlb-parity-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Props tab only (no Preview grid); keep PrizePicks / Underdog sub-tabs
- Line anchor: selected DFS `app` (`prizepicks` | `underdog`)
- Best odds book priority (ties → earlier): `novig` → `draftkings` → `fanduel` → `pinnacle` → `betmgm` → `caesars` → `betrivers` → `bet365`
- Exclude DFS books (`prizepicks`, `underdog`, `betr`, `sleeper`) from Over/Under pills
- Exact line match only; Show more collapses to 5 rows
- Soft-fail props section; never break Preview / Away / Home
- Empty copy: `No props available for this matchup`
- OpenAPI sync: `cd backend && PYTHONPATH=..:. python -m app.openapi_export` (or project’s export script) + `frontend` `npm run generate:api`
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_game_props.py -q`
- Verify frontend: targeted Vitest on new/changed game files + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/wnba/schemas_game_props.py` | Grid response models |
| `backend/app/domains/wnba/schemas.py` | Re-export new schemas |
| `backend/app/domains/betting/prop_stat_keys.py` | Add `GAME_PROP_CATEGORY_ORDER` (shared with today’s props) |
| `backend/app/domains/wnba/game_props.py` | Best-quote helpers + `get_wnba_props_for_game` (imports `get_today_props` from betting; do **not** import wnba from betting) |
| `backend/app/domains/wnba/routes.py` | `GET /wnba/props/game/{espn_event_id}` |
| `backend/app/openapi_export.py` | Add path to `REQUIRED_WNBA_PATHS` |
| `backend/tests/test_wnba_game_props.py` | Unit + route tests |
| `frontend/openapi.json` / `api.schema.d.ts` / `backend/openapi-golden.json` | Contract |
| `frontend/src/shared/lib/api.ts` | `fetchWnbaGameProps` |
| `frontend/src/shared/lib/api.test.ts` | Fetch URL / error tests |
| `frontend/src/features/basketball/hooks/useWnbaGameProps.ts` | TanStack Query hook |
| `frontend/src/features/basketball/hooks/useWnbaGameProps.test.tsx` | Hook enable/key tests |
| `frontend/src/features/basketball/lib/wnbaBookLabels.ts` | Book display names for pills |
| `frontend/src/features/basketball/game/WnbaGamePropsGrid.tsx` | Category card grid UI |
| `frontend/src/features/basketball/game/WnbaGamePropsGrid.test.tsx` | Grid + Show more + states |
| `frontend/src/features/basketball/game/WnbaPregameCenter.tsx` | Replace flat list with grid + game hook |
| `frontend/src/features/basketball/game/WnbaPregameCenter.test.tsx` | Tab fetch wiring |
| `md/system-design.md` | Page ↔ API row update |
| Spec status → Implemented (after ship) | |

---

### Task 1: Schemas + category order + best-quote helpers

**Files:**
- Create: `backend/app/domains/wnba/schemas_game_props.py`
- Modify: `backend/app/domains/wnba/schemas.py`
- Modify: `backend/app/domains/betting/prop_stat_keys.py`
- Create: `backend/app/domains/wnba/game_props.py` (helpers only in this task)
- Create: `backend/tests/test_wnba_game_props.py`

**Interfaces:**
- Produces:
  - `WnbaGamePropBestQuote(american: int, book: str)`
  - `WnbaGamePropPlayer(player_name, team_abbrev, headshot_url, line, over, under)`
  - `WnbaGamePropCategory(stat: str, label: str, players: list[WnbaGamePropPlayer])`
  - `WnbaGamePropsResponse(as_of, app, espn_event_id, away_abbrev, home_abbrev, categories, error)`
  - `BOOK_PRIORITY: tuple[str, ...] = ("novig", "draftkings", "fanduel", "pinnacle", "betmgm", "caesars", "betrivers", "bet365")`
  - `GAME_PROP_CATEGORY_ORDER: tuple[str, ...]` in `prop_stat_keys.py`
  - `pick_best_quote(candidates: list[tuple[str, int]]) -> WnbaGamePropBestQuote | None`
  - `group_game_prop_categories(players_by_stat: dict[str, list[WnbaGamePropPlayer]]) -> list[WnbaGamePropCategory]`
  - `_line_key(line: float) -> float`

- [ ] **Step 1: Write failing tests for pick_best_quote + category order**

Create `backend/tests/test_wnba_game_props.py`:

```python
from app.domains.wnba.game_props import pick_best_quote, group_game_prop_categories
from app.domains.wnba.schemas_game_props import WnbaGamePropPlayer
from app.domains.betting.prop_stat_keys import GAME_PROP_CATEGORY_ORDER, display_stat_label


def test_pick_best_quote_highest_american():
    q = pick_best_quote([("fanduel", -110), ("draftkings", -105), ("novig", -120)])
    assert q is not None
    assert q.american == -105
    assert q.book == "draftkings"


def test_pick_best_quote_tie_uses_book_priority():
    q = pick_best_quote([("draftkings", 100), ("novig", 100)])
    assert q is not None
    assert q.book == "novig"


def test_pick_best_quote_empty():
    assert pick_best_quote([]) is None


def test_group_game_prop_categories_stable_order():
    players = {
        "assists": [
            WnbaGamePropPlayer(
                player_name="A",
                team_abbrev="MIN",
                headshot_url=None,
                line=5.5,
                over=None,
                under=None,
            )
        ],
        "points": [
            WnbaGamePropPlayer(
                player_name="B",
                team_abbrev="SEA",
                headshot_url=None,
                line=18.5,
                over=None,
                under=None,
            )
        ],
    }
    cats = group_game_prop_categories(players)
    assert [c.stat for c in cats] == ["points", "assists"]
    assert cats[0].label == display_stat_label("points")


def test_game_prop_category_order_includes_core():
    assert "points" in GAME_PROP_CATEGORY_ORDER
    assert "rebounds" in GAME_PROP_CATEGORY_ORDER
    assert "assists" in GAME_PROP_CATEGORY_ORDER
    assert GAME_PROP_CATEGORY_ORDER.index("points") < GAME_PROP_CATEGORY_ORDER.index(
        "rebounds"
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_game_props.py -q`

Expected: FAIL (import / missing symbols)

- [ ] **Step 3: Add schemas**

Create `backend/app/domains/wnba/schemas_game_props.py` mirroring MLB’s `schemas_game_props.py`, with `espn_event_id` instead of `game_pk`:

```python
"""Response schemas for GET /api/wnba/props/game/{espn_event_id}."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class WnbaGamePropBestQuote(BaseModel):
    model_config = _RESPONSE_CONFIG
    american: int
    book: str


class WnbaGamePropPlayer(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_name: str
    team_abbrev: str | None = None
    headshot_url: str | None = None
    line: float
    over: WnbaGamePropBestQuote | None = None
    under: WnbaGamePropBestQuote | None = None


class WnbaGamePropCategory(BaseModel):
    model_config = _RESPONSE_CONFIG
    stat: str
    label: str
    players: list[WnbaGamePropPlayer] = Field(default_factory=list)


class WnbaGamePropsResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    as_of: str
    app: str
    espn_event_id: str
    away_abbrev: str
    home_abbrev: str
    categories: list[WnbaGamePropCategory] = Field(default_factory=list)
    error: str | None = None
```

Re-export from `backend/app/domains/wnba/schemas.py` (add imports + `__all__` entries).

- [ ] **Step 4: Add `GAME_PROP_CATEGORY_ORDER` + helpers**

In `backend/app/domains/betting/prop_stat_keys.py`, after `_LABELS`:

```python
GAME_PROP_CATEGORY_ORDER: tuple[str, ...] = (
    "points",
    "rebounds",
    "assists",
    "threes",
    "pts_rebs",
    "pts_asts",
    "rebs_asts",
    "pts_rebs_asts",
)
```

Create `backend/app/domains/wnba/game_props.py` with helpers (assembly comes in Task 2):

```python
from __future__ import annotations

from app.domains.betting.prop_stat_keys import (
    GAME_PROP_CATEGORY_ORDER,
    display_stat_label,
)
from app.domains.wnba.schemas_game_props import (
    WnbaGamePropBestQuote,
    WnbaGamePropCategory,
    WnbaGamePropPlayer,
)

BOOK_PRIORITY: tuple[str, ...] = (
    "novig",
    "draftkings",
    "fanduel",
    "pinnacle",
    "betmgm",
    "caesars",
    "betrivers",
    "bet365",
)

_PRIORITY_RANK = {book: i for i, book in enumerate(BOOK_PRIORITY)}


def _line_key(line: float) -> float:
    return round(float(line), 2)


def pick_best_quote(candidates: list[tuple[str, int]]) -> WnbaGamePropBestQuote | None:
    if not candidates:
        return None
    best_book, best_american = max(
        candidates,
        key=lambda item: (item[1], -_PRIORITY_RANK.get(item[0], 999)),
    )
    return WnbaGamePropBestQuote(american=best_american, book=best_book)


def group_game_prop_categories(
    players_by_stat: dict[str, list[WnbaGamePropPlayer]],
) -> list[WnbaGamePropCategory]:
    ordered: list[WnbaGamePropCategory] = []
    seen: set[str] = set()
    for stat in GAME_PROP_CATEGORY_ORDER:
        players = players_by_stat.get(stat)
        if not players:
            continue
        ordered.append(
            WnbaGamePropCategory(
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
            WnbaGamePropCategory(
                stat=stat,
                label=display_stat_label(stat),
                players=players,
            )
        )
    return ordered
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_game_props.py -q`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/wnba/schemas_game_props.py \
  backend/app/domains/wnba/schemas.py \
  backend/app/domains/betting/prop_stat_keys.py \
  backend/app/domains/wnba/game_props.py \
  backend/tests/test_wnba_game_props.py
git commit -m "$(cat <<'EOF'
feat(wnba): add game props schemas and best-quote helpers

EOF
)"
```

---

### Task 2: Assemble game props + route

**Files:**
- Modify: `backend/app/domains/wnba/game_props.py`
- Modify: `backend/app/domains/wnba/routes.py`
- Modify: `backend/tests/test_wnba_game_props.py`

**Interfaces:**
- Consumes: Task 1 helpers/schemas; `get_today_props()` (betting); `get_game_detail()`; `canonical_abbrev`; `norm_player_name`; roster headshots via `fetch_team_roster_athletes`
- Produces:
  - `get_wnba_props_for_game(*, espn_event_id: str, app: str) -> WnbaGamePropsResponse`
  - Route `GET /wnba/props/game/{espn_event_id}?app=prizepicks|underdog`
  - Raises `LookupError` for unknown game; `ValueError` for unsupported `app`

- [ ] **Step 1: Write failing assembly + route tests**

Append to `backend/tests/test_wnba_game_props.py`:

```python
import pytest
from app.domains.wnba import game_props as gp
from app.domains.betting.schemas_props import WnbaPropBookQuote, WnbaPropLine, WnbaPropsResponse


def _quote(line: float, american: int | None) -> WnbaPropBookQuote:
    return WnbaPropBookQuote(line=line, odds_american=american)


def _line(**kwargs) -> WnbaPropLine:
    base = dict(
        player_name="N. Collier",
        team_abbrev="MIN",
        logo_url=None,
        stat="Points",
        market_type="player_points",
        side="over",
        game_date=None,
        commence_time=None,
        model_prediction=None,
        over_under_pct=None,
        ev=None,
        fanduel=None,
        draftkings=None,
        caesars=None,
        betmgm=None,
        pinnacle=None,
        bet365=None,
        prizepicks=None,
        underdog=None,
        betr=None,
        novig=None,
        sleeper=None,
        betrivers=None,
    )
    base.update(kwargs)
    return WnbaPropLine(**base)


@pytest.mark.asyncio
async def test_get_wnba_props_for_game_filters_teams_and_both_sides(monkeypatch):
    today = WnbaPropsResponse(
        as_of="2026-08-10T12:00:00Z",
        props=[
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="over",
                prizepicks=_quote(22.5, None),
                draftkings=_quote(22.5, -110),
                fanduel=_quote(22.5, -105),
            ),
            _line(
                player_name="N. Collier",
                team_abbrev="MIN",
                side="under",
                prizepicks=_quote(22.5, None),
                draftkings=_quote(22.5, -110),
                novig=_quote(22.5, 100),
            ),
            _line(
                player_name="J. Loyd",
                team_abbrev="SEA",
                side="over",
                prizepicks=_quote(18.5, None),
                draftkings=_quote(18.5, -115),
            ),
            _line(
                player_name="A. Wilson",
                team_abbrev="LVA",
                side="over",
                prizepicks=_quote(20.5, None),
                draftkings=_quote(20.5, -120),
            ),
        ],
    )

    class FakeTeam:
        id = "1"
        abbrev = "MIN"

    class FakeHome:
        id = "2"
        abbrev = "SEA"

    class FakeDetail:
        away = FakeTeam()
        home = FakeHome()

    async def fake_detail(_id: str):
        return FakeDetail()

    async def fake_today():
        return today

    async def fake_roster(_team_id: str):
        return []

    monkeypatch.setattr(gp, "get_game_detail", fake_detail)
    monkeypatch.setattr(gp, "get_today_props", fake_today)
    monkeypatch.setattr(gp, "fetch_team_roster_athletes", fake_roster)

    res = await gp.get_wnba_props_for_game(espn_event_id="401770001", app="prizepicks")
    assert res.away_abbrev == "MIN"
    assert res.home_abbrev == "SEA"
    assert len(res.categories) == 1
    players = res.categories[0].players
    names = {p.player_name for p in players}
    assert names == {"N. Collier", "J. Loyd"}
    collier = next(p for p in players if p.player_name == "N. Collier")
    assert collier.line == 22.5
    assert collier.over is not None and collier.over.american == -105
    assert collier.over.book == "fanduel"
    assert collier.under is not None and collier.under.american == 100
    assert collier.under.book == "novig"


@pytest.mark.asyncio
async def test_get_wnba_props_for_game_unsupported_app():
    with pytest.raises(ValueError):
        await gp.get_wnba_props_for_game(espn_event_id="401770001", app="kalshi")


def test_route_game_props_404(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    async def boom(**_kwargs):
        raise LookupError("missing")

    monkeypatch.setattr(gp, "get_wnba_props_for_game", boom)
    # Prefer patching the route module binding if the route imported the symbol:
    import app.domains.wnba.routes as routes

    monkeypatch.setattr(routes, "get_wnba_props_for_game", boom)
    res = client.get("/api/wnba/props/game/999999?app=prizepicks")
    assert res.status_code == 404


def test_route_game_props_422_bad_app():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.get("/api/wnba/props/game/401770001?app=notabook")
    assert res.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_game_props.py -q`

Expected: FAIL (`get_wnba_props_for_game` missing)

- [ ] **Step 3: Implement assembly**

Extend `backend/app/domains/wnba/game_props.py`:

```python
# imports
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.wnba_abbrevs import canonical_abbrev
from app.domains.betting.parlay_props import get_today_props
from app.domains.betting.prop_stat_keys import (
    canonical_stat_key_from_parlay_market,
)
from app.domains.betting.schemas_props import WnbaPropLine
from app.domains.wnba.game_detail import get_game_detail, is_valid_espn_event_id
from app.domains.wnba.schemas_game_props import (
    WnbaGamePropPlayer,
    WnbaGamePropsResponse,
)
from app.providers.espn.wnba_roster import norm_player_name
from app.providers.espn.wnba_team_player_stats import fetch_team_roster_athletes

logger = logging.getLogger(__name__)

# BOOK_PRIORITY + helpers from Task 1 stay here


def _compose_error(existing: str | None, new: str) -> str:
    if not existing:
        return new
    parts = existing.split(",")
    if new in parts:
        return existing
    return f"{existing},{new}"


def _iso_now(now: datetime) -> str:
    return now.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _stat_key_for_row(row: WnbaPropLine) -> str:
    from_market = canonical_stat_key_from_parlay_market(row.market_type or "")
    if from_market:
        return from_market
    # Fallback: slug of display stat
    return (row.stat or "unknown").strip().lower().replace(" ", "_").replace("-", "_")


def _dfs_line(row: WnbaPropLine, app: str) -> float | None:
    quote = getattr(row, app, None)
    if quote is None:
        return None
    try:
        return float(quote.line)
    except (TypeError, ValueError):
        return None


def _side_candidates(
    rows: list[WnbaPropLine],
    *,
    side: str,
    line: float,
) -> list[tuple[str, int]]:
    target = _line_key(line)
    side_l = side.lower()
    candidates: list[tuple[str, int]] = []
    for row in rows:
        if (row.side or "").lower() != side_l:
            continue
        for book in BOOK_PRIORITY:
            quote = getattr(row, book, None)
            if quote is None or quote.odds_american is None:
                continue
            try:
                if _line_key(float(quote.line)) != target:
                    continue
                candidates.append((book, int(quote.odds_american)))
            except (TypeError, ValueError):
                continue
    return candidates


async def get_wnba_props_for_game(*, espn_event_id: str, app: str) -> WnbaGamePropsResponse:
    if app not in ("prizepicks", "underdog"):
        raise ValueError(f"unsupported app {app!r}")
    if not is_valid_espn_event_id(espn_event_id):
        raise LookupError(espn_event_id)

    detail = await get_game_detail(espn_event_id)
    away = canonical_abbrev(detail.away.abbrev)
    home = canonical_abbrev(detail.home.abbrev)
    game_teams = {away, home}
    now = datetime.now(timezone.utc)
    error: str | None = None

    today = await get_today_props()
    if today.error:
        error = _compose_error(error, today.error)

    # Headshot index: normalized name -> url (soft-fail)
    headshots: dict[str, str | None] = {}
    try:
        for team_id in (detail.away.id, detail.home.id):
            athletes = await fetch_team_roster_athletes(team_id)
            for athlete in athletes:
                # RosterAthlete.name is the display name field
                headshots[norm_player_name(athlete.name)] = athlete.headshot_url
    except Exception as exc:
        logger.warning("WNBA game props roster unavailable: %s", exc)
        error = _compose_error(error, "roster_unavailable")

    # Bucket DFS slots: (norm_player, stat_key, line) -> display fields + sibling rows
    buckets: dict[tuple[str, str, float], dict[str, Any]] = {}
    rows_by_player_stat: dict[tuple[str, str], list[WnbaPropLine]] = {}

    for row in today.props:
        team = canonical_abbrev(row.team_abbrev or "")
        if team not in game_teams:
            continue
        line = _dfs_line(row, app)
        if line is None:
            continue
        stat_key = _stat_key_for_row(row)
        norm = norm_player_name(row.player_name)
        key = (norm, stat_key, _line_key(line))
        if key not in buckets:
            buckets[key] = {
                "player_name": row.player_name,
                "team_abbrev": row.team_abbrev,
                "line": float(line),
                "stat_key": stat_key,
            }
        rows_by_player_stat.setdefault((norm, stat_key), []).append(row)

    players_by_stat: dict[str, list[WnbaGamePropPlayer]] = {}
    for (norm, stat_key, _lk), bucket in buckets.items():
        sibling_rows = rows_by_player_stat.get((norm, stat_key), [])
        line = float(bucket["line"])
        over = pick_best_quote(
            _side_candidates(sibling_rows, side="over", line=line)
        )
        under = pick_best_quote(
            _side_candidates(sibling_rows, side="under", line=line)
        )
        player = WnbaGamePropPlayer(
            player_name=bucket["player_name"],
            team_abbrev=bucket["team_abbrev"],
            headshot_url=headshots.get(norm),
            line=line,
            over=over,
            under=under,
        )
        players_by_stat.setdefault(stat_key, []).append(player)

    for lst in players_by_stat.values():
        lst.sort(key=lambda p: p.player_name.casefold())

    return WnbaGamePropsResponse(
        as_of=_iso_now(now),
        app=app,
        espn_event_id=str(espn_event_id),
        away_abbrev=detail.away.abbrev,
        home_abbrev=detail.home.abbrev,
        categories=group_game_prop_categories(players_by_stat),
        error=error,
    )
```

- [ ] **Step 4: Add route**

In `backend/app/domains/wnba/routes.py` (alongside other game routes), add:

```python
from typing import Literal
from fastapi import Query
from app.domains.wnba.game_props import get_wnba_props_for_game
from app.domains.wnba.schemas import WnbaGamePropsResponse  # after re-export

@router.get(
    "/wnba/props/game/{espn_event_id}",
    response_model=WnbaGamePropsResponse,
)
async def wnba_props_game(
    espn_event_id: str,
    response: Response,
    app: Literal["prizepicks", "underdog"] = Query(...),
) -> WnbaGamePropsResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_wnba_props_for_game(espn_event_id=espn_event_id, app=app)
    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="game not found",
            headers=_NO_STORE,
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
            headers=_NO_STORE,
        ) from exc
```

Note: `/api/wnba/props/today` stays on the betting router; only the **game** props path lives on the WNBA router so assembly can call `get_game_detail` without a betting→wnba import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_game_props.py -q`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/wnba/game_props.py \
  backend/app/domains/wnba/routes.py \
  backend/app/domains/wnba/schemas.py \
  backend/tests/test_wnba_game_props.py
git commit -m "$(cat <<'EOF'
feat(wnba): add matchup-scoped game props endpoint

EOF
)"
```

---

### Task 3: OpenAPI + `fetchWnbaGameProps`

**Files:**
- Modify: `backend/app/openapi_export.py`
- Regenerate: `frontend/openapi.json`, `frontend/src/shared/lib/api.schema.d.ts`, and golden if the repo uses one
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `ApiWnbaGamePropsResponse` type alias
  - `WnbaGamePropsParams = { espnEventId: string; app: "prizepicks" | "underdog" }`
  - `fetchWnbaGameProps(params): Promise<ApiWnbaGamePropsResponse>`
  - URL: `${API_BASE}/api/wnba/props/game/${encodeURIComponent(espnEventId)}?app=...`

- [ ] **Step 1: Add OpenAPI required path**

In `backend/app/openapi_export.py`, add to `REQUIRED_WNBA_PATHS`:

```python
"/api/wnba/props/game/{espn_event_id}",
```

- [ ] **Step 2: Export + generate types**

```bash
cd backend && PYTHONPATH=..:. python -c "from app.openapi_export import export_openapi; print(export_openapi())"
cd ../frontend && npm run generate:api
```

If the repo keeps `backend/openapi-golden.json`, update it the same way other API PRs do (copy or golden update script).

- [ ] **Step 3: Write failing fetch test**

In `frontend/src/shared/lib/api.test.ts`, mirror `fetchMlbGameProps` tests:

```typescript
describe("fetchWnbaGameProps", () => {
  it("requests game props with app query", async () => {
    // mock fetch → 200 JSON
    const { fetchWnbaGameProps } = await import("./api");
    await fetchWnbaGameProps({ espnEventId: "401770001", app: "prizepicks" });
    // assert URL contains /api/wnba/props/game/401770001?app=prizepicks
  });

  it("throws on non-OK", async () => {
    // mock 500 → rejects
  });
});
```

- [ ] **Step 4: Implement `fetchWnbaGameProps` in `api.ts`**

Mirror `fetchMlbGameProps` (types from Schemas after generate):

```typescript
export type ApiWnbaGamePropsResponse = Schemas["WnbaGamePropsResponse"];

export type WnbaGamePropsParams = {
  espnEventId: string;
  app: "prizepicks" | "underdog";
};

export async function fetchWnbaGameProps({
  espnEventId,
  app,
}: WnbaGamePropsParams): Promise<ApiWnbaGamePropsResponse> {
  const qs = new URLSearchParams({ app });
  const res = await fetch(
    `${API_BASE}/api/wnba/props/game/${encodeURIComponent(espnEventId)}?${qs}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`WNBA game props request failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 5: Run tests**

```bash
cd frontend && npm test -- src/shared/lib/api.test.ts
cd frontend && npm run check:api
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/openapi_export.py frontend/openapi.json \
  frontend/src/shared/lib/api.schema.d.ts frontend/src/shared/lib/api.ts \
  frontend/src/shared/lib/api.test.ts
# plus openapi-golden if touched
git commit -m "$(cat <<'EOF'
feat(api): wire WNBA game props client fetch

EOF
)"
```

---

### Task 4: `useWnbaGameProps` + book labels

**Files:**
- Create: `frontend/src/features/basketball/hooks/useWnbaGameProps.ts`
- Create: `frontend/src/features/basketball/hooks/useWnbaGameProps.test.tsx`
- Create: `frontend/src/features/basketball/lib/wnbaBookLabels.ts`

**Interfaces:**
- Produces:
  - `useWnbaGameProps({ espnEventId, app, enabled? })` with queryKey `["wnba", "props", "game", espnEventId, app]`
  - `bookDisplayName(book: string): string` for novig, draftkings, fanduel, pinnacle, betmgm, caesars, betrivers, bet365

- [ ] **Step 1: Write failing hook test**

Mirror `useMlbGameProps.test.tsx`: disabled when `espnEventId` empty or `enabled: false`; enabled call hits `fetchWnbaGameProps` with correct args.

- [ ] **Step 2: Implement hook + labels**

`useWnbaGameProps.ts` — copy MLB hook, swap names/keys/refetch 15m.

`wnbaBookLabels.ts`:

```typescript
export const WNBA_BOOK_LABELS: Record<string, string> = {
  novig: "Novig",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  pinnacle: "Pinnacle",
  betmgm: "BetMGM",
  caesars: "Caesars",
  betrivers: "BetRivers",
  bet365: "bet365",
};

export function bookDisplayName(book: string): string {
  return WNBA_BOOK_LABELS[book] ?? book;
}
```

- [ ] **Step 3: Run hook tests**

```bash
cd frontend && npm test -- src/features/basketball/hooks/useWnbaGameProps.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/basketball/hooks/useWnbaGameProps.ts \
  frontend/src/features/basketball/hooks/useWnbaGameProps.test.tsx \
  frontend/src/features/basketball/lib/wnbaBookLabels.ts
git commit -m "$(cat <<'EOF'
feat(wnba): add useWnbaGameProps hook and book labels

EOF
)"
```

---

### Task 5: `WnbaGamePropsGrid` UI

**Files:**
- Create: `frontend/src/features/basketball/game/WnbaGamePropsGrid.tsx`
- Create: `frontend/src/features/basketball/game/WnbaGamePropsGrid.test.tsx`

**Interfaces:**
- Consumes: `ApiWnbaGamePropsResponse` categories; `bookDisplayName`; `formatAmericanOdds` from `wnbaOddsBoard.ts`
- Produces: `WnbaGamePropsGrid({ categories, isPending?, error?, onPlayerClick? })`
- testids: `wnba-game-props-grid`, `wnba-game-props-columns`, `wnba-game-props-soft-error`, `wnba-game-props-category-${stat}`

- [ ] **Step 1: Write failing grid tests**

Copy `MlbGamePropsGrid.test.tsx` and adapt names/copy/books (FanDuel/DraftKings/Novig). Cover:

- Renders line, over odds, book name
- Show more / show less at 6 players
- Empty → `No props available for this matchup`
- Hard error when empty categories
- Soft error banner when categories present
- Pending → `Loading props…`
- Two-column wrapper present

Omit Preview click navigation tests (out of scope).

- [ ] **Step 2: Implement grid**

Copy `MlbGamePropsGrid.tsx` → `WnbaGamePropsGrid.tsx`, swap:

- Types from `ApiWnbaGamePropsResponse`
- Imports: `bookDisplayName` from `wnbaBookLabels`, `formatAmericanOdds` from `wnbaOddsBoard`
- testids / soft-error copy mapping (reuse soft strings for `odds_api_unavailable` / `roster_unavailable` if returned; otherwise show raw `error`)

Keep `VISIBLE_ROW_LIMIT = 5`, same grid classes, `GameSection`, columns layout.

- [ ] **Step 3: Run grid tests**

```bash
cd frontend && npm test -- src/features/basketball/game/WnbaGamePropsGrid.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/basketball/game/WnbaGamePropsGrid.tsx \
  frontend/src/features/basketball/game/WnbaGamePropsGrid.test.tsx
git commit -m "$(cat <<'EOF'
feat(wnba): add MLB-parity game props category grid

EOF
)"
```

---

### Task 6: Wire `WnbaPregameCenter`

**Files:**
- Modify: `frontend/src/features/basketball/game/WnbaPregameCenter.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaPregameCenter.test.tsx`

**Interfaces:**
- Consumes: `useWnbaGameProps`, `WnbaGamePropsGrid`
- Removes Props-tab use of `useWnbaProps` / `filterPropLines` / `WnbaGamePropsList` (league `/prop_picks` still uses `useWnbaProps`)

- [ ] **Step 1: Update failing PregameCenter tests**

Rewrite Props-tab tests to mirror `MlbPregameCenter.test.tsx`:

- Do not fetch game props on Preview
- Props tab + PrizePicks → `fetchWnbaGameProps({ espnEventId, app: "prizepicks" })`
- Underdog sub-tab → `app: "underdog"`
- Grid testid `wnba-game-props-grid` visible
- Empty / error states via grid (mock hook or fetch)

Mock `fetchWnbaGameProps` (or `useWnbaGameProps`) instead of `useWnbaProps` for the Props panel.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- src/features/basketball/game/WnbaPregameCenter.test.tsx
```

Expected: FAIL against old flat-list wiring

- [ ] **Step 3: Wire center**

In `WnbaPregameCenter.tsx`:

1. Remove `useWnbaProps`, `filterPropLines`, `expandWnbaTeamAbbrevs`, `WnbaGamePropsList`, and unused `ApiWnbaPropLine` imports from the Props path.
2. Keep `GamePropsAppTabs` + `propsApp` state.
3. Add:

```tsx
const prizeQuery = useWnbaGameProps({
  espnEventId: detail.espnEventId,
  app: "prizepicks",
  enabled: activeTab === "props" && propsApp === "prizepicks",
});
const underdogQuery = useWnbaGameProps({
  espnEventId: detail.espnEventId,
  app: "underdog",
  enabled: activeTab === "props" && propsApp === "underdog",
});
const propsQuery = propsApp === "underdog" ? underdogQuery : prizeQuery;
```

4. Props panel:

```tsx
<WnbaGamePropsGrid
  categories={propsQuery.data?.categories ?? []}
  isPending={propsQuery.isPending}
  error={
    propsQuery.isError
      ? "Failed to load props"
      : propsQuery.data?.error
  }
/>
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test -- src/features/basketball/game/WnbaPregameCenter.test.tsx src/features/basketball/game/WnbaGamePropsGrid.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/basketball/game/WnbaPregameCenter.tsx \
  frontend/src/features/basketball/game/WnbaPregameCenter.test.tsx
git commit -m "$(cat <<'EOF'
feat(wnba): wire matchup Props tab to game props grid

EOF
)"
```

---

### Task 7: Docs + spec status

**Files:**
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-08-10-wnba-game-props-mlb-parity-design.md` (Status → Implemented)

- [ ] **Step 1: Update system-design page ↔ API table**

In `md/system-design.md`:

1. `/games/:espnEventId` row: Props → game-scoped category grid via `useWnbaGameProps` / `GET /api/wnba/props/game/{id}?app=` (not client-filtered `/props/today`).
2. Add API inventory row:

| GET | `/api/wnba/props/game/{espn_event_id}` | `wnba.game_props` (+ `get_today_props`, game detail, roster headshots) |

- [ ] **Step 2: Mark spec Implemented**

Set `Status: Implemented` in the design doc header.

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md \
  docs/superpowers/specs/2026-08-10-wnba-game-props-mlb-parity-design.md
git commit -m "$(cat <<'EOF'
docs: mark WNBA game props MLB parity implemented

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Full MLB category-card UI on Props | 5, 6 |
| PrizePicks / Underdog sub-tabs kept | 6 |
| Game-scoped endpoint | 2 |
| Reuse today’s props assembly | 2 (`get_today_props`) |
| Exact-line best Over/Under + book priority | 1, 2 |
| Headshots soft-fail | 2 |
| Frontend fetch + hook | 3, 4 |
| OpenAPI + system-design | 3, 7 |
| Tests backend + frontend | 1–6 |
| Out of scope: Preview grid, prop_picks page, EV | Not planned |

No TBD placeholders. Types use `espn_event_id` / `espnEventId` consistently (not `gamePk`).
