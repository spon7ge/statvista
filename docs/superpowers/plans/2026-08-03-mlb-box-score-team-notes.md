# MLB Box Score Team Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich MLB Box score with per-team bordered panels, batting notes from Stats `info`, richer pitcher columns (HR/ERA/decision/Totals), and per-team pitching footnotes.

**Architecture:** Extend `MlbBoxScore` / `MlbPitcherRow` in the FastAPI schema; normalize notes + pitcher fields from the Stats live feed in `mlb_game_detail.py`; map through `mapMlbGameDetail`; render per-team boxes in `MlbBoxScore.tsx`.

**Tech Stack:** FastAPI · Pydantic · React 19 · TypeScript · Vitest · pytest · openapi-typescript

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-mlb-box-score-team-notes-design.md`
- Coding standards: `md/claude.md` / `CLAUDE.md`
- Brand: **statvista** in any new user-facing copy
- Additive API only; do not break existing batter/pitcher fields
- Pitcher columns become `IP H R ER BB K HR ERA` (drop trailing `P` from table; keep `pitches` on the model for footnotes)
- One bordered team box per side; quiet dark UI (`rounded-xl border border-white/10 bg-white/[0.03]`)
- Do not put Summary Team Stats on Box; do not show umpires/weather
- Do not modify WNBA `components/game/BoxScore*`
- Verify backend: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -v`
- Verify frontend: `cd frontend && npx vitest run src/components/mlb/MlbBoxScore.test.tsx src/components/mlb/mapMlbGameDetail.test.ts`
- After schema change: export openapi + `cd frontend && npm run generate:api` (and keep `check:api` green)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/schemas/mlb_game_detail.py` | `MlbBoxNoteLine`, enriched `MlbPitcherRow`, `MlbPitchingTotals`, note lists on `MlbBoxScore` |
| `backend/app/services/mlb_game_detail.py` | Parse `teams.*.info`, enrich `_pitcher_row`, totals from `teamStats.pitching` |
| `backend/tests/test_mlb_game_detail_normalize.py` | Assert notes + pitcher enrichments from mutated fixture |
| `frontend/openapi.json` + `frontend/src/lib/api.schema.d.ts` | Regenerated OpenAPI types |
| `frontend/src/components/mlb/types.ts` | View types for notes / pitcher extras / totals |
| `frontend/src/components/mlb/mapMlbGameDetail.ts` | Map new API fields → view |
| `frontend/src/components/mlb/testFixtures.ts` | Fixture data with notes + enriched pitchers |
| `frontend/src/components/mlb/MlbBoxScore.tsx` | Per-team boxes, notes, richer pitchers, footnotes |
| `frontend/src/components/mlb/MlbBoxScore.test.tsx` | UI assertions |
| `frontend/src/components/mlb/mapMlbGameDetail.test.ts` | Mapper assertions |

---

### Task 1: Backend schema + normalize notes/pitchers

**Files:**
- Modify: `backend/app/schemas/mlb_game_detail.py`
- Modify: `backend/app/services/mlb_game_detail.py` (`_pitcher_row`, `_box`, helpers)
- Test: `backend/tests/test_mlb_game_detail_normalize.py`

**Interfaces:**
- Produces:
  - `MlbBoxNoteLine(label: str, value: str)`
  - `MlbPitchingTotals(ip, h, r, er, bb, k, hr, era)`
  - `MlbPitcherRow` additive: `hr`, `era`, `decision`, `strikes`, `ground_outs`, `fly_outs`, `batters_faced`, `inherited_runners`, `inherited_runners_scored`
  - `MlbBoxScore` additive: `away_batting_notes`, `home_batting_notes`, `away_baserunning_notes`, `home_baserunning_notes`, `away_fielding_notes`, `home_fielding_notes`, `away_pitching_totals`, `home_pitching_totals` (lists default `[]`; totals default `None`)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_mlb_game_detail_normalize.py`:

```python
def test_normalize_box_notes_and_enriched_pitchers():
    payload = _payload()
    away = payload["liveData"]["boxscore"]["teams"]["away"]
    home = payload["liveData"]["boxscore"]["teams"]["home"]
    away["info"] = [
        {
            "title": "BATTING",
            "fieldList": [
                {"label": "2B", "value": "Rafaela."},
                {"label": "Team LOB", "value": "5."},
            ],
        },
        {
            "title": "BASERUNNING",
            "fieldList": [{"label": "SB", "value": "Rafaela."}],
        },
    ]
    home["info"] = [
        {
            "title": "BATTING",
            "fieldList": [{"label": "HR", "value": "Hernández."}],
        },
        {
            "title": "FIELDING",
            "fieldList": [{"label": "E", "value": "Betts."}],
        },
    ]
    # Enrich first away pitcher in box list if present
    pitchers = away.get("pitchers") or []
    assert pitchers, "fixture needs pitchers"
    pid = f"ID{pitchers[0]}"
    player = away["players"][pid]
    player.setdefault("stats", {}).setdefault("pitching", {})
    player["stats"]["pitching"].update(
        {
            "homeRuns": 1,
            "strikes": 57,
            "groundOuts": 4,
            "flyOuts": 3,
            "battersFaced": 22,
            "inheritedRunners": 0,
            "inheritedRunnersScored": 0,
            "note": "(L, 1-1)",
            "numberOfPitches": 90,
        }
    )
    player.setdefault("seasonStats", {}).setdefault("pitching", {})["era"] = "3.21"
    away.setdefault("teamStats", {}).setdefault("pitching", {}).update(
        {
            "inningsPitched": "9.0",
            "hits": 8,
            "runs": 4,
            "earnedRuns": 4,
            "baseOnBalls": 2,
            "strikeOuts": 9,
            "homeRuns": 1,
            "era": "4.50",
        }
    )

    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    box = detail.box_score
    assert box is not None
    assert box.away_batting_notes[0].label == "2B"
    assert box.away_batting_notes[0].value == "Rafaela."
    assert box.away_baserunning_notes[0].label == "SB"
    assert box.home_fielding_notes[0].label == "E"
    assert box.home_batting_notes[0].label == "HR"

    starter = box.away_pitchers[0]
    assert starter.decision == "(L, 1-1)"
    assert starter.hr == 1
    assert starter.era == "3.21"
    assert starter.strikes == 57
    assert starter.ground_outs == 4
    assert starter.fly_outs == 3
    assert starter.batters_faced == 22
    assert box.away_pitching_totals is not None
    assert box.away_pitching_totals.ip == "9.0"
    assert box.away_pitching_totals.k == 9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py::test_normalize_box_notes_and_enriched_pitchers -v`

Expected: FAIL (missing fields / attributes)

- [ ] **Step 3: Implement schema + normalize**

In `mlb_game_detail.py` schemas file, add models and extend `MlbPitcherRow` / `MlbBoxScore` as in Interfaces.

In service:

```python
def _info_notes(side: dict, title: str) -> list[MlbBoxNoteLine]:
    notes: list[MlbBoxNoteLine] = []
    for block in _as_list(side.get("info")):
        if not isinstance(block, dict):
            continue
        if str(block.get("title") or "").upper() != title.upper():
            continue
        for field in _as_list(block.get("fieldList")):
            if not isinstance(field, dict):
                continue
            label = str(field.get("label") or "").strip()
            value = str(field.get("value") or "").strip()
            if label and value:
                notes.append(MlbBoxNoteLine(label=label, value=value))
    return notes


def _pitching_totals(side: dict) -> MlbPitchingTotals | None:
    pitching = _as_dict(_as_dict(side.get("teamStats")).get("pitching"))
    if not pitching:
        return None
    ip = pitching.get("inningsPitched")
    era = pitching.get("era")
    return MlbPitchingTotals(
        ip=str(ip) if ip is not None else None,
        h=_int_or_none(pitching.get("hits")),
        r=_int_or_none(pitching.get("runs")),
        er=_int_or_none(pitching.get("earnedRuns")),
        bb=_int_or_none(pitching.get("baseOnBalls")),
        k=_int_or_none(pitching.get("strikeOuts")),
        hr=_int_or_none(pitching.get("homeRuns")),
        era=str(era).strip() if era is not None and str(era).strip() else None,
    )
```

Extend `_pitcher_row` to read season ERA + decision + footnote fields. Wire `_box` to attach notes and totals.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -v`

Expected: PASS

- [ ] **Step 5: Regenerate OpenAPI for frontend**

Run project’s openapi export (same command used elsewhere, e.g. `PYTHONPATH=backend python3 -m app.openapi_export` or documented script), then:

```bash
cd frontend && npm run generate:api
```

Confirm `MlbBoxScore` / `MlbPitcherRow` in `api.schema.d.ts` include new fields.

- [ ] **Step 6: Commit** (only if user requested commits; otherwise skip)

```bash
git add backend/app/schemas/mlb_game_detail.py backend/app/services/mlb_game_detail.py \
  backend/tests/test_mlb_game_detail_normalize.py frontend/openapi.json frontend/src/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
feat(mlb): enrich box score notes and pitcher stats in API

EOF
)"
```

---

### Task 2: Frontend types + mapper + fixtures

**Files:**
- Modify: `frontend/src/components/mlb/types.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.ts`
- Modify: `frontend/src/components/mlb/testFixtures.ts`
- Test: `frontend/src/components/mlb/mapMlbGameDetail.test.ts`

**Interfaces:**
- Consumes: API fields from Task 1
- Produces view types:

```ts
export type MlbBoxNoteLine = { label: string; value: string };
export type MlbPitchingTotals = {
  ip: string | null;
  h: number | null;
  r: number | null;
  er: number | null;
  bb: number | null;
  k: number | null;
  hr: number | null;
  era: string | null;
};
// MlbPitcherRow adds: hr, era, decision, strikes, groundOuts, flyOuts,
//   battersFaced, inheritedRunners, inheritedRunnersScored
// MlbBoxScore adds: awayBattingNotes, homeBattingNotes, awayBaserunningNotes,
//   homeBaserunningNotes, awayFieldingNotes, homeFieldingNotes,
//   awayPitchingTotals, homePitchingTotals
```

- [ ] **Step 1: Write failing mapper test**

Assert mapped `boxScore.awayBattingNotes[0]`, pitcher `decision` / `era` / `strikes`, and `awayPitchingTotals.ip` from a minimal API stub in `mapMlbGameDetail.test.ts`.

- [ ] **Step 2: Run test — expect FAIL**

`cd frontend && npx vitest run src/components/mlb/mapMlbGameDetail.test.ts`

- [ ] **Step 3: Update types, mapper, fixtures**

Map snake_case → camelCase. Update `mlbLiveDetail` / `mlbFinalDetail` boxScore with sample notes, enriched pitchers, and totals so UI tests have data.

- [ ] **Step 4: Run mapper test — PASS**

- [ ] **Step 5: Commit** (if requested)

---

### Task 3: Render per-team boxes in `MlbBoxScore`

**Files:**
- Modify: `frontend/src/components/mlb/MlbBoxScore.tsx`
- Test: `frontend/src/components/mlb/MlbBoxScore.test.tsx`

**Interfaces:**
- Consumes: enriched `MlbBoxScore` view from Task 2
- Produces: UI with `data-testid="mlb-box-team-away"` / `mlb-box-team-home`

- [ ] **Step 1: Write failing UI tests**

```tsx
it("renders per-team boxes with batting notes and pitcher footnotes", () => {
  render(<MlbBoxScore detail={mlbFinalDetail} sideBySide />);
  expect(screen.getByTestId("mlb-box-team-away")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-box-team-home")).toBeInTheDocument();
  expect(screen.getByText("2B")).toBeInTheDocument(); // or label from fixture
  expect(screen.getByText(/Pitches-strikes/i)).toBeInTheDocument();
  expect(screen.getByText("ERA")).toBeInTheDocument();
  expect(screen.getByText("Totals")).toBeInTheDocument();
});

it("appends pitcher decision to the name", () => {
  render(<MlbBoxScore detail={mlbFinalDetail} />);
  expect(screen.getByText(/Pfaadt.*\(W/)).toBeInTheDocument(); // match fixture
});
```

(Adjust strings to match fixtures set in Task 2.)

- [ ] **Step 2: Run — expect FAIL**

`cd frontend && npx vitest run src/components/mlb/MlbBoxScore.test.tsx`

- [ ] **Step 3: Implement UI**

Structure each column:

```tsx
function TeamBox({ team, batters, pitchers, battingNotes, baserunningNotes, fieldingNotes, pitchingTotals, testId }: ...) {
  return (
    <div data-testid={testId} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <BatterTable ... />
      <NoteBlock title="Batting" notes={battingNotes} />
      <NoteBlock notes={baserunningNotes} />
      <NoteBlock notes={fieldingNotes} />
      <PitcherTable ... totals={pitchingTotals} />
      <PitchingFootnotes pitchers={pitchers} />
    </div>
  );
}
```

- Pitcher cols: `IP H R ER BB K HR ERA`
- Name: `{name}{decision ? ` ${decision}` : ""}`
- Totals row when `pitchingTotals` present
- Footnotes helpers: join pitchers with data; skip empty lines; Inherited only when `inheritedRunners > 0 || inheritedRunnersScored > 0`

- [ ] **Step 4: Run UI + related tests — PASS**

```bash
cd frontend && npx vitest run src/components/mlb/MlbBoxScore.test.tsx src/components/mlb/MlbFinalCenter.test.tsx src/components/mlb/mapMlbGameDetail.test.ts
```

- [ ] **Step 5: Commit** (if requested)

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Pass-through batting/baserunning/fielding notes | Task 1–3 |
| Enriched pitcher fields + season ERA + decision | Task 1–3 |
| Pitching totals | Task 1–3 |
| Per-team bordered boxes | Task 3 |
| Columns IP…HR ERA; drop P from table | Task 3 |
| Pitching footnotes derived per team | Task 3 |
| Empty/missing graceful | Tasks 1+3 |
| Summary Team Stats unchanged | (no task touches it) |
| No umpires/weather | (out of scope) |

## Placeholder scan

None intentional. Commit steps skipped unless user asks to commit.
