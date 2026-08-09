# MLB Preview Game Leaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Preview Matchup Leaders with Game Leaders — three ESPN-style batter cards (HR / AVG / OPS) showing the best in-game player each, with value + `#N`, last name + logo, and ESPN headshot.

**Architecture:** Swap `matchup_leaders` for `game_leaders` on `GET /api/mlb/games/{gamePk}`. Fetch depth-100 hitting boards, pick first roster hit per category, enrich headshot via ESPN roster index. Frontend replaces tabbed list with a 3-card `MlbGameLeaders` section under Matchup prediction. Team Stats ranks stay untouched.

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React 19 · TypeScript · Vite · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-mlb-preview-game-leaders-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Title exactly: **Game Leaders**
- Categories only: HR · AVG · OPS (one card each; no pitching; no tabs; no top-3 lists)
- Board fetch `limit=100`; AVG/OPS use qualified pool (same as Leaders page)
- Soft-fail; hide box when no cards; never fail game detail
- ESPN headshots via `get_mlb_player_index()` name match
- Last name only on cards; value + muted `#N` when rank present
- Right column: Odds → Game Info → Matchup prediction → Game Leaders
- OpenAPI sync required after schema change
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_leaders.py tests/test_mlb_game_detail_season_injuries.py -q`
- Verify frontend: targeted Vitest + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_detail.py` | Remove MatchupLeader*; add `MlbGameLeaderCard` / `MlbGameLeaders`; field rename |
| `backend/app/domains/mlb/schemas.py` | Re-exports |
| `backend/app/domains/mlb/leaders.py` | Optional `limit` on params/fetch/normalize (default TOP_N) |
| `backend/app/providers/mlb_stats/game_leaders.py` | Build game leaders (new; replaces matchup_leaders usage) |
| Delete or stop wiring: `backend/app/providers/mlb_stats/matchup_leaders.py` | Remove after swap (delete file + tests) |
| `backend/app/domains/mlb/game_detail.py` | `attach_game_leaders` / `_attach_game_leaders` |
| `backend/tests/test_mlb_game_leaders.py` | Selection + last_name + soft-fail |
| `backend/tests/test_mlb_matchup_leaders.py` | Delete |
| `backend/tests/test_mlb_game_detail_season_injuries.py` | Swap attach tests |
| OpenAPI trio | Contract |
| `frontend/.../types.ts`, `mapMlbGameDetail.ts` (+test), `testFixtures.ts` | View + map |
| Create `MlbGameLeaders.tsx` (+test); delete `MlbMatchupLeaders*` | UI |
| `MlbProjectedLineups.tsx` (+test) | Wire |
| `md/system-design.md` + both design specs status | Docs |

---

### Task 1: Schema — `game_leaders` replaces `matchup_leaders`

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Modify: `backend/app/domains/mlb/game_detail.py` (attach rename only; fetch still broken until Task 2)
- Modify: `backend/tests/test_mlb_game_detail_season_injuries.py`

**Interfaces:**
- Produces:
  - `MlbGameLeaderCard(key: Literal["hr","avg","ops"], label: str, rank: int | None, value: str, player_id: str, last_name: str, team_abbrev: str, side: Literal["away","home"], headshot_url: str | None = None)`
  - `MlbGameLeaders(leaders: list[MlbGameLeaderCard])`
  - `MlbGameDetail.game_leaders: MlbGameLeaders | None = None`
  - Remove `MlbMatchupLeader*` and `matchup_leaders`
  - `attach_game_leaders(detail, leaders) -> MlbGameDetail`

- [ ] **Step 1: Rewrite attach tests for game leaders**

Replace matchup attach tests with:

```python
from app.domains.mlb.schemas_game_detail import MlbGameLeaderCard, MlbGameLeaders

def test_attach_game_leaders():
    leaders = MlbGameLeaders(
        leaders=[
            MlbGameLeaderCard(
                key="hr",
                label="HR",
                rank=4,
                value="33",
                player_id="123",
                last_name="Olson",
                team_abbrev="ATL",
                side="away",
                headshot_url="https://a.espncdn.com/i/headshots/mlb/players/full/1.png",
            )
        ]
    )
    out = attach_game_leaders(_scheduled_detail(), leaders)
    assert out.game_leaders is not None
    assert out.game_leaders.leaders[0].last_name == "Olson"


def test_attach_game_leaders_none_noop():
    detail = _scheduled_detail()
    assert attach_game_leaders(detail, None) is detail
```

Remove old `test_attach_matchup_leaders*` and MatchupLeader imports.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_game_detail_season_injuries.py::test_attach_game_leaders \
  tests/test_mlb_game_detail_season_injuries.py::test_attach_game_leaders_none_noop -v
```

- [ ] **Step 3: Update schemas + attach helper**

In `schemas_game_detail.py`: remove MatchupLeader models from `__all__` and file; add:

```python
class MlbGameLeaderCard(BaseModel):
    model_config = _RESPONSE_CONFIG

    key: Literal["hr", "avg", "ops"]
    label: str
    rank: int | None = None
    value: str
    player_id: str
    last_name: str
    team_abbrev: str
    side: Literal["away", "home"]
    headshot_url: str | None = None


class MlbGameLeaders(BaseModel):
    model_config = _RESPONSE_CONFIG

    leaders: list[MlbGameLeaderCard]
```

On `MlbGameDetail`: replace `matchup_leaders` with `game_leaders: MlbGameLeaders | None = None`.

Update `schemas.py` re-exports.

In `game_detail.py`: rename `attach_matchup_leaders` → `attach_game_leaders` updating field to `game_leaders`. Temporarily comment or leave `_attach_matchup_leaders` broken — Task 2 will replace the call site. Prefer renaming call site to `_attach_game_leaders` that still imports old fetch only if tests for attach don't need the async path; for this task, change attach only and keep async wire importing old module until Task 2 (or stub `_attach_game_leaders` returning detail unchanged). **Preferred:** update attach helper + schema now; leave `_attach_matchup_leaders` calling old fetch but writing via a temporary bridge — cleaner to have Task 1 only change schema/attach tests and keep `matchup_leaders` field until Task 2. **Do the full field rename in Task 1** and make `_attach_*` a no-op soft return of `detail` until Task 2 wires fetch (avoids import errors on MatchupLeaders).

```python
def attach_game_leaders(
    detail: MlbGameDetail,
    leaders: MlbGameLeaders | None,
) -> MlbGameDetail:
    """Attach Preview Game Leaders onto a Stats-normalized detail payload."""
    if leaders is None:
        return detail
    return detail.model_copy(update={"game_leaders": leaders})


async def _attach_game_leaders(detail: MlbGameDetail, payload: dict) -> MlbGameDetail:
    """Placeholder until Task 2; soft no-op."""
    return detail
```

Replace scheduled call to use `_attach_game_leaders`. Remove MatchupLeaders imports / old attach.

- [ ] **Step 4: Run attach tests — PASS**; fix any import fallout in season/injuries module

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_detail_season_injuries.py -q
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/mlb/schemas_game_detail.py \
  backend/app/domains/mlb/schemas.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_game_detail_season_injuries.py
git commit -m "$(cat <<'EOF'
feat(mlb): replace matchup_leaders schema with game_leaders

EOF
)"
```

---

### Task 2: Leaders limit=100 + `game_leaders` provider + wire

**Files:**
- Modify: `backend/app/domains/mlb/leaders.py` (`stats_request_params`, `fetch_category_payload`, `normalize_category_payload` accept `limit: int | None = None` defaulting to `TOP_N`)
- Create: `backend/app/providers/mlb_stats/game_leaders.py`
- Create: `backend/tests/test_mlb_game_leaders.py`
- Delete: `backend/app/providers/mlb_stats/matchup_leaders.py`
- Delete: `backend/tests/test_mlb_matchup_leaders.py`
- Modify: `backend/app/domains/mlb/game_detail.py` (real `_attach_game_leaders`)

**Interfaces:**
- Produces:
  - `def last_name_from_full(full_name: str) -> str`
  - `def pick_game_leader_from_board(category: MlbLeaderCategory, *, away_ids, home_ids, away_abbrev, home_abbrev, headshot_by_name: dict[str, str | None]) -> MlbGameLeaderCard | None`
  - `async def fetch_game_leaders(client, *, away_team_id, home_team_id, away_abbrev, home_abbrev, season) -> MlbGameLeaders | None`
  - `_attach_game_leaders` calls fetch + attach

- [ ] **Step 1: Failing unit tests**

`backend/tests/test_mlb_game_leaders.py`:

```python
from app.domains.mlb.schemas_leaders import MlbLeaderCategory, MlbLeaderRow
from app.providers.mlb_stats.game_leaders import (
    last_name_from_full,
    pick_game_leader_from_board,
)


def test_last_name_from_full():
    assert last_name_from_full("Matt Olson") == "Olson"
    assert last_name_from_full("Olson") == "Olson"


def test_pick_game_leader_first_roster_hit():
    cat = MlbLeaderCategory(
        key="hr",
        label="Home Runs",
        stat="HR",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="Other Guy", team_abbrev="SEA", gp=10, value="40"),
            MlbLeaderRow(rank=4, player_id="2", name="Matt Olson", team_abbrev="ATL", gp=10, value="33"),
            MlbLeaderRow(rank=8, player_id="3", name="Home Bat", team_abbrev="NYY", gp=10, value="28"),
        ],
    )
    card = pick_game_leader_from_board(
        cat,
        away_ids={"2"},
        home_ids={"3"},
        away_abbrev="ATL",
        home_abbrev="NYY",
        headshot_by_norm={"matt olson": "https://a.espncdn.com/i/headshots/mlb/players/full/1.png"},
    )
    assert card is not None
    assert card.key == "hr"
    assert card.rank == 4
    assert card.last_name == "Olson"
    assert card.side == "away"
    assert card.headshot_url is not None


def test_pick_game_leader_none_when_no_roster_hit():
    cat = MlbLeaderCategory(
        key="avg",
        label="Batting Average",
        stat="AVG",
        leaders=[
            MlbLeaderRow(rank=1, player_id="9", name="X", team_abbrev="SEA", gp=10, value=".340"),
        ],
    )
    assert (
        pick_game_leader_from_board(
            cat,
            away_ids={"1"},
            home_ids={"2"},
            away_abbrev="ATL",
            home_abbrev="NYY",
            headshot_by_norm={},
        )
        is None
    )
```

Use the same name-normalization key as ESPN index (`norm_player_name`). In `pick_game_leader_from_board`, look up headshot with `norm_player_name(row.name)`.

- [ ] **Step 2: Run — FAIL**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_leaders.py -v
```

- [ ] **Step 3: Extend leaders.py limit**

```python
def stats_request_params(..., limit: int | None = None) -> dict[str, str | int]:
    ...
    "limit": TOP_N if limit is None else limit,
    ...

async def fetch_category_payload(..., limit: int | None = None) -> dict:
    res = await client.get(STATS_URL, params=stats_request_params(..., limit=limit))
    ...

def normalize_category_payload(..., limit: int | None = None) -> MlbLeaderCategory:
    max_n = TOP_N if limit is None else limit
    ...
        if len(leaders) >= max_n:
            break
```

Existing `get_mlb_leaders` callers unchanged (default TOP_N).

- [ ] **Step 4: Implement `game_leaders.py`**

```python
GAME_LEADER_KEYS = ("hr", "avg", "ops")
GAME_BOARD_LIMIT = 100
_LABEL = {"hr": "HR", "avg": "AVG", "ops": "OPS"}

def last_name_from_full(full_name: str) -> str:
    parts = full_name.strip().split()
    return parts[-1] if parts else full_name

def pick_game_leader_from_board(...) -> MlbGameLeaderCard | None:
    # first row whose player_id in away_ids|home_ids
    # build MlbGameLeaderCard with key from category.key cast to hr|avg|ops
    ...

async def fetch_game_leaders(...):
    # gather both rosters (soft empty sets)
    # select CATEGORY_SPECS for hr, avg, ops only
    # gather fetch_category_payload(..., limit=100) with return_exceptions=True
    # normalize each with limit=100
    # get_mlb_player_index(); build headshot_by_norm = {name: entry["headshot_url"]}
    # for each category pick_game_leader_from_board
    # if no cards: return None
    # return MlbGameLeaders(leaders=cards)  # order HR, AVG, OPS when present
```

Wire `_attach_game_leaders` like former matchup attach (season, team ids, abbrevs, soft try in `get_mlb_game_detail`).

Delete `matchup_leaders.py` and `test_mlb_matchup_leaders.py`.

- [ ] **Step 5: Run tests**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_game_leaders.py \
  tests/test_mlb_game_detail_season_injuries.py \
  tests/test_mlb_leaders.py -q
```

Expected: PASS (leaders page tests still default limit 10)

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/leaders.py \
  backend/app/providers/mlb_stats/game_leaders.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_game_leaders.py \
  backend/app/providers/mlb_stats/matchup_leaders.py \
  backend/tests/test_mlb_matchup_leaders.py
git commit -m "$(cat <<'EOF'
feat(mlb): build Game Leaders from depth-100 hitting boards

EOF
)"
```

(Use `git add -u` for deletions of matchup_leaders files.)

---

### Task 3: OpenAPI regen

**Files:** `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

- [ ] **Step 1:** From repo root:

```bash
PYTHONPATH=.:backend python scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `game_leaders` present and `matchup_leaders` gone.

- [ ] **Step 2: Commit**

```bash
git add frontend/openapi.json backend/openapi-golden.json frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
chore(api): regenerate OpenAPI for MLB game_leaders

EOF
)"
```

---

### Task 4: Frontend types + mapper

**Files:**
- `frontend/src/features/mlb/lib/types.ts`
- `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts`
- `frontend/src/features/mlb/lib/testFixtures.ts`

**Interfaces:**

```ts
export type MlbGameLeaderCard = {
  key: "hr" | "avg" | "ops";
  label: string;
  rank: number | null;
  value: string;
  playerId: string;
  lastName: string;
  teamAbbrev: string;
  side: "away" | "home";
  headshotUrl: string | null;
};

export type MlbGameLeaders = { leaders: MlbGameLeaderCard[] };
// on view: gameLeaders: MlbGameLeaders | null
```

Remove MatchupLeader* / `matchupLeaders`.

- [ ] **Step 1:** Failing mapper tests for `game_leaders` → `gameLeaders` (incl. `headshot_url`, `last_name`).

- [ ] **Step 2:** Implement map + fixtures (`gameLeaders: null`).

- [ ] **Step 3:**

```bash
cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): map game_leaders on game detail view

EOF
)"
```

---

### Task 5: `MlbGameLeaders` UI + wire

**Files:**
- Create: `frontend/src/features/mlb/game/MlbGameLeaders.tsx`
- Create: `frontend/src/features/mlb/game/MlbGameLeaders.test.tsx`
- Delete: `MlbMatchupLeaders.tsx`, `MlbMatchupLeaders.test.tsx`
- Modify: `MlbProjectedLineups.tsx`, `MlbProjectedLineups.test.tsx`

**Interfaces:**
- `MlbGameLeaders({ detail })` — null if `!detail.gameLeaders?.leaders.length`

- [ ] **Step 1: Failing tests**

- null / empty → nothing
- title **Game Leaders**
- three cards for HR/AVG/OPS with value, `#N`, last name, logo, headshot img
- missing rank → no `#` node
- headshot null → fallback testid `mlb-game-leader-headshot-fallback-{key}`
- placement: inside right column after `mlb-matchup-prediction`

- [ ] **Step 2: Implement component**

```tsx
export function MlbGameLeaders({ detail }: { detail: MlbGameDetailView }) {
  const payload = detail.gameLeaders;
  if (!payload?.leaders.length) return null;
  return (
    <GameSection data-testid="mlb-game-leaders" className="w-full !p-3">
      <h2 className="text-center text-[18px] font-semibold text-white">
        Game Leaders
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {payload.leaders.map((card) => {
          const team = card.side === "away" ? detail.away : detail.home;
          const logo = team.logoUrl ?? mlbTeamLogoUrl(team.abbrev);
          return (
            <div
              key={card.key}
              data-testid={`mlb-game-leader-card-${card.key}`}
              className="flex flex-col items-center rounded-lg bg-white/[0.06] p-2 text-center"
            >
              <span className="text-[14px] font-semibold tracking-wide text-white/70">
                {card.label}
              </span>
              <span className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-white">
                {card.value}
              </span>
              {card.rank != null ? (
                <span
                  data-testid={`mlb-game-leader-rank-${card.key}`}
                  className="text-[14px] text-white/40"
                >{`#${card.rank}`}</span>
              ) : null}
              <div className="mt-2 flex items-center gap-1">
                {logo ? <img src={logo} alt="" className="size-4 object-contain" /> : null}
                <span className="text-[14px] font-semibold uppercase text-white">
                  {card.lastName}
                </span>
              </div>
              <GameLeaderHeadshot card={card} />
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
```

`GameLeaderHeadshot`: ESPN url with `onError` → initial fallback (mirror prop picks).

Wire: `<MlbGameLeaders detail={detail} />` after Matchup prediction; remove MatchupLeaders import.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- \
  src/features/mlb/game/MlbGameLeaders.test.tsx \
  src/features/mlb/game/MlbProjectedLineups.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): render Game Leaders batter cards on Preview

EOF
)"
```

---

### Task 6: Docs

**Files:**
- `md/system-design.md` — Preview row: Game Leaders (HR/AVG/OPS cards, ESPN headshots, `#N`) replace Matchup Leaders wording
- `docs/superpowers/specs/2026-08-08-mlb-preview-game-leaders-design.md` → Status: Implemented
- Optional note on older ranks/matchup-leaders spec that Matchup Leaders UI was superseded

- [ ] **Step 1: Edit docs**

- [ ] **Step 2: Final verify**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_game_leaders.py \
  tests/test_mlb_game_detail_season_injuries.py -q
cd ../frontend && npm run check:api && npm test -- \
  src/features/mlb/lib/mapMlbGameDetail.test.ts \
  src/features/mlb/game/MlbGameLeaders.test.tsx \
  src/features/mlb/game/MlbProjectedLineups.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs(mlb): mark Game Leaders shipped in system-design

EOF
)"
```

---

## Spec coverage

| Requirement | Task |
| --- | --- |
| Replace Matchup Leaders with Game Leaders | 1–5 |
| HR/AVG/OPS one card each | 2, 5 |
| Value + `#N`, last name + logo, ESPN headshot | 2, 5 |
| limit=100 boards; roster best | 2 |
| Soft-fail / hide empty | 2, 5 |
| OpenAPI + system-design | 3, 6 |
| Team Stats ranks unchanged | (no task) |
