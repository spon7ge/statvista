# MLB Preview Away/Home Team Leaders & Roster Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MLB pregame Away/Home tab stubs with a lazy-loaded team preview: Game Leaders–style batting (HR/AVG/OPS) and pitching (ERA/SO/WHIP) cards plus full active-roster season batting/pitching tables in a two-column layout.

**Architecture:** New `GET /api/mlb/games/{game_pk}/team-preview?side=away|home` assembles one team’s leaders (season boards ∩ active roster) and season roster tables (Stats `teamId` player splits). Frontend `useMlbTeamPreview` fetches only when that tab is active; `MlbTeamPreview` renders batting | pitching columns (stack on narrow).

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React 19 · TypeScript · Vite · TanStack Query · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-mlb-preview-team-tab-leaders-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Surface: Away tab → away team only; Home tab → home team only (pregame scheduled only)
- Layout B: batting left / pitching right; stack batting then pitching on narrow
- Leaders: HR · AVG · OPS and ERA · SO · WHIP — one card each; no team logo on cards
- Tables: season-core columns; sort batting OPS↓, pitching IP↓; no clickable sorts in v1
- Soft-fail: never break game page; omit empty leader sections; empty tables show “No season stats available”
- Invalid `side` → FastAPI `Literal` Query validation (**422**, same as props `app`); unknown game → **404**
- OpenAPI: add path to `REQUIRED_MLB_PATHS`, export, `npm run generate:api`, update golden
- Do not bloat `GET /api/mlb/games/{game_pk}` with this payload
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py tests/test_mlb_team_leaders.py -q`
- Verify frontend: Vitest on new/changed MLB game/hook/api files + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_team_preview.py` | Response models |
| `backend/app/domains/mlb/schemas.py` | Re-export |
| `backend/app/providers/mlb_stats/team_leaders.py` | Pick + fetch batting/pitching leaders for one team |
| `backend/app/providers/mlb_stats/team_player_season.py` | Fetch/map/sort team season batting & pitching rows |
| `backend/app/domains/mlb/team_preview.py` | `get_mlb_team_preview(game_pk, side)` assembler |
| `backend/app/domains/mlb/routes.py` | New GET route |
| `backend/app/openapi_export.py` | `REQUIRED_MLB_PATHS` entry |
| `backend/tests/test_mlb_team_leaders.py` | Leader pick unit tests |
| `backend/tests/test_mlb_team_preview.py` | Roster map/sort + route tests |
| `frontend/openapi.json` / `api.schema.d.ts` / `backend/openapi-golden.json` | Contract |
| `frontend/src/shared/lib/api.ts` (+ `api.test.ts`) | `fetchMlbTeamPreview` |
| `frontend/src/features/mlb/hooks/useMlbTeamPreview.ts` (+ test) | Lazy query hook |
| `frontend/src/features/mlb/game/MlbTeamPreview.tsx` (+ test) | Two-column UI |
| `frontend/src/features/mlb/game/MlbPregameCenter.tsx` (+ test) | Wire away/home |
| `md/system-design.md` | Page ↔ API + method catalog |
| Spec status → Implemented (after ship) | |

---

### Task 1: Team preview schemas

**Files:**
- Create: `backend/app/domains/mlb/schemas_team_preview.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Create: `backend/tests/test_mlb_team_preview.py` (schema smoke only in this task)

**Interfaces:**
- Produces:
  - `MlbTeamLeaderCard` (`key`, `label`, `rank`, `value`, `player_id`, `last_name`, `headshot_url`)
  - `MlbTeamBatterSeasonRow` / `MlbTeamPitcherSeasonRow` (fields per spec)
  - `MlbTeamPreviewTeam` (`id`, `abbrev`, `name`, `logo_url`)
  - `MlbTeamPreviewResponse` (`side`, `team`, `batting_leaders`, `pitching_leaders`, `batting_roster`, `pitching_roster`)

- [ ] **Step 1: Write failing schema construction test**

```python
# backend/tests/test_mlb_team_preview.py
from app.domains.mlb.schemas_team_preview import (
    MlbTeamBatterSeasonRow,
    MlbTeamLeaderCard,
    MlbTeamPitcherSeasonRow,
    MlbTeamPreviewResponse,
    MlbTeamPreviewTeam,
)


def test_team_preview_response_constructs():
    payload = MlbTeamPreviewResponse(
        side="away",
        team=MlbTeamPreviewTeam(
            id="120", abbrev="WSH", name="Washington Nationals", logo_url=None
        ),
        batting_leaders=[
            MlbTeamLeaderCard(
                key="hr",
                label="HR",
                rank=12,
                value="28",
                player_id="1",
                last_name="Smith",
                headshot_url=None,
            )
        ],
        pitching_leaders=[],
        batting_roster=[
            MlbTeamBatterSeasonRow(
                player_id="1",
                name="C. Smith",
                g=98,
                avg=".278",
                obp=".341",
                slg=".512",
                ops=".853",
                ab=400,
                r=60,
                h=111,
                hr=28,
                rbi=74,
                bb=40,
                so=90,
                sb=5,
            )
        ],
        pitching_roster=[
            MlbTeamPitcherSeasonRow(
                player_id="2",
                name="J. Gray",
                g=22,
                gs=22,
                w=9,
                l=4,
                sv=0,
                ip="130.1",
                h=100,
                er=35,
                bb=30,
                so=142,
                era="2.41",
                whip="0.98",
            )
        ],
    )
    assert payload.side == "away"
    assert payload.batting_leaders[0].key == "hr"
    assert payload.batting_roster[0].ops == ".853"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py::test_team_preview_response_constructs -v`

Expected: FAIL (module not found)

- [ ] **Step 3: Add schemas + re-export**

Create `backend/app/domains/mlb/schemas_team_preview.py`:

```python
"""Response schemas for GET /api/mlb/games/{game_pk}/team-preview."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)

TeamLeaderKey = Literal["hr", "avg", "ops", "era", "so", "whip"]


class MlbTeamLeaderCard(BaseModel):
    model_config = _RESPONSE_CONFIG
    key: TeamLeaderKey
    label: str
    rank: int | None = None
    value: str
    player_id: str
    last_name: str
    headshot_url: str | None = None


class MlbTeamBatterSeasonRow(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_id: str
    name: str
    g: int | None = None
    avg: str | None = None
    obp: str | None = None
    slg: str | None = None
    ops: str | None = None
    ab: int | None = None
    r: int | None = None
    h: int | None = None
    hr: int | None = None
    rbi: int | None = None
    bb: int | None = None
    so: int | None = None
    sb: int | None = None


class MlbTeamPitcherSeasonRow(BaseModel):
    model_config = _RESPONSE_CONFIG
    player_id: str
    name: str
    g: int | None = None
    gs: int | None = None
    w: int | None = None
    l: int | None = None
    sv: int | None = None
    ip: str | None = None
    h: int | None = None
    er: int | None = None
    bb: int | None = None
    so: int | None = None
    era: str | None = None
    whip: str | None = None


class MlbTeamPreviewTeam(BaseModel):
    model_config = _RESPONSE_CONFIG
    id: str
    abbrev: str
    name: str
    logo_url: str | None = None


class MlbTeamPreviewResponse(BaseModel):
    model_config = _RESPONSE_CONFIG
    side: Literal["away", "home"]
    team: MlbTeamPreviewTeam
    batting_leaders: list[MlbTeamLeaderCard] = Field(default_factory=list)
    pitching_leaders: list[MlbTeamLeaderCard] = Field(default_factory=list)
    batting_roster: list[MlbTeamBatterSeasonRow] = Field(default_factory=list)
    pitching_roster: list[MlbTeamPitcherSeasonRow] = Field(default_factory=list)
```

In `schemas.py`, import and add to `__all__` the five public classes above (same pattern as `schemas_game_props`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py::test_team_preview_response_constructs -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_team_preview.py backend/app/domains/mlb/schemas.py backend/tests/test_mlb_team_preview.py
git commit -m "feat(mlb): add team-preview response schemas"
```

---

### Task 2: Team leader pick + fetch provider

**Files:**
- Create: `backend/app/providers/mlb_stats/team_leaders.py`
- Create: `backend/tests/test_mlb_team_leaders.py`

**Interfaces:**
- Consumes: `CATEGORY_SPECS`, `fetch_category_payload`, `normalize_category_payload`, `fetch_team_abbrev_map`, `fetch_active_roster_player_ids`, `get_mlb_player_index`, `norm_player_name`, `last_name_from_full` (from `game_leaders` or re-export)
- Produces:
  - `BATTING_LEADER_KEYS = ("hr", "avg", "ops")`
  - `PITCHING_LEADER_KEYS = ("era", "so", "whip")`
  - `TEAM_BOARD_LIMIT = 100`
  - `pick_team_leader_from_board(category, *, roster_ids, headshot_by_norm) -> MlbTeamLeaderCard | None`
  - `async def fetch_team_leaders(client, *, team_id: int, season: int, keys: tuple[str, ...]) -> list[MlbTeamLeaderCard]`

- [ ] **Step 1: Write failing pick tests**

```python
# backend/tests/test_mlb_team_leaders.py
from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.team_leaders import pick_team_leader_from_board


def test_pick_team_leader_first_roster_hit():
    cat = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="Other Guy", team_abbrev="SEA", gp=10, value="40"),
            MlbLeaderRow(rank=4, player_id="2", name="Matt Olson", team_abbrev="ATL", gp=10, value="33"),
        ],
    )
    card = pick_team_leader_from_board(
        cat,
        roster_ids={"2"},
        headshot_by_norm={"matt olson": "https://example.com/o.png"},
    )
    assert card is not None
    assert card.key == "hr"
    assert card.label == "HR"
    assert card.rank == 4
    assert card.last_name == "Olson"
    assert card.headshot_url == "https://example.com/o.png"


def test_pick_team_leader_none_when_no_roster_hit():
    cat = MlbLeaderCategory(
        key="era",
        label="ERA",
        stat="ERA",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value="1.90"),
        ],
    )
    assert (
        pick_team_leader_from_board(cat, roster_ids={"1"}, headshot_by_norm={})
        is None
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_leaders.py -v`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement provider**

Create `backend/app/providers/mlb_stats/team_leaders.py` following `game_leaders.py`, but:

- Single `roster_ids: set[str]` (no away/home side)
- Card type `MlbTeamLeaderCard` with short labels: `{"hr":"HR","avg":"AVG","ops":"OPS","era":"ERA","so":"SO","whip":"WHIP"}`
- `fetch_team_leaders` loads roster for `team_id`, boards for requested `keys` via `select` from `CATEGORY_SPECS`, ESPN index, returns cards in `keys` order (omit missing)

Reuse `last_name_from_full` from `game_leaders` (import it; do not duplicate).

Sketch for pick:

```python
def pick_team_leader_from_board(
    category: MlbLeaderCategory,
    *,
    roster_ids: set[str],
    headshot_by_norm: dict[str, str | None],
) -> MlbTeamLeaderCard | None:
    key = cast(TeamLeaderKey, category.key)
    for row in category.leaders:
        if row.player_id not in roster_ids:
            continue
        return MlbTeamLeaderCard(
            key=key,
            label=_LABEL[key],
            rank=row.rank,
            value=row.value,
            player_id=row.player_id,
            last_name=last_name_from_full(row.name),
            headshot_url=headshot_by_norm.get(norm_player_name(row.name)),
        )
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_leaders.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/mlb_stats/team_leaders.py backend/tests/test_mlb_team_leaders.py
git commit -m "feat(mlb): pick team batting/pitching leaders from season boards"
```

---

### Task 3: Team player season roster provider

**Files:**
- Create: `backend/app/providers/mlb_stats/team_player_season.py`
- Modify: `backend/tests/test_mlb_team_preview.py`

**Interfaces:**
- Produces:
  - `TEAM_PLAYER_SEASON_TTL_SECONDS = 900.0`
  - `clear_team_player_season_cache() -> None`
  - `parse_batter_season_row(player_id, person, stat) -> MlbTeamBatterSeasonRow`
  - `parse_pitcher_season_row(player_id, person, stat) -> MlbTeamPitcherSeasonRow`
  - `sort_batter_rows(rows) -> list` (OPS desc, nulls last)
  - `sort_pitcher_rows(rows) -> list` (IP desc as float, nulls last)
  - `filter_rows_to_roster(rows, roster_ids) -> list` (if `roster_ids` empty, return rows unchanged)
  - `async def fetch_team_batter_season_rows(client, team_id, season) -> list[MlbTeamBatterSeasonRow]`
  - `async def fetch_team_pitcher_season_rows(client, team_id, season) -> list[MlbTeamPitcherSeasonRow]`

**Stats fetch:** `GET {STATS_BASE}/stats` with `stats=season`, `group=hitting|pitching`, `season`, `sportIds=1`, `teamId={team_id}`, `limit=50` (or omit limit). Parse `stats[0].splits[]` — each split has `player.id`, `player.fullName` / `player.boxscoreName`, and `stat` dict. Prefer `boxscoreName` for `name`.

IP sort helper: parse `"130.1"` → `130 + 1/3` style float (outs): `whole + frac/10*1/3` — or simple `float(ip)` if Stats always uses decimal innings; prefer matching any existing IP parse in repo; if none, use:

```python
def ip_to_float(ip: str | None) -> float | None:
    if not ip:
        return None
    try:
        if "." in ip:
            whole, frac = ip.split(".", 1)
            return int(whole) + (int(frac) / 3.0 if frac else 0.0)
        return float(ip)
    except ValueError:
        return None
```

- [ ] **Step 1: Write failing parse/sort tests**

```python
from app.providers.mlb_stats.team_player_season import (
    parse_batter_season_row,
    parse_pitcher_season_row,
    sort_batter_rows,
    sort_pitcher_rows,
    filter_rows_to_roster,
)


def test_parse_batter_prefers_boxscore_name():
    row = parse_batter_season_row(
        "1",
        {"fullName": "Christopher Smith", "boxscoreName": "C. Smith"},
        {
            "gamesPlayed": 98,
            "avg": ".278",
            "obp": ".341",
            "slg": ".512",
            "ops": ".853",
            "atBats": 400,
            "runs": 60,
            "hits": 111,
            "homeRuns": 28,
            "rbi": 74,
            "baseOnBalls": 40,
            "strikeOuts": 90,
            "stolenBases": 5,
        },
    )
    assert row.name == "C. Smith"
    assert row.hr == 28
    assert row.ops == ".853"


def test_sort_batters_by_ops_desc_nulls_last():
    a = parse_batter_season_row("1", {"boxscoreName": "A"}, {"ops": ".700", "gamesPlayed": 1})
    b = parse_batter_season_row("2", {"boxscoreName": "B"}, {"ops": ".900", "gamesPlayed": 1})
    c = parse_batter_season_row("3", {"boxscoreName": "C"}, {"ops": None, "gamesPlayed": 1})
    ordered = sort_batter_rows([a, c, b])
    assert [r.player_id for r in ordered] == ["2", "1", "3"]


def test_sort_pitchers_by_ip_desc():
    a = parse_pitcher_season_row(
        "1", {"boxscoreName": "A"},
        {"gamesPlayed": 10, "gamesStarted": 10, "wins": 1, "losses": 1, "saves": 0,
         "inningsPitched": "50.0", "hits": 40, "earnedRuns": 20, "baseOnBalls": 10,
         "strikeOuts": 40, "era": "3.60", "whip": "1.00"},
    )
    b = parse_pitcher_season_row(
        "2", {"boxscoreName": "B"},
        {"gamesPlayed": 20, "gamesStarted": 20, "wins": 5, "losses": 2, "saves": 0,
         "inningsPitched": "130.1", "hits": 100, "earnedRuns": 35, "baseOnBalls": 30,
         "strikeOuts": 142, "era": "2.41", "whip": "0.98"},
    )
    ordered = sort_pitcher_rows([a, b])
    assert [r.player_id for r in ordered] == ["2", "1"]


def test_filter_rows_to_roster():
    a = parse_batter_season_row("1", {"boxscoreName": "A"}, {"ops": ".8", "gamesPlayed": 1})
    b = parse_batter_season_row("2", {"boxscoreName": "B"}, {"ops": ".9", "gamesPlayed": 1})
    assert [r.player_id for r in filter_rows_to_roster([a, b], {"2"})] == ["2"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py::test_parse_batter_prefers_boxscore_name tests/test_mlb_team_preview.py::test_sort_batters_by_ops_desc_nulls_last tests/test_mlb_team_preview.py::test_sort_pitchers_by_ip_desc tests/test_mlb_team_preview.py::test_filter_rows_to_roster -v`

Expected: FAIL

- [ ] **Step 3: Implement provider**

Map Stats keys:
- Hitting: `gamesPlayed→g`, `avg`, `obp`, `slg`, `ops`, `atBats→ab`, `runs→r`, `hits→h`, `homeRuns→hr`, `rbi`, `baseOnBalls→bb`, `strikeOuts→so`, `stolenBases→sb`
- Pitching: `gamesPlayed→g`, `gamesStarted→gs`, `wins→w`, `losses→l`, `saves→sv`, `inningsPitched→ip` (str), `hits→h`, `earnedRuns→er`, `baseOnBalls→bb`, `strikeOuts→so`, `era`, `whip`

Ints: coerce with try/int; rates/IP keep as display strings via `str(stat[...]) if present else None`.

Cache parsed lists keyed by `f"{team_id}|{season}|{group}"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py tests/test_mlb_team_leaders.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/mlb_stats/team_player_season.py backend/tests/test_mlb_team_preview.py
git commit -m "feat(mlb): map and sort team season batting/pitching roster rows"
```

---

### Task 4: Domain assembler + HTTP route

**Files:**
- Create: `backend/app/domains/mlb/team_preview.py`
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/tests/test_mlb_team_preview.py`

**Interfaces:**
- Consumes: `get_mlb_game_detail`, `is_valid_mlb_game_pk`, providers above
- Produces: `async def get_mlb_team_preview(game_pk: str, side: Literal["away","home"]) -> MlbTeamPreviewResponse`
- Route: `GET /mlb/games/{game_pk}/team-preview?side=`

- [ ] **Step 1: Write failing route tests**

```python
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.domains.mlb.schemas_team_preview import (
    MlbTeamPreviewResponse,
    MlbTeamPreviewTeam,
)

client = TestClient(app)


def _preview() -> MlbTeamPreviewResponse:
    return MlbTeamPreviewResponse(
        side="away",
        team=MlbTeamPreviewTeam(id="120", abbrev="WSH", name="Washington Nationals", logo_url=None),
        batting_leaders=[],
        pitching_leaders=[],
        batting_roster=[],
        pitching_roster=[],
    )


def test_team_preview_ok_no_store():
    with patch(
        "app.domains.mlb.routes.get_mlb_team_preview",
        new=AsyncMock(return_value=_preview()),
    ):
        res = client.get("/api/mlb/games/776543/team-preview?side=away")
    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"
    assert res.json()["side"] == "away"


def test_team_preview_invalid_side_422():
    res = client.get("/api/mlb/games/776543/team-preview?side=midwest")
    assert res.status_code == 422


def test_team_preview_lookup_error_404():
    with patch(
        "app.domains.mlb.routes.get_mlb_team_preview",
        new=AsyncMock(side_effect=LookupError("missing")),
    ):
        res = client.get("/api/mlb/games/776543/team-preview?side=home")
    assert res.status_code == 404
```

Add assembler soft-fail unit test (concrete):

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.domains.mlb.schemas import MlbGameDetail, MlbGameDetailTeam
from app.domains.mlb.schemas_team_preview import MlbTeamBatterSeasonRow
from app.domains.mlb.team_preview import get_mlb_team_preview


def _scheduled_detail() -> MlbGameDetail:
    away = MlbGameDetailTeam(
        id="120", abbrev="WSH", name="Washington Nationals", score=None, color="#AB0003"
    )
    home = MlbGameDetailTeam(
        id="143", abbrev="PHI", name="Philadelphia Phillies", score=None, color="#E81828"
    )
    return MlbGameDetail(
        mlb_game_pk="776543",
        status="scheduled",
        status_label="8:00 PM ET",
        venue="Nationals Park",
        away=away,
        home=home,
        game_date="2026-08-10",
        sources=["mlb_stats_api"],
        fetched_at="2026-08-10T12:00:00+00:00",
    )


@pytest.mark.asyncio
async def test_get_mlb_team_preview_soft_fails_leaders():
    batter = MlbTeamBatterSeasonRow(
        player_id="1", name="C. Smith", g=1, ops=".900",
        avg=None, obp=None, slg=None, ab=None, r=None, h=None,
        hr=None, rbi=None, bb=None, so=None, sb=None,
    )
    with (
        patch(
            "app.domains.mlb.team_preview.get_mlb_game_detail",
            new=AsyncMock(return_value=_scheduled_detail()),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_leaders",
            new=AsyncMock(side_effect=RuntimeError("board down")),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_active_roster_player_ids",
            new=AsyncMock(return_value={"1"}),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_batter_season_rows",
            new=AsyncMock(return_value=[batter]),
        ),
        patch(
            "app.domains.mlb.team_preview.fetch_team_pitcher_season_rows",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "app.domains.mlb.team_preview.filter_rows_to_roster",
            side_effect=lambda rows, _ids: rows,
        ),
    ):
        result = await get_mlb_team_preview("776543", "away")
    assert result.batting_leaders == []
    assert result.pitching_leaders == []
    assert len(result.batting_roster) == 1
    assert result.team.abbrev == "WSH"
```

- [ ] **Step 2: Run route tests — expect fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py::test_team_preview_ok_no_store -v`

Expected: FAIL (404 or missing route)

- [ ] **Step 3: Implement assembler + route**

`team_preview.py` sketch:

```python
async def get_mlb_team_preview(game_pk: str, side: Literal["away", "home"]) -> MlbTeamPreviewResponse:
    if not is_valid_mlb_game_pk(game_pk):
        raise LookupError("Game not found")
    detail = await get_mlb_game_detail(game_pk)
    team = detail.away if side == "away" else detail.home
    season = int((detail.game_date or "")[:4]) if detail.game_date else None
    if season is None:
        # still return empty lists with team identity
        return MlbTeamPreviewResponse(
            side=side,
            team=MlbTeamPreviewTeam(id=team.id, abbrev=team.abbrev, name=team.name, logo_url=team.logo_url),
            batting_leaders=[], pitching_leaders=[], batting_roster=[], pitching_roster=[],
        )
    team_id = int(team.id)
    batting_leaders: list = []
    pitching_leaders: list = []
    batting_roster: list = []
    pitching_roster: list = []
    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        try:
            batting_leaders = await fetch_team_leaders(
                client, team_id=team_id, season=season, keys=BATTING_LEADER_KEYS
            )
        except Exception as exc:
            logger.warning("team batting leaders failed: %s", exc)
        try:
            pitching_leaders = await fetch_team_leaders(
                client, team_id=team_id, season=season, keys=PITCHING_LEADER_KEYS
            )
        except Exception as exc:
            logger.warning("team pitching leaders failed: %s", exc)
        roster_ids = await fetch_active_roster_player_ids(client, team_id, season)
        try:
            batting_roster = filter_rows_to_roster(
                await fetch_team_batter_season_rows(client, team_id, season),
                roster_ids,
            )
        except Exception as exc:
            logger.warning("team batting roster failed: %s", exc)
        try:
            pitching_roster = filter_rows_to_roster(
                await fetch_team_pitcher_season_rows(client, team_id, season),
                roster_ids,
            )
        except Exception as exc:
            logger.warning("team pitching roster failed: %s", exc)
    return MlbTeamPreviewResponse(
        side=side,
        team=MlbTeamPreviewTeam(
            id=team.id, abbrev=team.abbrev, name=team.name, logo_url=team.logo_url
        ),
        batting_leaders=batting_leaders,
        pitching_leaders=pitching_leaders,
        batting_roster=batting_roster,
        pitching_roster=pitching_roster,
    )
```

Use `timeout=12.0` on the AsyncClient (same value as `STATS_TIMEOUT_SECONDS` in `game_detail.py`), or `from app.domains.mlb.game_detail import STATS_TIMEOUT_SECONDS` if that constant is already exported for reuse.

Route (mirror game detail / props):

```python
@router.get(
    "/mlb/games/{game_pk}/team-preview",
    response_model=MlbTeamPreviewResponse,
)
async def mlb_team_preview(
    game_pk: str,
    response: Response,
    side: Literal["away", "home"] = Query(...),
) -> MlbTeamPreviewResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await get_mlb_team_preview(game_pk, side)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Game not found", headers=_NO_STORE) from exc
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py tests/test_mlb_team_leaders.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/team_preview.py backend/app/domains/mlb/routes.py backend/tests/test_mlb_team_preview.py
git commit -m "feat(mlb): add team-preview API for Away/Home tabs"
```

---

### Task 5: OpenAPI export + frontend fetch + hook

**Files:**
- Modify: `backend/app/openapi_export.py` (`REQUIRED_MLB_PATHS`)
- Regenerate: `frontend/openapi.json`, `frontend/src/shared/lib/api.schema.d.ts`, `backend/openapi-golden.json`
- Modify: `frontend/src/shared/lib/api.ts`, `frontend/src/shared/lib/api.test.ts`
- Create: `frontend/src/features/mlb/hooks/useMlbTeamPreview.ts`, `useMlbTeamPreview.test.tsx`

**Interfaces:**
- Produces:
  - `MlbTeamPreviewParams = { gamePk: string; side: "away" | "home" }`
  - `ApiMlbTeamPreviewResponse = Schemas["MlbTeamPreviewResponse"]`
  - `fetchMlbTeamPreview(params) -> Promise<ApiMlbTeamPreviewResponse>`
  - `useMlbTeamPreview({ gamePk, side, enabled? })`

- [ ] **Step 1: Add path to `REQUIRED_MLB_PATHS`**

```python
"/api/mlb/games/{game_pk}/team-preview",
```

- [ ] **Step 2: Export OpenAPI + generate types**

```bash
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api && npm run check:api
```

Expected: exit 0; schema includes `MlbTeamPreviewResponse`.

- [ ] **Step 3: Write failing api + hook tests**

In `api.test.ts` (mirror `fetchMlbGameProps`):

```ts
it("fetchMlbTeamPreview hits team-preview with side", async () => {
  // mock fetch → assert URL ends with /api/mlb/games/1/team-preview?side=away
});
```

In `useMlbTeamPreview.test.tsx` (mirror `useMlbGameProps.test.tsx`): enabled false → no fetch; enabled true → calls `fetchMlbTeamPreview`.

- [ ] **Step 4: Implement api + hook**

```ts
// api.ts
export type MlbTeamPreviewParams = {
  gamePk: string;
  side: "away" | "home";
};
export type ApiMlbTeamPreviewResponse = Schemas["MlbTeamPreviewResponse"];

export async function fetchMlbTeamPreview({
  gamePk,
  side,
}: MlbTeamPreviewParams): Promise<ApiMlbTeamPreviewResponse> {
  const qs = new URLSearchParams({ side });
  const res = await fetch(
    `${API_BASE}/api/mlb/games/${encodeURIComponent(gamePk)}/team-preview?${qs}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`MLB team preview request failed: ${res.status}`);
  }
  return res.json();
}
```

```ts
// useMlbTeamPreview.ts
export function useMlbTeamPreview({
  gamePk,
  side,
  enabled = true,
}: MlbTeamPreviewParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mlb", "team-preview", gamePk, side],
    queryFn: () => fetchMlbTeamPreview({ gamePk, side }),
    enabled: Boolean(gamePk) && enabled,
    refetchInterval: 15 * 60_000,
  });
}
```

- [ ] **Step 5: Run FE tests**

Run: `cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/mlb/hooks/useMlbTeamPreview.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/openapi_export.py backend/openapi-golden.json frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts frontend/src/features/mlb/hooks/useMlbTeamPreview.ts frontend/src/features/mlb/hooks/useMlbTeamPreview.test.tsx
git commit -m "feat(mlb): OpenAPI + fetch/hook for team-preview"
```

---

### Task 6: `MlbTeamPreview` UI

**Files:**
- Create: `frontend/src/features/mlb/game/MlbTeamPreview.tsx`
- Create: `frontend/src/features/mlb/game/MlbTeamPreview.test.tsx`

**Interfaces:**
- Consumes: `ApiMlbTeamPreviewResponse` (or a thin mapped view — snake_case from API is fine if components read `batting_leaders` etc.; prefer camelCase map only if neighboring MLB game UI already maps — Game Leaders maps on game detail; for this endpoint, map in the component file or a tiny `mapMlbTeamPreview.ts` to camelCase for consistency with `features/mlb/lib/types.ts`)
- Produces: `<MlbTeamPreview data | isPending | error />`

**Recommendation:** Map once in the component (or small mapper) to camelCase to match `MlbGameLeaders` style.

UI requirements from spec:
- `data-testid="mlb-team-preview"`
- Grid `md:grid-cols-2` gap; batting column then pitching column
- Sections: Team Batting Leaders / Batting / Team Pitching Leaders / Pitching
- Leader cards: copy structure from `MlbGameLeaders.tsx` without team logo
- Tables: monospace-ish numbers; headers for full season-core columns; `overflow-x-auto`
- Pending: short “Loading…” text
- Error: “Failed to load team preview”
- Empty leaders → omit section; empty roster → “No season stats available”

- [ ] **Step 1: Write failing UI tests**

```tsx
it("renders batting and pitching leader titles and table headers", () => {
  render(<MlbTeamPreview data={fixture} isPending={false} error={null} />);
  expect(screen.getByRole("heading", { name: "Team Batting Leaders" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Team Pitching Leaders" })).toBeInTheDocument();
  expect(screen.getByTestId("mlb-team-batting-table")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-team-pitching-table")).toBeInTheDocument();
});

it("hides batting leaders section when empty", () => { ... });
it("shows empty copy when batting roster empty", () => { ... });
it("shows loading when pending", () => { ... });
```

- [ ] **Step 2: Run — expect fail**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbTeamPreview.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement component**

Use `GameSection` charcoal chrome. Headshot fallback like `MlbGameLeaders`. Keep file focused; private subcomponents in the same file are OK if < ~250 lines; split only if unwieldy.

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbTeamPreview.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbTeamPreview.tsx frontend/src/features/mlb/game/MlbTeamPreview.test.tsx
git commit -m "feat(mlb): add Away/Home team preview leaders and roster tables UI"
```

---

### Task 7: Wire PregameCenter + docs

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.tsx`
- Modify: `frontend/src/features/mlb/game/MlbPregameCenter.test.tsx`
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-08-10-mlb-preview-team-tab-leaders-design.md` (Status → Implemented)

- [ ] **Step 1: Update PregameCenter tests first**

Replace stub assertions:

```tsx
// mock fetchMlbTeamPreview
it("loads team preview on Away tab", async () => {
  // click Washington Nationals tab
  // expect fetchMlbTeamPreview called with { gamePk, side: "away" }
  // expect mlb-team-preview in document (or loading then content)
  // expect useMlbOdds / lineups not forced for away (odds enabled false)
});

it("does not fetch team preview on Preview tab", () => {
  // fetchMlbTeamPreview not called on initial render
});
```

Remove `/preview coming soon/i` expectations for away/home.

- [ ] **Step 2: Run — expect fail**

Run: `cd frontend && npx vitest run src/features/mlb/game/MlbPregameCenter.test.tsx`

Expected: FAIL on stub text / missing mock

- [ ] **Step 3: Wire center**

```tsx
const awayPreview = useMlbTeamPreview({
  gamePk: detail.mlbGamePk,
  side: "away",
  enabled: activeTab === "away",
});
const homePreview = useMlbTeamPreview({
  gamePk: detail.mlbGamePk,
  side: "home",
  enabled: activeTab === "home",
});
const teamPreviewQuery = activeTab === "home" ? homePreview : awayPreview;

// in panel:
activeTab === "away" || activeTab === "home" ? (
  <MlbTeamPreview
    data={teamPreviewQuery.data ?? null}
    isPending={teamPreviewQuery.isPending}
    error={teamPreviewQuery.isError ? "Failed to load team preview" : null}
  />
) : ...
```

Remove `stub` variable.

- [ ] **Step 4: Update `md/system-design.md`**

In `/mlb/games/:gamePk` row: replace “away/team tabs stub” with Away/Home **team preview** (Team Batting/Pitching Leaders + season roster tables); add hook `useMlbTeamPreview(gamePk, side)` and API `GET /api/mlb/games/{gamePk}/team-preview?side=away|home`.

In API method catalog add:

```
| GET | `/api/mlb/games/{game_pk}/team-preview?side=` | `mlb.team_preview` (+ leaders boards, team season player splits) |
```

Set spec Status to **Implemented**.

- [ ] **Step 5: Run full targeted verification**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_team_preview.py tests/test_mlb_team_leaders.py -q
cd frontend && npx vitest run src/features/mlb/game/MlbTeamPreview.test.tsx src/features/mlb/game/MlbPregameCenter.test.tsx src/features/mlb/hooks/useMlbTeamPreview.test.tsx src/shared/lib/api.test.ts
cd frontend && npm run check:api
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mlb/game/MlbPregameCenter.tsx frontend/src/features/mlb/game/MlbPregameCenter.test.tsx md/system-design.md docs/superpowers/specs/2026-08-10-mlb-preview-team-tab-leaders-design.md
git commit -m "feat(mlb): wire Away/Home team preview on pregame tabs"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Lazy `team-preview` endpoint | 4–5 |
| Away/Home only, leaders HR/AVG/OPS + ERA/SO/WHIP | 2, 6–7 |
| Layout B two-column | 6 |
| Season-core roster columns + sorts | 3, 6 |
| Soft-fail / empty states | 4, 6 |
| OpenAPI + system-design | 5, 7 |
| No Game Leaders / Preview payload change | (explicit non-goals) |
| Live/Final out of scope | (not wired) |
