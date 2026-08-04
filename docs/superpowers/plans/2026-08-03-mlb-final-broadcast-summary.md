# MLB Final Broadcast Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the final `/mlb/games/:gamePk` first viewport into an ESPN-style Summary/Box shell (split header, play cards, linescore+W/L, team stats) with additive Stats API fields, keeping win probability and hit chart below.

**Architecture:** Extend `MlbGameDetail` normalize/schema with record, date label, decisions, Statcast play metrics, scoring_team, and team_stats. Map through to frontend view types. Replace `MlbFinalCenter` composition with dedicated final components; leave live/scheduled branches unchanged. Data sources: MLB Stats API primary; ESPN win-prob soft-merge unchanged; Savant out of scope for v1.

**Tech Stack:** FastAPI/Pydantic, pytest, React, TypeScript, Vitest/RTL, Tailwind, openapi-typescript

## Global Constraints

- Final branch only; live and scheduled unchanged
- High-fidelity visuals matching the SDP@AZ reference screenshot
- Additive API fields only (no breaking removals)
- Win prob + hit chart remain below tab content
- Box tab: full box, always side-by-side away|home
- No ESPN play-card action icons; share is non-functional UI only
- No Baseball Savant fetch in v1
- Follow existing `frontend/src/components/mlb/` and `backend/app/services/mlb_game_detail.py` patterns

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/schemas/mlb_game_detail.py` | Additive schema types/fields |
| `backend/app/services/mlb_game_detail.py` | Normalize record, date label, decisions, play metrics, team_stats |
| `backend/tests/test_mlb_game_detail_normalize.py` | Normalize coverage for new fields |
| `frontend/openapi.json` + `src/lib/api.schema.d.ts` | Regenerated contract |
| `frontend/src/components/mlb/types.ts` | View-model fields |
| `frontend/src/components/mlb/mapMlbGameDetail.ts` | Snake → camel mapping |
| `frontend/src/components/mlb/testFixtures.ts` | Final-ready fixture data |
| `frontend/src/components/mlb/MlbFinalBroadcastHeader.tsx` | Date · Final · share · split slabs |
| `frontend/src/components/mlb/MlbFinalPlayFeed.tsx` | Scoring/All toggle + play cards |
| `frontend/src/components/mlb/MlbFinalLinescoreCard.tsx` | Linescore + W/L/S |
| `frontend/src/components/mlb/MlbFinalTeamStats.tsx` | Team comparison rail |
| `frontend/src/components/mlb/MlbFinalCenter.tsx` | Tabs + composition |
| `frontend/src/components/mlb/MlbBoxScore.tsx` | Force side-by-side columns |

---

### Task 1: Backend additive final fields

**Files:**
- Modify: `backend/app/schemas/mlb_game_detail.py`
- Modify: `backend/app/services/mlb_game_detail.py`
- Modify: `backend/tests/test_mlb_game_detail_normalize.py`
- Regenerate: `frontend/openapi.json`, `frontend/src/lib/api.schema.d.ts`

**Interfaces:**
- Produces (Pydantic / OpenAPI snake_case):
  - `MlbGameDetailTeam.record: str | None`
  - `MlbGameDetail.game_date_label: str | None`
  - `MlbGameDetail.decisions: MlbDecisions | None` where `MlbDecisions` has `winner: str | None`, `loser: str | None`, `save: str | None`
  - `MlbPlay.exit_velo: float | None`, `launch_angle: float | None`, `total_distance: float | None`, `scoring_team: Literal["away","home"] | None`
  - `MlbGameDetail.team_stats: MlbTeamStatsPair | None` with away/home `MlbTeamStatLine` fields: `hr`, `r`, `h`, `sb`, `lob` (int|None), `avg`, `obp`, `slg`, `era` (str|None), `k` (int|None)

- [ ] **Step 1: Write failing normalize tests (mutate fixture payload in-test)**

```python
def test_normalize_final_additions_from_mutated_payload():
    payload = _payload()
    # Fixture already has gameData.datetime.officialDate; keep or set explicitly:
    payload["gameData"].setdefault("datetime", {})
    payload["gameData"]["datetime"]["officialDate"] = "2026-08-02"
    payload["gameData"]["teams"]["away"]["leagueRecord"] = {"wins": 58, "losses": 55}
    payload["gameData"]["teams"]["home"]["leagueRecord"] = {"wins": 60, "losses": 53}
    payload["liveData"]["decisions"] = {
        "winner": {"fullName": "Brandon Pfaadt", "id": 1},
        "loser": {"fullName": "Michael King", "id": 2},
    }
    # Attach Statcast keys onto first playEvent that already has hitData
    for play in payload["liveData"]["plays"]["allPlays"]:
        for ev in play.get("playEvents") or []:
            if isinstance(ev, dict) and "hitData" in ev:
                ev["hitData"]["launchSpeed"] = 104.1
                ev["hitData"]["launchAngle"] = 28.0
                ev["hitData"]["totalDistance"] = 404
                break
        else:
            continue
        break
    payload["liveData"]["boxscore"]["teams"]["away"]["teamStats"] = {
        "batting": {
            "homeRuns": 0, "runs": 1, "hits": 6, "stolenBases": 0,
            "leftOnBase": 7, "avg": ".188", "obp": ".250", "slg": ".300",
        },
        "pitching": {"era": "5.00", "strikeOuts": 8},
    }
    payload["liveData"]["boxscore"]["teams"]["home"]["teamStats"] = {
        "batting": {
            "homeRuns": 1, "runs": 5, "hits": 9, "stolenBases": 1,
            "leftOnBase": 6, "avg": ".300", "obp": ".360", "slg": ".500",
        },
        "pitching": {"era": "1.00", "strikeOuts": 10},
    }

    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.away.record == "58-55"
    assert detail.home.record == "60-53"
    assert detail.game_date_label  # e.g. "Yesterday" or "Aug 2" relative to "today"
    assert detail.decisions is not None
    assert detail.decisions.winner == "Brandon Pfaadt"
    assert detail.decisions.loser == "Michael King"
    asserted = False
    for p in detail.plays:
        if p.exit_velo is not None:
            assert p.exit_velo == 104.1
            assert p.launch_angle == 28.0
            assert p.total_distance == 404
            asserted = True
            break
    assert asserted
    scoring = [p for p in detail.plays if p.scoring]
    assert all(p.scoring_team in ("away", "home") for p in scoring)
    assert detail.team_stats is not None
    assert detail.team_stats.home.hr == 1
    assert detail.team_stats.away.avg == ".188"
```

Note: Stats API uses `launchSpeed` (mph) for exit velo — map that to `exit_velo`. Also accept `exitVelocity` if present.

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py::test_normalize_final_additions_from_mutated_payload -q`  
Expected: FAIL (missing attributes / schema fields)

- [ ] **Step 3: Implement schema + normalize helpers**

```python
# schemas — add classes and fields as listed in Interfaces

# service helpers (sketch):
def _team_record(team: dict) -> str | None:
    record = _as_dict(team.get("leagueRecord"))
    wins, losses = record.get("wins"), record.get("losses")
    if wins is None or losses is None:
        return None
    return f"{wins}-{losses}"

def _game_date_label(game_data: dict, *, now: date | None = None) -> str | None:
    # Use gameData.datetime.officialDate (YYYY-MM-DD). Compare to America/New_York "today".
    # Same day → "Today"; yesterday → "Yesterday"; else "Mon D" (e.g. "Aug 2").

def _decisions(live_data: dict) -> MlbDecisions | None:
    raw = _as_dict(live_data.get("decisions"))
    if not raw:
        return None
    def name(key: str) -> str | None:
        person = _as_dict(raw.get(key))
        full = person.get("fullName")
        return str(full) if full else None
    winner, loser, save = name("winner"), name("loser"), name("save")
    if not any([winner, loser, save]):
        return None
    return MlbDecisions(winner=winner, loser=loser, save=save)

def _hit_metrics(play: dict) -> tuple[float | None, float | None, float | None]:
    for event in reversed(_as_list(play.get("playEvents"))):
        if not isinstance(event, dict):
            continue
        hit = _as_dict(event.get("hitData"))
        if not hit:
            continue
        velo = hit.get("launchSpeed", hit.get("exitVelocity"))
        angle = hit.get("launchAngle")
        dist = hit.get("totalDistance")
        return _float_or_none(velo), _float_or_none(angle), _float_or_none(dist)
    return None, None, None

# In _plays: set scoring_team = "away" if half=="top" else "home" when is_scoring else None
# Wire _detail_team(..., record=_team_record(team))
# Wire normalize return with game_date_label, decisions, team_stats=_team_stats(boxscore)
```

For `_team_stats`, read `boxscore.teams.{away,home}.teamStats.batting|pitching` keys listed above; return `None` if both sides empty.

- [ ] **Step 4: Run normalize tests**

Run: `PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -q`  
Expected: PASS

- [ ] **Step 5: Export OpenAPI + regenerate TS types**

```bash
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; export_openapi()"
cd frontend && npm run generate:api
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/mlb_game_detail.py backend/app/services/mlb_game_detail.py backend/tests/test_mlb_game_detail_normalize.py frontend/openapi.json frontend/src/lib/api.schema.d.ts
git commit -m "feat: add MLB final detail fields (record, decisions, Statcast, team stats)"
```

---

### Task 2: Frontend types + mapper + fixtures

**Files:**
- Modify: `frontend/src/components/mlb/types.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.test.ts` (create if missing; else extend)
- Modify: `frontend/src/components/mlb/testFixtures.ts`

**Interfaces:**
- Consumes: OpenAPI `ApiMlbGameDetail` additive fields from Task 1
- Produces camelCase view model:
  - `MlbGameDetailTeam.record: string | null`
  - `MlbGameDetailView.gameDateLabel: string | null`
  - `MlbGameDetailView.decisions: { winner, loser, save } | null`
  - `MlbPlay.exitVelo`, `launchAngle`, `totalDistance`, `scoringTeam`
  - `MlbGameDetailView.teamStats: { away: MlbTeamStatLine; home: MlbTeamStatLine } | null`

- [ ] **Step 1: Write failing mapper test**

```ts
it("maps final additive fields", () => {
  const view = mapMlbGameDetail({
    /* minimal ApiMlbGameDetail with record, game_date_label, decisions,
       play exit_velo/launch_angle/total_distance/scoring_team, team_stats */
  } as ApiMlbGameDetail);
  expect(view.away.record).toBe("58-55");
  expect(view.gameDateLabel).toBe("Today");
  expect(view.decisions?.winner).toBe("Brandon Pfaadt");
  expect(view.plays[0].exitVelo).toBe(104.1);
  expect(view.plays[0].scoringTeam).toBe("home");
  expect(view.teamStats?.home.hr).toBe(1);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && npx vitest run src/components/mlb/mapMlbGameDetail.test.ts`  
Expected: FAIL

- [ ] **Step 3: Update types, mapper, fixtures**

Extend `mlbLiveDetail` / add `mlbFinalDetail` in `testFixtures.ts` with sample decisions, Statcast on one scoring play, teamStats, records, `gameDateLabel: "Today"`.

- [ ] **Step 4: Run mapper tests**

Run: `cd frontend && npx vitest run src/components/mlb/mapMlbGameDetail.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/types.ts frontend/src/components/mlb/mapMlbGameDetail.ts frontend/src/components/mlb/mapMlbGameDetail.test.ts frontend/src/components/mlb/testFixtures.ts
git commit -m "feat: map MLB final additive detail fields on the frontend"
```

---

### Task 3: `MlbFinalBroadcastHeader`

**Files:**
- Create: `frontend/src/components/mlb/MlbFinalBroadcastHeader.tsx`
- Create: `frontend/src/components/mlb/MlbFinalBroadcastHeader.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView` (`gameDateLabel`, `statusLabel`, `away`, `home` with record/logo/color/score)
- Produces: header strip + split colored slabs; winner slab emphasized (higher score; tie → neither)

- [ ] **Step 1: Failing test**

```tsx
it("renders Today, Final, records, and split scores", () => {
  render(<MlbFinalBroadcastHeader detail={mlbFinalDetail} />);
  expect(screen.getByTestId("mlb-final-broadcast-header")).toBeInTheDocument();
  expect(screen.getByText("Today")).toBeInTheDocument();
  expect(screen.getByText("Final")).toBeInTheDocument();
  expect(screen.getByText("58-55")).toBeInTheDocument();
  expect(screen.getByText(String(mlbFinalDetail.away.score))).toBeInTheDocument();
  expect(screen.getByLabelText(/share/i)).toBeInTheDocument(); // button type=button, no handler required
});
```

- [ ] **Step 2: Run fail → implement → pass**

Visual rules: team.color backgrounds with dark overlay; large mono scores; logos when `logoUrl` present; omit record if null; share button is decorative (`type="button"` aria-label Share, no onClick product behavior).

Run: `cd frontend && npx vitest run src/components/mlb/MlbFinalBroadcastHeader.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/mlb/MlbFinalBroadcastHeader.tsx frontend/src/components/mlb/MlbFinalBroadcastHeader.test.tsx
git commit -m "feat: add MLB final broadcast header with split scores"
```

---

### Task 4: `MlbFinalPlayFeed`

**Files:**
- Create: `frontend/src/components/mlb/MlbFinalPlayFeed.tsx`
- Create: `frontend/src/components/mlb/MlbFinalPlayFeed.test.tsx`
- Optional helper: `frontend/src/components/mlb/mlbPlayEventLabel.ts` for `home_run` → `Home Run`

**Interfaces:**
- Consumes: `detail.plays`, `detail.scoringPlays`, team colors for card tint via `scoringTeam`
- Produces: Scoring Plays | All Plays toggle; cards with `Top/Bottom {N}`, text, outcome pill, mph/ft/deg when any metric present

- [ ] **Step 1: Failing tests**

```tsx
it("defaults to scoring plays and shows Statcast row", () => {
  render(<MlbFinalPlayFeed detail={mlbFinalDetail} />);
  expect(screen.getByTestId("mlb-final-play-feed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /scoring plays/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText(/Bottom 4th|Top 3rd/i)).toBeInTheDocument();
  expect(screen.getByText(/104\.1 mph/)).toBeInTheDocument();
});

it("toggles to all plays", async () => {
  const user = userEvent.setup();
  render(<MlbFinalPlayFeed detail={mlbFinalDetail} />);
  await user.click(screen.getByRole("button", { name: /all plays/i }));
  // assert a non-scoring play from fixture appears
});
```

- [ ] **Step 2: Implement**

Card tint: if `scoringTeam === "home"` use home color at ~35% opacity background; away similarly; non-scoring cards use neutral dark panel. Hide metrics row when all three metrics null. No ESPN action icons.

Half label: `half === "top" ? \`Top ${inning}\` : \`Bottom ${inning}\`` (use ordinal if existing util exists; else `Top 4th` style with simple suffix helper).

- [ ] **Step 3: Run tests + commit**

```bash
cd frontend && npx vitest run src/components/mlb/MlbFinalPlayFeed.test.tsx
git add frontend/src/components/mlb/MlbFinalPlayFeed.tsx frontend/src/components/mlb/MlbFinalPlayFeed.test.tsx frontend/src/components/mlb/mlbPlayEventLabel.ts
git commit -m "feat: add MLB final scoring/all play feed cards"
```

---

### Task 5: Linescore card + team stats

**Files:**
- Create: `frontend/src/components/mlb/MlbFinalLinescoreCard.tsx` (+ test)
- Create: `frontend/src/components/mlb/MlbFinalTeamStats.tsx` (+ test)

**Interfaces:**
- Consumes: `detail` linescore + `decisions`; `teamStats` + team logos/colors
- Produces: linescore card with `W:` / `L:` / optional `S:`; comparison rows with leader circles

- [ ] **Step 1: Failing tests**

```tsx
// Linescore card
expect(screen.getByText(/W:\s*Brandon Pfaadt|W:\s*B\. Pfaadt/)).toBeTruthy();
// Prefer fullName as returned by API; display as provided (no forced initials).

// Team stats
render(<MlbFinalTeamStats detail={mlbFinalDetail} />);
expect(screen.getByTestId("mlb-final-team-stats")).toBeInTheDocument();
expect(screen.getByText("AVG")).toBeInTheDocument();
// Leader for higher AVG is home — assert highlighted side via data-testid or class
```

Leader rules (exact):
- Higher wins: HR, R, H, SB, LOB, AVG, OBP, SLG, K
- Lower wins: ERA (parse float from string; invalid → no leader)
- Tie or missing either side → no circle

- [ ] **Step 2: Implement + pass tests**

Reuse `MlbLinescore` inside `MlbFinalLinescoreCard` when practical; wrap with decisions footer.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/mlb/MlbFinalLinescoreCard.tsx frontend/src/components/mlb/MlbFinalLinescoreCard.test.tsx frontend/src/components/mlb/MlbFinalTeamStats.tsx frontend/src/components/mlb/MlbFinalTeamStats.test.tsx
git commit -m "feat: add MLB final linescore decisions and team stats rail"
```

---

### Task 6: Compose `MlbFinalCenter` + Box side-by-side

**Files:**
- Modify: `frontend/src/components/mlb/MlbFinalCenter.tsx`
- Modify: `frontend/src/components/mlb/MlbFinalCenter.test.tsx`
- Modify: `frontend/src/components/mlb/MlbBoxScore.tsx` (use `grid-cols-2` always, allow horizontal scroll)
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx` if final assertions break

**Interfaces:**
- Consumes: all Task 3–5 components + existing win prob / hit chart
- Produces: Summary (default) | Box tabs; below-fold charts; no `MlbScoringPlays` side column (replaced by play feed)

- [ ] **Step 1: Update FinalCenter test expectations**

```tsx
it("renders final shell with Summary default and charts below", async () => {
  const user = userEvent.setup();
  render(<MlbFinalCenter detail={mlbFinalDetail} />);
  expect(screen.getByTestId("mlb-final-broadcast-header")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-final-play-feed")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-final-team-stats")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-game-flow")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-hit-chart")).toBeInTheDocument();
  expect(screen.queryByTestId("mlb-box-score")).not.toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: /box/i }));
  expect(screen.getByTestId("mlb-box-score")).toBeInTheDocument();
  expect(screen.queryByTestId("mlb-final-play-feed")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement composition**

```tsx
// Sketch
export function MlbFinalCenter({ detail }: { detail: MlbGameDetailView }) {
  const [tab, setTab] = useState<"summary" | "box">("summary");
  return (
    <div data-testid="mlb-final-center" className="space-y-4">
      <MlbFinalBroadcastHeader detail={detail} />
      {/* Summary | Box tabs */}
      {tab === "summary" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <MlbFinalPlayFeed detail={detail} />
          <div className="space-y-4">
            <MlbFinalLinescoreCard detail={detail} />
            <MlbFinalTeamStats detail={detail} />
          </div>
        </div>
      ) : (
        <MlbBoxScore detail={detail} />
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MlbWinProbability detail={detail} />
        <MlbHitChart detail={detail} />
      </div>
    </div>
  );
}
```

Change `MlbBoxScore` grid from `lg:grid-cols-2` to `grid-cols-2` so columns stay side-by-side on mobile.

- [ ] **Step 3: Run MLB frontend suite**

Run: `cd frontend && npx vitest run src/components/mlb src/pages/MlbGameDetailPage.test.tsx`  
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/mlb/MlbFinalCenter.tsx frontend/src/components/mlb/MlbFinalCenter.test.tsx frontend/src/components/mlb/MlbBoxScore.tsx frontend/src/pages/MlbGameDetailPage.test.tsx
git commit -m "feat: compose MLB final Summary/Box broadcast shell"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Split final header + date/Final/share | 3 |
| Summary \| Box tabs | 6 |
| Scoring/All play cards + Statcast row | 1, 2, 4 |
| Linescore + W/L | 1, 2, 5 |
| Team stats comparison | 1, 2, 5 |
| Box side-by-side | 6 |
| Win prob + hit chart below | 6 |
| Additive Stats API fields | 1 |
| Live/scheduled unchanged | 6 (page branch untouched) |
| No Savant / no play icons / share non-functional | 3, 4 constraints |
