# MLB Projected Lineup Matchup UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Preview projected lineups to the mock (SP season card + career BvP table) by enriching one RotoWire matchup via `GET /api/mlb/lineups/matchup` and MLB Stats API.

**Architecture:** Keep `GET /api/mlb/lineups` as the completeness gate. Add a matchup endpoint that reuses the cached RotoWire slate, resolves MLBAM IDs, fetches SP season pitching + each batter’s career `vsPlayerTotal` vs the opposing SP, and returns one enriched game. Frontend fetches matchup when the slate match is complete and renders the new layout; soft-fail shows RotoWire names with `–` stats.

**Tech Stack:** FastAPI/Pydantic/httpx, pytest, React/TypeScript, TanStack Query, Vitest/RTL, openapi-typescript

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-mlb-projected-lineup-matchup-ui-design.md`
- Parent: `docs/superpowers/specs/2026-08-04-mlb-rotowire-projected-lineups-design.md`
- RotoWire = who is in the lineup; Stats API = season SP + career BvP only
- Selected team SP card + batters H2H vs opposing SP
- Missing ID/H2H → `–` (never invent `.000`); incomplete RotoWire → **Lineups unavailable**
- Soft failure preferred over 502 for Preview
- Brand: **statvista** in any new product copy
- Update `md/system-design.md` when the matchup route lands

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/schemas/mlb_lineups.py` | Additive matchup models (`vs_pitcher`, season pitcher fields, matchup response) |
| `backend/app/services/mlb_stats_people.py` | People search + season pitching + vsPlayerTotal helpers |
| `backend/app/services/mlb_lineup_matchup.py` | Matchup orchestration + cache |
| `backend/app/api/routes/mlb_lineups.py` | Add `GET /api/mlb/lineups/matchup` |
| `backend/app/openapi_export.py` | Require `/api/mlb/lineups` + `/api/mlb/lineups/matchup` |
| `backend/tests/test_mlb_stats_people.py` | Helper unit tests (mocked httpx) |
| `backend/tests/test_mlb_lineup_matchup.py` | Enrichment + soft-fail + cache |
| `backend/tests/test_mlb_lineups_route.py` | Route tests for matchup |
| `frontend/openapi.json` + `api.schema.d.ts` | Regenerated |
| `frontend/src/lib/api.ts` | `fetchMlbLineupMatchup` |
| `frontend/src/hooks/useMlbLineupMatchup.ts` | Query hook |
| `frontend/src/components/mlb/MlbProjectedLineups.tsx` | Mock layout |
| `frontend/src/components/mlb/MlbPregameCenter.tsx` | Wire matchup when slate complete |
| `md/system-design.md` | Page ↔ API row |

---

### Task 1: Matchup Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/mlb_lineups.py`
- Test: `backend/tests/test_mlb_lineup_schemas.py` (create)

**Interfaces:**
- Produces:
  - `MlbVsPitcherStats(ab: int | None, h: int | None, hr: int | None, avg: str | None)`
  - `MlbLineupMatchupPitcher` — extends lineup pitcher fields with optional `mlbam_id`, `wins`, `losses`, `era`, `innings_pitched`, `strikeouts`, `whip` (keep `name`, `hand`; `record` optional/unused on card)
  - `MlbLineupMatchupBatter` — `order`, `position`, `name`, `hand`, optional `mlbam_id`, optional `vs_pitcher: MlbVsPitcherStats | None`
  - `MlbLineupMatchupSide(pitcher, batters)`
  - `MlbLineupMatchupResponse(date, away_abbrev: str | None, home_abbrev: str | None, status: str | None, away: MlbLineupMatchupSide | None, home: MlbLineupMatchupSide | None, source: str = "rotowire+statsapi", fetched_at: str)`

- [ ] **Step 1: Write failing schema smoke test**

```python
from app.schemas.mlb_lineups import (
    MlbLineupMatchupBatter,
    MlbLineupMatchupPitcher,
    MlbLineupMatchupResponse,
    MlbLineupMatchupSide,
    MlbVsPitcherStats,
)


def test_matchup_response_round_trip():
    side = MlbLineupMatchupSide(
        pitcher=MlbLineupMatchupPitcher(
            name="Zack Littell",
            hand="R",
            mlbam_id=641793,
            wins=7,
            losses=8,
            era="4.97",
            innings_pitched="112.1",
            strikeouts=70,
            whip="1.34",
        ),
        batters=[
            MlbLineupMatchupBatter(
                order=1,
                position="RF",
                name="James Wood",
                hand="L",
                mlbam_id=695578,
                vs_pitcher=MlbVsPitcherStats(ab=10, h=3, hr=0, avg=".300"),
            )
        ],
    )
    body = MlbLineupMatchupResponse(
        date="2026-08-04",
        away_abbrev="WSH",
        home_abbrev="SF",
        status="expected",
        away=side,
        home=None,
        fetched_at="2026-08-04T17:00:00+00:00",
    )
    dumped = body.model_dump()
    assert dumped["away"]["pitcher"]["whip"] == "1.34"
    assert dumped["away"]["batters"][0]["vs_pitcher"]["ab"] == 10
    assert dumped["source"] == "rotowire+statsapi"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mlb_lineup_schemas.py -v`  
Expected: FAIL (import / class missing)

- [ ] **Step 3: Add models to `mlb_lineups.py`**

Append (keep existing lineup slate models unchanged):

```python
class MlbVsPitcherStats(BaseModel):
    model_config = _RESPONSE_CONFIG

    ab: int | None = None
    h: int | None = None
    hr: int | None = None
    avg: str | None = None


class MlbLineupMatchupPitcher(BaseModel):
    model_config = _RESPONSE_CONFIG

    name: str | None = None
    hand: str | None = None
    mlbam_id: int | None = None
    wins: int | None = None
    losses: int | None = None
    era: str | None = None
    innings_pitched: str | None = None
    strikeouts: int | None = None
    whip: str | None = None


class MlbLineupMatchupBatter(BaseModel):
    model_config = _RESPONSE_CONFIG

    order: int
    position: str | None = None
    name: str | None = None
    hand: str | None = None
    mlbam_id: int | None = None
    vs_pitcher: MlbVsPitcherStats | None = None


class MlbLineupMatchupSide(BaseModel):
    model_config = _RESPONSE_CONFIG

    pitcher: MlbLineupMatchupPitcher
    batters: list[MlbLineupMatchupBatter]


class MlbLineupMatchupResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    date: str = Field(description="YYYY-MM-DD in America/New_York")
    away_abbrev: str | None = None
    home_abbrev: str | None = None
    status: str | None = None
    away: MlbLineupMatchupSide | None = None
    home: MlbLineupMatchupSide | None = None
    source: str = "rotowire+statsapi"
    fetched_at: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_mlb_lineup_schemas.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/mlb_lineups.py backend/tests/test_mlb_lineup_schemas.py
git commit -m "$(cat <<'EOF'
Add MLB lineup matchup response schemas for Stats API enrichment.

EOF
)"
```

---

### Task 2: Stats API people helpers

**Files:**
- Create: `backend/app/services/mlb_stats_people.py`
- Create: `backend/tests/test_mlb_stats_people.py`

**Interfaces:**
- Produces (async, httpx):
  - `STATS_BASE = "https://statsapi.mlb.com/api/v1"`
  - `async def search_person_id(client, name: str) -> int | None`
  - `async def fetch_season_pitching(client, person_id: int, season: int) -> dict`  
    keys: `wins`, `losses`, `era`, `innings_pitched`, `strikeouts`, `whip` (values may be None)
  - `async def fetch_vs_pitcher_total(client, batter_id: int, pitcher_id: int) -> dict | None`  
    keys: `ab`, `h`, `hr`, `avg` — return `None` if no splits
  - `def pick_best_person(people: list[dict], query: str) -> dict | None` — prefer `active` + closest `fullName`

- [ ] **Step 1: Write failing helper tests**

```python
import pytest
from app.services.mlb_stats_people import (
    fetch_season_pitching,
    fetch_vs_pitcher_total,
    pick_best_person,
    search_person_id,
)


def test_pick_best_person_prefers_active_exact():
    people = [
        {"id": 1, "fullName": "James Wood", "active": False},
        {"id": 695578, "fullName": "James Wood", "active": True},
    ]
    assert pick_best_person(people, "James Wood")["id"] == 695578


@pytest.mark.asyncio
async def test_search_person_id_reads_people(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"people": [{"id": 641793, "fullName": "Zack Littell", "active": True}]}

    class FakeClient:
        async def get(self, url, params=None):
            assert "people/search" in url
            return FakeResp()

    assert await search_person_id(FakeClient(), "Zack Littell") == 641793


@pytest.mark.asyncio
async def test_fetch_season_pitching_maps_fields():
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "stats": [
                    {
                        "splits": [
                            {
                                "stat": {
                                    "wins": 7,
                                    "losses": 8,
                                    "era": "4.97",
                                    "inningsPitched": "112.1",
                                    "strikeOuts": 70,
                                    "whip": "1.34",
                                }
                            }
                        ]
                    }
                ]
            }

    class FakeClient:
        async def get(self, url, params=None):
            return FakeResp()

    stats = await fetch_season_pitching(FakeClient(), 641793, 2026)
    assert stats["wins"] == 7
    assert stats["innings_pitched"] == "112.1"
    assert stats["strikeouts"] == 70


@pytest.mark.asyncio
async def test_fetch_vs_pitcher_total_empty_splits_returns_none():
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"stats": [{"splits": []}]}

    class FakeClient:
        async def get(self, url, params=None):
            return FakeResp()

    assert await fetch_vs_pitcher_total(FakeClient(), 1, 2) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_mlb_stats_people.py -v`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `mlb_stats_people.py`**

```python
"""MLB Stats API helpers for person search and matchup stats."""

from __future__ import annotations

import logging
import unicodedata
from typing import Any

import httpx

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
STATS_TIMEOUT_SECONDS = 10.0


def _norm_name(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(ascii_only.lower().split())


def pick_best_person(people: list[dict], query: str) -> dict | None:
    if not people:
        return None
    q = _norm_name(query)

    def score(p: dict) -> tuple:
        name = _norm_name(str(p.get("fullName") or ""))
        exact = 0 if name == q else 1
        active = 0 if p.get("active") else 1
        return (exact, active, name)

    return sorted(people, key=score)[0]


async def search_person_id(client: httpx.AsyncClient, name: str) -> int | None:
    if not name or not name.strip():
        return None
    try:
        res = await client.get(
            f"{STATS_BASE}/people/search",
            params={"names": name.strip(), "sportIds": 1},
        )
        res.raise_for_status()
        people = res.json().get("people") or []
        best = pick_best_person(people, name)
        return int(best["id"]) if best and best.get("id") is not None else None
    except Exception as exc:
        logger.warning("people search failed for %r: %s", name, exc)
        return None


async def fetch_season_pitching(
    client: httpx.AsyncClient, person_id: int, season: int
) -> dict[str, Any]:
    empty = {
        "wins": None,
        "losses": None,
        "era": None,
        "innings_pitched": None,
        "strikeouts": None,
        "whip": None,
    }
    try:
        res = await client.get(
            f"{STATS_BASE}/people/{person_id}/stats",
            params={
                "stats": "season",
                "group": "pitching",
                "season": season,
                "sportId": 1,
            },
        )
        res.raise_for_status()
        splits = (res.json().get("stats") or [{}])[0].get("splits") or []
        if not splits:
            return empty
        st = splits[0].get("stat") or {}
        return {
            "wins": st.get("wins"),
            "losses": st.get("losses"),
            "era": st.get("era"),
            "innings_pitched": st.get("inningsPitched"),
            "strikeouts": st.get("strikeOuts"),
            "whip": st.get("whip"),
        }
    except Exception as exc:
        logger.warning("season pitching failed for %s: %s", person_id, exc)
        return empty


async def fetch_vs_pitcher_total(
    client: httpx.AsyncClient, batter_id: int, pitcher_id: int
) -> dict[str, Any] | None:
    try:
        res = await client.get(
            f"{STATS_BASE}/people/{batter_id}/stats",
            params={
                "stats": "vsPlayerTotal",
                "group": "hitting",
                "opposingPlayerId": pitcher_id,
                "sportId": 1,
            },
        )
        res.raise_for_status()
        splits = (res.json().get("stats") or [{}])[0].get("splits") or []
        if not splits:
            return None
        st = splits[0].get("stat") or {}
        return {
            "ab": st.get("atBats"),
            "h": st.get("hits"),
            "hr": st.get("homeRuns"),
            "avg": st.get("avg"),
        }
    except Exception as exc:
        logger.warning(
            "vsPlayerTotal failed batter=%s pitcher=%s: %s",
            batter_id,
            pitcher_id,
            exc,
        )
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_mlb_stats_people.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mlb_stats_people.py backend/tests/test_mlb_stats_people.py
git commit -m "$(cat <<'EOF'
Add Stats API helpers for person search, season pitching, and BvP.

EOF
)"
```

---

### Task 3: Matchup enrichment service

**Files:**
- Create: `backend/app/services/mlb_lineup_matchup.py`
- Create: `backend/tests/test_mlb_lineup_matchup.py`

**Interfaces:**
- Consumes: `get_mlb_lineups` from `mlb_lineups`; helpers from `mlb_stats_people`; schemas from Task 1
- Produces:
  - `clear_mlb_lineup_matchup_cache() -> None`
  - `async def get_mlb_lineup_matchup(date_et: str, away: str, home: str) -> MlbLineupMatchupResponse`
  - Cache key: `f"{date_et}|{away.upper()}|{home.upper()}"`, TTL 180s
  - On no slate game: response with `away=None`, `home=None`, abbrevs still set from query
  - Parallelize ID resolve + stats with `asyncio.gather` where safe

- [ ] **Step 1: Write failing service tests**

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.schemas.mlb_lineups import (
    MlbLineupBatter,
    MlbLineupGame,
    MlbLineupPitcher,
    MlbLineupSide,
    MlbLineupsResponse,
)
from app.services.mlb_lineup_matchup import (
    clear_mlb_lineup_matchup_cache,
    get_mlb_lineup_matchup,
)


def _slate_game() -> MlbLineupGame:
    batters = [
        MlbLineupBatter(order=i, position="RF", name=f"Batter {i}", hand="R")
        for i in range(1, 10)
    ]
    return MlbLineupGame(
        away_abbrev="WSH",
        home_abbrev="SF",
        status="expected",
        away=MlbLineupSide(
            pitcher=MlbLineupPitcher(name="Zack Littell", hand="R"),
            batters=batters,
        ),
        home=MlbLineupSide(
            pitcher=MlbLineupPitcher(name="Jesus Luzardo", hand="L"),
            batters=batters,
        ),
    )


@pytest.fixture(autouse=True)
def _clear():
    clear_mlb_lineup_matchup_cache()
    yield
    clear_mlb_lineup_matchup_cache()


@pytest.mark.asyncio
async def test_matchup_enriches_pitcher_and_bvp():
    slate = MlbLineupsResponse(
        date="2026-08-04",
        games=[_slate_game()],
        source="rotowire",
        fetched_at="2026-08-04T17:00:00+00:00",
    )

    async def fake_search(client, name):
        return {
            "Zack Littell": 641793,
            "Jesus Luzardo": 666200,
            "Batter 1": 695578,
        }.get(name)

    async def fake_season(client, person_id, season):
        return {
            "wins": 7,
            "losses": 8,
            "era": "4.97",
            "innings_pitched": "112.1",
            "strikeouts": 70,
            "whip": "1.34",
        }

    async def fake_vs(client, batter_id, pitcher_id):
        if batter_id == 695578 and pitcher_id == 666200:
            return {"ab": 10, "h": 3, "hr": 0, "avg": ".300"}
        return None

    with (
        patch(
            "app.services.mlb_lineup_matchup.get_mlb_lineups",
            AsyncMock(return_value=slate),
        ),
        patch(
            "app.services.mlb_lineup_matchup.search_person_id",
            side_effect=fake_search,
        ),
        patch(
            "app.services.mlb_lineup_matchup.fetch_season_pitching",
            side_effect=fake_season,
        ),
        patch(
            "app.services.mlb_lineup_matchup.fetch_vs_pitcher_total",
            side_effect=fake_vs,
        ),
        patch("app.services.mlb_lineup_matchup.httpx.AsyncClient") as client_cls,
    ):
        client_cls.return_value.__aenter__.return_value = object()
        result = await get_mlb_lineup_matchup("2026-08-04", "wsh", "sf")

    assert result.away is not None
    assert result.away.pitcher.mlbam_id == 641793
    assert result.away.pitcher.whip == "1.34"
    assert result.away.batters[0].vs_pitcher is not None
    assert result.away.batters[0].vs_pitcher.ab == 10
    assert result.source == "rotowire+statsapi"


@pytest.mark.asyncio
async def test_matchup_no_game_returns_null_sides():
    empty = MlbLineupsResponse(
        date="2026-08-04",
        games=[],
        source="rotowire",
        fetched_at="2026-08-04T17:00:00+00:00",
    )
    with patch(
        "app.services.mlb_lineup_matchup.get_mlb_lineups",
        AsyncMock(return_value=empty),
    ):
        result = await get_mlb_lineup_matchup("2026-08-04", "WSH", "SF")
    assert result.away is None
    assert result.home is None
    assert result.away_abbrev == "WSH"
    assert result.home_abbrev == "SF"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_mlb_lineup_matchup.py -v`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `mlb_lineup_matchup.py`**

```python
"""Enrich one RotoWire matchup with Stats API season SP + career BvP."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

from app.schemas.mlb_lineups import (
    MlbLineupBatter,
    MlbLineupGame,
    MlbLineupMatchupBatter,
    MlbLineupMatchupPitcher,
    MlbLineupMatchupResponse,
    MlbLineupMatchupSide,
    MlbLineupPitcher,
    MlbVsPitcherStats,
)
from app.services.mlb_lineups import get_mlb_lineups
from app.services.mlb_stats_people import (
    STATS_TIMEOUT_SECONDS,
    fetch_season_pitching,
    fetch_vs_pitcher_total,
    search_person_id,
)

logger = logging.getLogger(__name__)

MATCHUP_TTL_SECONDS = 180
_cache: dict[str, dict] = {}


def clear_mlb_lineup_matchup_cache() -> None:
    _cache.clear()


def _cache_key(date_et: str, away: str, home: str) -> str:
    return f"{date_et}|{away.upper()}|{home.upper()}"


def _find_game(
    games: list[MlbLineupGame], away: str, home: str
) -> MlbLineupGame | None:
    a, h = away.upper(), home.upper()
    for g in games:
        if g.away_abbrev.upper() == a and g.home_abbrev.upper() == h:
            return g
    return None


async def _enrich_pitcher(
    client: httpx.AsyncClient, pitcher: MlbLineupPitcher, season: int
) -> MlbLineupMatchupPitcher:
    mlbam_id = await search_person_id(client, pitcher.name or "")
    season_stats = (
        await fetch_season_pitching(client, mlbam_id, season)
        if mlbam_id is not None
        else {}
    )
    return MlbLineupMatchupPitcher(
        name=pitcher.name,
        hand=pitcher.hand,
        mlbam_id=mlbam_id,
        wins=season_stats.get("wins"),
        losses=season_stats.get("losses"),
        era=season_stats.get("era"),
        innings_pitched=season_stats.get("innings_pitched"),
        strikeouts=season_stats.get("strikeouts"),
        whip=season_stats.get("whip"),
    )


async def _enrich_batter(
    client: httpx.AsyncClient,
    batter: MlbLineupBatter,
    opposing_pitcher_id: int | None,
) -> MlbLineupMatchupBatter:
    mlbam_id = await search_person_id(client, batter.name or "")
    vs = None
    if mlbam_id is not None and opposing_pitcher_id is not None:
        raw = await fetch_vs_pitcher_total(client, mlbam_id, opposing_pitcher_id)
        if raw is not None:
            vs = MlbVsPitcherStats(
                ab=raw.get("ab"),
                h=raw.get("h"),
                hr=raw.get("hr"),
                avg=raw.get("avg"),
            )
    return MlbLineupMatchupBatter(
        order=batter.order,
        position=batter.position,
        name=batter.name,
        hand=batter.hand,
        mlbam_id=mlbam_id,
        vs_pitcher=vs,
    )


async def _enrich_side(
    client: httpx.AsyncClient,
    side_pitcher: MlbLineupPitcher,
    side_batters: list[MlbLineupBatter],
    opposing_pitcher_id: int | None,
    season: int,
) -> MlbLineupMatchupSide:
    pitcher = await _enrich_pitcher(client, side_pitcher, season)
    batters = await asyncio.gather(
        *[
            _enrich_batter(client, b, opposing_pitcher_id)
            for b in side_batters
        ]
    )
    return MlbLineupMatchupSide(pitcher=pitcher, batters=list(batters))


async def get_mlb_lineup_matchup(
    date_et: str, away: str, home: str
) -> MlbLineupMatchupResponse:
    key = _cache_key(date_et, away, home)
    entry = _cache.get(key)
    if entry and time.time() < float(entry.get("expires_at") or 0):
        return entry["response"]

    fetched_at = datetime.now(timezone.utc).isoformat()
    season = int(date_et[:4])
    empty = MlbLineupMatchupResponse(
        date=date_et,
        away_abbrev=away.upper(),
        home_abbrev=home.upper(),
        status=None,
        away=None,
        home=None,
        fetched_at=fetched_at,
    )

    try:
        slate = await get_mlb_lineups(date_et)
    except Exception as exc:
        logger.warning("matchup slate fetch failed: %s", exc)
        return empty

    game = _find_game(slate.games, away, home)
    if game is None:
        return empty

    try:
        async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
            away_sp_id = await search_person_id(
                client, game.away.pitcher.name or ""
            )
            home_sp_id = await search_person_id(
                client, game.home.pitcher.name or ""
            )
            away_side, home_side = await asyncio.gather(
                _enrich_side(
                    client,
                    game.away.pitcher,
                    game.away.batters,
                    home_sp_id,
                    season,
                ),
                _enrich_side(
                    client,
                    game.home.pitcher,
                    game.home.batters,
                    away_sp_id,
                    season,
                ),
            )
            # Re-apply SP ids/stats already fetched inside _enrich_side
            response = MlbLineupMatchupResponse(
                date=date_et,
                away_abbrev=game.away_abbrev,
                home_abbrev=game.home_abbrev,
                status=game.status,
                away=away_side,
                home=home_side,
                fetched_at=fetched_at,
            )
    except Exception as exc:
        logger.warning("matchup enrichment failed: %s", exc)
        return empty

    _cache[key] = {
        "response": response,
        "expires_at": time.time() + MATCHUP_TTL_SECONDS,
    }
    return response
```

Note: `_enrich_side` searches the SP again inside `_enrich_pitcher` after the pre-pass IDs — acceptable for clarity; optional follow-up can pass resolved IDs to avoid duplicate search. Keep duplicate search for v1 unless tests require otherwise.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_mlb_lineup_matchup.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/mlb_lineup_matchup.py backend/tests/test_mlb_lineup_matchup.py
git commit -m "$(cat <<'EOF'
Add MLB lineup matchup enrichment service with soft Stats API lookups.

EOF
)"
```

---

### Task 4: Matchup route + OpenAPI required path

**Files:**
- Modify: `backend/app/api/routes/mlb_lineups.py`
- Modify: `backend/app/openapi_export.py` — add `/api/mlb/lineups` and `/api/mlb/lineups/matchup` to `REQUIRED_MLB_PATHS`
- Modify: `backend/tests/test_mlb_lineups_route.py`
- Modify: `backend/tests/test_export_openapi.py` if it asserts the required path list length/contents

**Interfaces:**
- Produces: `GET /api/mlb/lineups/matchup?date=&away=&home=` → `MlbLineupMatchupResponse`
- Query validation: `date` `YYYY-MM-DD`; `away`/`home` required non-empty strings

- [ ] **Step 1: Write failing route test**

```python
def test_matchup_requires_params(client):
    assert client.get("/api/mlb/lineups/matchup").status_code == 422


def test_matchup_returns_enriched_payload(monkeypatch, client):
    from app.schemas.mlb_lineups import MlbLineupMatchupResponse

    async def fake_matchup(date_et, away, home):
        return MlbLineupMatchupResponse(
            date=date_et,
            away_abbrev=away.upper(),
            home_abbrev=home.upper(),
            status="expected",
            away=None,
            home=None,
            fetched_at="2026-08-04T17:00:00+00:00",
        )

    with patch(
        "app.api.routes.mlb_lineups.get_mlb_lineup_matchup",
        side_effect=fake_matchup,
    ):
        res = client.get(
            "/api/mlb/lineups/matchup?date=2026-08-04&away=WSH&home=SF"
        )
    assert res.status_code == 200
    assert res.json()["source"] == "rotowire+statsapi"
    assert res.json()["away_abbrev"] == "WSH"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_mlb_lineups_route.py::test_matchup_requires_params tests/test_mlb_lineups_route.py::test_matchup_returns_enriched_payload -v`  
Expected: FAIL (404 / missing)

- [ ] **Step 3: Add route**

```python
from app.schemas.mlb_lineups import MlbLineupMatchupResponse, MlbLineupsResponse
from app.services.mlb_lineup_matchup import get_mlb_lineup_matchup
from app.services.mlb_lineups import get_mlb_lineups


@router.get("/mlb/lineups/matchup", response_model=MlbLineupMatchupResponse)
async def mlb_lineups_matchup(
    response: Response,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    away: str = Query(..., min_length=1),
    home: str = Query(..., min_length=1),
) -> MlbLineupMatchupResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        Date.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid date") from exc
    return await get_mlb_lineup_matchup(date, away.strip(), home.strip())
```

Update `REQUIRED_MLB_PATHS` in `openapi_export.py`:

```python
REQUIRED_MLB_PATHS = (
    "/api/mlb/scoreboard/today",
    "/api/mlb/scoreboard",
    "/api/mlb/odds/today",
    "/api/mlb/games/{game_pk}",
    "/api/mlb/lineups",
    "/api/mlb/lineups/matchup",
)
```

- [ ] **Step 4: Run route + openapi tests**

Run: `cd backend && python -m pytest tests/test_mlb_lineups_route.py tests/test_export_openapi.py -v`  
Expected: PASS

- [ ] **Step 5: Export OpenAPI + generate frontend types**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && python scripts/export_openapi.py
cd frontend && npm run generate:api
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/mlb_lineups.py backend/app/openapi_export.py \
  backend/tests/test_mlb_lineups_route.py backend/tests/test_export_openapi.py \
  frontend/openapi.json frontend/src/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
Expose GET /api/mlb/lineups/matchup and regenerate OpenAPI types.

EOF
)"
```

---

### Task 5: Frontend API client + hook

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useMlbLineupMatchup.ts`
- Create: `frontend/src/hooks/useMlbLineupMatchup.test.tsx`

**Interfaces:**
- Produces:
  - `export type ApiMlbLineupMatchupResponse = Schemas["MlbLineupMatchupResponse"]` (and related types if useful)
  - `fetchMlbLineupMatchup(dateEt, away, home): Promise<ApiMlbLineupMatchupResponse>`
  - `useMlbLineupMatchup({ dateEt, away, home, enabled })` — queryKey `["mlb","lineups","matchup", dateEt, away, home]`

- [ ] **Step 1: Write failing hook test**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMlbLineupMatchup } from "./useMlbLineupMatchup";

vi.mock("@/lib/api", () => ({
  fetchMlbLineupMatchup: vi.fn(async () => ({
    date: "2026-08-04",
    away_abbrev: "WSH",
    home_abbrev: "SF",
    status: "expected",
    away: null,
    home: null,
    source: "rotowire+statsapi",
    fetched_at: "2026-08-04T17:00:00+00:00",
  })),
}));

describe("useMlbLineupMatchup", () => {
  it("fetches when enabled", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useMlbLineupMatchup({
          dateEt: "2026-08-04",
          away: "WSH",
          home: "SF",
          enabled: true,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.away_abbrev).toBe("WSH");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/hooks/useMlbLineupMatchup.test.tsx`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `fetchMlbLineupMatchup` + hook**

```typescript
export async function fetchMlbLineupMatchup(
  dateEt: string,
  away: string,
  home: string,
): Promise<ApiMlbLineupMatchupResponse> {
  const qs = new URLSearchParams({
    date: dateEt,
    away,
    home,
  });
  const res = await fetch(`${API_BASE}/api/mlb/lineups/matchup?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB lineup matchup request failed: ${res.status}`);
  }
  return res.json();
}
```

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchMlbLineupMatchup } from "@/lib/api";

export function useMlbLineupMatchup(args: {
  dateEt: string | null | undefined;
  away: string | null | undefined;
  home: string | null | undefined;
  enabled?: boolean;
}) {
  const { dateEt, away, home, enabled = true } = args;
  return useQuery({
    queryKey: ["mlb", "lineups", "matchup", dateEt, away, home],
    queryFn: () => fetchMlbLineupMatchup(dateEt!, away!, home!),
    enabled: Boolean(enabled && dateEt && away && home),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/hooks/useMlbLineupMatchup.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useMlbLineupMatchup.ts \
  frontend/src/hooks/useMlbLineupMatchup.test.tsx
git commit -m "$(cat <<'EOF'
Add frontend client and hook for MLB lineup matchup enrichment.

EOF
)"
```

---

### Task 6: Restyle `MlbProjectedLineups` to the mock

**Files:**
- Modify: `frontend/src/components/mlb/MlbProjectedLineups.tsx`
- Modify: `frontend/src/components/mlb/MlbProjectedLineups.test.tsx`

**Interfaces:**
- Consumes: existing `game: ApiMlbLineupGame | null` for unavailable/pending gate; optional `matchup: ApiMlbLineupMatchupResponse | null` for enriched sides
- Prefer matchup side when present; fall back to slate `game` side with `–` stats
- Display helpers:
  - `formatPitcherTitle(hand, name)` → `RHP Zack Littell`
  - `formatStat(value)` → string or `–`
  - `formatAvg(avg)` → as returned or `–`

- [ ] **Step 1: Update failing UI tests**

Replace/extend tests so they assert:

```tsx
it("renders pitcher season card and vs-pitcher table", () => {
  render(
    <MlbProjectedLineups
      detail={mlbScheduledDetail}
      game={lineupGame}
      matchup={enrichedMatchup}
    />,
  );
  expect(screen.getByText(/LHP MacKenzie Gore|RHP|LHP/i)).toBeInTheDocument();
  expect(screen.getByText(/Lineup vs/i)).toBeInTheDocument();
  expect(screen.getByText("W-L")).toBeInTheDocument();
  expect(screen.getByText("AB")).toBeInTheDocument();
  expect(screen.getByText("AVG")).toBeInTheDocument();
});

it("shows dashes when vs_pitcher missing", () => {
  // matchup batter without vs_pitcher → multiple – cells
});
```

Build `enrichedMatchup` fixture mirroring schema with away/home sides.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/components/mlb/MlbProjectedLineups.test.tsx`  
Expected: FAIL on new assertions

- [ ] **Step 3: Implement mock layout**

Structure inside `GameSection`:

1. Title + logo toggles (unchanged)
2. Pending / unavailable (unchanged)
3. Else: pitcher card (border `border-white/10`, rounded, padded) with title + 5-stat grid
4. `Lineup vs {opposingPitcherName}` muted text
5. Table header `# Batter Pos AB H HR AVG` + rows

Use opposing side from the same matchup/game object: if viewing away, opposing pitcher is `home.pitcher`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/components/mlb/MlbProjectedLineups.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbProjectedLineups.tsx \
  frontend/src/components/mlb/MlbProjectedLineups.test.tsx
git commit -m "$(cat <<'EOF'
Restyle MLB projected lineups to pitcher card and career BvP table.

EOF
)"
```

---

### Task 7: Wire PregameCenter + system-design

**Files:**
- Modify: `frontend/src/components/mlb/MlbPregameCenter.tsx`
- Modify: `frontend/src/components/mlb/MlbPregameCenter.test.tsx`
- Modify: `md/system-design.md` (MLB game detail row)

**Interfaces:**
- When `matchedGame` non-null and Preview active, call `useMlbLineupMatchup({ dateEt: detail.gameDate, away: detail.away.abbrev, home: detail.home.abbrev, enabled: true })`
- Pass `matchup={matchupQuery.data ?? null}` into `MlbProjectedLineups`
- Pending: slate pending OR (matched && matchup pending with no data) may show loading — prefer: show slate structure only after matchup settles **or** show names immediately from slate while matchup loads. Spec: soft-fail → show RotoWire with `–`. So: if matched, render with `game={matchedGame}` and `matchup={data}` even while matchup isPending (stats as `–` until data arrives).

- [ ] **Step 1: Extend PregameCenter test**

Assert matchup hook is used / enriched pitcher whip appears when matchup mock returns data (mock `@/hooks/useMlbLineupMatchup`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/mlb/MlbPregameCenter.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Wire hook + update system-design row**

Update the `/mlb/games/:gamePk` table cell to include `useMlbLineupMatchup` and `GET /api/mlb/lineups/matchup?date=&away=&home=` and note Stats API season + career BvP enrichment.

- [ ] **Step 4: Run frontend tests for pregame + lineups**

Run: `cd frontend && npm test -- src/components/mlb/MlbPregameCenter.test.tsx src/components/mlb/MlbProjectedLineups.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbPregameCenter.tsx \
  frontend/src/components/mlb/MlbPregameCenter.test.tsx \
  md/system-design.md
git commit -m "$(cat <<'EOF'
Wire lineup matchup enrichment into MLB Preview and document the API.

EOF
)"
```

---

## Self-Review

| Spec requirement | Task |
| --- | --- |
| Mock layout (SP card + BvP table) | 6 |
| Career `vsPlayerTotal` | 2, 3 |
| Season SP W-L/ERA/IP/K/WHIP | 2, 3 |
| Selected SP + H2H vs opposing SP | 3, 6 |
| Dedicated matchup endpoint | 3, 4 |
| Soft-fail `–` / unavailable gate | 3, 6, 7 |
| OpenAPI + system-design | 4, 7 |
| Logo toggle / RotoWire who | 6, 7 (unchanged gate) |

No intentional placeholders left. Types use `MlbLineupMatchup*` consistently across tasks.
