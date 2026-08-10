# WNBA Preview PX / Novig / Pinnacle Odds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preview Odds stacks ProphetX → Novig → Pinnacle via `book_boards`; wire WNBA ProphetX team upserts; remove odds from `/wnba/matchups` cards.

**Architecture:** Mirror MLB: migration `odds.wnba_prophetx_team`, league-aware `load_prophetx_team_snapshot`, `fetch_latest_prophetx_team("wnba")`, assemble `book_boards` on `GET /api/wnba/odds/today`. Frontend prefers `book_boards` for Preview; Matchups page stops odds fetch/merge.

**Tech Stack:** FastAPI/Pydantic, Supabase `odds.*`, React + Vitest, existing `WnbaGameOddsBoard` / `wnbaOddsBoard.ts`.

**Spec:** `docs/superpowers/specs/2026-08-10-wnba-preview-odds-px-novig-pinnacle-design.md`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-wnba-preview-odds-px-novig-pinnacle-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Preview book order: `prophetx` → `novig` → `pinnacle` (omit missing)
- Preview columns stay Money · Total · Spread (do not drop Money)
- Sharp DK/FD never appear on Preview `book_boards`
- Matchups: no odds pill, no `useWnbaOdds` / `mergeMatchupOdds`
- Soft-fail per book source; never 500 `/api/wnba/odds/today` solely for empty snapshots
- OpenAPI trio after schema change:
  `PYTHONPATH=.:backend python scripts/export_openapi.py && cp frontend/openapi.json backend/openapi-golden.json && cd frontend && npm run generate:api && npm run check:api`
- Backend verify: `cd backend && PYTHONPATH=..:. python3 -m pytest <tests> -q`
- Frontend verify: `cd frontend && npx vitest run <files>`
- Note: working tree may already have unrelated `odds_snapshots` / `quote_specs` edits — commit **only** this plan’s files

---

## File Structure

| File | Responsibility |
|------|----------------|
| `db/migrations/037_odds_wnba_prophetx_team.sql` | WNBA ProphetX team table |
| `src/odds/quote_specs.py` | Quote identity for `wnba_prophetx_team` |
| `src/odds/load_snapshots.py` | League-aware ProphetX team upsert table |
| `backend/app/core/odds_snapshots.py` | Map `wnba` → `wnba_prophetx_team` |
| `src/scrapers/wnba_prophetx.py` | Real `load_supabase_snapshots` (team) |
| `backend/app/schemas/odds.py` | `book_boards` on `WnbaOddsResponse` |
| `backend/app/providers/pinnacle/team_odds.py` | Assemble PX/Novig/Pin boards |
| `frontend/.../wnbaOddsBoard.ts` | Prefer `book_boards` |
| `frontend/src/pages/LeagueMatchupsPage.tsx` | Drop WNBA odds wiring |
| `md/system-design.md` | Page ↔ API notes |

---

### Task 1: Migration + league-aware ProphetX team load + fetch map

**Files:**
- Create: `db/migrations/037_odds_wnba_prophetx_team.sql`
- Modify: `src/odds/quote_specs.py`
- Modify: `src/odds/load_snapshots.py` (`load_prophetx_team_snapshot`)
- Modify: `backend/app/core/odds_snapshots.py` (`_PROPHETX_TEAM_TABLE`)
- Test: `src/scrapers/tests/odds/test_load_snapshots.py` (or new focused test)
- Test: `backend/tests/test_odds_snapshots_pinnacle.py` (or adjacent)

**Interfaces:**
- Produces: table `odds.wnba_prophetx_team`; `load_prophetx_team_snapshot(..., league="wnba")` upserts that table; `fetch_latest_prophetx_team("wnba")` reads it

- [ ] **Step 1: Failing tests**

Assert `fetch_latest_prophetx_team("wnba")` SQL references `odds.wnba_prophetx_team`.

Assert `load_prophetx_team_snapshot` with `league="wnba"` calls `upsert_df` / `apply_change_filter` with table `wnba_prophetx_team` (mock).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_odds_snapshots_pinnacle.py -k prophetx_team -q
# plus load_snapshots test path once named
```

- [ ] **Step 3: Implement**

Migration (mirror `030_odds_mlb_prophetx_team.sql`, `event_id BIGINT`):

```sql
-- 037_odds_wnba_prophetx_team.sql
CREATE SCHEMA IF NOT EXISTS odds;

CREATE TABLE IF NOT EXISTS odds.wnba_prophetx_team (
    league           TEXT        NOT NULL,
    event_id         BIGINT,
    away_team        TEXT        NOT NULL,
    home_team        TEXT        NOT NULL,
    start_time       TIMESTAMPTZ,
    market_type      TEXT        NOT NULL,
    side             TEXT        NOT NULL,
    team             TEXT,
    points           NUMERIC,
    american_price   INTEGER     NOT NULL,
    stake            NUMERIC,
    scraped_at       TIMESTAMPTZ NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS odds_wnba_prophetx_team_snapshot_uidx
    ON odds.wnba_prophetx_team (
        league, event_id, market_type, side, points, scraped_at
    )
    NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS odds_wnba_prophetx_team_league_scraped_at_idx
    ON odds.wnba_prophetx_team (league, scraped_at DESC);
```

In `quote_specs.py` add `"wnba_prophetx_team": _EXCHANGE_TEAM` (same identity as MLB team).

In `load_snapshots.py`:

```python
def _prophetx_team_table(league: str) -> str:
    key = (league or "").strip().lower()
    if key == "wnba":
        return "wnba_prophetx_team"
    return "mlb_prophetx_team"
```

Use that in `load_prophetx_team_snapshot` for `apply_change_filter` + `upsert_df` (keep props loader MLB-only unless trivial).

In `odds_snapshots.py`:

```python
_PROPHETX_TEAM_TABLE = {
    "mlb": "mlb_prophetx_team",
    "wnba": "wnba_prophetx_team",
}
```

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(odds): add wnba_prophetx_team table and league-aware load"
```

---

### Task 2: Wire WNBA ProphetX scraper Supabase team upsert

**Files:**
- Modify: `src/scrapers/wnba_prophetx.py` (`load_supabase_snapshots`)
- Test: `src/scrapers/tests/scrapers/test_wnba_prophetx.py`

**Interfaces:**
- Consumes: `load_prophetx_team_snapshot(games, league="wnba", scraped_at=...)`
- Produces: real upsert (JSON still written); props upsert optional/skip this pass

- [ ] **Step 1: Failing test** — mock `load_prophetx_team_snapshot`; call `load_supabase_snapshots`; expect `league="wnba"` and team games passed; no longer only log stub.

- [ ] **Step 2: RED**

- [ ] **Step 3: Implement** (mirror `mlb_prophetx.load_supabase_snapshots`, team-only):

```python
def load_supabase_snapshots(
    props_games: list[dict[str, Any]],
    team_games: list[dict[str, Any]],
    *,
    scraped_at: datetime | None = None,
    props_path: str | None = None,
    team_path: str | None = None,
) -> None:
    try:
        from src.odds.load_snapshots import load_prophetx_team_snapshot

        when = scraped_at or datetime.now(timezone.utc)
        n_team = load_prophetx_team_snapshot(
            team_games, league="wnba", scraped_at=when
        )
        logger.info(
            "Supabase ProphetX WNBA upserted team=%s%s",
            n_team,
            f" team_path={team_path}" if team_path else "",
        )
        del props_games, props_path  # props table out of scope this pass
    except Exception as exc:
        logger.error("Supabase ProphetX WNBA load failed (JSON kept): %s", exc)
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(scrapers): upsert WNBA ProphetX team snapshots to Supabase"
```

---

### Task 3: `book_boards` on WNBA odds API

**Files:**
- Modify: `backend/app/schemas/odds.py`
- Modify: `backend/app/providers/pinnacle/team_odds.py`
- Test: `backend/tests/test_pinnacle_team_odds.py`

**Interfaces:**
- Produces: `WnbaOddsResponse.book_boards: list[WnbaOddsGame]`
- `get_today_odds()` fills boards from PX → Novig → Pinnacle (soft-fail each)
- Reuse/generalize row normalize so PX/Novig get `sportsbook=` set (today’s `normalize_pinnacle_team_rows` hardcodes pinnacle)

- [ ] **Step 1: Failing tests**

```python
def test_get_today_odds_book_boards_order_px_novig_pin(monkeypatch):
    # stub fetch_latest_*_team to return one matchup each
    # assert [g.sportsbook for g in body.book_boards] == ["prophetx","novig","pinnacle"]
    # assert no draftkings/fanduel in book_boards

def test_get_today_odds_book_boards_omits_failed_source(monkeypatch):
    # PX raises / empty → boards are novig, pinnacle only
```

Also assert response includes `book_boards=[]` on total failure path.

- [ ] **Step 2: RED**

- [ ] **Step 3: Implement**

Schema:

```python
class WnbaOddsResponse(BaseModel):
    ...
    games: list[WnbaOddsGame] = Field(default_factory=list)
    book_boards: list[WnbaOddsGame] = Field(default_factory=list)
    error: str | None = None
```

In `team_odds.py` (pattern from `domains/mlb/odds.py`):

- `_BOOK_BOARD_ORDER = ("prophetx", "novig", "pinnacle")`
- Refactor normalize to `normalize_team_odds_rows(rows, *, sportsbook: str) -> list[WnbaOddsGame]` (keep `normalize_pinnacle_team_rows` as wrapper with `sportsbook="pinnacle"`)
- `collect_book_boards(*sources) -> list[WnbaOddsGame]`
- In `get_today_odds`:

```python
pin_rows = fetch_latest_pinnacle_team("wnba")
pin_games = normalize_pinnacle_team_rows(pin_rows)
try:
    px_rows = fetch_latest_prophetx_team("wnba")
    px_games = normalize_team_odds_rows(px_rows, sportsbook="prophetx")
except Exception:
    px_games = []
try:
    novig_rows = fetch_latest_novig_team("wnba")
    novig_games = normalize_team_odds_rows(novig_rows, sportsbook="novig")
except Exception:
    novig_games = []

sharp_games, sharp_errors = await _fetch_sharp_games()
games = merge_pinnacle_prefer_sharp(pin_games, sharp_games)
book_boards = collect_book_boards(px_games, novig_games, pin_games)
```

Cache/error paths must include `book_boards`.

- [ ] **Step 4: GREEN** — `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_pinnacle_team_odds.py -q`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add odds/today book_boards for PX/Novig/Pinnacle"
```

---

### Task 4: OpenAPI trio

**Files:**
- Regenerate: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`

- [ ] **Step 1: Run OpenAPI trio** (command in Global Constraints)

- [ ] **Step 2: Confirm `WnbaOddsResponse.book_boards` in schema**

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(api): expose WNBA odds book_boards in OpenAPI"
```

---

### Task 5: Frontend Preview prefers `book_boards`

**Files:**
- Modify: `frontend/src/features/basketball/lib/wnbaOddsBoard.ts`
- Test: `frontend/src/features/basketball/lib/wnbaOddsBoard.test.ts`

**Interfaces:**
- Consumes: `ApiWnbaOddsResponse.book_boards`
- Produces: `collectWnbaOddsBookBoards` uses `book_boards` when non-empty; else `games[]`

- [ ] **Step 1: Failing test**

```ts
it("prefers book_boards over games when present", () => {
  const views = collectWnbaOddsBookBoards(
    {
      as_of: "t",
      sportsbook: "pinnacle",
      error: null,
      games: [game({ sportsbook: "draftkings" })],
      book_boards: [
        game({ sportsbook: "prophetx" }),
        game({ sportsbook: "novig" }),
        game({ sportsbook: "pinnacle" }),
      ],
    },
    "SEA",
    "ATL",
  );
  expect(views.map((v) => v.sportsbook)).toEqual([
    "prophetx",
    "novig",
    "pinnacle",
  ]);
});
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Implement** — in `collectWnbaOddsBookBoards`, set source list to `response.book_boards` if length > 0 else `response.games`.

- [ ] **Step 4: GREEN**

```bash
cd frontend && npx vitest run src/features/basketball/lib/wnbaOddsBoard.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): Preview odds board prefers book_boards"
```

---

### Task 6: Remove odds from WNBA matchups cards

**Files:**
- Modify: `frontend/src/pages/LeagueMatchupsPage.tsx` (`WnbaMatchupsPage`)
- Test: `frontend/src/pages/LeagueMatchupsPage.test.tsx` (+ any matchups odds integration tests)

**Interfaces:**
- WNBA matchups use `mapToMatchupGames(games)` only (like MLB matchups)

- [ ] **Step 1: Failing test** — assert WNBA matchups does not call `useWnbaOdds` / no `matchup-odds` for scheduled games that previously had odds fixtures. Update existing tests that mocked odds.

- [ ] **Step 2: RED**

- [ ] **Step 3: Implement**

```tsx
function WnbaMatchupsPage() {
  // remove showOdds, oddsQuery, mergeMatchupOdds
  const matchupGames = mapToMatchupGames(games);
  ...
}
```

Remove unused imports (`useWnbaOdds`, `mergeMatchupOdds`, `isOddsWindowDate` if unused).

- [ ] **Step 4: GREEN**

```bash
cd frontend && npx vitest run src/pages/LeagueMatchupsPage.test.tsx src/features/basketball/league/MatchupGameCard.test.tsx
```

(`MatchupGameCard` may still support `odds` for other callers — leave component; just stop feeding it.)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): remove team odds from matchups cards"
```

---

### Task 7: Docs — system-design

**Files:**
- Modify: `md/system-design.md` (`/wnba/matchups`, `/games/:espnEventId`, `/api/wnba/odds/today` rows)
- Modify: spec status → Implemented when done: `docs/superpowers/specs/2026-08-10-wnba-preview-odds-px-novig-pinnacle-design.md`

- [ ] **Step 1: Update docs** — Matchups: no odds merge. Preview: `book_boards` PX→Novig→Pinnacle. API inventory notes `book_boards`.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: WNBA Preview multi-book odds and matchups without odds"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `odds.wnba_prophetx_team` migration | 1 |
| `fetch_latest_prophetx_team("wnba")` | 1 |
| League-aware team upsert | 1–2 |
| Scraper real `load_supabase_snapshots` | 2 |
| `book_boards` on odds/today | 3–4 |
| Order PX → Novig → Pinnacle | 3, 5 |
| Soft-fail per book | 3 |
| Preview prefers `book_boards` | 5 |
| Matchups remove odds | 6 |
| system-design | 7 |
| Props ProphetX table | Out of scope (YAGNI) |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-wnba-preview-odds-px-novig-pinnacle.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
