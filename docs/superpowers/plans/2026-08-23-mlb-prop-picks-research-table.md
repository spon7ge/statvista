# MLB Prop Picks Research Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/mlb/prop_picks` with a sportsbook-main research table (exact-line clusters, de-vigged IP, opp def/pace ranks, L5/L10/L15) served by `GET /api/mlb/props/board`.

**Architecture:** New assembler `get_mlb_prop_board()` clusters sportsbook mains + DFS mains by `(player_key, stat, line)`, emits Over and Under rows, then enriches IP / ranks / hit rates. `GET /api/mlb/props/today` and game-detail Props stay DFS +EV. Frontend drops PrizePicks/Underdog tabs and the player odds-grid route.

**Tech Stack:** FastAPI + Pydantic, pytest, React 19 + Vite + TanStack Query + Vitest + Testing Library, MLB Stats API, existing Supabase/Parlay snapshots.

**Spec:** `docs/superpowers/specs/2026-08-23-mlb-prop-picks-research-table-design.md`

## Global Constraints

- Product name in user-facing copy: **statvista**
- Do **not** change `GET /api/mlb/props/today` behavior or game-detail Props tabs
- WNBA `/wnba/prop_picks` is out of scope
- No alt ladders; only sportsbook **mains** + PrizePicks/Underdog **mains**
- IP books only: ProphetX → Novig → Pinnacle → DraftKings (multiplicative de-vig, row side)
- DFS never sets IP
- Empty enrichments render `—` / null; board still 200
- OpenAPI must stay in sync (`export_openapi` + `npm run generate:api`)
- Tests ship with code; TDD per task
- Brand / docs: follow `md/claude.md` (small modules, typed, early validation)

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_prop_board.py` | `MlbPropBoardBookChip`, `MlbPropBoardRow`, `MlbPropBoardResponse` |
| `backend/app/domains/mlb/schemas.py` | Re-export board schemas |
| `backend/app/domains/mlb/prop_board_cluster.py` | Pure cluster + IP |
| `backend/app/domains/mlb/prop_board_ranks.py` | Batter vs pitcher + rank attach |
| `backend/app/domains/mlb/prop_board_form.py` | L5/L10/L15 from game logs |
| `backend/app/domains/mlb/prop_board.py` | `get_mlb_prop_board()` assembler |
| `backend/app/providers/mlb_stats/people.py` | Add `fetch_game_log_stats` |
| `backend/app/providers/mlb_stats/team_season.py` | ERA / OPS / PA-per-game league ranks |
| `backend/app/domains/mlb/routes.py` | `GET /mlb/props/board` |
| `backend/app/openapi_export.py` | Require `/api/mlb/props/board` |
| `backend/tests/test_mlb_prop_board_cluster.py` | Cluster + IP |
| `backend/tests/test_mlb_prop_board_ranks.py` | Rank mapping |
| `backend/tests/test_mlb_prop_board_form.py` | Hit rates |
| `backend/tests/test_mlb_prop_board.py` | Assembler + route |
| `frontend/src/shared/lib/api.ts` | `fetchMlbPropBoard` |
| `frontend/src/features/mlb/hooks/useMlbPropBoard.ts` | Query hook |
| `frontend/src/features/mlb/league/filterMlbPropBoard.ts` | Team + name filter on board rows |
| `frontend/src/features/mlb/league/MlbPropPicksTable.tsx` | Dense sortable table |
| `frontend/src/features/mlb/league/MlbPropPicksHeader.tsx` | Title + filters; **no app tabs** |
| `frontend/src/pages/MlbPropPicksPage.tsx` | Wire board API |
| `frontend/src/app/AppRouter.tsx` | Redirect player route → `/mlb/prop_picks` |
| `md/system-design.md` | Page ↔ API table |

**Do not delete** `get_mlb_props_today` / `MlbPlayerPropsOddsGrid` until the player route is redirected (Task 7). Game-detail still uses today/game APIs.

---

### Task 1: Board schemas + empty route

**Files:**
- Create: `backend/app/domains/mlb/schemas_prop_board.py`
- Create: `backend/tests/test_mlb_prop_board_schema.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Modify: `backend/app/domains/mlb/routes.py`
- Modify: `backend/app/openapi_export.py` (`REQUIRED_MLB_PATHS`)
- Create: `backend/app/domains/mlb/prop_board.py` (stub `get_mlb_prop_board`)
- Update: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Consumes: FastAPI router pattern from `mlb_props_today`
- Produces:
  - `Side = Literal["over", "under"]`
  - `MlbPropBoardBookChip(book: str, american: int | None = None, url: str | None = None)`
  - `MlbPropBoardRow` fields listed below
  - `MlbPropBoardResponse(as_of: datetime, warnings: list[str], rows: list[MlbPropBoardRow])`
  - `GET /api/mlb/props/board` → 200 empty rows

`MlbPropBoardRow` fields:

```text
player_name: str
headshot_url: str | None
team_abbrev: str | None
opponent_abbrev: str | None
home_away: Literal["home", "away"] | None
stat: str
market_label: str
side: Side
line: float
game_pk: int | None
game_start_at: datetime | None
books: list[MlbPropBoardBookChip]
ip_pct: int | None
opp_def_rank: int | None
opp_def_label: str | None
opp_pace_rank: int | None
opp_pace_label: str | None
hit_l5: int | None
hit_l10: int | None
hit_l15: int | None
```

- [ ] **Step 1: Write failing schema/route test**

Create `backend/tests/test_mlb_prop_board_schema.py`:

```python
from datetime import datetime, timezone

from app.domains.mlb.schemas_prop_board import (
    MlbPropBoardBookChip,
    MlbPropBoardResponse,
    MlbPropBoardRow,
)


def test_board_response_defaults_empty_rows():
    body = MlbPropBoardResponse(as_of=datetime.now(timezone.utc))
    dumped = body.model_dump()
    assert dumped["rows"] == []
    assert dumped["warnings"] == []


def test_board_row_requires_side_and_line():
    row = MlbPropBoardRow(
        player_name="Aaron Judge",
        headshot_url=None,
        team_abbrev="NYY",
        opponent_abbrev="BOS",
        home_away="away",
        stat="hits",
        market_label="Over 1.5 Hits",
        side="over",
        line=1.5,
        game_pk=1,
        game_start_at=None,
        books=[MlbPropBoardBookChip(book="prophetx", american=-115)],
        ip_pct=53,
        opp_def_rank=12,
        opp_def_label="12th BOS",
        opp_pace_rank=4,
        opp_pace_label="4th BOS",
        hit_l5=80,
        hit_l10=70,
        hit_l15=60,
    )
    assert row.side == "over"
    assert row.books[0].book == "prophetx"
```

Create `backend/tests/test_mlb_prop_board.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_mlb_props_board_route_returns_200(monkeypatch):
    from app.domains.mlb import prop_board as mod

    async def fake():
        from datetime import datetime, timezone
        from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse

        return MlbPropBoardResponse(as_of=datetime.now(timezone.utc), rows=[], warnings=[])

    monkeypatch.setattr(mod, "get_mlb_prop_board", fake)
    res = client.get("/api/mlb/props/board")
    assert res.status_code == 200
    assert res.json()["rows"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_schema.py backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_returns_200 -v
```

Expected: FAIL (`schemas_prop_board` / `get_mlb_prop_board` missing)

- [ ] **Step 3: Implement schemas, stub assembler, route**

`backend/app/domains/mlb/schemas_prop_board.py`:

```python
"""Response schemas for GET /api/mlb/props/board."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Side = Literal["over", "under"]
HomeAway = Literal["home", "away"]
_RESPONSE_CONFIG = ConfigDict(json_schema_serialization_defaults_required=True)


class MlbPropBoardBookChip(BaseModel):
    model_config = _RESPONSE_CONFIG

    book: str
    american: int | None = None
    url: str | None = None


class MlbPropBoardRow(BaseModel):
    model_config = _RESPONSE_CONFIG

    player_name: str
    headshot_url: str | None = None
    team_abbrev: str | None = None
    opponent_abbrev: str | None = None
    home_away: HomeAway | None = None
    stat: str
    market_label: str
    side: Side
    line: float
    game_pk: int | None = None
    game_start_at: datetime | None = None
    books: list[MlbPropBoardBookChip] = Field(default_factory=list)
    ip_pct: int | None = None
    opp_def_rank: int | None = None
    opp_def_label: str | None = None
    opp_pace_rank: int | None = None
    opp_pace_label: str | None = None
    hit_l5: int | None = None
    hit_l10: int | None = None
    hit_l15: int | None = None


class MlbPropBoardResponse(BaseModel):
    model_config = _RESPONSE_CONFIG

    as_of: datetime
    warnings: list[str] = Field(default_factory=list)
    rows: list[MlbPropBoardRow] = Field(default_factory=list)
```

Stub `backend/app/domains/mlb/prop_board.py`:

```python
from datetime import datetime, timezone

from app.domains.mlb.schemas_prop_board import MlbPropBoardResponse


async def get_mlb_prop_board() -> MlbPropBoardResponse:
    return MlbPropBoardResponse(as_of=datetime.now(timezone.utc))
```

In `routes.py`, import `get_mlb_prop_board` and `MlbPropBoardResponse`, then add below `mlb_props_today`:

```python
@router.get("/mlb/props/board", response_model=MlbPropBoardResponse)
async def mlb_props_board(response: Response) -> MlbPropBoardResponse:
    response.headers["Cache-Control"] = "no-store"
    return await get_mlb_prop_board()
```

Re-export `MlbPropBoardResponse`, `MlbPropBoardRow`, `MlbPropBoardBookChip` from `schemas.py`.

Add `"/api/mlb/props/board"` to `REQUIRED_MLB_PATHS` in `openapi_export.py`.

- [ ] **Step 4: Re-run tests**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_schema.py backend/tests/test_mlb_prop_board.py::test_mlb_props_board_route_returns_200 -v
```

Expected: PASS

- [ ] **Step 5: Export OpenAPI**

```bash
PYTHONPATH=.:backend python -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/schemas_prop_board.py \
  backend/app/domains/mlb/schemas.py \
  backend/app/domains/mlb/prop_board.py \
  backend/app/domains/mlb/routes.py \
  backend/app/openapi_export.py \
  backend/tests/test_mlb_prop_board_schema.py \
  backend/tests/test_mlb_prop_board.py \
  frontend/openapi.json backend/openapi-golden.json \
  frontend/src/shared/lib/api.schema.d.ts
git commit -m "Add empty MLB props board API contract."
```

---

### Task 2: Cluster mains + de-vig IP

**Files:**
- Create: `backend/app/domains/mlb/prop_board_cluster.py`
- Create: `backend/tests/test_mlb_prop_board_cluster.py`

**Interfaces:**
- Consumes: `american_to_fair_pct` from `app.domains.mlb.prop_fair` (0–100 implied)
- Produces:
  - `BoardQuote(player_name, player_key, stat, line, book, over_american, under_american, url=None)`
  - `Cluster(player_name, player_key, stat, line, quotes: list[BoardQuote])`
  - `cluster_quotes(quotes: list[BoardQuote]) -> list[Cluster]`
  - `ip_pct_for_side(cluster: Cluster, side: Literal["over","under"]) -> int | None`
  - `BOOK_CHIP_ORDER: tuple[str, ...]`
  - `IP_BOOK_ORDER = ("prophetx", "novig", "pinnacle", "draftkings")`  # keys match `MlbPropBooksMain`

Line rounding: `round(float(line), 1)` (same as `_line_key` in `props.py`).

- [ ] **Step 1: Write failing cluster tests**

```python
from app.domains.mlb.prop_board_cluster import (
    BoardQuote,
    cluster_quotes,
    ip_pct_for_side,
)


def _q(**kwargs):
    base = dict(
        player_name="Jewell Loyd",
        player_key="jewell loyd",
        stat="points",
        line=9.5,
        book="prophetx",
        over_american=-110,
        under_american=-110,
        url=None,
    )
    base.update(kwargs)
    return BoardQuote(**base)


def test_split_mains_make_two_clusters():
    quotes = [
        _q(line=9.5, book="prophetx"),
        _q(line=9.5, book="draftkings", over_american=-115, under_american=-105),
        _q(line=10.0, book="prizepicks", over_american=None, under_american=None),
    ]
    clusters = cluster_quotes(quotes)
    lines = sorted(c.line for c in clusters)
    assert lines == [9.5, 10.0]
    c95 = next(c for c in clusters if c.line == 9.5)
    assert {q.book for q in c95.quotes} == {"prophetx", "draftkings"}


def test_ip_uses_prophetx_over_draftkings():
    cluster = cluster_quotes(
        [
            _q(book="draftkings", over_american=100, under_american=-120),
            _q(book="prophetx", over_american=-150, under_american=130),
        ]
    )[0]
    over = ip_pct_for_side(cluster, "over")
    under = ip_pct_for_side(cluster, "under")
    assert over is not None and under is not None
    assert over + under == 100


def test_dfs_only_cluster_has_null_ip():
    cluster = cluster_quotes(
        [_q(book="prizepicks", over_american=None, under_american=None)]
    )[0]
    assert ip_pct_for_side(cluster, "over") is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_cluster.py -v
```

Expected: FAIL (module missing)

- [ ] **Step 3: Implement cluster + IP**

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.domains.mlb.prop_fair import american_to_fair_pct

Side = Literal["over", "under"]

IP_BOOK_ORDER = ("prophetx", "novig", "pinnacle", "draftkings")
BOOK_CHIP_ORDER = (
    "prophetx",
    "novig",
    "pinnacle",
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "bet365",
    "kalshi",
    "fliff",
    "prizepicks",
    "underdog",
)


def round_line(line: float) -> float:
    return round(float(line), 1)


@dataclass(frozen=True)
class BoardQuote:
    player_name: str
    player_key: str
    stat: str
    line: float
    book: str
    over_american: int | None
    under_american: int | None
    url: str | None = None


@dataclass(frozen=True)
class Cluster:
    player_name: str
    player_key: str
    stat: str
    line: float
    quotes: tuple[BoardQuote, ...]


def cluster_quotes(quotes: list[BoardQuote]) -> list[Cluster]:
    buckets: dict[tuple[str, str, float], list[BoardQuote]] = {}
    names: dict[tuple[str, str, float], str] = {}
    for q in quotes:
        line = round_line(q.line)
        key = (q.player_key, q.stat, line)
        buckets.setdefault(key, []).append(q)
        names.setdefault(key, q.player_name)
    clusters: list[Cluster] = []
    for (player_key, stat, line), qs in buckets.items():
        clusters.append(
            Cluster(
                player_name=names[(player_key, stat, line)],
                player_key=player_key,
                stat=stat,
                line=line,
                quotes=tuple(qs),
            )
        )
    return clusters


def ip_pct_for_side(cluster: Cluster, side: Side) -> int | None:
    by_book = {q.book: q for q in cluster.quotes}
    chosen = None
    for book in IP_BOOK_ORDER:
        q = by_book.get(book)
        if q is None:
            continue
        if q.over_american is None or q.under_american is None:
            continue
        chosen = q
        break
    if chosen is None:
        return None
    p_over = american_to_fair_pct(chosen.over_american) / 100.0
    p_under = american_to_fair_pct(chosen.under_american) / 100.0
    total = p_over + p_under
    if total <= 0:
        return None
    fair = p_over / total if side == "over" else p_under / total
    return int(round(fair * 100))
```

- [ ] **Step 4: Re-run tests**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_cluster.py -v
```

Expected: PASS (`over + under == 100` after rounding; if a 99/101 split appears, adjust the test to `abs((over + under) - 100) <= 1` and document that integer rounding can be off by 1)

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/prop_board_cluster.py backend/tests/test_mlb_prop_board_cluster.py
git commit -m "Cluster MLB board quotes by exact line and de-vig IP."
```

---

### Task 3: Opp def / pace ranks

**Files:**
- Create: `backend/app/domains/mlb/prop_board_ranks.py`
- Create: `backend/tests/test_mlb_prop_board_ranks.py`
- Modify: `backend/app/providers/mlb_stats/team_season.py` (add PA/G + OPS rank keys if missing)
- Modify: `backend/tests/test_mlb_team_season.py` (extend if rank helper tests already live there)

**Interfaces:**
- Consumes: `competition_rank` from `team_season.py`
- Produces:
  - `BATTER_STATS: frozenset[str]` — `hits`, `hits_runs_rbis`, `home_runs`, `rbis`, `runs`, `singles`, `doubles`, `triples`, `stolen_bases`, `total_bases`, `walks`, `batter_strikeouts`, `plate_appearances`
  - `PITCHER_STATS: frozenset[str]` — `pitcher_strikeouts`, `hits_allowed`, `walks_allowed`, `earned_runs_allowed`, `runs_allowed`, `pitching_outs`, `pitches_thrown`
  - `is_pitcher_stat(stat: str) -> bool`
  - `TeamRankRow(abbrev: str, era_rank: int | None, ops_rank: int | None, pace_rank: int | None)`
  - `def_and_pace_ranks(stat: str, opponent_abbrev: str | None, ranks: dict[str, TeamRankRow]) -> tuple[int | None, str | None, int | None, str | None]`
  - Labels: `f"{n}{_ordinal(n)} {abbrev}"` e.g. `12th BOS`

- [ ] **Step 1: Write failing rank tests**

```python
from app.domains.mlb.prop_board_ranks import (
    TeamRankRow,
    def_and_pace_ranks,
    is_pitcher_stat,
)


def test_hits_is_batter_strikeouts_is_not_pitcher():
    assert is_pitcher_stat("hits") is False
    assert is_pitcher_stat("pitcher_strikeouts") is True


def test_batter_uses_era_rank_pitcher_uses_ops():
    ranks = {
        "BOS": TeamRankRow(abbrev="BOS", era_rank=2, ops_rank=14, pace_rank=5),
    }
    def_r, def_l, pace_r, pace_l = def_and_pace_ranks("hits", "BOS", ranks)
    assert def_r == 2 and def_l == "2nd BOS"
    assert pace_r == 5 and pace_l == "5th BOS"
    def_r, def_l, _, _ = def_and_pace_ranks("pitcher_strikeouts", "BOS", ranks)
    assert def_r == 14 and def_l == "14th BOS"


def test_missing_opponent_is_null():
    def_r, def_l, pace_r, pace_l = def_and_pace_ranks("hits", None, {})
    assert def_r is None and def_l is None and pace_r is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_ranks.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement ranks helper**

```python
from __future__ import annotations

from dataclasses import dataclass

BATTER_STATS = frozenset({
    "hits", "hits_runs_rbis", "home_runs", "rbis", "runs", "singles",
    "doubles", "triples", "stolen_bases", "total_bases", "walks",
    "batter_strikeouts", "plate_appearances",
})
PITCHER_STATS = frozenset({
    "pitcher_strikeouts", "hits_allowed", "walks_allowed",
    "earned_runs_allowed", "runs_allowed", "pitching_outs", "pitches_thrown",
})


def is_pitcher_stat(stat: str) -> bool:
    return stat in PITCHER_STATS


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


@dataclass(frozen=True)
class TeamRankRow:
    abbrev: str
    era_rank: int | None
    ops_rank: int | None
    pace_rank: int | None


def def_and_pace_ranks(
    stat: str,
    opponent_abbrev: str | None,
    ranks: dict[str, TeamRankRow],
) -> tuple[int | None, str | None, int | None, str | None]:
    if not opponent_abbrev:
        return None, None, None, None
    row = ranks.get(opponent_abbrev)
    if row is None:
        return None, None, None, None
    def_rank = row.ops_rank if is_pitcher_stat(stat) else row.era_rank
    def_label = f"{_ordinal(def_rank)} {row.abbrev}" if def_rank is not None else None
    pace_label = (
        f"{_ordinal(row.pace_rank)} {row.abbrev}" if row.pace_rank is not None else None
    )
    return def_rank, def_label, row.pace_rank, pace_label
```

If `team_season.py` hitting splits already expose `obp`, `slg`, `plateAppearances` / `gamesPlayed`, add a pure function `build_team_rank_index(hitting_rows, pitching_rows) -> dict[str, TeamRankRow]` in the same ranks module (keep HTTP out of this task). ERA rank: `competition_rank(..., lower_is_better=True)`. OPS rank: `obp+slg`, `lower_is_better=False`. Pace: `pa / games`, `lower_is_better=False`.

- [ ] **Step 4: Re-run tests**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_ranks.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/prop_board_ranks.py backend/tests/test_mlb_prop_board_ranks.py
git commit -m "Map MLB board matchup ranks for batter vs pitcher markets."
```

---

### Task 4: L5 / L10 / L15 hit rates

**Files:**
- Create: `backend/app/domains/mlb/prop_board_form.py`
- Create: `backend/tests/test_mlb_prop_board_form.py`
- Modify: `backend/app/providers/mlb_stats/people.py` — add `fetch_game_log_splits(client, person_id, season, group: Literal["hitting","pitching"]) -> list[dict]`

**Interfaces:**
- Consumes: `is_pitcher_stat`
- Produces:
  - `actual_for_stat(stat: str, split: dict) -> float | None` using Stats API split `stat` blob (`hits`, `totalBases`, `homeRuns`, `rbi`, `runs`, `stolenBases`, `baseOnBalls`, `strikeOuts`, `plateAppearances`, `doubles`, `triples`, `inningsPitched` parsed to outs if needed)
  - `combo hits_runs_rbis` = hits + runs + rbi
  - `qualifying_splits(stat, splits)` — batter: `plateAppearances > 0`; pitcher: `inningsPitched`/`outs`/`battersFaced` > 0
  - `hit_rates(stat: str, side: Side, line: float, splits: list[dict]) -> tuple[int | None, int | None, int | None]` for 5/10/15
  - Hit: over `actual > line`; under `actual < line`; push = miss, stays in denominator
  - Window uses `min(N, len(qualifying))`; null if zero qualifying games

- [ ] **Step 1: Write failing form tests**

```python
from app.domains.mlb.prop_board_form import hit_rates


def test_l5_skips_zero_pa_and_push_is_miss():
    splits = [
        {"stat": {"plateAppearances": 0, "hits": 0}},  # skip
        {"stat": {"plateAppearances": 4, "hits": 3}},  # over 1.5 hit
        {"stat": {"plateAppearances": 4, "hits": 2}},  # over 1.5 hit
        {"stat": {"plateAppearances": 4, "hits": 1}},  # miss
        {"stat": {"plateAppearances": 4, "hits": 0}},  # miss
        {"stat": {"plateAppearances": 4, "hits": 2}},  # hit
    ]
    l5, l10, l15 = hit_rates("hits", "over", 1.5, splits)
    assert l5 == 60  # 3/5
    assert l10 == l15 == 60


def test_under_is_complement_except_pushes():
    splits = [{"stat": {"plateAppearances": 3, "hits": 2}}]
    over, _, _ = hit_rates("hits", "over", 2.0, splits)
    under, _, _ = hit_rates("hits", "under", 2.0, splits)
    assert over == 0  # push
    assert under == 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_form.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement `hit_rates` + game-log fetch**

Keep `hit_rates` pure. In `people.py`, add:

```python
async def fetch_game_log_splits(
    client: httpx.AsyncClient,
    person_id: int,
    season: int,
    group: str,
) -> list[dict]:
    try:
        res = await client.get(
            f"{STATS_BASE}/people/{person_id}/stats",
            params={
                "stats": "gameLog",
                "group": group,
                "season": season,
                "sportId": 1,
            },
        )
        res.raise_for_status()
        return (res.json().get("stats") or [{}])[0].get("splits") or []
    except Exception as exc:
        logger.warning("game log failed for %s: %s", person_id, exc)
        return []
```

Map fields in `actual_for_stat` (hits → `hits`, total_bases → `totalBases`, pitcher_strikeouts → `strikeOuts`, pitching_outs → parse IP `1.2` as 5 outs, etc.). Chronology: Stats API gameLog splits are typically newest-first; **take the first N qualifying after filtering** as “last N”. Add a test that a trailing DNP is ignored.

- [ ] **Step 4: Re-run tests**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board_form.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/prop_board_form.py \
  backend/tests/test_mlb_prop_board_form.py \
  backend/app/providers/mlb_stats/people.py
git commit -m "Compute MLB prop hit rates from played-game logs."
```

---

### Task 5: Assemble `get_mlb_prop_board`

**Files:**
- Modify: `backend/app/domains/mlb/prop_board.py`
- Modify: `backend/tests/test_mlb_prop_board.py`
- Modify: `backend/app/domains/mlb/prop_stat_keys.py` only if a `display_stat_label` helper needs a `side` prefix (prefer local `f"{side.title()} {line} {display_stat_label(stat)}"`)

**Interfaces:**
- Consumes: snapshot fetchers already used by `get_mlb_props_today` (`fetch_latest_prophetx` / `fetch_latest_novig` / `fetch_latest_pinnacle(..., mains_only=True)`, `fetch_latest_parlay_api_odds("mlb")`, `fetch_latest_prizepicks("mlb")`, `fetch_latest_underdog("mlb")`), `_main_from_snapshot_rows` / parlay main indexes from `props.py` (import those helpers rather than copying SQL), `match_player_key`, ESPN roster index, today’s scoreboard for opponent/game_pk/start, `search_person_id` + `fetch_game_log_splits`, team rank index
- Produces: full `MlbPropBoardResponse`
- Warnings: `parlay_unavailable`, `gamelogs_unavailable`, `team_ranks_unavailable` (append, never raise)

Quote collection:

1. For each sportsbook main index (`prophetx`, `novig`, `pinnacle`, `draftkings`, `fanduel`, `betmgm`, `caesars`, `kalshi`, `fliff`, `bet365`): one `BoardQuote` per `(player, stat)` at that book’s **main line** with over/under American.
2. DFS: one quote per PrizePicks row and Underdog row (`book="prizepicks"|"underdog"`, american None unless snapshot has it). Use `canonical_stat_key_from_pp_mlb` / `canonical_stat_key_from_ud_mlb`. Skip unknown stats.
3. `cluster_quotes` → for each cluster emit **two** `MlbPropBoardRow`s (over and under).
4. `books` chips: quotes on that cluster, ordered by `BOOK_CHIP_ORDER`, this side’s American (`over_american` / `under_american`).
5. Sort rows: `game_start_at` (None last), `player_name`, `stat`, over before under, `line`.

Soft-fail:

```python
warnings: list[str] = []
try:
    ...
except Exception:
    warnings.append("parlay_unavailable")
```

Same for ranks and gamelogs. Missing person_id → that player’s L# stay null, do not fail the board.

- [ ] **Step 1: Write failing assembler tests** (monkeypatch fetches)

```python
import pytest
from app.domains.mlb.prop_board import get_mlb_prop_board
from app.domains.mlb.prop_board_cluster import BoardQuote


@pytest.mark.asyncio
async def test_assembler_splits_lines_and_null_ip_for_dfs_only(monkeypatch):
    quotes = [
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=1.5,
            book="prophetx",
            over_american=-110,
            under_american=-110,
        ),
        BoardQuote(
            player_name="Judge",
            player_key="aaron judge",
            stat="hits",
            line=2.0,
            book="prizepicks",
            over_american=None,
            under_american=None,
        ),
    ]
    monkeypatch.setattr(
        "app.domains.mlb.prop_board.collect_board_quotes",
        lambda: quotes,
    )
    monkeypatch.setattr("app.domains.mlb.prop_board.load_enrichment", lambda *_: ({}, {}, [], set()))
    body = await get_mlb_prop_board()
    lines = sorted({r.line for r in body.rows})
    assert lines == [1.5, 2.0]
    dfs = [r for r in body.rows if r.line == 2.0]
    assert all(r.ip_pct is None for r in dfs)
    assert {r.side for r in body.rows} == {"over", "under"}
```

Factor `collect_board_quotes()` and `load_enrichment()` as module-level functions so tests can patch them.

- [ ] **Step 2: Run test to verify it fails**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board.py -v
```

Expected: FAIL (stub still empty)

- [ ] **Step 3: Implement assembler**

Keep `get_mlb_prop_board` async. Use one `httpx.AsyncClient` for person search + game logs + team season. Cap concurrent person lookups (e.g. `asyncio.Semaphore(8)`). Cache logs keyed by `person_id`.

Opponent: from today’s scoreboard games, map `team_abbrev` → opponent abbrev, `game_pk`, start time, home/away.

- [ ] **Step 4: Re-run tests including cluster/ranks/form**

```bash
PYTHONPATH=.:backend pytest backend/tests/test_mlb_prop_board.py backend/tests/test_mlb_prop_board_cluster.py backend/tests/test_mlb_prop_board_ranks.py backend/tests/test_mlb_prop_board_form.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/prop_board.py backend/tests/test_mlb_prop_board.py
git commit -m "Assemble the MLB research board from mains and DFS lines."
```

---

### Task 6: Frontend fetch + filter

**Files:**
- Modify: `frontend/src/shared/lib/api.ts`
- Modify: `frontend/src/shared/lib/api.test.ts`
- Create: `frontend/src/features/mlb/hooks/useMlbPropBoard.ts`
- Create: `frontend/src/features/mlb/league/filterMlbPropBoard.ts`
- Create: `frontend/src/features/mlb/league/filterMlbPropBoard.test.ts`

**Interfaces:**
- Consumes: OpenAPI types from Task 1 (`paths["/api/mlb/props/board"]["get"]["responses"]["200"]["content"]["application/json"]`)
- Produces:
  - `fetchMlbPropBoard(): Promise<ApiMlbPropBoardResponse>`
  - `useMlbPropBoard()` query key `["mlb", "props", "board"]`, `refetchInterval: 15 * 60_000` (same cadence as `useMlbProps`)
  - `filterMlbPropBoardRows(rows, { teams: Set<string>, query: string })`

- [ ] **Step 1: Write failing api + filter tests**

In `api.test.ts` add a case that `fetchMlbPropBoard` GETs `/api/mlb/props/board` with no query string.

```typescript
import { filterMlbPropBoardRows } from "./filterMlbPropBoard";
import type { ApiMlbPropBoardRow } from "@/shared/lib/api";

const row = (over: Partial<ApiMlbPropBoardRow>): ApiMlbPropBoardRow =>
  ({
    player_name: "Aaron Judge",
    headshot_url: null,
    team_abbrev: "NYY",
    opponent_abbrev: "BOS",
    home_away: "away",
    stat: "hits",
    market_label: "Over 1.5 Hits",
    side: "over",
    line: 1.5,
    game_pk: 1,
    game_start_at: null,
    books: [],
    ip_pct: 53,
    opp_def_rank: 2,
    opp_def_label: "2nd BOS",
    opp_pace_rank: 5,
    opp_pace_label: "5th BOS",
    hit_l5: 60,
    hit_l10: 50,
    hit_l15: 40,
    ...over,
  }) as ApiMlbPropBoardRow;

it("filters by team and player substring", () => {
  const rows = [
    row({}),
    row({ player_name: "Mookie Betts", team_abbrev: "LAD" }),
  ];
  const out = filterMlbPropBoardRows(rows, {
    teams: new Set(["NYY"]),
    query: "judge",
  });
  expect(out).toHaveLength(1);
  expect(out[0].player_name).toBe("Aaron Judge");
});
```

Export `ApiMlbPropBoardResponse` / `ApiMlbPropBoardRow` from `api.ts` using the generated schema (same pattern as `ApiMlbPropsResponse`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/mlb/league/filterMlbPropBoard.test.ts
```

Expected: FAIL (`fetchMlbPropBoard` missing)

- [ ] **Step 3: Implement fetch + filter + hook**

```typescript
export async function fetchMlbPropBoard(): Promise<ApiMlbPropBoardResponse> {
  const res = await fetch(`${API_BASE}/api/mlb/props/board`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MLB prop board request failed: ${res.status}`);
  }
  return res.json();
}
```

```typescript
export function filterMlbPropBoardRows(
  rows: ApiMlbPropBoardRow[],
  { teams, query }: { teams: Set<string>; query: string },
): ApiMlbPropBoardRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (teams.size > 0 && (!row.team_abbrev || !teams.has(row.team_abbrev))) {
      return false;
    }
    if (q && !row.player_name.toLowerCase().includes(q)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Re-run tests**

```bash
cd frontend && npx vitest run src/shared/lib/api.test.ts src/features/mlb/league/filterMlbPropBoard.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/api.ts frontend/src/shared/lib/api.test.ts \
  frontend/src/features/mlb/hooks/useMlbPropBoard.ts \
  frontend/src/features/mlb/league/filterMlbPropBoard.ts \
  frontend/src/features/mlb/league/filterMlbPropBoard.test.ts
git commit -m "Add MLB prop board client fetch and filters."
```

---

### Task 7: Research table UI + drop DFS tabs / player route

**Files:**
- Create: `frontend/src/features/mlb/league/MlbPropPicksTable.tsx`
- Create: `frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksHeader.tsx` (+ its test) — remove PrizePicks/Underdog tabs; keep title “MLB Props” and `children` for filters
- Modify: `frontend/src/pages/MlbPropPicksPage.tsx` (+ `MlbPropPicksPage.test.tsx`) — `useMlbPropBoard`, table, reuse `MlbPropPicksFilters` team+search
- Modify: `frontend/src/app/AppRouter.tsx` — `<Navigate to="/mlb/prop_picks" replace />` for `/mlb/prop_picks/player/:playerSlug`
- Modify: `frontend/src/app/AppRouter.test.tsx` — board fetch mock `/api/mlb/props/board`; player URL is not the odds grid
- Modify: `md/system-design.md` — `/mlb/prop_picks` row; drop player-route row (note redirect)

**UI rules (from spec):**
- Columns: composite, Line, Odds, IP, Opp Def Rank, Opp Pace Rank, L5, L10, L15
- Composite: headshot, bold name, muted `NYY @ BOS`, `Over 1.5 Hits`
- Null IP/ranks/L# → `—`; nulls sort last
- Default sort: `game_start_at`, name, stat, Over then Under, line
- Header sort on every column
- Odds: book icon + American; DFS may omit American; overflow `+N` after ~4 chips
- Rank pills + green→amber→red hit-rate cells
- No app tabs; no “View X props”
- Empty: “No board yet”
- Keep last-updated via `dataUpdatedAt`

- [ ] **Step 1: Write failing table/page tests**

```tsx
it("renders board columns and no dfs tabs", () => {
  render(<MlbPropPicksTable rows={[fixtureRow]} lastUpdatedAt={Date.now()} />);
  expect(screen.getByText("Line")).toBeInTheDocument();
  expect(screen.getByText("IP")).toBeInTheDocument();
  expect(screen.getByText("Opp Def Rank")).toBeInTheDocument();
  expect(screen.getByText("Opp Pace Rank")).toBeInTheDocument();
  expect(screen.getByText("L5")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "PrizePicks" })).not.toBeInTheDocument();
});

it("renders em dash for null ip", () => {
  render(<MlbPropPicksTable rows={[{ ...fixtureRow, ip_pct: null }]} />);
  expect(screen.getByTestId("ip-cell")).toHaveTextContent("—");
});
```

Update `MlbPropPicksPage.test.tsx` to mock `useMlbPropBoard` instead of `useMlbProps`.

AppRouter: navigating `/mlb/prop_picks/player/aaron-judge` lands on the board (heading MLB Props), not “odds grid”.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/features/mlb/league/MlbPropPicksTable.test.tsx src/pages/MlbPropPicksPage.test.tsx src/app/AppRouter.test.tsx src/features/mlb/league/MlbPropPicksHeader.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement table, page, header, redirect**

Header: delete `APP_TABS` / `appFromSearch` usage on this page (keep `appFromSearch` exported only if game-detail still needs it — **game-detail Props still uses PrizePicks/Underdog**; do not delete the helper, just stop using it on `MlbPropPicksPage`).

Page sketch:

```tsx
export function MlbPropPicksPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useMlbPropBoard();
  const [selectedTeams, setSelectedTeams] = useState(new Set<string>());
  const [query, setQuery] = useState("");
  const rows = data?.rows ?? [];
  const filtered = useMemo(
    () => filterMlbPropBoardRows(rows, { teams: selectedTeams, query }),
    [rows, selectedTeams, query],
  );
  return (
    <div>
      <LeagueSubnav league="mlb" />
      <MlbPropPicksHeader>
        <MlbPropPicksFilters ... />
      </MlbPropPicksHeader>
      <MlbPropPicksTable
        rows={filtered}
        isLoading={isLoading}
        isError={isError}
        lastUpdatedAt={dataUpdatedAt || undefined}
      />
    </div>
  );
}
```

Router:

```tsx
<Route
  path="/mlb/prop_picks/player/:playerSlug"
  element={<Navigate to="/mlb/prop_picks" replace />}
/>
```

Leave `MlbPlayerPropsPage.tsx` in the tree this task if still imported elsewhere; if unused after redirect, delete page + tests in the same commit to avoid dead routes.

- [ ] **Step 4: Re-run frontend tests**

```bash
cd frontend && npx vitest run src/features/mlb/league/MlbPropPicksTable.test.tsx src/pages/MlbPropPicksPage.test.tsx src/app/AppRouter.test.tsx src/features/mlb/league/MlbPropPicksHeader.test.tsx src/pages/MlbPlayerPropsPage.test.tsx
```

Expected: PASS (player page tests removed or converted to redirect)

- [ ] **Step 5: Update `md/system-design.md`**

Replace the `/mlb/prop_picks` table row: research table, `useMlbPropBoard`, `GET /api/mlb/props/board`. Remove the player-detail row; mention replace-redirect. Add `GET /api/mlb/props/board` to the API list.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mlb/league/MlbPropPicksTable.tsx \
  frontend/src/features/mlb/league/MlbPropPicksTable.test.tsx \
  frontend/src/features/mlb/league/MlbPropPicksHeader.tsx \
  frontend/src/features/mlb/league/MlbPropPicksHeader.test.tsx \
  frontend/src/pages/MlbPropPicksPage.tsx \
  frontend/src/pages/MlbPropPicksPage.test.tsx \
  frontend/src/app/AppRouter.tsx \
  frontend/src/app/AppRouter.test.tsx \
  md/system-design.md
git commit -m "Render the MLB prop board as a research table."
```

---

## Self-review

| Spec requirement | Task |
| --- | --- |
| New `GET /api/mlb/props/board` | 1, 5 |
| Exact-line cluster; split mains | 2, 5 |
| Always Over + Under rows | 2, 5 |
| Mains + DFS only, no alts | 5 |
| IP PX→Novig→Pinnacle→DK, row side, DFS null | 2, 5 |
| Opp def ERA vs OPS; pace PA/G | 3, 5 |
| L5/L10/L15 played games; push miss | 4 |
| Composite first cell; listed columns | 7 |
| No PP/UD tabs; remove player grid | 7 |
| Soft-fail warnings; empty board | 5, 7 |
| `today` / game Props unchanged | 5 (do not touch those handlers) |
| system-design + OpenAPI | 1, 7 |

No TBD/TODO left in tasks. Types: `MlbPropBoardRow.ip_pct: int | None`, `Cluster.quotes: tuple[BoardQuote, ...]`, `fetchMlbPropBoard()` no query params.

---

## Execution

Plan saved to `docs/superpowers/plans/2026-08-23-mlb-prop-picks-research-table.md`.

Two execution options:

1. **Subagent-driven (recommended)** — a fresh subagent per task, review between tasks  
2. **Inline** — run tasks in this session with executing-plans and checkpoints  

Which approach?
