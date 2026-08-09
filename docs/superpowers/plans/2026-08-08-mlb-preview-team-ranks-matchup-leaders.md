# MLB Preview Team Ranks & Matchup Leaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On MLB game Preview, show league `#N` beside existing Team Stats values, and add a Matchup Leaders box under Matchup prediction (up to 3 active-roster players from the league top 10 for HR/AVG/OPS/ERA/SO/WHIP).

**Architecture:** Extend `GET /api/mlb/games/{gamePk}` only. Prefer league-wide `/teams/stats` for season values + competition ranks on `season_team_stats`; fall back to today’s per-team fetch with null ranks. Soft-attach `matchup_leaders` from active rosters ∩ cached-style league `/stats` boards (reuse `mlb/leaders.py` fetch/normalize patterns). Frontend maps new fields and renders ranks + a tabbed `MlbMatchupLeaders` in the Preview right rail.

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React 19 · TypeScript · Vite · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-mlb-preview-team-ranks-matchup-leaders-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- No new public API routes
- Soft-fail enrichments; never fail game detail
- Team Stats ranks: competition ranking (ties share, next skips); lower-better ERA/BB
- Leaders categories fixed: HR, AVG, OPS, ERA, SO, WHIP; limit 10 board → intersect roster → top 3
- Always emit all six categories when `matchup_leaders` is non-null
- Right column order: Odds → Game Info → Matchup prediction → Matchup Leaders
- OpenAPI must stay in sync (`python scripts/export_openapi.py` + `npm run generate:api` + golden copy)
- Verify backend (after relevant tasks): `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_season_team_stats.py tests/test_mlb_matchup_leaders.py tests/test_mlb_game_detail_season_injuries.py -q`
- Verify frontend: targeted Vitest + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_detail.py` | Rank fields on `MlbSeasonTeamStatLine`; `MlbMatchupLeader*` models + `matchup_leaders` on detail |
| `backend/app/domains/mlb/schemas.py` | Re-exports |
| `backend/app/providers/mlb_stats/team_season.py` | League `/teams/stats` fetch, competition ranks, pair builder with fallback |
| `backend/app/providers/mlb_stats/roster.py` | Active roster person-id sets (cached) |
| `backend/app/providers/mlb_stats/matchup_leaders.py` | Build `MlbMatchupLeaders` from boards ∩ rosters |
| `backend/app/domains/mlb/game_detail.py` | Soft-attach matchup leaders on scheduled games |
| `backend/tests/test_mlb_season_team_stats.py` | Rank + league-path tests |
| `backend/tests/test_mlb_matchup_leaders.py` | Roster + intersect + soft-fail tests |
| `backend/tests/test_mlb_game_detail_season_injuries.py` | Attach helper coverage |
| `backend/openapi-golden.json` / `frontend/openapi.json` / `api.schema.d.ts` | Contract |
| `frontend/src/features/mlb/lib/types.ts` | View types |
| `frontend/src/features/mlb/lib/mapMlbGameDetail.ts` (+ test) | Mapping |
| `frontend/src/features/mlb/lib/testFixtures.ts` | Defaults |
| `frontend/src/features/mlb/game/MlbSeasonTeamStats.tsx` (+ test) | Rank UI |
| `frontend/src/features/mlb/game/MlbMatchupLeaders.tsx` (+ test) | New box |
| `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` (+ test) | Wire under Matchup prediction |
| `md/system-design.md` | Preview rail note |
| Spec status → Implemented | After ship |

---

### Task 1: Backend schemas — ranks + matchup leaders

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Modify: `backend/tests/test_mlb_game_detail_season_injuries.py`

**Interfaces:**
- Produces:
  - On `MlbSeasonTeamStatLine`: optional `hr_rank`, `r_rank`, `h_rank`, `avg_rank`, `obp_rank`, `slg_rank`, `era_rank`, `so_rank`, `bb_rank: int | None = None`
  - `MlbMatchupLeaderEntry(rank: int, player_id: str, name: str, team_abbrev: str, side: Literal["away","home"], value: str)`
  - `MlbMatchupLeaderCategory(key: Literal["hr","avg","ops","era","so","whip"], label: str, leaders: list[MlbMatchupLeaderEntry])`
  - `MlbMatchupLeaders(categories: list[MlbMatchupLeaderCategory])`
  - On `MlbGameDetail`: `matchup_leaders: MlbMatchupLeaders | None = None`
  - `attach_matchup_leaders(detail, leaders) -> MlbGameDetail`

- [ ] **Step 1: Write failing attach test**

Add to `backend/tests/test_mlb_game_detail_season_injuries.py`:

```python
from app.domains.mlb.schemas_game_detail import (
    MlbMatchupLeaderCategory,
    MlbMatchupLeaderEntry,
    MlbMatchupLeaders,
)


def test_attach_matchup_leaders():
    leaders = MlbMatchupLeaders(
        categories=[
            MlbMatchupLeaderCategory(
                key="hr",
                label="HR",
                leaders=[
                    MlbMatchupLeaderEntry(
                        rank=2,
                        player_id="123",
                        name="Slugger",
                        team_abbrev="LAD",
                        side="away",
                        value="28",
                    )
                ],
            )
        ]
    )
    out = attach_matchup_leaders(_scheduled_detail(), leaders)
    assert out.matchup_leaders is not None
    assert out.matchup_leaders.categories[0].leaders[0].name == "Slugger"


def test_attach_matchup_leaders_none_noop():
    detail = _scheduled_detail()
    assert attach_matchup_leaders(detail, None) is detail
```

Import `attach_matchup_leaders` from `game_detail` alongside existing attaches.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_game_detail_season_injuries.py::test_attach_matchup_leaders \
  tests/test_mlb_game_detail_season_injuries.py::test_attach_matchup_leaders_none_noop \
  -v
```

Expected: FAIL (import / missing symbol)

- [ ] **Step 3: Extend schemas**

In `schemas_game_detail.py`, add rank fields to `MlbSeasonTeamStatLine`:

```python
class MlbSeasonTeamStatLine(BaseModel):
    model_config = _RESPONSE_CONFIG

    hr: int | None = None
    r: int | None = None
    h: int | None = None
    avg: str | None = None
    obp: str | None = None
    slg: str | None = None
    era: str | None = None
    so: int | None = None
    bb: int | None = None
    hr_rank: int | None = None
    r_rank: int | None = None
    h_rank: int | None = None
    avg_rank: int | None = None
    obp_rank: int | None = None
    slg_rank: int | None = None
    era_rank: int | None = None
    so_rank: int | None = None
    bb_rank: int | None = None
```

Add models (export in `__all__`):

```python
class MlbMatchupLeaderEntry(BaseModel):
    model_config = _RESPONSE_CONFIG

    rank: int
    player_id: str
    name: str
    team_abbrev: str
    side: Literal["away", "home"]
    value: str


class MlbMatchupLeaderCategory(BaseModel):
    model_config = _RESPONSE_CONFIG

    key: Literal["hr", "avg", "ops", "era", "so", "whip"]
    label: str
    leaders: list[MlbMatchupLeaderEntry]


class MlbMatchupLeaders(BaseModel):
    model_config = _RESPONSE_CONFIG

    categories: list[MlbMatchupLeaderCategory]
```

On `MlbGameDetail` (near `season_team_stats`):

```python
matchup_leaders: MlbMatchupLeaders | None = None
```

Re-export new types from `schemas.py` (`import` + `__all__`).

- [ ] **Step 4: Add attach helper**

In `game_detail.py`:

```python
def attach_matchup_leaders(
    detail: MlbGameDetail,
    leaders: MlbMatchupLeaders | None,
) -> MlbGameDetail:
    if leaders is None:
        return detail
    return detail.model_copy(update={"matchup_leaders": leaders})
```

Import `MlbMatchupLeaders` in the schemas import block.

- [ ] **Step 5: Run tests to verify they pass**

Run the same pytest command as Step 2.

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/schemas_game_detail.py \
  backend/app/domains/mlb/schemas.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_game_detail_season_injuries.py
git commit -m "$(cat <<'EOF'
feat(mlb): add matchup leaders schema and season rank fields

EOF
)"
```

---

### Task 2: League team stats + competition ranks

**Files:**
- Modify: `backend/app/providers/mlb_stats/team_season.py`
- Modify: `backend/tests/test_mlb_season_team_stats.py`

**Interfaces:**
- Consumes: `MlbSeasonTeamStatLine`, `MlbSeasonTeamStatsPair`
- Produces:
  - `def competition_rank(values: list[tuple[int, float]], *, lower_is_better: bool) -> dict[int, int]`
  - `async def fetch_league_group_splits(client, *, group: str, season: int) -> list[dict]`
  - `def build_season_pair_from_league_splits(hitting_splits, pitching_splits, *, away_team_id, home_team_id) -> MlbSeasonTeamStatsPair | None`
  - Updated `fetch_season_team_stats_pair`: try league path first; on failure fall back to per-team values with null ranks

- [ ] **Step 1: Write failing unit tests**

Append to `backend/tests/test_mlb_season_team_stats.py`:

```python
from app.providers.mlb_stats.team_season import (
    build_season_pair_from_league_splits,
    competition_rank,
)


def test_competition_rank_ties_skip():
    ranks = competition_rank(
        [(1, 10.0), (2, 20.0), (3, 20.0), (4, 5.0)],
        lower_is_better=False,
    )
    assert ranks == {2: 1, 3: 1, 1: 3, 4: 4}


def test_competition_rank_lower_better():
    ranks = competition_rank(
        [(1, 3.50), (2, 2.10), (3, 2.10)],
        lower_is_better=True,
    )
    assert ranks == {2: 1, 3: 1, 1: 3}


def test_build_season_pair_from_league_splits_assigns_ranks():
    hitting = [
        {"team": {"id": 119}, "stat": {"homeRuns": 100, "runs": 400, "hits": 800, "avg": ".250", "obp": ".320", "slg": ".400"}},
        {"team": {"id": 147}, "stat": {"homeRuns": 120, "runs": 450, "hits": 850, "avg": ".260", "obp": ".330", "slg": ".420"}},
        {"team": {"id": 111}, "stat": {"homeRuns": 90, "runs": 380, "hits": 780, "avg": ".240", "obp": ".310", "slg": ".390"}},
    ]
    pitching = [
        {"team": {"id": 119}, "stat": {"era": "3.50", "strikeOuts": 900, "baseOnBalls": 400}},
        {"team": {"id": 147}, "stat": {"era": "4.00", "strikeOuts": 850, "baseOnBalls": 420}},
        {"team": {"id": 111}, "stat": {"era": "3.20", "strikeOuts": 950, "baseOnBalls": 380}},
    ]
    pair = build_season_pair_from_league_splits(
        hitting, pitching, away_team_id=119, home_team_id=147
    )
    assert pair is not None
    assert pair.away.hr == 100
    assert pair.home.hr == 120
    assert pair.home.hr_rank == 1
    assert pair.away.hr_rank == 2
    assert pair.away.era_rank == 2  # 3.50 behind 3.20
    assert pair.home.era_rank == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_season_team_stats.py::test_competition_rank_ties_skip \
  tests/test_mlb_season_team_stats.py::test_competition_rank_lower_better \
  tests/test_mlb_season_team_stats.py::test_build_season_pair_from_league_splits_assigns_ranks \
  -v
```

Expected: FAIL (import errors)

- [ ] **Step 3: Implement ranking + league parse**

In `team_season.py`, add:

```python
HITTING_RANK_KEYS = (
    ("hr", "homeRuns", False),
    ("r", "runs", False),
    ("h", "hits", False),
    ("avg", "avg", False),
    ("obp", "obp", False),
    ("slg", "slg", False),
)
PITCHING_RANK_KEYS = (
    ("era", "era", True),
    ("so", "strikeOuts", False),
    ("bb", "baseOnBalls", True),
)

_league_group_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
LEAGUE_GROUP_TTL_SECONDS = 900.0


def competition_rank(
    values: list[tuple[int, float]],
    *,
    lower_is_better: bool,
) -> dict[int, int]:
    ordered = sorted(values, key=lambda item: item[1], reverse=not lower_is_better)
    ranks: dict[int, int] = {}
    i = 0
    while i < len(ordered):
        j = i + 1
        while j < len(ordered) and ordered[j][1] == ordered[i][1]:
            j += 1
        rank = i + 1
        for k in range(i, j):
            ranks[ordered[k][0]] = rank
        i = j
    return ranks


def _numeric_stat(raw: Any) -> float | None:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value else None  # NaN guard


def clear_team_season_cache() -> None:
    _team_season_cache.clear()
    _league_group_cache.clear()
```

Implement `fetch_league_group_splits` calling `GET {STATS_BASE}/teams/stats` with `stats=season`, `group`, `season`, `sportId=1`, cache by `f"{group}|{season}"`.

Implement `build_season_pair_from_league_splits`:

1. Index splits by `team.id`.
2. Build value lines via existing `parse_hitting_split` / `parse_pitching_split` for away/home.
3. For each rank key, collect `(team_id, numeric)` across all splits, `competition_rank`, set `{key}_rank` on away/home lines.
4. If both sides empty → `None`.

Update `fetch_season_team_stats_pair`:

```python
async def fetch_season_team_stats_pair(...):
    try:
        async def league_path():
            hitting, pitching = await asyncio.gather(
                fetch_league_group_splits(client, group="hitting", season=season),
                fetch_league_group_splits(client, group="pitching", season=season),
            )
            return build_season_pair_from_league_splits(
                hitting,
                pitching,
                away_team_id=away_team_id,
                home_team_id=home_team_id,
            )

        # Note: caller already owns client in game_detail; keep signature with client
        pair = await asyncio.gather(
            fetch_league_group_splits(client, group="hitting", season=season),
            fetch_league_group_splits(client, group="pitching", season=season),
        )
        built = build_season_pair_from_league_splits(
            pair[0], pair[1], away_team_id=away_team_id, home_team_id=home_team_id
        )
        if built is not None:
            return built
    except Exception as exc:
        logger.warning("league team stats path failed: %s", exc)

    # fallback: existing per-team lines (no ranks)
    away, home = await asyncio.gather(
        fetch_team_season_stat_line(client, away_team_id, season),
        fetch_team_season_stat_line(client, home_team_id, season),
    )
    if not away and not home:
        return None
    return MlbSeasonTeamStatsPair(
        away=MlbSeasonTeamStatLine(**away),
        home=MlbSeasonTeamStatLine(**home),
    )
```

Keep existing per-team helpers for the fallback path. Do not invent a second client in this function.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_season_team_stats.py -q
```

Expected: PASS (update any tests that assert exact cache keys if `clear_team_season_cache` now clears league cache too)

- [ ] **Step 5: Commit**

```bash
git add backend/app/providers/mlb_stats/team_season.py \
  backend/tests/test_mlb_season_team_stats.py
git commit -m "$(cat <<'EOF'
feat(mlb): rank season team stats from league-wide Stats API

EOF
)"
```

---

### Task 3: Active roster + matchup leaders builder + game_detail wire

**Files:**
- Create: `backend/app/providers/mlb_stats/roster.py`
- Create: `backend/app/providers/mlb_stats/matchup_leaders.py`
- Create: `backend/tests/test_mlb_matchup_leaders.py`
- Modify: `backend/app/domains/mlb/game_detail.py`

**Interfaces:**
- Consumes: `MlbMatchupLeaders` schemas; `app.domains.mlb.leaders` (`CATEGORY_SPECS`, `fetch_category_payload`, `normalize_category_payload`, `fetch_team_abbrev_map`, `TOP_N`)
- Produces:
  - `async def fetch_active_roster_player_ids(client, team_id: int, season: int) -> set[str]`
  - `def clear_roster_cache() -> None`
  - `MATCHUP_LEADER_CATEGORY_KEYS = ("hr", "avg", "ops", "era", "so", "whip")`
  - `async def fetch_matchup_leaders(client, *, away_team_id, home_team_id, season) -> MlbMatchupLeaders | None`
  - `async def _attach_matchup_leaders(detail, payload) -> MlbGameDetail` soft wrapper
  - Call from `get_mlb_game_detail` in the `scheduled` block after season team stats

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_mlb_matchup_leaders.py`:

```python
from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.matchup_leaders import (
    intersect_category_with_rosters,
    select_matchup_leader_specs,
)


def test_select_matchup_leader_specs_six_keys():
    specs = select_matchup_leader_specs()
    assert [s[0] for s in specs] == ["hr", "avg", "ops", "era", "so", "whip"]


def test_intersect_category_keeps_top_three_roster_hits():
    category = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="1", name="A", team_abbrev="NYY", gp=10, value="30"),
            MlbLeaderRow(rank=2, player_id="2", name="B", team_abbrev="LAD", gp=10, value="28"),
            MlbLeaderRow(rank=3, player_id="3", name="C", team_abbrev="BOS", gp=10, value="27"),
            MlbLeaderRow(rank=4, player_id="4", name="D", team_abbrev="LAD", gp=10, value="26"),
            MlbLeaderRow(rank=5, player_id="5", name="E", team_abbrev="NYY", gp=10, value="25"),
        ],
    )
    out = intersect_category_with_rosters(
        category,
        away_ids={"2", "4"},
        home_ids={"5"},
        away_abbrev="LAD",
        home_abbrev="NYY",
    )
    assert out.key == "hr"
    assert out.label == "HR"
    assert [e.player_id for e in out.leaders] == ["2", "4", "5"]
    assert [e.side for e in out.leaders] == ["away", "away", "home"]
    assert out.leaders[0].rank == 2


def test_intersect_empty_when_no_overlap():
    category = MlbLeaderCategory(
        key="avg",
        label="Batting Average",
        stat="AVG",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value=".340"),
        ],
    )
    out = intersect_category_with_rosters(
        category,
        away_ids={"1"},
        home_ids={"2"},
        away_abbrev="LAD",
        home_abbrev="NYY",
    )
    assert out.leaders == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_matchup_leaders.py -v
```

Expected: FAIL (module missing)

- [ ] **Step 3: Implement roster provider**

Create `backend/app/providers/mlb_stats/roster.py`:

```python
"""MLB Stats API active roster helpers."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

STATS_BASE = "https://statsapi.mlb.com/api/v1"
ROSTER_TTL_SECONDS = 600.0
_roster_cache: dict[str, tuple[float, set[str]]] = {}


def clear_roster_cache() -> None:
    _roster_cache.clear()


async def fetch_active_roster_player_ids(
    client: httpx.AsyncClient, team_id: int, season: int
) -> set[str]:
    cache_key = f"{team_id}|{season}"
    cached = _roster_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < ROSTER_TTL_SECONDS:
        return set(cached[1])
    try:
        response = await client.get(
            f"{STATS_BASE}/teams/{team_id}/roster",
            params={"rosterType": "active", "season": season},
        )
        response.raise_for_status()
        ids: set[str] = set()
        for entry in response.json().get("roster") or []:
            person = entry.get("person") or {}
            pid = person.get("id")
            if pid is not None:
                ids.add(str(pid))
        _roster_cache[cache_key] = (time.monotonic(), ids)
        return set(ids)
    except Exception as exc:
        logger.warning("active roster failed team=%s season=%s: %s", team_id, season, exc)
        return set()
```

- [ ] **Step 4: Implement matchup leaders builder**

Create `backend/app/providers/mlb_stats/matchup_leaders.py`:

```python
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.domains.mlb.leaders import (
    CATEGORY_SPECS,
    fetch_category_payload,
    fetch_team_abbrev_map,
    normalize_category_payload,
)
from app.domains.mlb.schemas_game_detail import (
    MlbMatchupLeaderCategory,
    MlbMatchupLeaderEntry,
    MlbMatchupLeaders,
)
from app.domains.mlb.schemas_leaders import MlbLeaderCategory
from app.providers.mlb_stats.roster import fetch_active_roster_player_ids

logger = logging.getLogger(__name__)

MATCHUP_LEADER_KEYS = ("hr", "avg", "ops", "era", "so", "whip")
_LABEL_BY_KEY = {
    "hr": "HR",
    "avg": "AVG",
    "ops": "OPS",
    "era": "ERA",
    "so": "SO",
    "whip": "WHIP",
}


def select_matchup_leader_specs() -> list[tuple[str, str, str, str, str, Any]]:
    by_key = {spec[0]: spec for spec in CATEGORY_SPECS}
    return [by_key[key] for key in MATCHUP_LEADER_KEYS]


def intersect_category_with_rosters(
    category: MlbLeaderCategory,
    *,
    away_ids: set[str],
    home_ids: set[str],
    away_abbrev: str,
    home_abbrev: str,
) -> MlbMatchupLeaderCategory:
    leaders: list[MlbMatchupLeaderEntry] = []
    for row in category.leaders:
        if row.player_id in away_ids:
            side = "away"
            abbrev = away_abbrev
        elif row.player_id in home_ids:
            side = "home"
            abbrev = home_abbrev
        else:
            continue
        leaders.append(
            MlbMatchupLeaderEntry(
                rank=row.rank,
                player_id=row.player_id,
                name=row.name,
                team_abbrev=abbrev,
                side=side,
                value=row.value,
            )
        )
        if len(leaders) >= 3:
            break
    return MlbMatchupLeaderCategory(
        key=category.key,  # type: ignore[arg-type]
        label=_LABEL_BY_KEY[category.key],
        leaders=leaders,
    )


async def fetch_matchup_leaders(
    client: httpx.AsyncClient,
    *,
    away_team_id: int,
    home_team_id: int,
    away_abbrev: str,
    home_abbrev: str,
    season: int,
) -> MlbMatchupLeaders | None:
    specs = select_matchup_leader_specs()
    away_ids, home_ids, team_map, *payloads = await asyncio.gather(
        fetch_active_roster_player_ids(client, away_team_id, season),
        fetch_active_roster_player_ids(client, home_team_id, season),
        fetch_team_abbrev_map(client, season),
        *(
            fetch_category_payload(client, sort_stat, group, order, season)
            for (_k, _lab, _st, sort_stat, group, order) in specs
        ),
    )
    if not away_ids and not home_ids:
        return None

    categories: list[MlbMatchupLeaderCategory] = []
    for spec, payload in zip(specs, payloads, strict=True):
        key, label, stat, sort_stat, _group, _order = spec
        try:
            board = normalize_category_payload(
                payload,
                key=key,
                label=label,
                stat=stat,
                sort_stat=sort_stat,
                team_id_to_abbrev=team_map,
            )
            categories.append(
                intersect_category_with_rosters(
                    board,
                    away_ids=away_ids,
                    home_ids=home_ids,
                    away_abbrev=away_abbrev,
                    home_abbrev=home_abbrev,
                )
            )
        except Exception as exc:
            logger.warning("matchup leaders category %s failed: %s", key, exc)
            categories.append(
                MlbMatchupLeaderCategory(key=key, label=_LABEL_BY_KEY[key], leaders=[])
            )
    return MlbMatchupLeaders(categories=categories)
```

Fix `gather` unpacking carefully in the real implementation (rosters + map + 6 payloads). Prefer:

```python
roster_results = await asyncio.gather(
    fetch_active_roster_player_ids(client, away_team_id, season),
    fetch_active_roster_player_ids(client, home_team_id, season),
)
away_ids, home_ids = roster_results
# then gather map + category payloads
```

so soft-fail of one roster still yields an empty set without aborting the other.

- [ ] **Step 5: Wire into game_detail**

Add `_attach_matchup_leaders` mirroring `_attach_season_team_stats` (season year, int team ids, soft try/except). Call it in the `scheduled` block after season team stats:

```python
        try:
            detail = await _attach_matchup_leaders(detail, payload)
        except Exception as exc:
            logger.warning(
                "matchup leaders unavailable for %s: %s",
                detail.mlb_game_pk,
                exc,
            )
```

Pass `detail.away.abbrev` / `detail.home.abbrev` into `fetch_matchup_leaders`.

- [ ] **Step 6: Run tests**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_matchup_leaders.py \
  tests/test_mlb_game_detail_season_injuries.py \
  tests/test_mlb_season_team_stats.py \
  -q
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/providers/mlb_stats/roster.py \
  backend/app/providers/mlb_stats/matchup_leaders.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_matchup_leaders.py
git commit -m "$(cat <<'EOF'
feat(mlb): attach matchup leaders from roster ∩ league boards

EOF
)"
```

---

### Task 4: Regenerate OpenAPI contract

**Files:**
- Modify: `frontend/openapi.json`
- Modify: `backend/openapi-golden.json`
- Modify: `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Consumes: updated Pydantic models on `MlbGameDetail`
- Produces: regenerated OpenAPI types including `*_rank` and `matchup_leaders`

- [ ] **Step 1: Export OpenAPI**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
python scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

- [ ] **Step 2: Confirm schema includes new fields**

```bash
rg -n "matchup_leaders|hr_rank" frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts | head
```

Expected: matches present

- [ ] **Step 3: Commit**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
chore(api): regenerate OpenAPI for MLB preview ranks and leaders

EOF
)"
```

---

### Task 5: Frontend types + mapper

**Files:**
- Modify: `frontend/src/features/mlb/lib/types.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts`
- Modify: `frontend/src/features/mlb/lib/testFixtures.ts`

**Interfaces:**
- Produces view types:

```ts
export type MlbSeasonTeamStatLine = {
  hr: number | null;
  // ...existing...
  bb: number | null;
  hrRank: number | null;
  rRank: number | null;
  hRank: number | null;
  avgRank: number | null;
  obpRank: number | null;
  slgRank: number | null;
  eraRank: number | null;
  soRank: number | null;
  bbRank: number | null;
};

export type MlbMatchupLeaderEntry = {
  rank: number;
  playerId: string;
  name: string;
  teamAbbrev: string;
  side: "away" | "home";
  value: string;
};

export type MlbMatchupLeaderCategory = {
  key: "hr" | "avg" | "ops" | "era" | "so" | "whip";
  label: string;
  leaders: MlbMatchupLeaderEntry[];
};

export type MlbMatchupLeaders = {
  categories: MlbMatchupLeaderCategory[];
};
```

On `MlbGameDetailView`: `matchupLeaders: MlbMatchupLeaders | null`

- [ ] **Step 1: Write failing mapper test**

In `mapMlbGameDetail.test.ts`, assert a fixture with `hr_rank` and `matchup_leaders` maps to camelCase ranks + `matchupLeaders`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts
```

Expected: FAIL on missing fields

- [ ] **Step 3: Update types, mapper, fixtures**

Extend `mapSeasonTeamStatLine`:

```ts
hrRank: line.hr_rank ?? null,
rRank: line.r_rank ?? null,
hRank: line.h_rank ?? null,
avgRank: line.avg_rank ?? null,
obpRank: line.obp_rank ?? null,
slgRank: line.slg_rank ?? null,
eraRank: line.era_rank ?? null,
soRank: line.so_rank ?? null,
bbRank: line.bb_rank ?? null,
```

Map `matchup_leaders` → `matchupLeaders` (categories/leaders with camelCase keys). Default `matchupLeaders: null` and rank `null`s on all `testFixtures` game details.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/lib/types.ts \
  frontend/src/features/mlb/lib/mapMlbGameDetail.ts \
  frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts \
  frontend/src/features/mlb/lib/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): map season ranks and matchup leaders on game detail

EOF
)"
```

---

### Task 6: Team Stats UI — show `#N` ranks

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbSeasonTeamStats.tsx`
- Modify: `frontend/src/features/mlb/game/MlbSeasonTeamStats.test.tsx`

**Interfaces:**
- Consumes: `MlbSeasonTeamStatLine` rank fields (`hrRank`, …)
- Produces: muted `#N` beside value when rank is non-null; `data-testid={`mlb-season-stat-${statKey}-rank-${side}`}`

- [ ] **Step 1: Write failing UI test**

In `MlbSeasonTeamStats.test.tsx`, with fixture ranks `away.hrRank = 3`, assert:

```ts
expect(screen.getByTestId("mlb-season-stat-hr-rank-away")).toHaveTextContent("#3");
```

And a case with `null` rank → rank testid absent.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- src/features/mlb/game/MlbSeasonTeamStats.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement rank rendering**

In `StatValue`, after the numeric value span, when `rank != null`:

```tsx
<span
  data-testid={`mlb-season-stat-${statKey}-rank-${side}`}
  className="text-[14px] text-white/40"
>
  {`#${rank}`}
</span>
```

Pass `rank={seasonTeamStats[side][`${stat.key}Rank` as ...]}` — cleaner: add `rankKey` on `STAT_DEFINITIONS` (`hr` → look up `hrRank` via a map):

```ts
const RANK_KEY: Record<StatKey, keyof MlbSeasonTeamStatLine> = {
  hr: "hrRank",
  r: "rRank",
  h: "hRank",
  avg: "avgRank",
  obp: "obpRank",
  slg: "slgRank",
  era: "eraRank",
  so: "soRank",
  bb: "bbRank",
};
```

Leader dots remain based on raw values only.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- src/features/mlb/game/MlbSeasonTeamStats.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbSeasonTeamStats.tsx \
  frontend/src/features/mlb/game/MlbSeasonTeamStats.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): show league ranks on Preview Team Stats

EOF
)"
```

---

### Task 7: Matchup Leaders UI + wire under Matchup prediction

**Files:**
- Create: `frontend/src/features/mlb/game/MlbMatchupLeaders.tsx`
- Create: `frontend/src/features/mlb/game/MlbMatchupLeaders.test.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx`

**Interfaces:**
- Consumes: `detail.matchupLeaders`
- Produces: `MlbMatchupLeaders` component; right column after `MlbMatchupPrediction`

- [ ] **Step 1: Write failing component + placement tests**

`MlbMatchupLeaders.test.tsx`:

- null → nothing
- with categories → title **Matchup Leaders**, tabs HR/AVG/OPS/ERA/SO/WHIP
- default tab HR lists up to 3 rows (`#rank`, name, abbrev, value)
- empty leaders → “No top leaders on either roster.”
- click AVG tab updates list

`MlbProjectedLineups.test.tsx`:

- when `matchupLeaders` present, `mlb-matchup-leaders` is inside `mlb-preview-right-column` and appears after `mlb-matchup-prediction` in DOM order

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- \
  src/features/mlb/game/MlbMatchupLeaders.test.tsx \
  src/features/mlb/game/MlbProjectedLineups.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement component**

Create `MlbMatchupLeaders.tsx`:

```tsx
import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import { mlbTeamLogoUrl } from "../league/mlbTeamLogos";
import type {
  MlbGameDetailView,
  MlbMatchupLeaderCategory,
} from "../lib/types";

type CategoryKey = MlbMatchupLeaderCategory["key"];

const TAB_ORDER: CategoryKey[] = ["hr", "avg", "ops", "era", "so", "whip"];

export function MlbMatchupLeaders({
  detail,
}: {
  detail: MlbGameDetailView;
}) {
  const payload = detail.matchupLeaders;
  const [activeKey, setActiveKey] = useState<CategoryKey>("hr");
  if (!payload) return null;

  const category =
    payload.categories.find((c) => c.key === activeKey) ??
    payload.categories[0];
  if (!category) return null;

  return (
    <GameSection data-testid="mlb-matchup-leaders" className="w-full !p-3">
      <h2 className="text-center text-[18px] font-semibold text-white">
        Matchup Leaders
      </h2>
      <div
        className="mt-3 flex flex-wrap justify-center gap-1"
        role="tablist"
        aria-label="Matchup leader categories"
      >
        {TAB_ORDER.map((key) => {
          const label =
            payload.categories.find((c) => c.key === key)?.label ?? key.toUpperCase();
          const selected = category.key === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`mlb-matchup-leaders-tab-${key}`}
              className={`px-2 py-1 text-[14px] ${
                selected ? "text-white" : "text-white/45"
              }`}
              onClick={() => setActiveKey(key)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {category.leaders.length === 0 ? (
        <p className="mt-3 text-center text-[18px] text-white/50">
          No top leaders on either roster.
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="mlb-matchup-leaders-list">
          {category.leaders.map((entry) => {
            const team = entry.side === "away" ? detail.away : detail.home;
            const logo = team.logoUrl ?? mlbTeamLogoUrl(team.abbrev);
            return (
              <li
                key={`${entry.playerId}-${entry.rank}`}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 text-[18px] text-white/85"
                data-testid={`mlb-matchup-leader-${entry.playerId}`}
              >
                <span className="font-mono text-white/45">{`#${entry.rank}`}</span>
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {logo ? (
                    <img src={logo} alt="" className="size-5 object-contain" />
                  ) : null}
                  <span className="truncate">{entry.name}</span>
                  <span className="text-white/45">{entry.teamAbbrev}</span>
                </span>
                <span className="font-mono tabular-nums">{entry.value}</span>
              </li>
            );
          })}
        </ul>
      )}
    </GameSection>
  );
}
```

Wire in `MlbProjectedLineups` right column:

```tsx
<MlbMatchupPrediction detail={detail} />
<MlbMatchupLeaders detail={detail} />
```
- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- \
  src/features/mlb/game/MlbMatchupLeaders.test.tsx \
  src/features/mlb/game/MlbProjectedLineups.test.tsx \
  src/features/mlb/game/MlbSeasonTeamStats.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mlb/game/MlbMatchupLeaders.tsx \
  frontend/src/features/mlb/game/MlbMatchupLeaders.test.tsx \
  frontend/src/features/mlb/game/MlbProjectedLineups.tsx \
  frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): add Matchup Leaders under Preview Matchup prediction

EOF
)"
```

---

### Task 8: Docs — system-design + spec status

**Files:**
- Modify: `md/system-design.md` (MLB game detail Preview row)
- Modify: `docs/superpowers/specs/2026-08-08-mlb-preview-team-ranks-matchup-leaders-design.md` (Status → Implemented)

**Interfaces:**
- None (docs only)

- [ ] **Step 1: Update system-design Preview note**

In the `/mlb/games/:gamePk` table row, note: Team Stats include league ranks; right rail adds Matchup Leaders (roster ∩ league top 10 for HR/AVG/OPS/ERA/SO/WHIP) under Matchup prediction.

- [ ] **Step 2: Mark spec Implemented**

Set `Status: Implemented`.

- [ ] **Step 3: Final verification**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_season_team_stats.py \
  tests/test_mlb_matchup_leaders.py \
  tests/test_mlb_game_detail_season_injuries.py -q
cd ../frontend && npm run check:api && npm test -- \
  src/features/mlb/lib/mapMlbGameDetail.test.ts \
  src/features/mlb/game/MlbSeasonTeamStats.test.tsx \
  src/features/mlb/game/MlbMatchupLeaders.test.tsx \
  src/features/mlb/game/MlbProjectedLineups.test.tsx
```

Expected: all PASS / check:api clean

- [ ] **Step 4: Commit**

```bash
git add md/system-design.md \
  docs/superpowers/specs/2026-08-08-mlb-preview-team-ranks-matchup-leaders-design.md
git commit -m "$(cat <<'EOF'
docs(mlb): mark Preview ranks/leaders shipped in system-design

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Team Stats keep comparison + `#N` ranks | 2, 6 |
| League `/teams/stats` + competition ranks; fallback per-team | 2 |
| Rank fields on season stat line | 1, 5 |
| Matchup Leaders under Matchup prediction | 7 |
| Categories HR/AVG/OPS/ERA/SO/WHIP tabs | 3, 7 |
| Active roster ∩ top 10 → ≤3 | 3 |
| Soft-fail / hide null | 2, 3, 7 |
| Extend game detail only | 1–4 |
| OpenAPI sync | 4 |
| system-design | 8 |
