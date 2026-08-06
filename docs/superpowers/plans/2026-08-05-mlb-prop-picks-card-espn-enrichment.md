# MLB Prop Picks Card ESPN Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich MLB props with ESPN headshot/position/team and redesign collapsed prop cards to a PrizePicks-style centered stack.

**Architecture:** Add a cached ESPN MLB roster name index (like WNBA rosters). After assembling prop rows, attach `headshot_url`, `position`, and `team_abbrev`. Frontend `PropPickCard` renders headshot → team·pos → name → line+stat → side/edge.

**Tech Stack:** FastAPI + httpx, React + Vitest, ESPN site API, existing `norm_player_name`

## Global Constraints

- Headshot URL pattern: `https://a.espncdn.com/i/headshots/mlb/players/full/{espn_id}.png`
- Match key: `norm_player_name` (reuse from `app.providers.espn.wnba_roster`)
- ESPN failures must not fail `/api/mlb/props/today` (null enrichment)
- Card surface: `#3a3d42`, no white border
- Edge: green if `> 0`, red if `< 0`, muted if null/zero
- Expanded panel unchanged; scrapers unchanged; WNBA props out of scope
- Product name: **statvista**

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/providers/espn/mlb_roster.py` | ESPN teams + roster fetch, name index, headshot helper |
| `backend/tests/test_mlb_espn_roster.py` | Roster index + enrichment unit tests |
| `backend/tests/fixtures/espn_mlb_roster_nyy.json` | Minimal ESPN roster fixture |
| `backend/app/domains/mlb/schemas_props.py` | Add `headshot_url`, `position` on `MlbPropRow` |
| `backend/app/domains/mlb/props.py` | Attach enrichment after `_assemble_rows` |
| `backend/tests/test_mlb_props.py` | Enrichment attach / ESPN failure tests |
| `backend/openapi-golden.json` + `frontend/openapi.json` | Schema sync |
| `frontend/src/shared/lib/api.schema.d.ts` | Regenerated types |
| `frontend/src/features/mlb/league/MlbPropPicksList.tsx` | New collapsed card UI |
| `frontend/src/features/mlb/league/MlbPropPicksList.test.tsx` | Card layout tests |

---

### Task 1: ESPN MLB roster provider + index

**Files:**
- Create: `backend/app/providers/espn/mlb_roster.py`
- Create: `backend/tests/fixtures/espn_mlb_roster_nyy.json`
- Create: `backend/tests/test_mlb_espn_roster.py`
- Consumes: `norm_player_name` from `app.providers.espn.wnba_roster`
- Produces: `headshot_url_for(espn_id)`, `roster_player_index(payload, team_abbrev)`, `async get_mlb_player_index() -> dict[str, MlbRosterPlayer]`

- [ ] **Step 1: Write fixture**

Create `backend/tests/fixtures/espn_mlb_roster_nyy.json`:

```json
{
  "athletes": [
    {
      "id": "33192",
      "displayName": "Aaron Judge",
      "jersey": "99",
      "position": { "abbreviation": "RF" }
    },
    {
      "id": "33786",
      "displayName": "Giancarlo Stanton",
      "jersey": "27",
      "position": { "abbreviation": "DH" }
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_mlb_espn_roster.py`:

```python
import json
from pathlib import Path

from app.providers.espn.mlb_roster import (
    headshot_url_for,
    roster_player_index,
)
from app.providers.espn.wnba_roster import norm_player_name

FIXTURES = Path(__file__).parent / "fixtures"


def test_headshot_url_for():
    assert headshot_url_for("33192") == (
        "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png"
    )


def test_roster_player_index_maps_name_position_team_headshot():
    payload = json.loads((FIXTURES / "espn_mlb_roster_nyy.json").read_text())
    index = roster_player_index(payload, team_abbrev="NYY")
    entry = index[norm_player_name("Aaron Judge")]
    assert entry["espn_id"] == "33192"
    assert entry["position"] == "RF"
    assert entry["team_abbrev"] == "NYY"
    assert entry["headshot_url"] == headshot_url_for("33192")
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `cd backend && python -m pytest tests/test_mlb_espn_roster.py -v`  
Expected: FAIL (module not found)

- [ ] **Step 4: Implement provider**

Create `backend/app/providers/espn/mlb_roster.py`:

```python
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, TypedDict

import httpx

from app.providers.espn.wnba_roster import norm_player_name

logger = logging.getLogger(__name__)

ESPN_TEAMS_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams"
)
ESPN_ROSTER_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{team_id}/roster"
)
ESPN_TIMEOUT_SECONDS = 8.0
INDEX_CACHE_TTL_SECONDS = 900
HEADSHOT_TMPL = (
    "https://a.espncdn.com/i/headshots/mlb/players/full/{espn_id}.png"
)

_index_cache: dict[str, Any] = {"expires_at": 0.0, "index": {}}


class MlbRosterPlayer(TypedDict):
    espn_id: str
    position: str | None
    team_abbrev: str | None
    headshot_url: str | None


def clear_mlb_roster_cache() -> None:
    _index_cache["expires_at"] = 0.0
    _index_cache["index"] = {}


def headshot_url_for(espn_id: str) -> str:
    return HEADSHOT_TMPL.format(espn_id=str(espn_id).strip())


def roster_player_index(
    payload: dict,
    *,
    team_abbrev: str | None,
) -> dict[str, MlbRosterPlayer]:
    index: dict[str, MlbRosterPlayer] = {}
    for athlete in payload.get("athletes") or []:
        if not isinstance(athlete, dict):
            continue
        display_name = str(athlete.get("displayName") or "").strip()
        espn_id = str(athlete.get("id") or "").strip()
        if not display_name or not espn_id:
            continue
        key = norm_player_name(display_name)
        if key in index:
            continue
        position_block = athlete.get("position") or {}
        position = None
        if isinstance(position_block, dict):
            position = str(position_block.get("abbreviation") or "").strip() or None
        index[key] = {
            "espn_id": espn_id,
            "position": position,
            "team_abbrev": (team_abbrev or None),
            "headshot_url": headshot_url_for(espn_id),
        }
    return index


def _as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def team_entries_from_teams_payload(payload: dict) -> list[tuple[str, str]]:
    """Return (team_id, abbrev) pairs from ESPN teams endpoint."""
    out: list[tuple[str, str]] = []
    sports = _as_list(payload.get("sports"))
    leagues = _as_list(sports[0].get("leagues")) if sports else []
    teams = _as_list(leagues[0].get("teams")) if leagues else []
    for wrapper in teams:
        team = _as_dict(_as_dict(wrapper).get("team"))
        team_id = str(team.get("id") or "").strip()
        abbrev = str(team.get("abbreviation") or "").strip().upper() or None
        if team_id and abbrev:
            out.append((team_id, abbrev))
    return out


async def fetch_espn_json(url: str, client: httpx.AsyncClient) -> dict:
    response = await client.get(url)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {}


async def build_mlb_player_index(
    client: httpx.AsyncClient | None = None,
) -> dict[str, MlbRosterPlayer]:
    owns = client is None
    http_client = client or httpx.AsyncClient(timeout=ESPN_TIMEOUT_SECONDS)
    try:
        teams_payload = await fetch_espn_json(ESPN_TEAMS_URL, http_client)
        teams = team_entries_from_teams_payload(teams_payload)
        index: dict[str, MlbRosterPlayer] = {}

        async def one(team_id: str, abbrev: str) -> None:
            try:
                payload = await fetch_espn_json(
                    ESPN_ROSTER_URL.format(team_id=team_id), http_client
                )
            except Exception as exc:
                logger.warning("ESPN MLB roster %s failed: %s", team_id, exc)
                return
            for key, entry in roster_player_index(
                payload, team_abbrev=abbrev
            ).items():
                if key not in index:
                    index[key] = entry

        await asyncio.gather(*(one(tid, abbr) for tid, abbr in teams))
        return index
    finally:
        if owns:
            await http_client.aclose()


async def get_mlb_player_index() -> dict[str, MlbRosterPlayer]:
    now = time.time()
    if float(_index_cache["expires_at"]) > now and _index_cache["index"]:
        return _index_cache["index"]  # type: ignore[return-value]
    try:
        index = await build_mlb_player_index()
    except Exception as exc:
        logger.warning("ESPN MLB player index unavailable: %s", exc)
        return {}
    _index_cache["index"] = index
    _index_cache["expires_at"] = now + INDEX_CACHE_TTL_SECONDS
    return index
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd backend && python -m pytest tests/test_mlb_espn_roster.py -v`  
Expected: PASS

- [ ] **Step 6: Commit** (only if user asked for commits; otherwise skip)

```bash
git add backend/app/providers/espn/mlb_roster.py \
  backend/tests/test_mlb_espn_roster.py \
  backend/tests/fixtures/espn_mlb_roster_nyy.json
git commit -m "feat(espn): add cached MLB roster name index for prop enrichment"
```

---

### Task 2: Schema + enrich prop rows

**Files:**
- Modify: `backend/app/domains/mlb/schemas_props.py`
- Modify: `backend/app/domains/mlb/props.py`
- Modify: `backend/tests/test_mlb_props.py`
- Modify: `backend/openapi-golden.json`, `frontend/openapi.json`
- Regenerate: `frontend/src/shared/lib/api.schema.d.ts`
- Consumes: `get_mlb_player_index`, `MlbRosterPlayer`
- Produces: `MlbPropRow.headshot_url`, `MlbPropRow.position`; filled `team_abbrev`

- [ ] **Step 1: Extend schema**

In `MlbPropRow` add:

```python
    headshot_url: str | None = None
    position: str | None = None
```

Keep `team_abbrev: str | None = None`.

- [ ] **Step 2: Add enrichment helper + wire into `get_mlb_props_today`**

In `props.py`:

```python
from app.providers.espn.mlb_roster import get_mlb_player_index
from app.providers.espn.wnba_roster import norm_player_name

def _apply_roster_enrichment(
    rows: list[MlbPropRow],
    index: dict[str, Any],
) -> list[MlbPropRow]:
    enriched: list[MlbPropRow] = []
    for row in rows:
        entry = index.get(norm_player_name(row.player_name))
        if not entry:
            enriched.append(row)
            continue
        enriched.append(
            row.model_copy(
                update={
                    "headshot_url": entry.get("headshot_url"),
                    "position": entry.get("position"),
                    "team_abbrev": entry.get("team_abbrev") or row.team_abbrev,
                }
            )
        )
    return enriched
```

After `rows = _assemble_rows(...)`:

```python
    try:
        roster_index = await get_mlb_player_index()
        rows = _apply_roster_enrichment(rows, roster_index)
    except Exception as exc:
        logger.warning("MLB prop roster enrichment skipped: %s", exc)
```

- [ ] **Step 3: Tests for attach + failure**

Add to `backend/tests/test_mlb_props.py` (patch `get_mlb_player_index`):

```python
@pytest.mark.asyncio
async def test_props_attach_roster_enrichment(monkeypatch):
    # ... existing dfs/book mocks ...
    async def fake_index():
        return {
            norm_player_name("Aaron Judge"): {
                "espn_id": "33192",
                "position": "RF",
                "team_abbrev": "NYY",
                "headshot_url": "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
            }
        }
    monkeypatch.setattr(svc, "get_mlb_player_index", fake_index)  # or patch module path
    response = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    judge = next(r for r in response.props if r.player_name == "Aaron Judge")
    assert judge.position == "RF"
    assert judge.team_abbrev == "NYY"
    assert judge.headshot_url and "33192" in judge.headshot_url


@pytest.mark.asyncio
async def test_props_survive_roster_index_failure(monkeypatch):
    async def boom():
        raise RuntimeError("espn down")
    monkeypatch.setattr(
        "app.domains.mlb.props.get_mlb_player_index", boom
    )
    response = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    assert response.props  # still returned
    assert all(r.headshot_url is None for r in response.props)
```

Adapt mocks to match existing `test_mlb_props.py` patterns (they use `asyncio.run` and module patches — follow that file’s style exactly).

- [ ] **Step 4: Run backend tests**

Run: `cd backend && python -m pytest tests/test_mlb_props.py tests/test_mlb_espn_roster.py -v`  
Expected: PASS

- [ ] **Step 5: Sync OpenAPI**

Update `MlbPropRow` in `backend/openapi-golden.json` and `frontend/openapi.json` with `headshot_url` and `position` (nullable string). Then:

```bash
cd frontend && npm run generate:api
```

Confirm `ApiMlbPropRow` in `api.schema.d.ts` includes the new fields.

- [ ] **Step 6: Commit** (if user requested)

```bash
git commit -m "feat(api): enrich MLB props with ESPN headshot, position, team"
```

---

### Task 3: PrizePicks-style collapsed card UI

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.tsx`
- Modify: `frontend/src/features/mlb/league/MlbPropPicksList.test.tsx`
- Consumes: `row.headshot_url`, `row.position`, `row.team_abbrev`
- Produces: redesigned collapsed `PropPickCard`

- [ ] **Step 1: Update failing/updated tests first**

Replace collapsed-card tests in `MlbPropPicksList.test.tsx` to expect:

```tsx
it("renders PrizePicks-style collapsed card", () => {
  const enriched = row({
    player_name: "Aaron Judge",
    team_abbrev: "NYY",
    position: "RF",
    headshot_url:
      "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
    edge_pct: 5.1,
  });
  render(
    <MlbPropPicksList
      props={[enriched]}
      format="power"
      legs={4}
      breakevenPct={54.3}
    />,
  );
  const card = screen.getByTestId("mlb-prop-row");
  expect(within(card).getByRole("img", { name: /Aaron Judge/i })).toHaveAttribute(
    "src",
    expect.stringContaining("33192.png"),
  );
  expect(within(card).getByText("NYY · RF")).toBeInTheDocument();
  expect(within(card).getByText("Aaron Judge")).toBeInTheDocument();
  expect(within(card).getByText("1.5 Total Bases")).toBeInTheDocument();
  expect(within(card).getByText("Over")).toBeInTheDocument();
  expect(within(card).getByText("+5.1%").className).toMatch(/text-emerald-400/);
});

it("uses initials placeholder when headshot missing", () => {
  render(
    <MlbPropPicksList
      props={[row({ player_name: "Aaron Judge", headshot_url: null })]}
      format="power"
      legs={4}
      breakevenPct={54.3}
    />,
  );
  expect(screen.queryByRole("img", { name: /Aaron Judge/i })).not.toBeInTheDocument();
  expect(screen.getByText("A")).toBeInTheDocument(); // or data-testid placeholder
});
```

Extend the local `row()` helper with optional `position` / `headshot_url` defaults (`null`).

- [ ] **Step 2: Run frontend tests — expect FAIL**

Run: `cd frontend && npm test -- --run src/features/mlb/league/MlbPropPicksList.test.tsx`  
Expected: FAIL on new assertions

- [ ] **Step 3: Implement `PropPickCard`**

Collapsed structure:

```tsx
function teamPosLabel(team: string | null, pos: string | null): string | null {
  const parts = [team, pos].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function PropPickCard(...) {
  const [imgFailed, setImgFailed] = useState(false);
  const lean = sideLabel(row.recommended_side);
  const meta = teamPosLabel(row.team_abbrev, row.position);
  const showImg = Boolean(row.headshot_url) && !imgFailed;
  const initial = (row.player_name.trim()[0] ?? "?").toUpperCase();

  return (
    <article data-testid="mlb-prop-row" className={...}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full text-left">
        <div className="flex flex-col items-center text-center">
          {showImg ? (
            <img
              src={row.headshot_url!}
              alt={row.player_name}
              className="size-16 rounded-full object-cover bg-white/10"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span
              data-testid="mlb-prop-headshot-fallback"
              className="flex size-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/50"
            >
              {initial}
            </span>
          )}
          {meta ? (
            <p className="mt-2 text-[14px] text-white/45">{meta}</p>
          ) : null}
          <p className="mt-1 text-[18px] font-semibold text-white">{row.player_name}</p>
          <p className="mt-1 text-[18px] text-white">
            {row.line} {row.stat}
          </p>
          <div className="mt-3 flex w-full items-center justify-between gap-2">
            <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-[14px] font-semibold text-black">
              {lean}
            </span>
            <span className={`font-mono text-[18px] font-semibold ${edgeToneClass(row.edge_pct)}`}>
              {formatEdge(row.edge_pct)}
            </span>
          </div>
        </div>
      </button>
      {expanded ? <ExpandedPanel row={row} /> : null}
    </article>
  );
}
```

Keep masonry wrapper and `ExpandedPanel` as-is.

- [ ] **Step 4: Run frontend tests — expect PASS**

Run: `cd frontend && npm test -- --run src/features/mlb/league/MlbPropPicksList.test.tsx src/pages/MlbPropPicksPage.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit** (if user requested)

```bash
git commit -m "feat(frontend): PrizePicks-style MLB prop cards with ESPN headshots"
```

---

### Task 4: Docs touch-up

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-mlb-prop-picks-card-espn-enrichment-design.md` — set Status to `Implemented`
- Modify: `frontend/README.md` only if page↔API notes mention prop row shape (optional one-liner)

- [ ] **Step 1: Mark spec implemented**
- [ ] **Step 2: Quick manual check** — load `/mlb/prop_picks` with API running; confirm headshots and expand still work

---

## Spec coverage self-review

| Spec item | Task |
|-----------|------|
| ESPN roster index + CDN headshot | Task 1 |
| `MlbPropRow` fields + attach on props today | Task 2 |
| ESPN failure soft | Task 2 |
| PrizePicks-style collapsed card | Task 3 |
| Masonry / expand unchanged | Task 3 |
| OpenAPI / types | Task 2 |
| Out of scope scrapers/WNBA | Not in plan |

## Placeholder scan

None — concrete files, code, and commands included.
