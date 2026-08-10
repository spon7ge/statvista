# WNBA MLB-Parity Matchup Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scheduled WNBA game detail match MLB pregame: header with record + last 10, centered Preview / Away / Home / Props tabs, and a two-column Preview with starters, game info, prediction, leaders, odds, team stats + ranks, and injuries.

**Architecture:** ESPN-first enrichment on `GET /api/wnba/games/{id}` (record, last_10, season_team_stats, game_leaders). New `GET /api/wnba/games/{id}/team-preview?side=`. Reuse odds/props today endpoints (client-filter). Frontend mirrors MLB pregame center with WNBA-specific components and column order from the spec.

**Tech Stack:** FastAPI · Pydantic · httpx · pytest · React 19 · TypeScript · Vite · Vitest · Testing Library · Tailwind 4 · openapi-typescript

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-wnba-mlb-parity-matchup-preview-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Preview left: Projected Starters → Game Info → Matchup Prediction → Game Leaders
- Preview right: Odds → Team Stats + `#rank` → Injuries
- Team stats rows: PTS, FG%, 3P%, FT%, REB, AST, STL, BLK, TO (+ ranks)
- Game Leaders: PPG · RPG · APG (one card each across both teams)
- Soft-fail enrichment; hide empty sections; never fail game detail for missing preview fields
- Live/final Summary|Box unchanged; leave `WnbaBroadcastHeader` for in-game
- OpenAPI trio after every schema change:
  `PYTHONPATH=.:backend python scripts/export_openapi.py && cp frontend/openapi.json backend/openapi-golden.json && cd frontend && npm run generate:api && npm run check:api`
- Backend verify pattern: `cd backend && PYTHONPATH=..:. python3 -m pytest <tests> -q`
- Frontend verify pattern: `cd frontend && npx vitest run <files>`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/wnba/schemas_game_detail.py` | `record`/`last_10`; `season_team_stats`; `game_leaders` |
| `backend/app/domains/wnba/schemas_team_preview.py` | New Away/Home response schemas |
| `backend/app/domains/wnba/game_detail.py` | Attach helpers + orchestration for scheduled |
| `backend/app/domains/wnba/team_preview.py` | Assemble team-preview |
| `backend/app/domains/wnba/team_season_stats.py` | Fetch/rank ESPN team stats (new) |
| `backend/app/domains/wnba/game_leaders.py` | Build PPG/RPG/APG cards from summary leaders (new) |
| `backend/app/domains/wnba/routes.py` | team-preview route |
| `backend/app/schemas/odds.py` (+ pinnacle/novig normalizers as needed) | Optional moneyline fields on `WnbaOddsGame` |
| `backend/tests/test_wnba_pregame_enrichment.py` | record/last10/stats/leaders |
| `backend/tests/test_wnba_team_preview.py` | team-preview |
| OpenAPI trio | Contract |
| `frontend/.../basketball/lib/types.ts` + `mapGameDetail.ts` (+tests) | View types |
| `WnbaPregameBroadcastHeader.tsx` (+test) | Record/last10 + centered tabs |
| `WnbaPregameCenter.tsx` (+test) | Tabs + columns + props/away/home |
| `WnbaGameOddsBoard.tsx`, `WnbaSeasonTeamStats.tsx`, `WnbaGameLeaders.tsx` (+tests) | Preview sections |
| `WnbaTeamPreview.tsx` (+test) | Away/Home |
| `wnbaOddsBoard.ts` + hooks | Odds filter/board view; `useWnbaTeamPreview` |
| `md/system-design.md` | Page ↔ API table |

---

### Task 1: Schema — team record/last_10 + season_team_stats + game_leaders

**Files:**
- Modify: `backend/app/domains/wnba/schemas_game_detail.py`
- Modify: `backend/app/domains/wnba/schemas.py` (re-exports if used)
- Test: `backend/tests/test_wnba_pregame_enrichment.py` (create)

**Interfaces:**
- Produces:
  - `GameDetailTeam.record: str | None = None`
  - `GameDetailTeam.last_10: str | None = None`
  - `WnbaSeasonTeamStatLine` with value + `*_rank` for: `pts`, `fg_pct`, `fg3_pct`, `ft_pct`, `reb`, `ast`, `stl`, `blk`, `to`
  - `WnbaSeasonTeamStatsPair(away, home)`
  - `WnbaGameLeaderCard(key: Literal["ppg","rpg","apg"], label, rank, value, player_id, last_name, team_abbrev, side, headshot_url)`
  - `WnbaGameLeaders(leaders: list[WnbaGameLeaderCard])`
  - `WnbaGameDetail.season_team_stats` / `game_leaders` optional

- [ ] **Step 1: Write failing schema/import smoke test**

```python
from app.domains.wnba.schemas_game_detail import (
    GameDetailTeam,
    WnbaGameLeaderCard,
    WnbaGameLeaders,
    WnbaSeasonTeamStatLine,
    WnbaSeasonTeamStatsPair,
)

def test_game_detail_team_accepts_record_and_last10():
    t = GameDetailTeam(
        id="1", abbrev="LVA", name="Aces", score=None, color="#000",
        record="22-8", last_10="7-3",
    )
    assert t.record == "22-8"
    assert t.last_10 == "7-3"

def test_season_team_stats_and_game_leaders_shapes():
    line = WnbaSeasonTeamStatLine(pts=92.0, pts_rank=3, reb=34.0, reb_rank=5)
    pair = WnbaSeasonTeamStatsPair(away=line, home=line)
    leaders = WnbaGameLeaders(
        leaders=[
            WnbaGameLeaderCard(
                key="ppg", label="PPG", rank=1, value="26.6",
                player_id="9", last_name="Wilson", team_abbrev="LVA",
                side="away", headshot_url=None,
            )
        ]
    )
    assert pair.away.pts_rank == 3
    assert leaders.leaders[0].key == "ppg"
```

- [ ] **Step 2: Run test — expect import/attr failures**

Run: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_wnba_pregame_enrichment.py::test_game_detail_team_accepts_record_and_last10 tests/test_wnba_pregame_enrichment.py::test_season_team_stats_and_game_leaders_shapes -q`  
Expected: FAIL (types missing)

- [ ] **Step 3: Add schemas**

On `GameDetailTeam` add `record` / `last_10` like MLB. Add `WnbaSeasonTeamStatLine`, `WnbaSeasonTeamStatsPair`, `WnbaGameLeaderCard`, `WnbaGameLeaders`. On `WnbaGameDetail` add:

```python
season_team_stats: WnbaSeasonTeamStatsPair | None = None
game_leaders: WnbaGameLeaders | None = None
```

Export new symbols from `schemas_game_detail.__all__` / `schemas.py` as needed.

- [ ] **Step 4: Re-run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/wnba/schemas_game_detail.py backend/app/domains/wnba/schemas.py backend/tests/test_wnba_pregame_enrichment.py
git commit -m "feat(wnba): add pregame detail schema fields for record, team stats, leaders"
```

---

### Task 2: Attach record + last_10 from standings

**Files:**
- Modify: `backend/app/domains/wnba/game_detail.py`
- Modify: `backend/tests/test_wnba_pregame_enrichment.py`

**Interfaces:**
- Consumes: `get_wnba_standings()` / standings rows with `wl`, `l10`, team `id`
- Produces:
  - `standings_record_last10_map() -> dict[str, tuple[str | None, str | None]]` keyed by team id → `(record, last_10)`
  - `attach_record_last10(detail, mapping) -> WnbaGameDetail`
  - Call from scheduled path in `get_game_detail` (soft-fail)

- [ ] **Step 1: Failing tests**

```python
def test_attach_record_last10():
    detail = _minimal_scheduled_detail()  # helper with away.id="17", home.id="9"
    out = attach_record_last10(
        detail,
        {"17": ("22-8", "7-3"), "9": ("20-10", "6-4")},
    )
    assert out.away.record == "22-8"
    assert out.away.last_10 == "7-3"
    assert out.home.record == "20-10"
    assert out.home.last_10 == "6-4"

def test_attach_record_last10_missing_team_leaves_null():
    detail = _minimal_scheduled_detail()
    out = attach_record_last10(detail, {})
    assert out.away.record is None
    assert out.away.last_10 is None
```

Build `_minimal_scheduled_detail()` copying patterns from existing WNBA game_detail tests.

- [ ] **Step 2: Run — expect FAIL (functions missing)**

- [ ] **Step 3: Implement attach + wire**

```python
def attach_record_last10(
    detail: WnbaGameDetail,
    mapping: dict[str, tuple[str | None, str | None]],
) -> WnbaGameDetail:
    away_rec, away_l10 = mapping.get(detail.away.id, (None, None))
    home_rec, home_l10 = mapping.get(detail.home.id, (None, None))
    return detail.model_copy(
        update={
            "away": detail.away.model_copy(update={"record": away_rec, "last_10": away_l10}),
            "home": detail.home.model_copy(update={"record": home_rec, "last_10": home_l10}),
        }
    )
```

Map from standings rows: `row.wl` → record, `row.l10` → last_10, key `row.team_id` (confirm field name on `WnbaStandingsRow`). Soft-try in scheduled branch only.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): attach standings record and last-10 on scheduled game detail"
```

---

### Task 3: Season team stats + league ranks

**Files:**
- Create: `backend/app/domains/wnba/team_season_stats.py`
- Modify: `backend/app/domains/wnba/game_detail.py` (`attach_season_team_stats`, soft `_attach_…`)
- Modify: `backend/tests/test_wnba_pregame_enrichment.py`

**Interfaces:**
- Produces:
  - `async def fetch_season_team_stats_pair(away_id: str, home_id: str) -> WnbaSeasonTeamStatsPair | None`
  - ESPN source: site API team stats / leaders table (prefer `https://site.web.api.espn.com/apis/site/v2/sports/basketball/wnba/statistics/team` or documented ESPN team stats endpoint used elsewhere — probe with a fixture from a live fetch during implementation; store fixture JSON under `backend/tests/fixtures/`)
  - Ranks: sort all league teams per stat; 1 = best (for TO, lower is better)
  - Curated keys only: pts, fg_pct, fg3_pct, ft_pct, reb, ast, stl, blk, to

- [ ] **Step 1: Failing unit test with fixture payload**

```python
def test_normalize_team_stats_pair_assigns_ranks():
    # fixture: 3 teams including away/home ids
    pair = normalize_season_team_stats_pair(FIXTURE, away_id="17", home_id="9")
    assert pair is not None
    assert pair.away.pts is not None
    assert pair.away.pts_rank is not None
    assert pair.home.to_rank is not None  # lower TO → better rank
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement normalize + fetch + attach**

Mirror MLB soft-fail:

```python
def attach_season_team_stats(detail, pair):
    if pair is None:
        return detail
    return detail.model_copy(update={"season_team_stats": pair})
```

Only for `status == "scheduled"`.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): attach ESPN season team stats with league ranks"
```

---

### Task 4: Game leaders (PPG / RPG / APG cards)

**Files:**
- Create: `backend/app/domains/wnba/game_leaders.py`
- Modify: `backend/app/domains/wnba/game_detail.py`
- Modify: `backend/tests/test_wnba_pregame_enrichment.py`

**Interfaces:**
- Consumes: existing ESPN summary `leaders` / already-normalized `season_leaders` structure
- Produces: `build_game_leaders_from_summary(payload, away, home) -> WnbaGameLeaders | None`
  - One card per key `ppg`/`rpg`/`apg` picking the better of away vs home season leader
  - `last_name` from display name; `side`/`team_abbrev` from winner; `rank` if available else None
  - Labels: `PPG`, `RPG`, `APG`

- [ ] **Step 1: Failing test**

```python
def test_build_game_leaders_picks_best_per_category():
    leaders = build_game_leaders_from_summary(SUMMARY_FIXTURE, away_team, home_team)
    assert leaders is not None
    keys = [c.key for c in leaders.leaders]
    assert keys == ["ppg", "rpg", "apg"]
```

Reuse or slim a real ESPN summary fixture from existing WNBA game_detail tests.

- [ ] **Step 2–4: Implement, attach soft-fail on scheduled, tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): build game leaders cards for scheduled preview"
```

---

### Task 5: OpenAPI regen after game-detail schema changes

**Files:**
- `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

- [ ] **Step 1: Export + generate + check**

```bash
PYTHONPATH=.:backend python scripts/export_openapi.py
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api && npm run check:api
```

Expected: PASS; schema includes `record`, `last_10`, `season_team_stats`, `game_leaders`.

- [ ] **Step 2: Commit**

```bash
git commit -m "chore(api): regenerate OpenAPI for WNBA pregame detail fields"
```

---

### Task 6: Frontend types + mapper

**Files:**
- Modify: `frontend/src/features/basketball/lib/types.ts`
- Modify: `frontend/src/features/basketball/lib/mapGameDetail.ts`
- Modify: `frontend/src/features/basketball/lib/mapGameDetail.test.ts`
- Update fixtures if present

**Interfaces:**
- Produces view fields: `GameDetailTeam.record`, `last10`; `seasonTeamStats`; `gameLeaders` (camelCase)

- [ ] **Step 1: Failing mapper test**

```ts
it("maps record, last10, seasonTeamStats, and gameLeaders", () => {
  const view = mapGameDetail(apiDetailWithPregameFields);
  expect(view.away.record).toBe("22-8");
  expect(view.away.last10).toBe("7-3");
  expect(view.seasonTeamStats?.away.pts).toBe(92);
  expect(view.gameLeaders?.leaders[0].key).toBe("ppg");
});
```

- [ ] **Step 2: Run vitest — FAIL**

- [ ] **Step 3: Extend types + `mapGameDetail` (mirror `mapMlbGameDetail`)**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): map pregame record, team stats, and game leaders"
```

---

### Task 7: `WnbaPregameBroadcastHeader` (record, last10, centered tabs)

**Files:**
- Create: `frontend/src/features/basketball/game/WnbaPregameBroadcastHeader.tsx`
- Create: `frontend/src/features/basketball/game/WnbaPregameBroadcastHeader.test.tsx`
- Do **not** break live `WnbaBroadcastHeader`

**Interfaces:**
- Produces: `PregameTab = "preview" | "away" | "home" | "props"`
- Props: `{ detail, activeTab, onTabChange }`
- UI: meta row (date | statusLabel | Share) → flush team slabs with name/record/`{last10} in Last 10` → centered tablist

- [ ] **Step 1: Failing tests** (copy structure from `MlbPregameBroadcastHeader` tests if present, else):

```tsx
it("shows record and last 10 on both slabs", () => {
  render(<WnbaPregameBroadcastHeader detail={detail} activeTab="preview" onTabChange={() => {}} />);
  expect(screen.getByText("22-8")).toBeInTheDocument();
  expect(screen.getByText(/7-3 in Last 10/)).toBeInTheDocument();
});

it("centers Preview Away Home Props tabs", () => {
  render(<WnbaPregameBroadcastHeader ... />);
  const tablist = screen.getByRole("tablist");
  expect(tablist).toHaveClass(/justify-center/);
  expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Props" })).toBeInTheDocument();
});
```

- [ ] **Step 2–4: Implement mirroring `MlbPregameBroadcastHeader.tsx`, tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add pregame broadcast header with record, last-10, tabs"
```

---

### Task 8: Odds board helper + UI (filter today’s odds)

**Files:**
- Create: `frontend/src/features/basketball/lib/wnbaOddsBoard.ts` (+test)
- Create: `frontend/src/features/basketball/game/WnbaGameOddsBoard.tsx` (+test)
- Modify odds schema/normalizers **only if** moneyline can be plumbed from existing novig/pinnacle team snapshots with small changes; otherwise show Total + Spread and leave Money as `–`

**Interfaces:**
- `findWnbaOddsGamesForMatchup(games, awayAbbrev, homeAbbrev, opts?: { wnbaAliases?: boolean })`
- Board view: group by `sportsbook`; tiles for money/total/spread when data exists
- Reuse `useWnbaOdds`; filter client-side for this game

- [ ] **Step 1: Failing filter test** using alias rules from `mergeMatchupOdds`

- [ ] **Step 2–4: Implement board UI charcoal `GameSection` titled **Odds**; pending/empty states**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add pregame odds board from today's matchup odds"
```

If moneyline fields are added to `WnbaOddsGame`, include OpenAPI regen in this task before frontend types.

---

### Task 9: `WnbaSeasonTeamStats` + `WnbaGameLeaders` UI

**Files:**
- Create: `WnbaSeasonTeamStats.tsx` (+test) — mirror `MlbSeasonTeamStats`
- Create: `WnbaGameLeaders.tsx` (+test) — mirror `MlbGameLeaders` with PPG/RPG/APG labels
- Hide section when data null/empty

- [ ] **Step 1: Failing render tests** for ranks (`#3`) and three leader cards

- [ ] **Step 2–4: Implement; PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add team stats ranks and game leaders preview sections"
```

---

### Task 10: Wire `WnbaPregameCenter` two-column Preview

**Files:**
- Modify: `frontend/src/features/basketball/game/WnbaPregameCenter.tsx`
- Modify: `frontend/src/features/basketball/game/WnbaPregameCenter.test.tsx`

**Interfaces:**
- State: `activeTab`; Preview default
- Preview grid `lg:grid-cols-2`:
  - left testid `wnba-preview-left-column`: ProjectedStarters → WnbaGameInfo → MatchupPrediction → WnbaGameLeaders
  - right testid `wnba-preview-right-column`: WnbaGameOddsBoard → WnbaSeasonTeamStats → InjuryReport
- Stop rendering list `SeasonLeaders` on Preview

- [ ] **Step 1: Failing test for column order / header usage**

```tsx
it("renders two-column preview with approved section order", () => {
  render(<WnbaPregameCenter detail={detail} />);
  const left = screen.getByTestId("wnba-preview-left-column");
  const right = screen.getByTestId("wnba-preview-right-column");
  // assert section titles order via within(left/right)
});
```

- [ ] **Step 2–4: Implement; PASS** (Away/Home/Props can be placeholders until later tasks)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): wire MLB-style two-column pregame preview layout"
```

---

### Task 11: Backend team-preview route

**Files:**
- Create: `backend/app/domains/wnba/schemas_team_preview.py`
- Create: `backend/app/domains/wnba/team_preview.py`
- Modify: `backend/app/domains/wnba/routes.py`
- Create: `backend/tests/test_wnba_team_preview.py`

**Interfaces:**
- `GET /api/wnba/games/{espn_event_id}/team-preview?side=away|home`
- Response:
  - `side`, `team {id,abbrev,name,logo_url}`
  - `leaders: list[WnbaTeamLeaderCard]` keys `ppg|rpg|apg`
  - `roster: list[WnbaTeamRosterRow]` columns: jersey, position, gp, min, pts, reb, ast, stl, blk, to, fg_pct, fg3_pct, ft_pct, name, player_id, headshot_url
- Source: ESPN roster + team player stats; soft empty lists on fetch failure; `LookupError` → 404 for bad game/side

- [ ] **Step 1: Failing route/unit tests** with mocked ESPN payloads

- [ ] **Step 2–4: Implement assembler + route; PASS**

- [ ] **Step 5: OpenAPI regen + commit**

```bash
git commit -m "feat(wnba): add team-preview endpoint for Away/Home tabs"
```

---

### Task 12: `WnbaTeamPreview` UI + Away/Home tabs

**Files:**
- Create: `frontend/src/features/basketball/hooks/useWnbaTeamPreview.ts`
- Create: `fetchWnbaTeamPreview` in `frontend/src/shared/lib/api.ts` (or local fetch helper matching MLB)
- Create: `WnbaTeamPreview.tsx` (+test)
- Modify: `WnbaPregameCenter.tsx` (+test)

- [ ] **Step 1: Failing tests** — leaders + roster table headers; tab loads with `enabled: activeTab === "away"|"home"`

- [ ] **Step 2–4: Implement; wire tabs; PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): wire Away/Home team preview tabs"
```

---

### Task 13: Props tab (PrizePicks / Underdog)

**Files:**
- Modify: `WnbaPregameCenter.tsx` (+test)
- Reuse: `useWnbaProps`, `filterPropLines` from `frontend/src/features/basketball/league/filterPropLines.ts`
- UI: sub-tabs PrizePicks | Underdog; filter props where `team_abbrev` ∈ `{away.abbrev, home.abbrev}` (apply WNBA alias set if needed); render a compact list/grid (can adapt MLB `MlbGamePropsGrid` patterns or a thin WNBA game props table using existing prop row fields)

- [ ] **Step 1: Failing test** — Props tab filters to game teams; empty message “No props for this game”

- [ ] **Step 2–4: Implement; PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add pregame Props tab filtered to this game"
```

---

### Task 14: Docs — system-design + spec status

**Files:**
- Modify: `md/system-design.md` row for `/games/:espnEventId` (+ team-preview + odds/props on pregame)
- Modify: `docs/superpowers/specs/2026-08-10-wnba-mlb-parity-matchup-preview-design.md` status → Implemented (when done)
- Optionally note superseded pregame bullets in `2026-08-09-wnba-mlb-parity-chrome-design.md`

- [ ] **Step 1: Update docs to match shipped behavior**

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: update system-design for WNBA MLB-parity matchup preview"
```

---

## Self-review checklist (plan author)

| Spec requirement | Task |
| --- | --- |
| Header record + last 10 | 2, 6, 7 |
| Centered Preview/Away/Home/Props | 7, 10, 12, 13 |
| Left column order | 10 |
| Right column order | 8, 9, 10 |
| Team stats curated + ranks | 1, 3, 9 |
| Game leaders PPG/RPG/APG | 1, 4, 9 |
| Odds on Preview | 8 |
| Game Info on Preview | 10 (reuse `WnbaGameInfo`) |
| Starters / prediction / injuries | 10 (reuse) |
| Away/Home leaders + roster | 11, 12 |
| Props PrizePicks/Underdog | 13 |
| Soft-fail | 2–4, 11 |
| OpenAPI | 5, 11 |
| system-design.md | 14 |

**Odds moneyline note:** Snapshots include moneyline but `WnbaOddsGame` may not. Task 8 must either plumb moneyline into the API or ship Total/Spread with Money as `–` — prefer plumbing if a small normalizer change unlocks it.

**No placeholders remaining** after implementation fills fixture paths discovered during Task 3 probe.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-wnba-mlb-parity-matchup-preview.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
