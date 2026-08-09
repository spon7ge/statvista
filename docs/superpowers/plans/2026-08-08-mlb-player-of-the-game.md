# MLB Final Player of the Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-merge official MLB fan-vote Player of the Game winners into Final game detail and show a stacked card above the Play feed.

**Architecture:** On `GET /api/mlb/games/{gamePk}` when status is Final, attach optional `player_of_the_game` via a provider that reads a durable per-`gamePk` cache, else fetches the MLB Play / Genius Sports POTG winner, normalizes, and caches. Frontend maps to `playerOfTheGame` and renders `MlbPlayerOfTheGame` above `MlbFinalPlayFeed` only when non-null.

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React 19 · TypeScript · Vite · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-mlb-player-of-the-game-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Source: MLB Play fan-vote POTG only (not boxscore-derived; not `liveData.decisions`)
- No winner / scrape fail → `null` → hide card; never fail game detail
- Fetch: hybrid cache by `gamePk` (positive cache permanent; no permanent negative cache)
- Stats only from scrape payload; if winner known without stats, omit stats row
- UI layout B: stacked center — headshot → bold boxed **PLAYER OF THE GAME** → name → team → stats
- Placement: Final Summary left column, above Play feed; live/scheduled never show
- OpenAPI sync required after schema change
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py -q`
- Verify frontend: `cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts src/features/mlb/game/MlbPlayerOfTheGame.test.tsx src/features/mlb/game/MlbFinalCenter.test.tsx` + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_detail.py` | Add `MlbPlayerOfTheGameStat`, `MlbPlayerOfTheGame`; field on `MlbGameDetail` |
| `backend/app/domains/mlb/schemas.py` | Re-export new types |
| `backend/app/providers/mlb_play/player_of_the_game.py` | Cache + fetch + normalize POTG winner |
| `backend/app/providers/mlb_play/__init__.py` | Package init |
| `backend/tests/fixtures/mlb_play_potg_winner.json` | Captured/locked winner payload fixture |
| `backend/tests/test_mlb_player_of_the_game.py` | Provider + attach tests |
| `backend/app/domains/mlb/game_detail.py` | `attach_player_of_the_game`, `_attach_player_of_the_game` (Final only) |
| OpenAPI trio | Contract |
| `frontend/.../types.ts`, `mapMlbGameDetail.ts` (+test), `testFixtures.ts` | View + map |
| `frontend/.../game/MlbPlayerOfTheGame.tsx` (+test) | UI card |
| `frontend/.../game/MlbFinalCenter.tsx` (+test) | Wire above Play feed |
| `md/system-design.md` | Document Final POTG |

---

### Task 1: Schema — `player_of_the_game`

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Modify: `backend/app/domains/mlb/game_detail.py`
- Create: `backend/tests/test_mlb_player_of_the_game.py`

**Interfaces:**
- Produces:
  - `MlbPlayerOfTheGameStat(label: str | None = None, value: str)`
  - `MlbPlayerOfTheGame(player_id: str, full_name: str, last_name: str, team_abbrev: str | None = None, headshot_url: str | None = None, stats: list[MlbPlayerOfTheGameStat] = [], source: Literal["mlb_player_of_the_game"] = "mlb_player_of_the_game")`
  - `MlbGameDetail.player_of_the_game: MlbPlayerOfTheGame | None = None`
  - `attach_player_of_the_game(detail: MlbGameDetail, potg: MlbPlayerOfTheGame | None) -> MlbGameDetail`

- [ ] **Step 1: Write failing attach test**

```python
from app.domains.mlb.game_detail import attach_player_of_the_game
from app.domains.mlb.schemas_game_detail import (
    MlbPlayerOfTheGame,
    MlbPlayerOfTheGameStat,
)


def test_attach_player_of_the_game(sample_final_detail):
    potg = MlbPlayerOfTheGame(
        player_id="592450",
        full_name="Aaron Judge",
        last_name="Judge",
        team_abbrev="NYY",
        headshot_url="https://example.test/judge.png",
        stats=[MlbPlayerOfTheGameStat(label=None, value="3-4 · 2 HR · 5 RBI")],
    )
    out = attach_player_of_the_game(sample_final_detail, potg)
    assert out.player_of_the_game is not None
    assert out.player_of_the_game.player_id == "592450"
    assert out.player_of_the_game.source == "mlb_player_of_the_game"


def test_attach_player_of_the_game_none_unchanged(sample_final_detail):
    out = attach_player_of_the_game(sample_final_detail, None)
    assert out.player_of_the_game is None
```

Reuse or build `sample_final_detail` the same way other game-detail tests construct a minimal `MlbGameDetail` (copy a compact fixture from `test_mlb_game_detail_season_injuries.py` if present).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py::test_attach_player_of_the_game -v`  
Expected: FAIL (import/attribute missing)

- [ ] **Step 3: Add schema + attach helper**

In `schemas_game_detail.py` (near other game-detail models):

```python
class MlbPlayerOfTheGameStat(BaseModel):
    model_config = _RESPONSE_CONFIG

    label: str | None = None
    value: str


class MlbPlayerOfTheGame(BaseModel):
    model_config = _RESPONSE_CONFIG

    player_id: str
    full_name: str
    last_name: str
    team_abbrev: str | None = None
    headshot_url: str | None = None
    stats: list[MlbPlayerOfTheGameStat] = []
    source: Literal["mlb_player_of_the_game"] = "mlb_player_of_the_game"
```

On `MlbGameDetail` add:

```python
player_of_the_game: MlbPlayerOfTheGame | None = None
```

In `game_detail.py`:

```python
def attach_player_of_the_game(
    detail: MlbGameDetail,
    potg: MlbPlayerOfTheGame | None,
) -> MlbGameDetail:
    """Attach MLB Play Player of the Game onto a Stats-normalized detail payload."""
    if potg is None:
        return detail
    sources = list(detail.sources)
    if "mlb_player_of_the_game" not in sources:
        sources.append("mlb_player_of_the_game")
    return detail.model_copy(
        update={"player_of_the_game": potg, "sources": sources}
    )
```

Re-export new types from `schemas.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_game_detail.py backend/app/domains/mlb/schemas.py backend/app/domains/mlb/game_detail.py backend/tests/test_mlb_player_of_the_game.py
git commit -m "$(cat <<'EOF'
feat(mlb): add player_of_the_game schema on game detail

EOF
)"
```

---

### Task 2: Probe POTG upstream + lock fixture

**Files:**
- Create: `backend/tests/fixtures/mlb_play_potg_winner.json`
- Create: `backend/tests/fixtures/mlb_play_potg_games_sample.json` (optional slim slice if needed)
- Modify: `docs/superpowers/specs/2026-08-08-mlb-player-of-the-game-design.md` only if probe discovers a blocking auth constraint (note under Open implementation — prefer not)

**Interfaces:**
- Produces: committed JSON fixture(s) that Task 3’s normalizer must accept
- Known starting points (from design research):
  - `https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/games.json` (`feedId` ≈ MLB `gamePk`, `status: "complete"`)
  - `https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/players.json`
  - `https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/squads.json`
  - JS bundle API roots: `…/game/api/` and `https://mlb-global.us.f2p.media.geniussports.com/apps/global/game/api/`
  - Routes in bundle: `pog/contest/{id}/winner`, `pog/predictions`, `contests.json`

- [ ] **Step 1: Probe for a completed final with a published winner**

From repo root (network required):

```bash
curl -sSL --compressed -A 'Mozilla/5.0' \
  'https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json/games.json' \
  -o /tmp/potg_games.json
python3 - <<'PY'
import json
games=json.load(open('/tmp/potg_games.json'))
done=[g for g in games if g.get('status')=='complete']
print('complete', len(done))
print(done[-1] if done else None)
PY
```

Then discover the winner endpoint for that game’s `feedId` / contest id by inspecting the Play app JS (`main.*.js`) and trying `pog/contest/.../winner` (and any working contests list). Capture **one real successful winner JSON** (plus any companion player row if winner JSON is id-only).

- [ ] **Step 2: Write fixture file(s)**

Save the captured winner payload to:

`backend/tests/fixtures/mlb_play_potg_winner.json`

If the live shape uses nested fields, keep them as-is — Task 3 adapts. Also record in the test file docstring the exact URL + headers that worked (User-Agent minimum).

If public winner HTTP remains blocked after earnest probing, stop and report — do not invent a fake live client. In that case, still commit a **realistic** fixture matching the closest documented Genius `pog` winner shape you can extract from the JS (field names from bundle strings), and implement Task 3 against the fixture with the live client raising a clear soft-fail until a working URL is found. Prefer a real capture.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/fixtures/mlb_play_potg_winner.json
git commit -m "$(cat <<'EOF'
test(mlb): lock Player of the Game winner fixture

EOF
)"
```

---

### Task 3: Provider — fetch, cache, normalize

**Files:**
- Create: `backend/app/providers/mlb_play/__init__.py`
- Create: `backend/app/providers/mlb_play/player_of_the_game.py`
- Modify: `backend/tests/test_mlb_player_of_the_game.py`

**Interfaces:**
- Produces:
  - `async def fetch_player_of_the_game(client: httpx.AsyncClient, *, game_pk: str) -> MlbPlayerOfTheGame | None`
  - Cache dir: `data/cache/mlb_player_of_the_game/{game_pk}.json` (create parents)
  - Headshot via same mlbstatic pattern as `game_detail.HEADSHOT` / `_headshot_url` (duplicate the URL template in the provider or import a shared helper — prefer importing `_headshot_url` only if already public; otherwise copy the one-liner template to avoid circular imports)

- [ ] **Step 1: Write failing provider tests using the fixture**

```python
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.providers.mlb_play.player_of_the_game import (
    fetch_player_of_the_game,
    normalize_player_of_the_game,
    read_potg_cache,
    write_potg_cache,
)

FIXTURE = Path(__file__).parent / "fixtures" / "mlb_play_potg_winner.json"


def test_normalize_player_of_the_game_from_fixture():
    raw = json.loads(FIXTURE.read_text())
    potg = normalize_player_of_the_game(raw, game_pk="778563")
    assert potg is not None
    assert potg.player_id
    assert potg.full_name
    assert potg.last_name
    assert potg.source == "mlb_player_of_the_game"
    # stats may be empty if fixture has none — assert type
    assert isinstance(potg.stats, list)


@pytest.mark.asyncio
async def test_fetch_uses_cache_hit(tmp_path, monkeypatch):
    monkeypatch.setenv("MLB_POTG_CACHE_DIR", str(tmp_path))
    potg = normalize_player_of_the_game(json.loads(FIXTURE.read_text()), game_pk="1")
    assert potg is not None
    write_potg_cache("1", potg)
    client = AsyncMock(spec=httpx.AsyncClient)
    out = await fetch_player_of_the_game(client, game_pk="1")
    assert out is not None
    assert out.player_id == potg.player_id
    client.get.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_soft_fails_on_http_error(monkeypatch, tmp_path):
    monkeypatch.setenv("MLB_POTG_CACHE_DIR", str(tmp_path))
    client = AsyncMock(spec=httpx.AsyncClient)
    client.get.side_effect = httpx.HTTPError("boom")
    out = await fetch_player_of_the_game(client, game_pk="999999")
    assert out is None
```

Adapt `normalize_player_of_the_game(raw, game_pk=...)` field paths to match the **committed fixture** from Task 2 (replace nested key access accordingly — do not leave `raw["TODO"]`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py -k normalize_or_fetch -v`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement provider**

`backend/app/providers/mlb_play/__init__.py` can be empty or re-export `fetch_player_of_the_game`.

`player_of_the_game.py` sketch (adjust URL/parse to Task 2 findings):

```python
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import httpx

from app.domains.mlb.schemas_game_detail import (
    MlbPlayerOfTheGame,
    MlbPlayerOfTheGameStat,
)

logger = logging.getLogger(__name__)

JSON_BASE = "https://mlb-play.mlbstatic.com/apps/player-of-the-game/game/json"
# Set WINNER_URL_TEMPLATE from Task 2 probe, e.g. contest-based path
HEADSHOT = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:67:current.png/w_213,q_auto:best/"
    "v1/people/{id}/headshot/67/current"
)
DEFAULT_CACHE_DIR = Path("data/cache/mlb_player_of_the_game")


def _cache_dir() -> Path:
    return Path(os.environ.get("MLB_POTG_CACHE_DIR", DEFAULT_CACHE_DIR))


def _cache_path(game_pk: str) -> Path:
    return _cache_dir() / f"{game_pk}.json"


def read_potg_cache(game_pk: str) -> MlbPlayerOfTheGame | None:
    path = _cache_path(game_pk)
    if not path.is_file():
        return None
    try:
        return MlbPlayerOfTheGame.model_validate_json(path.read_text())
    except Exception as exc:
        logger.warning("POTG cache read failed for %s: %s", game_pk, exc)
        return None


def write_potg_cache(game_pk: str, potg: MlbPlayerOfTheGame) -> None:
    path = _cache_path(game_pk)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(potg.model_dump_json())


def _headshot_url(player_id: str) -> str | None:
    try:
        int(player_id)
    except ValueError:
        return None
    return HEADSHOT.format(id=player_id)


def normalize_player_of_the_game(
    raw: dict,
    *,
    game_pk: str,
) -> MlbPlayerOfTheGame | None:
    """Map upstream winner JSON → schema. Field paths must match Task 2 fixture."""
    # EXAMPLE — replace with real fixture keys:
    player = raw.get("player") if isinstance(raw.get("player"), dict) else raw
    player_id = str(player.get("feedId") or player.get("playerId") or player.get("id") or "").strip()
    full_name = str(player.get("name") or player.get("fullName") or "").strip()
    if not player_id or not full_name:
        return None
    last_name = str(player.get("lastName") or full_name.split()[-1]).strip()
    team_abbrev = player.get("teamAbbrev") or player.get("abbreviation")
    stats_raw = raw.get("stats") or player.get("stats") or raw.get("statLine")
    stats: list[MlbPlayerOfTheGameStat] = []
    if isinstance(stats_raw, str) and stats_raw.strip():
        stats = [MlbPlayerOfTheGameStat(label=None, value=stats_raw.strip())]
    elif isinstance(stats_raw, list):
        for row in stats_raw:
            if not isinstance(row, dict):
                continue
            value = row.get("value") or row.get("displayValue")
            if value is None:
                continue
            stats.append(
                MlbPlayerOfTheGameStat(
                    label=(str(row["label"]) if row.get("label") else None),
                    value=str(value),
                )
            )
    return MlbPlayerOfTheGame(
        player_id=player_id,
        full_name=full_name,
        last_name=last_name,
        team_abbrev=str(team_abbrev) if team_abbrev else None,
        headshot_url=_headshot_url(player_id),
        stats=stats,
    )


async def fetch_player_of_the_game(
    client: httpx.AsyncClient,
    *,
    game_pk: str,
) -> MlbPlayerOfTheGame | None:
    cached = read_potg_cache(game_pk)
    if cached is not None:
        return cached
    try:
        # 1) Resolve Play game / contest for feedId == game_pk via games.json / contests
        # 2) GET winner payload using URL proven in Task 2
        # 3) normalize → write_potg_cache → return
        # On any failure: log warning and return None (no negative cache file)
        raise NotImplementedError("wire URLs from Task 2 probe")
    except Exception as exc:
        logger.warning("POTG fetch failed for %s: %s", game_pk, exc)
        return None
```

Replace `NotImplementedError` with the real httpx GETs from Task 2 before finishing the task. Add a unit test that mocks `client.get` to return the fixture body and asserts cache file written.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py -q`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/mlb_play/ backend/tests/test_mlb_player_of_the_game.py
git commit -m "$(cat <<'EOF'
feat(mlb): fetch and cache MLB Play Player of the Game winners

EOF
)"
```

---

### Task 4: Wire soft-merge on Final game detail

**Files:**
- Modify: `backend/app/domains/mlb/game_detail.py`
- Modify: `backend/tests/test_mlb_player_of_the_game.py`

**Interfaces:**
- Consumes: `fetch_player_of_the_game`, `attach_player_of_the_game`
- Produces: `async def _attach_player_of_the_game(detail: MlbGameDetail) -> MlbGameDetail`
- Call only when `detail.status == "final"` (same `GameStatus` literal used elsewhere)

- [ ] **Step 1: Write failing wiring test**

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.domains.mlb.game_detail import _attach_player_of_the_game
from app.domains.mlb.schemas_game_detail import MlbPlayerOfTheGame


@pytest.mark.asyncio
async def test_attach_skips_non_final(sample_live_detail):
    with patch(
        "app.domains.mlb.game_detail.fetch_player_of_the_game",
        new_callable=AsyncMock,
    ) as mocked:
        out = await _attach_player_of_the_game(sample_live_detail)
        mocked.assert_not_called()
        assert out.player_of_the_game is None


@pytest.mark.asyncio
async def test_attach_final_merges_winner(sample_final_detail):
    potg = MlbPlayerOfTheGame(
        player_id="1",
        full_name="Test Player",
        last_name="Player",
    )
    with patch(
        "app.domains.mlb.game_detail.fetch_player_of_the_game",
        new_callable=AsyncMock,
        return_value=potg,
    ):
        out = await _attach_player_of_the_game(sample_final_detail)
    assert out.player_of_the_game is not None
    assert out.player_of_the_game.full_name == "Test Player"
```

- [ ] **Step 2: Run to verify fail / then implement**

```python
async def _attach_player_of_the_game(detail: MlbGameDetail) -> MlbGameDetail:
    if detail.status != "final":
        return detail
    try:
        async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
            potg = await fetch_player_of_the_game(client, game_pk=detail.mlb_game_pk)
    except Exception as exc:
        logger.warning(
            "player of the game unavailable for %s: %s",
            detail.mlb_game_pk,
            exc,
        )
        return detail
    return attach_player_of_the_game(detail, potg)
```

Call it from `get_mlb_game_detail` after core normalize (near other soft-merges), wrapped in try/except like game leaders. Prefer after status is known; only Final pays the cost.

- [ ] **Step 3: Run tests**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py -q`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/domains/mlb/game_detail.py backend/tests/test_mlb_player_of_the_game.py
git commit -m "$(cat <<'EOF'
feat(mlb): soft-merge Player of the Game on Final game detail

EOF
)"
```

---

### Task 5: OpenAPI regen

**Files:** `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

- [ ] **Step 1:** From repo root:

```bash
PYTHONPATH=.:backend python3 scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `player_of_the_game` / `MlbPlayerOfTheGame` present in all three artifacts.

- [ ] **Step 2: Commit**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
chore(api): regenerate OpenAPI for MLB player_of_the_game

EOF
)"
```

---

### Task 6: Frontend types + mapper

**Files:**
- Modify: `frontend/src/features/mlb/lib/types.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts`
- Modify: `frontend/src/features/mlb/lib/testFixtures.ts`

**Interfaces:**
- Produces:
  - `MlbPlayerOfTheGameStat = { label: string | null; value: string }`
  - `MlbPlayerOfTheGame = { playerId: string; fullName: string; lastName: string; teamAbbrev: string | null; headshotUrl: string | null; stats: MlbPlayerOfTheGameStat[]; source: "mlb_player_of_the_game" }`
  - `MlbGameDetailView.playerOfTheGame: MlbPlayerOfTheGame | null`
  - `mapPlayerOfTheGame(raw) -> MlbPlayerOfTheGame | null`

- [ ] **Step 1: Failing mapper test**

```ts
it("maps player_of_the_game to playerOfTheGame", () => {
  const mapped = mapMlbGameDetail(
    buildApiDetail({
      player_of_the_game: {
        player_id: "592450",
        full_name: "Aaron Judge",
        last_name: "Judge",
        team_abbrev: "NYY",
        headshot_url: "https://example.test/judge.png",
        stats: [{ label: null, value: "3-4 · 2 HR · 5 RBI" }],
        source: "mlb_player_of_the_game",
      },
    }),
  );
  expect(mapped.playerOfTheGame).toEqual({
    playerId: "592450",
    fullName: "Aaron Judge",
    lastName: "Judge",
    teamAbbrev: "NYY",
    headshotUrl: "https://example.test/judge.png",
    stats: [{ label: null, value: "3-4 · 2 HR · 5 RBI" }],
    source: "mlb_player_of_the_game",
  });
});

it("maps null player_of_the_game", () => {
  const mapped = mapMlbGameDetail(buildApiDetail({ player_of_the_game: null }));
  expect(mapped.playerOfTheGame).toBeNull();
});
```

Update `buildApiDetail` / fixtures defaults: `player_of_the_game: null` / `playerOfTheGame: null`.

- [ ] **Step 2: Run to fail, then implement map**

```ts
function mapPlayerOfTheGame(
  raw: components["schemas"]["MlbPlayerOfTheGame"] | null | undefined,
): MlbPlayerOfTheGame | null {
  if (!raw) return null;
  return {
    playerId: raw.player_id,
    fullName: raw.full_name,
    lastName: raw.last_name,
    teamAbbrev: raw.team_abbrev ?? null,
    headshotUrl: raw.headshot_url ?? null,
    stats: (raw.stats ?? []).map((s) => ({
      label: s.label ?? null,
      value: s.value,
    })),
    source: "mlb_player_of_the_game",
  };
}
```

Wire `playerOfTheGame: mapPlayerOfTheGame(detail.player_of_the_game)` in `mapMlbGameDetail`.

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/mlb/lib/types.ts frontend/src/features/mlb/lib/mapMlbGameDetail.ts frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts frontend/src/features/mlb/lib/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): map player_of_the_game on game detail view

EOF
)"
```

---

### Task 7: `MlbPlayerOfTheGame` UI + wire above Play feed

**Files:**
- Create: `frontend/src/features/mlb/game/MlbPlayerOfTheGame.tsx`
- Create: `frontend/src/features/mlb/game/MlbPlayerOfTheGame.test.tsx`
- Modify: `frontend/src/features/mlb/game/MlbFinalCenter.tsx`
- Modify: `frontend/src/features/mlb/game/MlbFinalCenter.test.tsx`

**Interfaces:**
- Consumes: `detail.playerOfTheGame`
- Produces: `<MlbPlayerOfTheGame detail={detail} />` — returns `null` when payload null

- [ ] **Step 1: Failing UI tests**

```tsx
import { render, screen } from "@testing-library/react";
import { MlbPlayerOfTheGame } from "./MlbPlayerOfTheGame";
import { mlbFinalDetail } from "../lib/testFixtures";

describe("MlbPlayerOfTheGame", () => {
  it("renders nothing when playerOfTheGame is null", () => {
    const { container } = render(
      <MlbPlayerOfTheGame detail={{ ...mlbFinalDetail, playerOfTheGame: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders stacked card with title, name, and stats", () => {
    render(
      <MlbPlayerOfTheGame
        detail={{
          ...mlbFinalDetail,
          playerOfTheGame: {
            playerId: "592450",
            fullName: "Aaron Judge",
            lastName: "Judge",
            teamAbbrev: "NYY",
            headshotUrl: "https://example.test/judge.png",
            stats: [{ label: null, value: "3-4 · 2 HR · 5 RBI" }],
            source: "mlb_player_of_the_game",
          },
        }}
      />,
    );
    expect(screen.getByTestId("mlb-player-of-the-game")).toBeInTheDocument();
    expect(screen.getByText("PLAYER OF THE GAME")).toBeInTheDocument();
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("3-4 · 2 HR · 5 RBI")).toBeInTheDocument();
    expect(screen.getByTestId("mlb-player-of-the-game-headshot")).toHaveAttribute(
      "src",
      "https://example.test/judge.png",
    );
  });
});
```

Add FinalCenter test: when `playerOfTheGame` set, card appears before play feed (`mlb-player-of-the-game` then `mlb-final-play-feed` in document order).

- [ ] **Step 2: Implement component (layout B)**

```tsx
import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailView } from "../lib/types";

function PotgHeadshot({
  url,
  lastName,
}: {
  url: string | null;
  lastName: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(url) && !failed;
  const initial = (lastName.trim()[0] ?? "?").toUpperCase();
  if (show) {
    return (
      <img
        src={url!}
        alt=""
        data-testid="mlb-player-of-the-game-headshot"
        className="size-16 rounded-full bg-white/10 object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      data-testid="mlb-player-of-the-game-headshot-fallback"
      className="flex size-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white/50"
    >
      {initial}
    </span>
  );
}

export function MlbPlayerOfTheGame({ detail }: { detail: MlbGameDetailView }) {
  const potg = detail.playerOfTheGame;
  if (!potg) return null;
  const statLine = potg.stats.map((s) => s.value).filter(Boolean).join(" · ");

  return (
    <GameSection data-testid="mlb-player-of-the-game" className="w-full !p-4">
      <div className="flex flex-col items-center text-center">
        <PotgHeadshot url={potg.headshotUrl} lastName={potg.lastName} />
        <div className="mt-3 inline-block border-2 border-white px-3 py-1 text-[12px] font-extrabold tracking-wide text-white">
          PLAYER OF THE GAME
        </div>
        <div className="mt-2 text-[18px] font-semibold text-white">{potg.fullName}</div>
        {potg.teamAbbrev ? (
          <div className="mt-1 text-[14px] text-white/60">{potg.teamAbbrev}</div>
        ) : null}
        {statLine ? (
          <div
            data-testid="mlb-player-of-the-game-stats"
            className="mt-3 text-[15px] text-white/90"
          >
            {statLine}
          </div>
        ) : null}
      </div>
    </GameSection>
  );
}
```

Wire in `MlbFinalCenter.tsx` Summary left column:

```tsx
<div className="space-y-4">
  <MlbPlayerOfTheGame detail={detail} />
  <MlbFinalPlayFeed detail={detail} />
</div>
```

(Keep the left column as a single stack so POTG sits above the feed; adjust grid cell from bare `<MlbFinalPlayFeed />` to a wrapping `space-y-4` div.)

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- src/features/mlb/game/MlbPlayerOfTheGame.test.tsx src/features/mlb/game/MlbFinalCenter.test.tsx`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/mlb/game/MlbPlayerOfTheGame.tsx frontend/src/features/mlb/game/MlbPlayerOfTheGame.test.tsx frontend/src/features/mlb/game/MlbFinalCenter.tsx frontend/src/features/mlb/game/MlbFinalCenter.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): show Player of the Game above Final play feed

EOF
)"
```

---

### Task 8: Docs

**Files:**
- Modify: `md/system-design.md` (MLB game detail row — Final Summary mentions Player of the Game above Play feed when fan-vote winner available)
- Modify: `docs/superpowers/specs/2026-08-08-mlb-player-of-the-game-design.md` → Status: Implemented

- [ ] **Step 1: Edit docs**

- [ ] **Step 2: Final verify**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_player_of_the_game.py -q
cd ../frontend && npm run check:api && npm test -- \
  src/features/mlb/lib/mapMlbGameDetail.test.ts \
  src/features/mlb/game/MlbPlayerOfTheGame.test.tsx \
  src/features/mlb/game/MlbFinalCenter.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md docs/superpowers/specs/2026-08-08-mlb-player-of-the-game-design.md
git commit -m "$(cat <<'EOF'
docs(mlb): mark Final Player of the Game shipped in system-design

EOF
)"
```

---

## Spec coverage

| Requirement | Task |
| --- | --- |
| Fan-vote MLB Play source | 2–3 |
| Hybrid cache by gamePk | 3 |
| Soft-fail / hide when null | 3–4, 7 |
| Schema on game detail only | 1, 5 |
| Final-only attach | 4 |
| Stacked UI above Play feed | 7 |
| Stats from scrape only | 3, 7 |
| OpenAPI + system-design | 5, 8 |
