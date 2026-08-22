# WNBA Team-Preview BPG/SPG + Efficiency Cols Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scheduled WNBA Away/Home team-preview cards become PPG/RPG/APG/BPG/SPG, and the roster table gains SH-EFF, SC-EFF, PPEP, RTG, +/- from ESPN byathlete.

**Architecture:** Extend `schemas_team_preview` + `wnba_team_player_stats` parsing/leaders/merge; regenerate OpenAPI; update `WnbaTeamPreview` types, columns, and tests. Live/final centers unchanged.

**Tech Stack:** FastAPI/Pydantic, ESPN byathlete, React/Vitest, `scripts/export_openapi.py` → `frontend/openapi.json` → `openapi-typescript`

## Global Constraints

- Product name: **statvista**
- Spec: `docs/superpowers/specs/2026-08-21-wnba-team-preview-efficiency-design.md`
- Scope: scheduled Away/Home `team-preview` only (no live Away/Home)
- Leaders: `ppg`, `rpg`, `apg`, `bpg`, `spg` only (drop `fg_pct` / `fg3_pct`)
- No MPG gate for BPG/SPG
- Efficiency ESPN names: `shootingEfficiency`, `scoringEfficiency`, `pointsPerEstimatedPossessions`, `NBARating`, `plusMinus`
- Do not invent TS%/eFG%/USG%
- OpenAPI is the contract; run export + `npm run check:api`

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/wnba/schemas_team_preview.py` | `TeamLeaderKey` + roster efficiency fields |
| `backend/app/providers/espn/wnba_team_player_stats.py` | Parse, leaders, merge |
| `backend/tests/fixtures/espn_wnba_byathlete_atl.json` | Add ranks + efficiency stats on sample athletes |
| `backend/tests/test_wnba_team_preview.py` | Leader + parse/merge assertions |
| `scripts/export_openapi.py` / `frontend/openapi.json` / `frontend/src/shared/lib/api.schema.d.ts` / `backend/openapi-golden.json` | Contract sync |
| `frontend/src/features/basketball/game/WnbaTeamPreview.tsx` | Cards + roster cols |
| `frontend/src/features/basketball/game/WnbaTeamPreview.test.tsx` | UI assertions |
| `md/system-design.md` | Brief Away/Home leaders note if table mentions FG%/3FG% |

---

### Task 1: Schema + provider (BPG/SPG leaders + efficiency parse)

**Files:**
- Modify: `backend/app/domains/wnba/schemas_team_preview.py`
- Modify: `backend/app/providers/espn/wnba_team_player_stats.py`
- Modify: `backend/tests/fixtures/espn_wnba_byathlete_atl.json`
- Modify: `backend/tests/test_wnba_team_preview.py`

**Interfaces:**
- Produces:
  - `TeamLeaderKey = Literal["ppg","rpg","apg","bpg","spg"]`
  - `WnbaTeamRosterRow` fields: `sh_eff`, `sc_eff`, `ppep`, `rtg`, `plus_minus` (`str | None`)
  - `PlayerSeasonStats`: `stl_value`, `blk_value`, `stl_rank`, `blk_rank`, plus efficiency display fields
  - `build_team_leaders` returns five cards in order PPG→SPG; no shooting MPG gate

- [ ] **Step 1: Update byathlete fixture (first athlete at minimum)**

On athlete `3058901` (Allisha Gray) in `espn_wnba_byathlete_atl.json`, ensure:

```json
{ "name": "avgBlocks", "displayValue": "0.4", "value": 0.41935483, "rank": 42 }
{ "name": "avgSteals", "displayValue": "1.4", "value": 1.3870968, "rank": 8 }
{ "name": "shootingEfficiency", "displayValue": "1.12", "value": 1.12 }
{ "name": "scoringEfficiency", "displayValue": "1.05", "value": 1.05 }
{ "name": "pointsPerEstimatedPossessions", "displayValue": "0.98", "value": 0.98 }
{ "name": "NBARating", "displayValue": "112.3", "value": 112.3 }
{ "name": "plusMinus", "displayValue": "+3.2", "value": 3.2 }
```

Place efficiency stats under `general` or `offensive` as ESPN does (`NBARating`/`plusMinus` general; shooting/scoring/PPEP offensive). Add `rank` on `avgBlocks`/`avgSteals` for at least two athletes so BPG/SPG leaders resolve.

- [ ] **Step 2: Write failing backend tests**

Replace/update in `test_wnba_team_preview.py`:

```python
def test_build_team_leaders_ppg_rpg_apg_bpg_spg():
    athletes = parse_roster_athletes(_roster_fixture())
    stats = parse_byathlete_stat_map(_byathlete_fixture())
    rows = merge_roster_rows(athletes, stats)
    leaders = build_team_leaders(rows, stats)
    assert [c.key for c in leaders] == ["ppg", "rpg", "apg", "bpg", "spg"]
    assert [c.label for c in leaders] == ["PPG", "RPG", "APG", "BPG", "SPG"]
    assert leaders[0].value == "19.1"
    assert leaders[0].last_name == "Gray"
    # BPG / SPG: highest avgBlocks / avgSteals among roster (assert concrete last_name from fixture)


def test_merge_roster_includes_efficiency_fields():
    athletes = parse_roster_athletes(_roster_fixture())
    stats = parse_byathlete_stat_map(_byathlete_fixture())
    rows = merge_roster_rows(athletes, stats)
    gray = next(r for r in rows if r.player_id == "3058901")
    assert gray.sh_eff == "1.12"
    assert gray.sc_eff == "1.05"
    assert gray.ppep == "0.98"
    assert gray.rtg == "112.3"
    assert gray.plus_minus == "+3.2"
```

Delete or rewrite `test_build_team_leaders_ppg_rpg_apg_fg_pct_fg3_pct` and `test_build_team_leaders_shooting_requires_min_mpg` (MPG gate gone). Update `test_team_preview_response_constructs` roster construction if new fields are required without defaults — prefer `Field(default=None)` so old constructors still work.

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_team_preview.py -v`

Expected: FAIL on new leader keys / missing efficiency fields

- [ ] **Step 4: Implement schema**

In `schemas_team_preview.py`:

```python
TeamLeaderKey = Literal["ppg", "rpg", "apg", "bpg", "spg"]

# On WnbaTeamRosterRow add:
sh_eff: str | None = None
sc_eff: str | None = None
ppep: str | None = None
rtg: str | None = None
plus_minus: str | None = None
```

- [ ] **Step 5: Implement provider**

In `wnba_team_player_stats.py`:

1. `_LEADER_KEYS = ("ppg", "rpg", "apg", "bpg", "spg")`
2. Labels BPG/SPG; `_VALUE_ATTR` / `_RANK_ATTR` / `_DISPLAY_ATTR` for `blk_*` / `stl_*`
3. Extend `PlayerSeasonStats` with `stl_value`, `blk_value`, `stl_rank`, `blk_rank`, `sh_eff`, `sc_eff`, `ppep`, `rtg`, `plus_minus`
4. In `_stats_from_flat`, map:
   - `avgSteals` / `avgBlocks` → display already; add value + rank
   - `shootingEfficiency` → `sh_eff`
   - `scoringEfficiency` → `sc_eff`
   - `pointsPerEstimatedPossessions` → `ppep`
   - `NBARating` → `rtg`
   - `plusMinus` → `plus_minus`
5. Remove `_SHOOTING_LEADER_KEYS` and MPG gate logic from `build_team_leaders`
6. `merge_roster_rows` pass new fields onto `WnbaTeamRosterRow`

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_team_preview.py -v`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/domains/wnba/schemas_team_preview.py \
  backend/app/providers/espn/wnba_team_player_stats.py \
  backend/tests/fixtures/espn_wnba_byathlete_atl.json \
  backend/tests/test_wnba_team_preview.py
git commit -m "$(cat <<'EOF'
feat(wnba): team-preview BPG/SPG leaders and efficiency roster fields

EOF
)"
```

---

### Task 2: OpenAPI export + frontend types

**Files:**
- Modify: `frontend/openapi.json`, `frontend/src/shared/lib/api.schema.d.ts`, `backend/openapi-golden.json` (if project keeps golden in sync)

**Interfaces:**
- Consumes: updated Pydantic schemas from Task 1
- Produces: regenerated OpenAPI + TS types for `WnbaTeamLeaderCard.key` and roster efficiency fields

- [ ] **Step 1: Export OpenAPI**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=backend:backend/..:. python3 scripts/export_openapi.py
# If golden is used:
cp frontend/openapi.json backend/openapi-golden.json
```

- [ ] **Step 2: Regenerate TS types**

```bash
cd frontend && npm run generate:api && npm run check:api
```

Expected: `check:api` exits 0

- [ ] **Step 3: Commit**

```bash
git add frontend/openapi.json frontend/src/shared/lib/api.schema.d.ts backend/openapi-golden.json
git commit -m "$(cat <<'EOF'
chore(api): regenerate OpenAPI for team-preview efficiency fields

EOF
)"
```

---

### Task 3: Frontend Away/Home UI

**Files:**
- Modify: `frontend/src/features/basketball/game/WnbaTeamPreview.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaTeamPreview.test.tsx`
- Modify: `md/system-design.md` (only if page↔API table still says FG%/3FG% leaders)

**Interfaces:**
- Consumes: `ApiWnbaTeamPreviewResponse` with new leader keys + roster fields
- Produces: five cards PPG…SPG; roster cols append SH-EFF, SC-EFF, PPEP, RTG, +/-

- [ ] **Step 1: Write failing UI tests**

In `WnbaTeamPreview.test.tsx`, change fixture leaders to `bpg`/`spg` instead of `fg_pct`/`fg3_pct`, and add efficiency fields on a roster row. Assert:

```tsx
expect(screen.getByTestId("wnba-team-leader-card-bpg")).toBeInTheDocument();
expect(screen.getByTestId("wnba-team-leader-card-spg")).toBeInTheDocument();
expect(screen.queryByTestId("wnba-team-leader-card-fg_pct")).not.toBeInTheDocument();
expect(screen.getByText("SH-EFF")).toBeInTheDocument();
expect(screen.getByText("SC-EFF")).toBeInTheDocument();
expect(screen.getByText("PPEP")).toBeInTheDocument();
expect(screen.getByText("RTG")).toBeInTheDocument();
expect(screen.getByText("+/-")).toBeInTheDocument();
```

- [ ] **Step 2: Run UI test — expect FAIL**

Run: `cd frontend && npm test -- --run src/features/basketball/game/WnbaTeamPreview.test.tsx`

- [ ] **Step 3: Update `WnbaTeamPreview.tsx`**

1. Leader key union: `"ppg" | "rpg" | "apg" | "bpg" | "spg"`
2. `RosterSeasonRow` + mapper: `shEff`, `scEff`, `ppep`, `rtg`, `plusMinus` from `sh_eff`, `sc_eff`, `ppep`, `rtg`, `plus_minus`
3. `ROSTER_COLS` append `"SH-EFF", "SC-EFF", "PPEP", "RTG", "+/-"`
4. `rosterValues` append those five cells
5. Widen `colWidth` for longer labels if needed (`SH-EFF` / `SC-EFF` / `PPEP` → `w-12` or `w-14`)

- [ ] **Step 4: Run UI tests — expect PASS**

Run: `cd frontend && npm test -- --run src/features/basketball/game/WnbaTeamPreview.test.tsx`

- [ ] **Step 5: Docs touch (if needed)**

If `md/system-design.md` documents Away/Home team leaders as PPG/RPG/APG/FG%/3FG%, update to PPG/RPG/APG/BPG/SPG and note efficiency roster cols.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/basketball/game/WnbaTeamPreview.tsx \
  frontend/src/features/basketball/game/WnbaTeamPreview.test.tsx \
  md/system-design.md
git commit -m "$(cat <<'EOF'
feat(wnba): show BPG/SPG leaders and efficiency roster cols

EOF
)"
```

- [ ] **Step 7: Mark spec Implemented**

Set `Status: Implemented` in `docs/superpowers/specs/2026-08-21-wnba-team-preview-efficiency-design.md` and commit.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Leaders PPG/RPG/APG/BPG/SPG | Task 1 + 3 |
| Drop FG%/3FG% leaders | Task 1 + 3 |
| No MPG gate | Task 1 |
| Roster SH-EFF/SC-EFF/PPEP/RTG/+/- | Task 1 + 3 |
| ESPN name mapping | Task 1 |
| OpenAPI sync | Task 2 |
| Scheduled Away/Home only | Global Constraints (no live tab work) |

Placeholder scan: clean.
