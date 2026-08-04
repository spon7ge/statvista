# MLB RotoWire Projected Lineups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show RotoWire projected SP + batting order (1–9) on scheduled MLB Preview in one logo-toggled box, via `GET /api/mlb/lineups?date=YYYY-MM-DD`, with a **Lineups unavailable** placeholder when data is missing.

**Architecture:** New `MLBDailyLineups` scraper parses RotoWire `daily-lineups.php` (today default URL; tomorrow via `?date=tomorrow`). Backend caches the slate ~3 minutes by ET date and exposes a dated JSON API. Preview loads lineups for `detail.game_date`, matches by team abbrev, and renders `MlbProjectedLineups` (away default). Live/final unchanged; no soft-merge into game detail.

**Tech Stack:** Python/BeautifulSoup/requests, FastAPI/Pydantic, pytest, React/TypeScript, TanStack Query, Vitest/RTL, openapi-typescript

## Global Constraints

- Preview tab only on **scheduled** games; Away/Home tabs stay stubs
- One lineup box toggled by **team logos** (default **away**)
- Missing/incomplete → always show **“Lineups unavailable”**
- UI note: **“RotoWire expected lineup”**
- Completeness: both sides need pitcher name + exactly 9 batters
- Supported RotoWire slates: ET **today** and **tomorrow** only; other dates → empty `games`
- Soft scrape failure → empty `games` (200), not 502
- Brand: **statvista** in any new product copy
- Spec: `docs/superpowers/specs/2026-08-04-mlb-rotowire-projected-lineups-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/scrapers/mlb_rotowire_lineups.py` | Fetch + parse MLB daily lineups HTML |
| `backend/tests/fixtures/rotowire_mlb_lineups_laa_bal.html` | Minimal one-card HTML fixture |
| `backend/tests/test_mlb_rotowire_lineups_scraper.py` | Scraper unit tests |
| `backend/app/schemas/mlb_lineups.py` | API models |
| `backend/app/services/mlb_lineups.py` | Date map, cache, get slate |
| `backend/app/api/routes/mlb_lineups.py` | `GET /api/mlb/lineups` |
| `backend/tests/test_mlb_lineups_route.py` | Route + cache tests |
| `backend/app/main.py` | Register router |
| `backend/app/schemas/mlb_game_detail.py` + service/mapper | Additive `game_date` |
| `frontend/openapi.json` + `api.schema.d.ts` | Regenerated |
| `frontend/src/lib/api.ts` | `fetchMlbLineups` |
| `frontend/src/hooks/useMlbLineups.ts` | Query hook |
| `frontend/src/components/mlb/MlbProjectedLineups.tsx` | Logo toggle UI |
| `frontend/src/components/mlb/MlbPregameCenter.tsx` | Mount on Preview |
| `md/system-design.md` | Page ↔ API row |

### RotoWire HTML facts (verified 2026-08-04)

- Cards: `div.lineup.is-mlb` (exclude nested `lineup__*` wrappers)
- Abbrs: `a.lineup__team.is-visit|is-home` → `.lineup__abbr`
- Pitcher: first `li.lineup__player-highlight` under each side’s list region — name `a`, hand `.lineup__throws`, stats `.lineup__player-highlight-stats` (e.g. `3-3 7.98 ERA`)
- Batters: `ul.lineup__list.is-visit|is-home` → `li.lineup__player` with `.lineup__pos`, name `a`, hand `.lineup__bats`
- Today URL: `https://www.rotowire.com/baseball/daily-lineups.php`
- Tomorrow URL: same + `?date=tomorrow`

---

### Task 1: MLB RotoWire scraper + fixture

**Files:**
- Create: `src/scrapers/mlb_rotowire_lineups.py`
- Create: `backend/tests/fixtures/rotowire_mlb_lineups_laa_bal.html`
- Create: `backend/tests/test_mlb_rotowire_lineups_scraper.py`

**Interfaces:**
- Produces:
  - `MLB_LINEUPS_URL = "https://www.rotowire.com/baseball/daily-lineups.php"`
  - `parse_mlb_lineups_html(html: str) -> list[dict]` — each game dict:
    `{away_abbrev, home_abbrev, status, away: {pitcher, batters}, home: {pitcher, batters}}`
  - `pitcher`: `{name, hand, record, era}` (record/era parsed from stats text; null if missing)
  - `batters`: list of `{order, position, name, hand}` order 1..n
  - `fetch_mlb_lineups_html(*, date_token: str | None = None) -> str` — `None`/empty → today; `"tomorrow"` → query param
  - `scrape_mlb_lineups(*, date_token: str | None = None) -> list[dict]`

- [ ] **Step 1: Create HTML fixture**

Copy a minimal single-card fixture into `backend/tests/fixtures/rotowire_mlb_lineups_laa_bal.html` based on live markup (LAA @ BAL): include visit/home abbrs, both pitcher highlights (throws + stats), and 9 batters per side with pos/bats. Wrap in `<html><body>…</body></html>`.

- [ ] **Step 2: Write failing scraper tests**

```python
from pathlib import Path
from src.scrapers.mlb_rotowire_lineups import parse_mlb_lineups_html

FIXTURE = Path(__file__).parent / "fixtures" / "rotowire_mlb_lineups_laa_bal.html"


def test_parse_mlb_lineups_laa_bal():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    assert len(games) == 1
    g = games[0]
    assert g["away_abbrev"] == "LAA"
    assert g["home_abbrev"] == "BAL"
    assert g["away"]["pitcher"]["name"]
    assert g["away"]["pitcher"]["hand"] in ("L", "R", "S")
    assert len(g["away"]["batters"]) == 9
    assert g["away"]["batters"][0]["order"] == 1
    assert g["away"]["batters"][0]["position"]
    assert len(g["home"]["batters"]) == 9


def test_parse_pitcher_record_and_era():
    games = parse_mlb_lineups_html(FIXTURE.read_text())
    p = games[0]["away"]["pitcher"]
    assert p["record"]  # e.g. "3-3"
    assert p["era"]  # e.g. "7.98"
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=. python3 -m pytest backend/tests/test_mlb_rotowire_lineups_scraper.py -v`

Expected: FAIL (module not found)

- [ ] **Step 4: Implement scraper**

```python
# src/scrapers/mlb_rotowire_lineups.py
MLB_LINEUPS_URL = "https://www.rotowire.com/baseball/daily-lineups.php"

def fetch_mlb_lineups_html(*, date_token: str | None = None) -> str:
    params = {}
    if date_token == "tomorrow":
        params["date"] = "tomorrow"
    # requests.get(MLB_LINEUPS_URL, params=params or None, timeout=30, headers={User-Agent})
    ...

def parse_mlb_lineups_html(html: str) -> list[dict]:
    # BeautifulSoup; cards = div.lineup where class has lineup and not lineup__*
    # prefer cards with "is-mlb" when present
    # for each card: away=is-visit, home=is-home
    # pitcher from lineup__player-highlight inside that side's list (or first highlight in side column)
    # parse stats with regex: r"(\d+-\d+)\s+([\d.]+)\s*ERA"
    # batters from ul.lineup__list.is-visit / is-home li.lineup__player
    ...
```

Pitcher association: each `ul.lineup__list.is-visit|is-home` typically contains the highlight `li` then batter `li`s — prefer highlight **inside** that `ul`; if highlight is a sibling structure, match visit highlight to visit list by DOM order (first highlight → away, second → home) as fallback.

- [ ] **Step 5: Run tests — expect PASS**

Run: `PYTHONPATH=. python3 -m pytest backend/tests/test_mlb_rotowire_lineups_scraper.py -v`

- [ ] **Step 6: Commit**

```bash
git add src/scrapers/mlb_rotowire_lineups.py \
  backend/tests/fixtures/rotowire_mlb_lineups_laa_bal.html \
  backend/tests/test_mlb_rotowire_lineups_scraper.py
git commit -m "$(cat <<'EOF'
feat(mlb): scrape RotoWire daily projected lineups

EOF
)"
```

---

### Task 2: Lineups schema, service, route, OpenAPI

**Files:**
- Create: `backend/app/schemas/mlb_lineups.py`
- Create: `backend/app/services/mlb_lineups.py`
- Create: `backend/app/api/routes/mlb_lineups.py`
- Create: `backend/tests/test_mlb_lineups_route.py`
- Modify: `backend/app/main.py`
- Modify: `frontend/openapi.json` + `frontend/src/lib/api.schema.d.ts` (export + generate)

**Interfaces:**
- Produces:
  - Models: `MlbLineupsResponse`, `MlbLineupGame`, `MlbLineupSide`, `MlbLineupPitcher`, `MlbLineupBatter`
  - `rotowire_date_token(date_et: str, *, now_et: date | None = None) -> str | None`  
    returns `None` for today, `"tomorrow"` for tomorrow, else sentinel that yields empty games
  - `async def get_mlb_lineups(date_et: str) -> MlbLineupsResponse`
  - `clear_mlb_lineups_cache() -> None`
  - Route: `GET /api/mlb/lineups?date=`

- [ ] **Step 1: Write failing route tests**

```python
def test_lineups_requires_date(client):
    assert client.get("/api/mlb/lineups").status_code == 422


def test_lineups_today_returns_games(monkeypatch, client):
    # patch scrape to parse fixture; date = ET today ISO
    ...
    res = client.get(f"/api/mlb/lineups?date={today_et}")
    assert res.status_code == 200
    body = res.json()
    assert body["date"] == today_et
    assert body["source"] == "rotowire"
    assert body["games"][0]["away_abbrev"] == "LAA"


def test_lineups_unsupported_date_empty_games(client):
    res = client.get("/api/mlb/lineups?date=2099-01-01")
    assert res.status_code == 200
    assert res.json()["games"] == []


def test_lineups_scrape_failure_returns_empty(monkeypatch, client):
    # patch scrape to raise; assert 200 games=[]
    ...
```

- [ ] **Step 2: Run — expect FAIL**

Run: `PYTHONPATH=backend:. python3 -m pytest backend/tests/test_mlb_lineups_route.py -v`

- [ ] **Step 3: Implement schema + service + route + register**

Schema fields match the design JSON (`last_10`-style snake_case). Service:

```python
ROTOWIRE_TTL_SECONDS = 180

def rotowire_date_token(date_et: str, *, now_et: date | None = None) -> str | None | Literal["unsupported"]:
    today = now_et or datetime.now(ZoneInfo("America/New_York")).date()
    target = date.fromisoformat(date_et)
    if target == today:
        return None  # today URL
    if target == today + timedelta(days=1):
        return "tomorrow"
    return "unsupported"

async def get_mlb_lineups(date_et: str) -> MlbLineupsResponse:
    token = rotowire_date_token(date_et)
    if token == "unsupported":
        return MlbLineupsResponse(date=date_et, games=[], source="rotowire", fetched_at=...)
    # cache key = date_et; on miss asyncio.to_thread(scrape_mlb_lineups, date_token=token)
    # on exception: return stale if any else empty games
```

Validate `date` query with regex `^\d{4}-\d{2}-\d{2}$` → 422 otherwise (FastAPI Query).

Register in `main.py` next to other MLB routers.

- [ ] **Step 4: Export OpenAPI + generate types**

```bash
python3 scripts/export_openapi.py
cd frontend && npm run generate:api
```

- [ ] **Step 5: Run tests — PASS**

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/mlb_lineups.py backend/app/services/mlb_lineups.py \
  backend/app/api/routes/mlb_lineups.py backend/app/main.py \
  backend/tests/test_mlb_lineups_route.py \
  frontend/openapi.json frontend/src/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
feat(mlb): add GET /api/mlb/lineups dated RotoWire slate

EOF
)"
```

---

### Task 3: Additive `game_date` on MLB game detail

**Files:**
- Modify: `backend/app/schemas/mlb_game_detail.py`
- Modify: `backend/app/services/mlb_game_detail.py` (`normalize_mlb_live_feed`)
- Modify: `backend/tests/test_mlb_game_detail_normalize.py` / schema test
- Modify: `frontend` OpenAPI regen
- Modify: `frontend/src/components/mlb/types.ts`, `mapMlbGameDetail.ts`, fixtures, mapper test

**Interfaces:**
- Produces: `MlbGameDetail.game_date: str | None` (ISO `YYYY-MM-DD` from `officialDate`)
- View: `gameDate: string | null`

- [ ] **Step 1: Failing backend + mapper tests** asserting `game_date` / `gameDate` from fixture officialDate

- [ ] **Step 2: Implement field + mapping; regenerate OpenAPI**

In normalize, set `game_date` from the same `officialDate` used by `_game_date_label` (raw ISO string when valid).

- [ ] **Step 3: Tests PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): expose game_date on game detail for lineups lookup

EOF
)"
```

---

### Task 4: Frontend API client + `useMlbLineups`

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useMlbLineups.ts`
- Create: `frontend/src/hooks/useMlbLineups.test.tsx` (optional thin) or cover via component tests in Task 5

**Interfaces:**
- Produces:
  - `fetchMlbLineups(dateEt: string): Promise<ApiMlbLineupsResponse>`
  - `useMlbLineups(dateEt: string | null | undefined)` — disabled when falsy; `queryKey: ["mlb", "lineups", dateEt]`

```typescript
export async function fetchMlbLineups(dateEt: string) {
  const res = await fetch(
    `${API_BASE}/api/mlb/lineups?date=${encodeURIComponent(dateEt)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`MLB lineups request failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 1: Implement client + hook**
- [ ] **Step 2: Smoke-test hook with mocked fetch (or defer asserts to Task 5)**
- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): add lineups API client and useMlbLineups hook

EOF
)"
```

---

### Task 5: `MlbProjectedLineups` UI

**Files:**
- Create: `frontend/src/components/mlb/MlbProjectedLineups.tsx`
- Create: `frontend/src/components/mlb/MlbProjectedLineups.test.tsx`

**Interfaces:**
- Consumes: `detail: MlbGameDetailView`, `lineupGame | null`, `isLoading?: boolean`
- Or: component accepts `detail` + matched game / null and owns unavailable copy

Props recommendation:

```typescript
type Props = {
  detail: MlbGameDetailView;
  game: ApiMlbLineupGame | null; // matched complete game or null
};
```

Behavior:
- Title: `Projected lineups · RotoWire expected lineup`
- Logo buttons for away/home (`data-testid` `mlb-lineup-toggle-away|home`); default away selected
- If `game` null → body **Lineups unavailable**
- Else show selected side’s SP then batters 1–9
- Missing logos → show abbrev text as toggle control

- [ ] **Step 1: Write failing RTL tests** (toggle, unavailable, SP+9 rows)
- [ ] **Step 2: Implement component** using `GameSection` surface like other MLB cards
- [ ] **Step 3: Tests PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): add logo-toggled projected lineups panel

EOF
)"
```

---

### Task 6: Wire Preview + system-design

**Files:**
- Modify: `frontend/src/components/mlb/MlbPregameCenter.tsx` + test
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx` if needed
- Modify: `md/system-design.md`

**Logic in Preview panel:**

```tsx
const date = detail.gameDate;
const { data, isError } = useMlbLineups(activeTab === "preview" ? date : undefined);
const matched = findCompleteMatch(data?.games, detail.away.abbrev, detail.home.abbrev);
// findCompleteMatch: both abbrevs equal (case-insensitive) AND both sides complete
<MlbProjectedLineups detail={detail} game={matched} />
```

Helper `sideComplete(side)`: pitcher?.name && batters?.length === 9.

Away/Home tabs keep stub text.

Update `md/system-design.md` table: `/mlb/games/:gamePk` Preview uses `GET /api/mlb/lineups?date=` + game detail.

- [ ] **Step 1: Failing pregame center test** — Preview shows projected lineups / unavailable
- [ ] **Step 2: Implement wiring**
- [ ] **Step 3: Tests PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mlb): show RotoWire lineups on scheduled Preview tab

EOF
)"
```

---

### Task 7: Verification sweep

- [ ] **Step 1:** `PYTHONPATH=backend:. python3 -m pytest backend/tests/test_mlb_rotowire_lineups_scraper.py backend/tests/test_mlb_lineups_route.py backend/tests/test_mlb_game_detail_normalize.py -v`
- [ ] **Step 2:** `cd frontend && npm test -- --run src/components/mlb/MlbProjectedLineups.test.tsx src/components/mlb/MlbPregameCenter.test.tsx src/pages/MlbGameDetailPage.test.tsx`
- [ ] **Step 3:** Confirm OpenAPI path `/api/mlb/lineups` present
- [ ] **Step 4:** Fix only regressions caused by this work; commit if needed

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Scraper RotoWire MLB | 1 |
| `GET /api/mlb/lineups?date=` + cache + soft fail | 2 |
| `game_date` on detail | 3 |
| Hook / fetch | 4 |
| Logo toggle UI + unavailable | 5 |
| Preview wiring + system-design | 6 |
| Verification | 7 |

## Self-review notes

- Date token mapping is ET today/`tomorrow` only — not raw ISO to RotoWire.
- Batter hand from `.lineup__bats`; pitcher from `.lineup__throws`.
- No soft-merge into game-detail payload.
