# MLB Pregame Broadcast Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On scheduled `/mlb/games/:gamePk`, replace the compact “Not live yet” shell with a final-style split broadcast header (name, season record, last-10) plus stub Preview / Away / Home tabs, with additive `last_10` from MLB standings.

**Architecture:** Soft-attach standings last-10 onto existing `GET /api/mlb/games/{gamePk}` after live-feed normalize. New frontend `MlbPregameBroadcastHeader` + `MlbPregameCenter` mirror the final shell pattern without changing live/final branches. Halftime stays on the compact path.

**Tech Stack:** FastAPI/Pydantic, httpx, pytest, React, TypeScript, Vitest/RTL, Tailwind, openapi-typescript

## Global Constraints

- Scheduled branch only; live and final unchanged; halftime stays compact
- Season record + **Last 10** only (not Last 5)
- Tabs are stubs (Preview / Away name / Home name); no real preview content
- Additive API field `last_10` only; standings failure must not fail game detail
- Share control is non-functional UI affordance
- Follow existing `frontend/src/components/mlb/` and `backend/app/services/mlb_game_detail.py` patterns
- Brand: **statvista** in any new user-facing copy

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/schemas/mlb_game_detail.py` | Add `last_10` on `MlbGameDetailTeam` |
| `backend/app/services/mlb_game_detail.py` | Standings fetch/cache/parse; soft-attach `last_10`; scheduled start-time label |
| `backend/tests/fixtures/mlb_standings_sample.json` | Minimal AL+NL standings fixture with `lastTen` split |
| `backend/tests/test_mlb_game_detail_normalize.py` | last_10 attach + soft-fail coverage |
| `backend/tests/test_mlb_game_detail_schema.py` | Schema accepts `last_10` |
| `frontend/openapi.json` + `src/lib/api.schema.d.ts` | Regenerated contract |
| `frontend/src/components/mlb/types.ts` | View-model `last10` |
| `frontend/src/components/mlb/mapMlbGameDetail.ts` | Map `last_10` → `last10` |
| `frontend/src/components/mlb/testFixtures.ts` | Scheduled fixture with records/last10 |
| `frontend/src/components/mlb/MlbPregameBroadcastHeader.tsx` | Split slabs + stub tabs |
| `frontend/src/components/mlb/MlbPregameBroadcastHeader.test.tsx` | Header unit tests |
| `frontend/src/components/mlb/MlbPregameCenter.tsx` | Header + stub panels |
| `frontend/src/components/mlb/MlbPregameCenter.test.tsx` | Center composition tests |
| `frontend/src/pages/MlbGameDetailPage.tsx` | Scheduled → `MlbPregameCenter` |
| `frontend/src/pages/MlbGameDetailPage.test.tsx` | Update scheduled assertion |
| `md/system-design.md` | Correct `/mlb/games/:gamePk` row |

---

### Task 1: Schema `last_10` + OpenAPI regen

**Files:**
- Modify: `backend/app/schemas/mlb_game_detail.py`
- Modify: `backend/tests/test_mlb_game_detail_schema.py`
- Modify: `frontend/openapi.json` (via export)
- Modify: `frontend/src/lib/api.schema.d.ts` (via generate)

**Interfaces:**
- Produces: `MlbGameDetailTeam.last_10: str | None = None`

- [ ] **Step 1: Write the failing schema test**

Append to `backend/tests/test_mlb_game_detail_schema.py`:

```python
def test_mlb_game_detail_team_accepts_last_10():
    team = MlbGameDetailTeam(
        id="120",
        abbrev="WSH",
        name="Washington Nationals",
        score=None,
        color="#AB0003",
        record="55-59",
        last_10="0-5",
    )
    assert team.last_10 == "0-5"
    assert team.model_dump()["last_10"] == "0-5"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_schema.py::test_mlb_game_detail_team_accepts_last_10 -v`

Expected: FAIL (unexpected keyword argument `last_10` / validation error)

- [ ] **Step 3: Add field to schema**

In `MlbGameDetailTeam` in `backend/app/schemas/mlb_game_detail.py`, after `record`:

```python
    record: str | None = None
    last_10: str | None = None
```

- [ ] **Step 4: Run schema test to verify it passes**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_schema.py -v`

Expected: PASS

- [ ] **Step 5: Regenerate OpenAPI artifacts**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
python3 scripts/export_openapi.py
cd frontend && npm run generate:api
```

Confirm `MlbGameDetailTeam` in `frontend/src/lib/api.schema.d.ts` includes `last_10: string | null`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/mlb_game_detail.py \
  backend/tests/test_mlb_game_detail_schema.py \
  frontend/openapi.json \
  frontend/src/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
feat(mlb): add last_10 to game-detail team schema

EOF
)"
```

---

### Task 2: Standings last-10 soft-attach + scheduled start label

**Files:**
- Create: `backend/tests/fixtures/mlb_standings_sample.json`
- Modify: `backend/app/services/mlb_game_detail.py`
- Modify: `backend/tests/test_mlb_game_detail_normalize.py`

**Interfaces:**
- Consumes: `MlbGameDetailTeam.last_10`
- Produces:
  - `parse_standings_last10(payload: dict) -> dict[str, str]`  # team_id → `"W-L"`
  - `attach_last10(detail: MlbGameDetail, last10_by_team_id: dict[str, str]) -> MlbGameDetail`
  - `fetch_mlb_standings() -> dict` (cached ~600s)
  - Soft-call from `get_mlb_game_detail` after normalize
  - When status is scheduled and `gameData.datetime.dateTime` exists, set `status_label` to ET tip time (reuse scoreboard formatting pattern)

- [ ] **Step 1: Create standings fixture**

Create `backend/tests/fixtures/mlb_standings_sample.json` with two team records (enough for away/home ids used in tests). Minimal shape:

```json
{
  "records": [
    {
      "teamRecords": [
        {
          "team": { "id": 120, "name": "Washington Nationals" },
          "wins": 55,
          "losses": 59,
          "records": {
            "splitRecords": [
              { "wins": 0, "losses": 5, "type": "lastTen", "pct": ".000" }
            ]
          }
        },
        {
          "team": { "id": 143, "name": "Philadelphia Phillies" },
          "wins": 60,
          "losses": 53,
          "records": {
            "splitRecords": [
              { "wins": 3, "losses": 2, "type": "lastTen", "pct": ".600" }
            ]
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing parse / attach tests**

Append to `backend/tests/test_mlb_game_detail_normalize.py`:

```python
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services.mlb_game_detail import (
    attach_last10,
    normalize_mlb_live_feed,
    parse_standings_last10,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_standings_last10_from_split_records():
    payload = json.loads((FIXTURES / "mlb_standings_sample.json").read_text())
    mapping = parse_standings_last10(payload)
    assert mapping["120"] == "0-5"
    assert mapping["143"] == "3-2"


def test_attach_last10_sets_both_teams():
    payload = _payload()
    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    # Force known ids if fixture ids differ — use detail.away.id / home.id
    mapping = {
        detail.away.id: "0-5",
        detail.home.id: "3-2",
    }
    enriched = attach_last10(detail, mapping)
    assert enriched.away.last_10 == "0-5"
    assert enriched.home.last_10 == "3-2"


def test_attach_last10_leaves_null_when_missing():
    payload = _payload()
    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    enriched = attach_last10(detail, {})
    assert enriched.away.last_10 is None
    assert enriched.home.last_10 is None
```

Also add a route/get-level soft-fail test if one exists for ESPN attach patterns; otherwise add:

```python
@pytest.mark.asyncio
async def test_get_mlb_game_detail_soft_fails_standings(monkeypatch):
    # Patch fetch_mlb_live_feed to return _payload(); patch fetch_mlb_standings to raise
    # Assert returned detail has last_10 is None and status still ok
    ...
```

Implement the soft-fail test against the real `get_mlb_game_detail` helpers already used in `backend/tests/test_mlb_game_detail_route.py` if easier — mirror ESPN soft-merge style.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py::test_parse_standings_last10_from_split_records backend/tests/test_mlb_game_detail_normalize.py::test_attach_last10_sets_both_teams -v`

Expected: FAIL (import / not defined)

- [ ] **Step 4: Implement parse, attach, fetch, cache, wire into get**

In `backend/app/services/mlb_game_detail.py`:

```python
STANDINGS_URL = "https://statsapi.mlb.com/api/v1/standings"
STANDINGS_TTL_SECONDS = 600
_standings_cache: dict[str, Any] = {"expires_at": 0.0, "payload": None}


def parse_standings_last10(payload: dict) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for block in _as_list(payload.get("records")):
        for team_record in _as_list(_as_dict(block).get("teamRecords")):
            team = _as_dict(team_record.get("team"))
            team_id = team.get("id")
            if team_id is None:
                continue
            splits = _as_list(_as_dict(_as_dict(team_record.get("records")).get("splitRecords")))
            for split in splits:
                if str(_as_dict(split).get("type") or "") != "lastTen":
                    continue
                wins = _int_or_none(split.get("wins"))
                losses = _int_or_none(split.get("losses"))
                if wins is None or losses is None:
                    break
                mapping[str(team_id)] = f"{wins}-{losses}"
                break
    return mapping


def attach_last10(
    detail: MlbGameDetail, last10_by_team_id: dict[str, str]
) -> MlbGameDetail:
    away_l10 = last10_by_team_id.get(detail.away.id)
    home_l10 = last10_by_team_id.get(detail.home.id)
    if away_l10 is None and home_l10 is None:
        return detail
    return detail.model_copy(
        update={
            "away": detail.away.model_copy(update={"last_10": away_l10}),
            "home": detail.home.model_copy(update={"last_10": home_l10}),
        }
    )


async def fetch_mlb_standings() -> dict:
    async with httpx.AsyncClient(timeout=STATS_TIMEOUT_SECONDS) as client:
        response = await client.get(
            STANDINGS_URL,
            params={"leagueId": "103,104"},
        )
        response.raise_for_status()
        return response.json()


async def _standings_last10_map() -> dict[str, str]:
    now = time.time()
    cached = _standings_cache.get("payload")
    if cached is not None and float(_standings_cache.get("expires_at") or 0) > now:
        return parse_standings_last10(cached)
    payload = await fetch_mlb_standings()
    _standings_cache["payload"] = payload
    _standings_cache["expires_at"] = now + STANDINGS_TTL_SECONDS
    return parse_standings_last10(payload)
```

In `get_mlb_game_detail`, after normalize (and preferably before/after ESPN soft-merge — either is fine; do after normalize, before cache write):

```python
    try:
        detail = attach_last10(detail, await _standings_last10_map())
    except Exception as exc:
        logger.warning(
            "MLB standings last10 unavailable for game %s: %s",
            detail.mlb_game_pk,
            exc,
        )
```

Also improve scheduled `status_label` when first pitch is known. In `normalize_mlb_live_feed` (or `_map_status` callers), when `status == "scheduled"`:

```python
    datetime_block = _as_dict(game_data.get("datetime"))
    date_time = datetime_block.get("dateTime") or datetime_block.get("dateTimeUTC")
    if status == "scheduled" and isinstance(date_time, str):
        tip = _format_first_pitch_et(date_time)
        if tip:
            status_label = tip
```

Implement `_format_first_pitch_et` locally (same logic as `format_tip_label` in `mlb_scoreboard.py`) — prefer a small local helper over cross-import if that avoids circular deps; otherwise import `format_tip_label` from `app.services.mlb_scoreboard`.

Ensure `_detail_team` does **not** need to set `last_10` (defaults null); attach fills it.

- [ ] **Step 5: Run normalize tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_normalize.py -v`

Expected: PASS (including new tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/mlb_game_detail.py \
  backend/tests/fixtures/mlb_standings_sample.json \
  backend/tests/test_mlb_game_detail_normalize.py \
  backend/tests/test_mlb_game_detail_route.py
git commit -m "$(cat <<'EOF'
feat(mlb): soft-attach standings last_10 on game detail

EOF
)"
```

---

### Task 3: Frontend types, mapper, fixtures

**Files:**
- Modify: `frontend/src/components/mlb/types.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.test.ts`
- Modify: `frontend/src/components/mlb/testFixtures.ts`

**Interfaces:**
- Consumes: API `last_10`
- Produces: view `MlbGameDetailTeam.last10: string | null`

- [ ] **Step 1: Write failing mapper test**

In `frontend/src/components/mlb/mapMlbGameDetail.test.ts`, extend an existing scheduled/final mapping assertion:

```typescript
expect(view.away.last10).toBe("0-5");
expect(view.home.last10).toBe("3-2");
```

Add `last_10: "0-5"` / `"3-2"` on the API fixture input used by that test.

- [ ] **Step 2: Run mapper test to verify it fails**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/mapMlbGameDetail.test.ts`

Expected: FAIL (`last10` undefined / not equal)

- [ ] **Step 3: Update types, mapper, fixtures**

`types.ts` — on `MlbGameDetailTeam`:

```typescript
  record: string | null;
  last10: string | null;
  color: string;
```

`mapMlbGameDetail.ts` — in `mapTeam`:

```typescript
    record: team.record,
    last10: team.last_10 ?? null,
    color: team.color,
```

`testFixtures.ts` — add `last10: null` to all team objects; add:

```typescript
export const mlbScheduledDetail: MlbGameDetailView = {
  ...mlbLiveDetail,
  mlbGamePk: "824999",
  status: "scheduled",
  statusLabel: "3:40 PM ET",
  gameDateLabel: "Today",
  away: {
    id: "120",
    abbrev: "WSH",
    name: "Washington Nationals",
    score: null,
    record: "55-59",
    last10: "0-5",
    color: "#AB0003",
    logoUrl: null,
  },
  home: {
    id: "143",
    abbrev: "PHI",
    name: "Philadelphia Phillies",
    score: null,
    record: "60-53",
    last10: "3-2",
    color: "#E81828",
    logoUrl: null,
  },
  situation: null,
  linescore: null,
  plays: [],
  scoringPlays: [],
  boxScore: null,
  teamStats: null,
  winProbability: null,
  hitChart: [],
  decisions: null,
  sources: ["statsapi"],
  fetchedAt: "2026-08-04T00:00:00Z",
};
```

(Adjust spread vs explicit fields so TypeScript compiles — do not leave live-only situation data on scheduled.)

- [ ] **Step 4: Run mapper + typecheck-related tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/mapMlbGameDetail.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/types.ts \
  frontend/src/components/mlb/mapMlbGameDetail.ts \
  frontend/src/components/mlb/mapMlbGameDetail.test.ts \
  frontend/src/components/mlb/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): map game-detail last_10 into view model

EOF
)"
```

---

### Task 4: `MlbPregameBroadcastHeader`

**Files:**
- Create: `frontend/src/components/mlb/MlbPregameBroadcastHeader.tsx`
- Create: `frontend/src/components/mlb/MlbPregameBroadcastHeader.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView` (`gameDateLabel`, `statusLabel`, `away`/`home` with `name`, `record`, `last10`, `color`, `logoUrl`)
- Produces:
  - `export type PregameTab = "preview" | "away" | "home"`
  - `MlbPregameBroadcastHeader({ detail, activeTab, onTabChange })`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbPregameBroadcastHeader } from "./MlbPregameBroadcastHeader";
import { mlbScheduledDetail } from "./testFixtures";

describe("MlbPregameBroadcastHeader", () => {
  it("renders date, start time, records, last-10, and share", () => {
    render(
      <MlbPregameBroadcastHeader
        detail={mlbScheduledDetail}
        activeTab="preview"
        onTabChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("mlb-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(/3:40 PM/i)).toBeInTheDocument();
    expect(screen.getByText("Washington Nationals")).toBeInTheDocument();
    expect(screen.getByText("Philadelphia Phillies")).toBeInTheDocument();
    expect(screen.getByText("55-59")).toBeInTheDocument();
    expect(screen.getByText("60-53")).toBeInTheDocument();
    expect(screen.getByText("0-5 in Last 10")).toBeInTheDocument();
    expect(screen.getByText("3-2 in Last 10")).toBeInTheDocument();
    expect(screen.getByLabelText(/share/i)).toBeInTheDocument();
  });

  it("renders Preview and team-name tabs", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <MlbPregameBroadcastHeader
        detail={mlbScheduledDetail}
        activeTab="preview"
        onTabChange={onTabChange}
      />,
    );
    expect(
      screen.getByRole("tab", { name: /preview/i }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(
      screen.getByRole("tab", { name: /philadelphia phillies/i }),
    );
    expect(onTabChange).toHaveBeenCalledWith("home");
  });

  it("omits record and last-10 lines when null", () => {
    const detail = {
      ...mlbScheduledDetail,
      away: { ...mlbScheduledDetail.away, record: null, last10: null },
      home: { ...mlbScheduledDetail.home, record: null, last10: null },
    };
    render(
      <MlbPregameBroadcastHeader
        detail={detail}
        activeTab="preview"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/in Last 10/i)).not.toBeInTheDocument();
    expect(screen.queryByText("55-59")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/MlbPregameBroadcastHeader.test.tsx`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement header**

Mirror structure of `MlbFinalBroadcastHeader.tsx`:

- Top row: `gameDateLabel`, `statusLabel`, Share2 button
- `grid grid-cols-2` slabs with `style={{ backgroundColor: team.color }}`, dark overlay, large centered logo (`size-28` / `sm:size-32`, opacity ~0.9)
- Text stack toward seam: **name** (bold), `record`, `{last10} in Last 10`
- Away: `items-end text-right`; home: `items-start text-left`
- No scores, no winner ring
- Tablist aria-label `"Pregame details"` with tabs Preview / `{away.name}` / `{home.name}` mapping to `"preview" | "away" | "home"`

Keep TeamLogo local (same pattern as final) or extract only if trivial — prefer local duplicate for this slice (YAGNI).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/MlbPregameBroadcastHeader.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbPregameBroadcastHeader.tsx \
  frontend/src/components/mlb/MlbPregameBroadcastHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): add pregame broadcast header with last-10

EOF
)"
```

---

### Task 5: `MlbPregameCenter` + page wiring

**Files:**
- Create: `frontend/src/components/mlb/MlbPregameCenter.tsx`
- Create: `frontend/src/components/mlb/MlbPregameCenter.test.tsx`
- Modify: `frontend/src/pages/MlbGameDetailPage.tsx`
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx`
- Modify: `md/system-design.md` (page ↔ API row for `/mlb/games/:gamePk`)

**Interfaces:**
- Consumes: `MlbPregameBroadcastHeader`, `PregameTab`
- Produces: `MlbPregameCenter({ detail })` with stub panels

- [ ] **Step 1: Write failing center + page tests**

`MlbPregameCenter.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MlbPregameCenter } from "./MlbPregameCenter";
import { mlbScheduledDetail } from "./testFixtures";

describe("MlbPregameCenter", () => {
  it("renders header and preview stub by default", () => {
    render(<MlbPregameCenter detail={mlbScheduledDetail} />);
    expect(screen.getByTestId("mlb-pregame-center")).toBeInTheDocument();
    expect(
      screen.getByTestId("mlb-pregame-broadcast-header"),
    ).toBeInTheDocument();
    expect(screen.getByText(/preview coming soon/i)).toBeInTheDocument();
  });

  it("switches stub panels on tab click", async () => {
    const user = userEvent.setup();
    render(<MlbPregameCenter detail={mlbScheduledDetail} />);
    await user.click(
      screen.getByRole("tab", { name: /washington nationals/i }),
    );
    expect(
      screen.getByText(/washington nationals preview coming soon/i),
    ).toBeInTheDocument();
  });
});
```

Update `MlbGameDetailPage.test.tsx` scheduled case:

```typescript
  it("shows pregame center for scheduled MLB games", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mlbDetail("scheduled"),
        game_date_label: "Today",
        away: { ...mlbDetail("scheduled").away, record: "55-59", last_10: "0-5" },
        home: { ...mlbDetail("scheduled").home, record: "60-53", last_10: "3-2" },
      }),
    });
    renderPage();
    expect(await screen.findByTestId("mlb-pregame-center")).toBeInTheDocument();
    expect(screen.queryByText("Not live yet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mlb-live-center")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/MlbPregameCenter.test.tsx src/pages/MlbGameDetailPage.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement center + page branch**

`MlbPregameCenter.tsx`:

```tsx
import { useState } from "react";
import {
  MlbPregameBroadcastHeader,
  type PregameTab,
} from "./MlbPregameBroadcastHeader";
import type { MlbGameDetailView } from "./types";

export function MlbPregameCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");

  const stub =
    activeTab === "preview"
      ? "Preview coming soon"
      : activeTab === "away"
        ? `${detail.away.name} preview coming soon`
        : `${detail.home.name} preview coming soon`;

  return (
    <div data-testid="mlb-pregame-center" className="space-y-4">
      <MlbPregameBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <p className="text-sm text-white/60">{stub}</p>
    </div>
  );
}
```

In `MlbGameDetailPage.tsx`:

- Import `MlbPregameCenter`
- Change scheduled branch to:

```tsx
  if (detail.status === "scheduled") {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <BackLink />
        <MlbPregameCenter detail={detail} />
      </div>
    );
  }

  if (detail.status === "halftime") {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <BackLink />
        <CompactMlbHeader detail={detail} />
        <p className="text-sm text-white/60">Not live yet</p>
      </div>
    );
  }
```

Update `md/system-design.md` `/mlb/games/:gamePk` row to reflect live/final/pregame centers + `GET /api/mlb/games/{gamePk}` (do not leave “coming soon” / stub wording).

- [ ] **Step 4: Run frontend tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/MlbPregameCenter.test.tsx src/components/mlb/MlbPregameBroadcastHeader.test.tsx src/pages/MlbGameDetailPage.test.tsx src/components/mlb/mapMlbGameDetail.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbPregameCenter.tsx \
  frontend/src/components/mlb/MlbPregameCenter.test.tsx \
  frontend/src/pages/MlbGameDetailPage.tsx \
  frontend/src/pages/MlbGameDetailPage.test.tsx \
  md/system-design.md
git commit -m "$(cat <<'EOF'
feat(mlb): wire scheduled game detail to pregame center

EOF
)"
```

---

### Task 6: Verification sweep

**Files:** none new (run only)

- [ ] **Step 1: Backend suite for game detail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=backend python3 -m pytest backend/tests/test_mlb_game_detail_schema.py backend/tests/test_mlb_game_detail_normalize.py backend/tests/test_mlb_game_detail_route.py -v`

Expected: PASS

- [ ] **Step 2: Frontend targeted suite**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm test -- --run src/components/mlb/MlbPregame src/pages/MlbGameDetailPage.test.tsx src/components/mlb/mapMlbGameDetail.test.ts src/components/mlb/MlbFinalBroadcastHeader.test.tsx`

Expected: PASS (final header still green)

- [ ] **Step 3: Manual smoke (optional if server available)**

Open a scheduled `/mlb/games/:gamePk` — confirm split colors, records, `W-L in Last 10`, stub tabs; open a final and live game — unchanged.

- [ ] **Step 4: Final commit only if verification fixed stragglers**

If Step 1–2 required fixes, commit those fixes with a clear message; otherwise no empty commit.

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Split header name / record / last-10 | 4 |
| Stub Preview / Away / Home tabs | 4, 5 |
| Scheduled page wiring; halftime unchanged | 5 |
| Additive `last_10` from standings splitRecords | 1, 2 |
| Soft-fail standings | 2 |
| Mapper + fixtures | 3 |
| Live/final unchanged | 5, 6 |
| system-design page row | 5 |
| Share UI-only | 4 |

## Self-review notes

- API field is `last_10`; view field is `last10`; display string is `{last10} in Last 10`.
- Standings source is `records.splitRecords[type=lastTen]`, not a top-level `lastTen` property.
- No Last-5, no real preview content, no shared header refactor with final.
