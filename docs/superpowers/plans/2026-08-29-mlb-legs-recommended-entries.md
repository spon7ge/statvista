# MLB Legs Recommended Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/mlb/legs` as complete N-pick cards (`entries[]`) packed from PLAY, with no public leftover PLAY list.

**Architecture:** Keep `price_line` and `get_mlb_legs` I/O. After the sorted PLAY pool, a pure `pack_entries` builds disjoint cards of size N (Flex 6: max 2 per `game_id`). The envelope exposes `entries` only; `unpacked_remainder` keeps the identity equation.

**Tech Stack:** FastAPI, Pydantic, pytest; React 19, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md`  
Pricing unchanged: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md`

## Global Constraints

- Product name: **statvista**. Research copy only (no locks / guaranteed EV).
- Do **not** change `prop_fair`, `GET /api/mlb/props/today`, `GET /api/mlb/props/board`, or game-detail Props.
- Do **not** add WNBA `/api/wnba/legs`. `/wnba/legs` must not call the MLB API.
- Never invent book quotes. Never `implied = 1 / payout_multiplier`.
- Never import `mlb.prop_formats` for Legs break-evens.
- Cards only: no public top-level PLAY array. Never emit a partial card (`len(entry.legs) == query legs`).
- One `match_player_key` per response (and per card). Flex 6: max 2 non-null `game_id`s per card. Power/UD: no same-game cap.
- Greedy packer only (not a combination search).
- Tests with code (TDD). OpenAPI in sync (`export_openapi` + `npm run generate:api`).
- Follow `md/skills.md`. Legs work is **Python FastAPI + React** (pytest, Pydantic, Vitest).
- **§17:** validate `app`/`format`/`legs` (422); no secrets in logs; errors not swallowed (`warnings[]`); UI keyboard/labels/focus. Public read like `/api/mlb/props/board` (no per-user auth).
- **§09:** real `assert` / raise.
- **Do not git commit** unless the user asks.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/betting/legs_pack.py` | `PackablePlay`, `PackedEntry`, `pack_entries` |
| `backend/tests/test_legs_pack.py` | Packer unit tests |
| `backend/app/domains/mlb/schemas_legs.py` | `MlbLegsEntry`; `unpacked_remainder`; `entries`; drop `legs` |
| `backend/app/domains/mlb/schemas.py` | Re-export `MlbLegsEntry` |
| `backend/app/domains/mlb/legs.py` | Sort → pack → envelope; `flex_same_game_warning=False` |
| `backend/tests/test_mlb_legs.py` | Identity, cards, Flex cap, no top-level `legs` |
| `backend/openapi-golden.json`, `frontend/openapi.json`, `frontend/src/shared/lib/api.schema.d.ts` | Regen |
| `frontend/src/features/mlb/league/mlbLegsExample.ts` | `?example=1` card fixtures |
| `frontend/src/features/mlb/league/MlbLegsBoard.tsx` | Entry blocks |
| `frontend/src/features/mlb/league/MlbLegsBoard.test.tsx` | N rows per card; empty entries |
| `frontend/src/pages/LeagueLegsPage.test.tsx` | WNBA no-fetch; MLB cards |
| `md/system-design.md` | Page ↔ API row |
| recommended-entries spec | Status: **Approved** |

---

### Task 1: Pure packer

**Files:**
- Create: `backend/app/domains/betting/legs_pack.py`
- Create: `backend/tests/test_legs_pack.py`

**Interfaces:**
- Consumes: `MlbLegsPlay` from `app.domains.mlb.schemas_legs`
- Produces:
  - `PackablePlay(player_key: str, play: MlbLegsPlay)`
  - `PackedEntry(rank: int, legs: list[MlbLegsPlay])` — each play `rank` is 1…n
  - `pack_entries(plays: list[PackablePlay], *, n: int, format: str) -> tuple[list[PackedEntry], int]` — second value is `unpacked_remainder` (`len(plays) - n * len(entries)`)

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_legs_pack.py
from app.domains.betting.legs_pack import PackablePlay, pack_entries
from app.domains.mlb.schemas_legs import MlbLegsPlay


def _item(
    player_key: str,
    player: str,
    margin: float,
    *,
    game_id: str | None = None,
    market: str = "Hits",
) -> PackablePlay:
    return PackablePlay(
        player_key=player_key,
        play=MlbLegsPlay(
            rank=0,
            player=player,
            team="NYY",
            matchup="NYY @ BOS",
            market=market,
            dfs_line=1.5,
            side="over",
            variant="standard",
            game_id=game_id,
            sharp_anchor="pinnacle",
            fair_prob=0.60,
            break_even=0.56,
            required_margin_pts=4.0,
            margin_pts=margin,
            book_disagreement_pts=1.0,
            payout_multiplier=1.0,
        ),
    )


def test_five_plays_n4_one_card_one_unpacked():
    plays = [
        _item("a", "A", 9.0),
        _item("b", "B", 8.0),
        _item("c", "C", 7.0),
        _item("d", "D", 6.0),
        _item("e", "E", 5.0),
    ]
    entries, unpacked = pack_entries(plays, n=4, format="power")
    assert len(entries) == 1
    assert unpacked == 1
    assert [p.player for p in entries[0].legs] == ["A", "B", "C", "D"]
    assert [p.rank for p in entries[0].legs] == [1, 2, 3, 4]


def test_same_player_key_skipped_second_market():
    plays = [
        _item("judge", "Aaron Judge", 9.0, market="Hits"),
        _item("judge", "Aaron Judge", 8.0, market="Total Bases"),
        _item("soto", "Juan Soto", 7.0),
    ]
    entries, unpacked = pack_entries(plays, n=2, format="power")
    assert len(entries) == 1
    assert unpacked == 1
    assert [p.player for p in entries[0].legs] == ["Aaron Judge", "Juan Soto"]
    assert entries[0].legs[0].market == "Hits"


def test_flex_skips_third_same_game_and_fills_from_others():
    plays = [
        _item("a", "A", 9.0, game_id="111"),
        _item("b", "B", 8.0, game_id="111"),
        _item("c", "C", 7.0, game_id="111"),
        _item("d", "D", 6.0, game_id="222"),
        _item("e", "E", 5.0, game_id="333"),
        _item("f", "F", 4.0, game_id="444"),
        _item("g", "G", 3.0, game_id="555"),
    ]
    entries, unpacked = pack_entries(plays, n=6, format="flex")
    assert len(entries) == 1
    keys = {p.player for p in entries[0].legs}
    assert "C" not in keys
    assert unpacked == 1
    games = [p.game_id for p in entries[0].legs]
    assert games.count("111") == 2


def test_flex_cannot_fill_six_no_card():
    plays = [
        _item("a", "A", 9.0, game_id="111"),
        _item("b", "B", 8.0, game_id="111"),
        _item("c", "C", 7.0, game_id="111"),
    ]
    entries, unpacked = pack_entries(plays, n=6, format="flex")
    assert entries == []
    assert unpacked == 3


def test_power_allows_three_same_game():
    plays = [
        _item("a", "A", 9.0, game_id="111"),
        _item("b", "B", 8.0, game_id="111"),
        _item("c", "C", 7.0, game_id="111"),
    ]
    entries, unpacked = pack_entries(plays, n=3, format="power")
    assert len(entries) == 1
    assert unpacked == 0
    assert [p.game_id for p in entries[0].legs] == ["111", "111", "111"]
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_legs_pack.py -v`

- [ ] **Step 3: Implement `legs_pack.py`**

```python
from __future__ import annotations

from dataclasses import dataclass

from app.domains.mlb.schemas_legs import MlbLegsPlay


@dataclass(frozen=True)
class PackablePlay:
    player_key: str
    play: MlbLegsPlay


@dataclass(frozen=True)
class PackedEntry:
    rank: int
    legs: list[MlbLegsPlay]


def pack_entries(
    plays: list[PackablePlay],
    *,
    n: int,
    format: str,
) -> tuple[list[PackedEntry], int]:
    if n < 1:
        raise ValueError("n must be >= 1")
    used: set[str] = set()
    entries: list[PackedEntry] = []
    flex = format == "flex"
    while True:
        card: list[PackablePlay] = []
        game_counts: dict[str, int] = {}
        on_card: set[str] = set()
        for item in plays:
            if item.player_key in used or item.player_key in on_card:
                continue
            gid = item.play.game_id
            if flex and gid is not None and game_counts.get(gid, 0) >= 2:
                continue
            card.append(item)
            on_card.add(item.player_key)
            if gid is not None:
                game_counts[gid] = game_counts.get(gid, 0) + 1
            if len(card) == n:
                break
        if len(card) < n:
            packed = n * len(entries)
            return entries, len(plays) - packed
        used.update(item.player_key for item in card)
        ranked = [
            item.play.model_copy(update={"rank": i})
            for i, item in enumerate(card, start=1)
        ]
        entries.append(PackedEntry(rank=len(entries) + 1, legs=ranked))
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_legs_pack.py -v`

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 2: Schemas, assembler, OpenAPI

**Files:**
- Modify: `backend/app/domains/mlb/schemas_legs.py`
- Modify: `backend/app/domains/mlb/schemas.py` (re-export `MlbLegsEntry`)
- Modify: `backend/app/domains/mlb/legs.py` (`_empty_rejected_summary`, `_envelope`, PLAY loop stores `PackablePlay`, pack before envelope)
- Modify: `backend/tests/test_mlb_legs.py`
- Regen: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Consumes: `pack_entries`, `PackablePlay` from Task 1
- Produces: `MlbLegsResponse.entries: list[MlbLegsEntry]`; no `legs` field; `MlbLegsRejectedSummary.unpacked_remainder: int`

- [ ] **Step 1: Write failing assembler/route assertions**

In `test_mlb_legs.py`:
- Replace every `body.legs` with packed `body.entries` (flatten `entry.legs` only when asserting a player on a card).
- Identity: `legs_evaluated == legs_surfaced + sum(rejected_summary.model_dump().values())` and `legs_surfaced == sum(len(e.legs) for e in body.entries)`.
- Route 200 empty seed: `payouts_assumed is True`, `entries == []`.
- Fixture that yields **one** PLAY while query `legs=4`: `entries == []`, `unpacked_remainder == 1`, keep existing `legs_evaluated` / coverage reject counts and add `unpacked_remainder`.
- Replace `test_flex_same_game_warning_when_top_cluster`: three PLAY same `game_id` on Flex 6 → `entries == []`, `flex_same_game_warning is False`, `unpacked_remainder == 3`.
- Add: two PLAY `game_id=111` plus four other games, Flex 6, all priceable → one entry of 6; third same-game player absent; `flex_same_game_warning is False`.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_legs.py -q`

- [ ] **Step 3: Schemas**

`MlbLegsRejectedSummary`: add `unpacked_remainder: int`.

```python
class MlbLegsEntry(BaseModel):
    model_config = _RESPONSE_CONFIG
    rank: int
    legs: list[MlbLegsPlay]
```

`MlbLegsResponse`: remove `legs`; add `entries: list[MlbLegsEntry] = Field(default_factory=list)`.

Re-export `MlbLegsEntry` in `schemas.py`.

- [ ] **Step 4: Assembler**

Append `PackablePlay(player_key=player_key, play=MlbLegsPlay(... rank=0 ...))` in the PLAY loop.

Sort packable with `(-play.margin_pts, -play.fair_prob, play.player.casefold())`. Do not assign global ranks before packing.

```python
packed, unpacked = pack_entries(packable, n=legs, format=format)
rejected_counts["unpacked_remainder"] = unpacked
entries = [MlbLegsEntry(rank=pe.rank, legs=pe.legs) for pe in packed]
```

`_empty_rejected_summary()` includes `unpacked_remainder=0`.

`_envelope` takes `entries: list[MlbLegsEntry]`:
- `surfaced = sum(len(e.legs) for e in entries)`
- identity includes `unpacked_remainder`
- min/max break-even from packed plays only
- `flex_same_game_warning=False`
- no `legs=` argument

Stale DFS / empty seed: `entries=[]`, unpacked 0.

- [ ] **Step 5: OpenAPI**

```bash
cd backend && PYTHONPATH=..:. python3 -c "from app.openapi_export import export_openapi; export_openapi()"
cp ../frontend/openapi.json openapi-golden.json
cd ../frontend && npm run generate:api
```

- [ ] **Step 6: Run**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_legs_pack.py tests/test_mlb_legs.py tests/test_mlb_props.py -q`

Expected: all pass.

- [ ] **Step 7: Commit** (skip unless asked)

---

### Task 3: Frontend cards

**Files:**
- Create: `frontend/src/features/mlb/league/mlbLegsExample.ts`
- Modify: `frontend/src/features/mlb/league/MlbLegsBoard.tsx`
- Modify: `frontend/src/features/mlb/league/MlbLegsBoard.test.tsx`
- Modify: `frontend/src/pages/LeagueLegsPage.test.tsx`

**Interfaces:**
- Consumes: `ApiMlbLegsResponse.entries`
- Produces: one block per entry (`Entry {rank}`); N `PlayRow`s; no flat list

- [ ] **Step 1: Failing tests**

- Mock `entries: [{ rank: 1, legs: [play(), play(), play(), play()] }]` on default 4-pick.
- Assert heading `Entry 1` and a player name; do not assert the old “No legs cleared the margin” string.
- Empty `entries`, `lines_seeded > 0`, `warnings: []` → text matches `/complete 4-pick/i`.
- `/wnba/legs` does not call `useMlbLegs`.
- `?example=1` shows layout-only banner and `Entry 1` plus `Entry 2`.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npm test -- src/pages/LeagueLegsPage.test.tsx src/features/mlb/league/MlbLegsBoard.test.tsx`

- [ ] **Step 3: Implement**

`isLegsEnvelope`: `Array.isArray(data?.entries)`.

`emptyCopy`: if `entries.length === 0` and not stale/missing snapshot → `No complete ${legs}-pick entry for this format.`

Preserve `example` on URL writes (`selectionSearch` / `example=1`).

```tsx
{(envelope?.entries ?? []).map((entry) => (
  <section key={entry.rank} aria-label={`Entry ${entry.rank}`}>
    <h2 className="text-[18px] font-medium text-white">Entry {entry.rank}</h2>
    <ul className="space-y-2">
      {entry.legs.map((leg) => (
        <PlayRow
          key={`${entry.rank}-${leg.rank}-${leg.player}-${leg.market}`}
          leg={leg}
        />
      ))}
    </ul>
  </section>
))}
```

Delete the `flex_same_game_warning` banner (always false after packing).

`mlbLegsExample.ts`: two `entries`, each with **exactly `legs`** unique fixture players; `unpacked_remainder: 0`; banner copy: example layout only, not live pricing.

- [ ] **Step 4: Tests PASS**

Run: `cd frontend && npm test -- src/pages/LeagueLegsPage.test.tsx src/features/mlb/league/MlbLegsBoard.test.tsx`

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 4: Docs

**Files:**
- Modify: `md/system-design.md` — `/mlb/legs` row: complete N-pick `entries`; packer; `unpacked_remainder`; Flex max 2 per game; link `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md`
- Modify: `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md` — Status: **Approved**
- Modify: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` — UI: PLAY is packed into `entries` (one sentence + pointer). Do not rewrite pricer math.

- [ ] **Step 1: Edit those files** (no placeholders)

- [ ] **Step 2: Commit** (skip unless asked)

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Greedy packer, remainder, Flex cap, Power same-game | 1 |
| `entries`, drop `legs`, `unpacked_remainder`, identity, OpenAPI | 2 |
| Envelope min/max from packed; `flex_same_game_warning` false | 2 |
| UI cards, empty complete-N copy, example cards, WNBA no-fetch | 3 |
| system-design + spec Approved | 4 |
| Props / `prop_fair` unchanged | 2 regression `test_mlb_props.py` |
