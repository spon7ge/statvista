# MLB Play Feed Batter Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each play’s batter MLB boxscore game-line (`stats.batting.summary`) next to the outcome pill in Scoring / All plays.

**Architecture:** Additive `batter_summary` on `MlbPlay`. Normalize resolves `matchup.batter` → `_boxscore_players` → raw batting summary (no `" today"` suffix). Frontend maps to `batterSummary` and renders it under the description beside the pill; remove game score from that row.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vitest · Testing Library · openapi-typescript

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-mlb-play-feed-batter-summary-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Format: raw MLB summary as-is (e.g. `1-3 | HR, K, RBI`); never append `" today"`
- Missing batter / summary → `null`; omit stats span
- Remove game score next to pill (replaced by batter summary)
- Shared `MlbFinalPlayFeed` (final + live)
- OpenAPI sync after schema change
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_detail_normalize.py -q`
- Verify frontend: `cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts src/features/mlb/game/MlbFinalPlayFeed.test.tsx` + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_detail.py` | Add `batter_summary` on `MlbPlay` |
| `backend/app/domains/mlb/game_detail.py` | Helper + `_plays` boxscore lookup; wire in `normalize_mlb_live_feed` |
| `backend/tests/test_mlb_game_detail_normalize.py` | Normalize assertions for summary / null |
| `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts` | Contract |
| `frontend/src/features/mlb/lib/types.ts` | `MlbPlay.batterSummary` |
| `frontend/src/features/mlb/lib/mapMlbGameDetail.ts` (+ test) | Map field |
| `frontend/src/features/mlb/lib/testFixtures.ts` | Sample `batterSummary` on plays |
| `frontend/src/features/mlb/game/MlbFinalPlayFeed.tsx` (+ test) | Pill – summary UI |

---

### Task 1: Backend schema + normalize `batter_summary`

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py` (`MlbPlay`)
- Modify: `backend/app/domains/mlb/game_detail.py` (`_batting_game_summary`, `_plays`, `normalize_mlb_live_feed`)
- Modify: `backend/tests/test_mlb_game_detail_normalize.py`

**Interfaces:**
- Produces:
  - `MlbPlay.batter_summary: str | None = None`
  - `_batting_game_summary(player: dict | None) -> str | None` — raw `stats.batting.summary` stripped; empty → `None` (no `" today"`)
  - `_plays(all_plays: list, box_players: dict[int, dict]) -> tuple[list[MlbPlay], list[MlbPlay]]`

- [ ] **Step 1: Write failing normalize tests**

Add to `backend/tests/test_mlb_game_detail_normalize.py`:

```python
def test_normalize_play_batter_summary_from_boxscore():
    detail = normalize_mlb_live_feed(
        _payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    rafaela_play = next(
        (p for p in detail.plays if "Rafaela" in p.text),
        None,
    )
    assert rafaela_play is not None
    assert rafaela_play.batter_summary == "1-3 | HR, K, RBI"


def test_normalize_play_batter_summary_null_when_batter_missing():
    payload = _payload()
    for play in payload["liveData"]["plays"]["allPlays"]:
        matchup = play.get("matchup")
        if isinstance(matchup, dict):
            matchup.pop("batter", None)
    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.plays
    assert all(p.batter_summary is None for p in detail.plays)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_detail_normalize.py::test_normalize_play_batter_summary_from_boxscore tests/test_mlb_game_detail_normalize.py::test_normalize_play_batter_summary_null_when_batter_missing -v`

Expected: FAIL (field missing / AttributeError or assertion)

- [ ] **Step 3: Add schema field**

In `backend/app/domains/mlb/schemas_game_detail.py` on `MlbPlay`, after `scoring_team`:

```python
batter_summary: str | None = None
```

- [ ] **Step 4: Implement helper + `_plays` lookup**

In `backend/app/domains/mlb/game_detail.py`, near `_batter_card_summary`:

```python
def _batting_game_summary(player: dict | None) -> str | None:
    if not player:
        return None
    batting = _as_dict(_as_dict(player.get("stats")).get("batting"))
    summary = batting.get("summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()
    return None
```

Change `_plays` signature and body:

```python
def _plays(
    all_plays: list, box_players: dict[int, dict]
) -> tuple[list[MlbPlay], list[MlbPlay]]:
    plays: list[MlbPlay] = []
    scoring: list[MlbPlay] = []
    for index, raw in enumerate(all_plays):
        if not isinstance(raw, dict):
            continue
        about = _as_dict(raw.get("about"))
        result = _as_dict(raw.get("result"))
        half = _half(about.get("halfInning"))
        inning = _int_or_none(about.get("inning"))
        text = result.get("description")
        if half is None or inning is None or not text:
            continue
        is_scoring = bool(about.get("isScoringPlay"))
        event = result.get("eventType") or result.get("event")
        exit_velo, launch_angle, total_distance = _hit_metrics(raw)
        matchup = _as_dict(raw.get("matchup"))
        batter_id = _person_id(_as_dict(matchup.get("batter")))
        batter_box = (
            box_players.get(batter_id) if batter_id is not None else None
        )
        play = MlbPlay(
            id=_play_id(raw, index),
            inning=inning,
            half=half,
            text=str(text),
            scoring=is_scoring,
            away_score=int(result.get("awayScore") or 0),
            home_score=int(result.get("homeScore") or 0),
            event=str(event) if event else None,
            exit_velo=exit_velo,
            launch_angle=launch_angle,
            total_distance=total_distance,
            scoring_team=("away" if half == "top" else "home")
            if is_scoring
            else None,
            batter_summary=_batting_game_summary(batter_box),
        )
        plays.append(play)
        if is_scoring:
            scoring.append(play)
    return plays, scoring
```

In `normalize_mlb_live_feed`, build boxscore players before plays:

```python
boxscore = _as_dict(live_data.get("boxscore"))
plays, scoring_plays = _plays(all_plays, _boxscore_players(boxscore))
umpires = _umpires(boxscore)
```

Remove the later duplicate `boxscore = _as_dict(...)` if it becomes redundant (keep a single assignment).

- [ ] **Step 5: Run normalize tests**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_game_detail_normalize.py -q`

Expected: PASS

- [ ] **Step 6: Commit** (only if the user explicitly asked to commit)

```bash
git add backend/app/domains/mlb/schemas_game_detail.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_game_detail_normalize.py
git commit -m "$(cat <<'EOF'
feat(mlb): attach batter boxscore summary on plays

EOF
)"
```

---

### Task 2: OpenAPI regen

**Files:**
- Modify: `frontend/openapi.json`
- Modify: `backend/openapi-golden.json`
- Modify: `frontend/src/shared/lib/api.schema.d.ts`

**Interfaces:**
- Produces: `components["schemas"]["MlbPlay"].batter_summary: string | null`

- [ ] **Step 1: Export OpenAPI and regenerate types**

```bash
PYTHONPATH=.:backend python scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

- [ ] **Step 2: Confirm field present**

```bash
rg -n "batter_summary" frontend/src/shared/lib/api.schema.d.ts
```

Expected: `batter_summary` on `MlbPlay`

- [ ] **Step 3: Commit** (only if the user explicitly asked to commit)

```bash
git add frontend/openapi.json backend/openapi-golden.json \
  frontend/src/shared/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
chore(api): regenerate OpenAPI for MLB play batter_summary

EOF
)"
```

---

### Task 3: Frontend map + fixtures

**Files:**
- Modify: `frontend/src/features/mlb/lib/types.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts`
- Modify: `frontend/src/features/mlb/lib/testFixtures.ts`

**Interfaces:**
- Produces: `MlbPlay.batterSummary: string | null`
- Consumes: API `batter_summary`

- [ ] **Step 1: Write failing map test**

In `mapMlbGameDetail.test.ts`, extend the final-additions play object and assert:

```typescript
batter_summary: "2-3 | HR, RBI, 2 R",
// ...
expect(view.plays[0].batterSummary).toBe("2-3 | HR, RBI, 2 R");
```

Also set `batter_summary` explicitly on other play literals in that test file once the OpenAPI type requires it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts`

Expected: FAIL (`batterSummary` undefined)

- [ ] **Step 3: Update types + mapPlay + fixtures**

`types.ts` on `MlbPlay`:

```typescript
batterSummary: string | null;
```

`mapMlbGameDetail.ts` `mapPlay`:

```typescript
batterSummary: play.batter_summary ?? null,
```

Update every play object in `testFixtures.ts` (and any other local play literals that must satisfy `MlbPlay`) with `batterSummary: null` or a sample string on the final scoring play, e.g. `batterSummary: "2-3 | HR, RBI, 2 R"`.

- [ ] **Step 4: Run map tests**

Run: `cd frontend && npm test -- src/features/mlb/lib/mapMlbGameDetail.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if the user explicitly asked to commit)

```bash
git add frontend/src/features/mlb/lib/types.ts \
  frontend/src/features/mlb/lib/mapMlbGameDetail.ts \
  frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts \
  frontend/src/features/mlb/lib/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): map play batterSummary into game detail view

EOF
)"
```

---

### Task 4: Play feed UI — pill + batter summary

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbFinalPlayFeed.tsx`
- Modify: `frontend/src/features/mlb/game/MlbFinalPlayFeed.test.tsx`

**Interfaces:**
- Consumes: `MlbPlay.batterSummary`, `MlbPlay.event`
- Produces: stacked row under description: pill – summary; no `mlb-play-score`

- [ ] **Step 1: Update UI tests**

In `MlbFinalPlayFeed.test.tsx` default scoring test, replace score assertions with batter summary:

```typescript
const description = screen.getByText("Freeman homers (2)");
const pill = screen.getByTestId("mlb-play-event-pill");
const batterStats = screen.getByTestId("mlb-play-batter-summary");
const ballInfo = screen.getByTestId("mlb-play-ball-info");
expect(pill).toHaveTextContent("Home Run");
expect(batterStats).toHaveTextContent("2-3 | HR, RBI, 2 R");
expect(screen.queryByTestId("mlb-play-score")).not.toBeInTheDocument();
expect(
  description.compareDocumentPosition(pill) &
    Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
expect(
  pill.compareDocumentPosition(batterStats) &
    Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
expect(
  batterStats.compareDocumentPosition(ballInfo) &
    Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
```

Ensure `mlbFinalDetail` scoring play used in this test has `batterSummary: "2-3 | HR, RBI, 2 R"` (Task 3 fixture).

Add:

```typescript
it("omits batter summary when null", () => {
  render(
    <MlbFinalPlayFeed
      detail={{
        ...mlbFinalDetail,
        scoringPlays: [
          { ...mlbFinalDetail.scoringPlays[0], batterSummary: null },
        ],
        plays: [{ ...mlbFinalDetail.plays[0], batterSummary: null }],
      }}
    />,
  );
  expect(screen.getByTestId("mlb-play-event-pill")).toBeInTheDocument();
  expect(
    screen.queryByTestId("mlb-play-batter-summary"),
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd frontend && npm test -- src/features/mlb/game/MlbFinalPlayFeed.test.tsx`

Expected: FAIL until UI updated

- [ ] **Step 3: Implement PlayRow**

```tsx
function PlayRow({
  play,
  isFirst,
}: {
  play: MlbPlay;
  isFirst: boolean;
}) {
  const event = eventLabel(play.event);
  const batterSummary = play.batterSummary?.trim() || null;

  return (
    <li className={isFirst ? "" : "border-t border-white/10 pt-3"}>
      <p className="text-[18px] text-white/90">{play.text}</p>
      {event || batterSummary ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {event ? (
            <span
              data-testid="mlb-play-event-pill"
              className="shrink-0 rounded-full bg-black/20 px-2 py-1 text-[14px] font-semibold uppercase tracking-wide text-white/80"
            >
              {event}
            </span>
          ) : null}
          {event && batterSummary ? (
            <span className="text-white/40" aria-hidden>
              –
            </span>
          ) : null}
          {batterSummary ? (
            <span
              data-testid="mlb-play-batter-summary"
              className="text-[18px] text-white/70"
            >
              {batterSummary}
            </span>
          ) : null}
        </div>
      ) : null}
      <StatcastMetrics play={play} />
    </li>
  );
}
```

- [ ] **Step 4: Run play feed tests**

Run: `cd frontend && npm test -- src/features/mlb/game/MlbFinalPlayFeed.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit** (only if the user explicitly asked to commit)

```bash
git add frontend/src/features/mlb/game/MlbFinalPlayFeed.tsx \
  frontend/src/features/mlb/game/MlbFinalPlayFeed.test.tsx \
  frontend/src/features/mlb/lib/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): show batter summary beside play feed outcome pill

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `batter_summary` on `MlbPlay` | 1 |
| Lookup matchup.batter → boxscore summary | 1 |
| Raw summary, no `" today"` | 1 (`_batting_game_summary`) |
| Missing → null | 1 |
| OpenAPI / TS types | 2–3 |
| UI: description → pill – summary → ball info | 4 |
| Remove score-by-pill | 4 |
| Scoring + All / shared feed | 4 (same component) |
