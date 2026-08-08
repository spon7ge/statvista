# MLB Matchup Prediction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Preview-only Matchup prediction card under MLB Game Info (right rail), fed by ESPN `predictor` from the existing summary enrichment on `GET /api/mlb/games/{gamePk}`.

**Architecture:** Parse ESPN summary `predictor.awayTeam/homeTeam.gameProjection` in the MLB ESPN bridge, attach nullable `matchup_prediction` on `MlbGameDetail` during `_attach_espn_summary_enrichment`, map to the frontend view, and render `MlbMatchupPrediction` only in `MlbProjectedLineups` right column after Game Info. Hide when null.

**Tech Stack:** FastAPI · Pydantic · pytest · React 19 · TypeScript · Vite · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-mlb-matchup-prediction-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Preview only; right column order: Odds → Game Info → Matchup prediction
- Soft-fail: missing/malformed predictor → `null`; never fail game detail
- Source label exactly: `ESPN game projection`
- Chrome: charcoal `GameSection` + 18px title; team-color win-% bar
- No new HTTP call / endpoint
- OpenAPI must stay in sync (`export_openapi` + `npm run generate:api`)
- Verify backend: `cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_espn_bridge.py tests/test_mlb_game_detail_season_injuries.py -q`
- Verify frontend: targeted Vitest + `npm run check:api`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/domains/mlb/schemas_game_detail.py` | `MlbMatchupPrediction` + field on `MlbGameDetail` |
| `backend/app/domains/mlb/schemas.py` | Re-export new schema |
| `backend/app/providers/espn/mlb_bridge.py` | `normalize_espn_mlb_matchup_prediction` |
| `backend/app/domains/mlb/game_detail.py` | Attach helper + wire into ESPN enrichment |
| `backend/tests/test_mlb_espn_bridge.py` | Predictor normalize tests |
| `backend/tests/test_mlb_game_detail_season_injuries.py` | Attach helper tests (or extend) |
| `backend/tests/fixtures/espn_mlb_summary_wp.json` | Add `predictor` block for fixture reuse |
| `frontend/openapi.json` / `api.schema.d.ts` / `backend/openapi-golden.json` | Contract regen |
| `frontend/src/features/mlb/lib/types.ts` | View type |
| `frontend/src/features/mlb/lib/mapMlbGameDetail.ts` | Map field |
| `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts` | Mapper coverage |
| `frontend/src/features/mlb/lib/testFixtures.ts` | Default `matchupPrediction: null` on fixtures |
| `frontend/src/features/mlb/game/MlbMatchupPrediction.tsx` | Card UI |
| `frontend/src/features/mlb/game/MlbMatchupPrediction.test.tsx` | Card tests |
| `frontend/src/features/mlb/game/MlbProjectedLineups.tsx` | Wire under Game Info |
| `frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx` | Placement assertion |
| `md/system-design.md` | Preview right-rail note |
| Spec status → Implemented | After ship |

---

### Task 1: Backend schema + ESPN normalize + attach

**Files:**
- Modify: `backend/app/domains/mlb/schemas_game_detail.py`
- Modify: `backend/app/domains/mlb/schemas.py`
- Modify: `backend/app/providers/espn/mlb_bridge.py`
- Modify: `backend/app/domains/mlb/game_detail.py`
- Modify: `backend/tests/test_mlb_espn_bridge.py`
- Modify: `backend/tests/test_mlb_game_detail_season_injuries.py`
- Modify: `backend/tests/fixtures/espn_mlb_summary_wp.json`

**Interfaces:**
- Produces:
  - `class MlbMatchupPrediction(BaseModel): away_win_pct: int; home_win_pct: int; source_label: str`
  - On `MlbGameDetail`: `matchup_prediction: MlbMatchupPrediction | None = None`
  - `class EspnMatchupPrediction` (dataclass in mlb_bridge) with same three fields
  - `normalize_espn_mlb_matchup_prediction(summary: dict) -> EspnMatchupPrediction | None`
  - `attach_matchup_prediction(detail, pred) -> MlbGameDetail`
  - Enrichment wires attach after summary fetch

- [ ] **Step 1: Write failing bridge + attach tests**

Add to `backend/tests/fixtures/espn_mlb_summary_wp.json` (top-level sibling of `winprobability`):

```json
"predictor": {
  "header": "Chance to win",
  "homeTeam": { "id": "home1", "gameProjection": "41.2" },
  "awayTeam": { "id": "away1", "gameProjection": "58.8" }
}
```

Add to `backend/tests/test_mlb_espn_bridge.py`:

```python
def test_normalize_espn_mlb_matchup_prediction():
    summary = json.loads((FIXTURES / "espn_mlb_summary_wp.json").read_text())
    pred = mlb_bridge.normalize_espn_mlb_matchup_prediction(summary)
    assert pred is not None
    assert pred.away_win_pct == 59
    assert pred.home_win_pct == 41
    assert pred.source_label == "ESPN game projection"

def test_normalize_espn_mlb_matchup_prediction_missing():
    assert mlb_bridge.normalize_espn_mlb_matchup_prediction({}) is None
    assert mlb_bridge.normalize_espn_mlb_matchup_prediction({"predictor": {}}) is None
```

Add to `backend/tests/test_mlb_game_detail_season_injuries.py` (import `attach_matchup_prediction` and `MlbMatchupPrediction`):

```python
def test_attach_matchup_prediction():
    detail = _scheduled_detail()
    pred = MlbMatchupPrediction(
        away_win_pct=59, home_win_pct=41, source_label="ESPN game projection"
    )
    out = attach_matchup_prediction(detail, pred)
    assert out.matchup_prediction == pred
    assert "espn" in out.sources

def test_attach_matchup_prediction_none_noop():
    detail = _scheduled_detail()
    assert attach_matchup_prediction(detail, None) is detail
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest \
  tests/test_mlb_espn_bridge.py::test_normalize_espn_mlb_matchup_prediction \
  tests/test_mlb_espn_bridge.py::test_normalize_espn_mlb_matchup_prediction_missing \
  tests/test_mlb_game_detail_season_injuries.py::test_attach_matchup_prediction \
  tests/test_mlb_game_detail_season_injuries.py::test_attach_matchup_prediction_none_noop \
  -v
```

Expected: FAIL (import / attribute errors for new APIs)

- [ ] **Step 3: Add schema**

In `schemas_game_detail.py`, export `MlbMatchupPrediction` in `__all__`, add model, and field on `MlbGameDetail`:

```python
class MlbMatchupPrediction(BaseModel):
    model_config = _RESPONSE_CONFIG

    away_win_pct: int
    home_win_pct: int
    source_label: str
```

On `MlbGameDetail` (near `win_probability`):

```python
matchup_prediction: MlbMatchupPrediction | None = None
```

Re-export from `schemas.py` (`import` + `__all__`).

- [ ] **Step 4: Implement bridge normalize**

In `mlb_bridge.py` (near other ESPN dataclasses):

```python
@dataclass(frozen=True)
class EspnMatchupPrediction:
    away_win_pct: int
    home_win_pct: int
    source_label: str


def normalize_espn_mlb_matchup_prediction(
    summary: dict,
) -> EspnMatchupPrediction | None:
    """Map ESPN summary ``predictor`` gameProjection percents."""
    predictor = summary.get("predictor")
    if not isinstance(predictor, dict):
        return None
    try:
        away = float((_as_dict(predictor.get("awayTeam")).get("gameProjection")))
        home = float((_as_dict(predictor.get("homeTeam")).get("gameProjection")))
    except (TypeError, ValueError):
        return None
    return EspnMatchupPrediction(
        away_win_pct=round(away),
        home_win_pct=round(home),
        source_label="ESPN game projection",
    )
```

- [ ] **Step 5: Attach + wire enrichment**

In `game_detail.py`:

1. Import `MlbMatchupPrediction`, `normalize_espn_mlb_matchup_prediction`, and (if used) the ESPN dataclass.
2. Add:

```python
def attach_matchup_prediction(
    detail: MlbGameDetail,
    prediction: MlbMatchupPrediction | None,
) -> MlbGameDetail:
    if prediction is None:
        return detail
    sources = list(detail.sources)
    if "espn" not in sources:
        sources.append("espn")
    return detail.model_copy(
        update={"matchup_prediction": prediction, "sources": sources}
    )


def _to_mlb_matchup_prediction(
    pred: EspnMatchupPrediction | None,
) -> MlbMatchupPrediction | None:
    if pred is None:
        return None
    return MlbMatchupPrediction(
        away_win_pct=pred.away_win_pct,
        home_win_pct=pred.home_win_pct,
        source_label=pred.source_label,
    )
```

3. In `_attach_espn_summary_enrichment`, after fetching `summary` (and alongside WP/injuries):

```python
detail = attach_matchup_prediction(
    detail,
    _to_mlb_matchup_prediction(normalize_espn_mlb_matchup_prediction(summary)),
)
```

Keep soft-fail `except` wrapping the whole enrichment unchanged.

- [ ] **Step 6: Run tests to verify they pass**

Run the same pytest command as Step 2. Expected: PASS

Also run:

```bash
cd backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_espn_bridge.py tests/test_mlb_game_detail_season_injuries.py -q
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add \
  backend/app/domains/mlb/schemas_game_detail.py \
  backend/app/domains/mlb/schemas.py \
  backend/app/providers/espn/mlb_bridge.py \
  backend/app/domains/mlb/game_detail.py \
  backend/tests/test_mlb_espn_bridge.py \
  backend/tests/test_mlb_game_detail_season_injuries.py \
  backend/tests/fixtures/espn_mlb_summary_wp.json
git commit -m "$(cat <<'EOF'
feat(mlb): attach ESPN matchup prediction on game detail

EOF
)"
```

---

### Task 2: OpenAPI + frontend types/mapper

**Files:**
- Update: `frontend/openapi.json`, `backend/openapi-golden.json`, `frontend/src/shared/lib/api.schema.d.ts`
- Modify: `frontend/src/features/mlb/lib/types.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.ts`
- Modify: `frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts`
- Modify: `frontend/src/features/mlb/lib/testFixtures.ts`

**Interfaces:**
- Consumes: API `matchup_prediction: { away_win_pct, home_win_pct, source_label } | null`
- Produces: `MlbGameDetailView.matchupPrediction: { awayWinPct, homeWinPct, sourceLabel } | null`

- [ ] **Step 1: Export OpenAPI and regenerate TS types**

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; print(export_openapi())"
cp frontend/openapi.json backend/openapi-golden.json
cd frontend && npm run generate:api
```

Confirm `MlbMatchupPrediction` / `matchup_prediction` appear in `api.schema.d.ts`.

- [ ] **Step 2: Write failing mapper test**

In `mapMlbGameDetail.test.ts`, extend an API fixture (or inline) with:

```ts
matchup_prediction: {
  away_win_pct: 59,
  home_win_pct: 41,
  source_label: "ESPN game projection",
},
```

Assert:

```ts
expect(mapped.matchupPrediction).toEqual({
  awayWinPct: 59,
  homeWinPct: 41,
  sourceLabel: "ESPN game projection",
});
```

Also assert `null` maps to `null` when the field is null.

- [ ] **Step 3: Run mapper test to verify it fails**

```bash
cd frontend && npm test -- --run src/features/mlb/lib/mapMlbGameDetail.test.ts
```

Expected: FAIL (missing view field / property)

- [ ] **Step 4: Add types + mapper + fixture defaults**

`types.ts`:

```ts
export type MlbMatchupPrediction = {
  awayWinPct: number;
  homeWinPct: number;
  sourceLabel: string;
};
```

On `MlbGameDetailView`:

```ts
matchupPrediction: MlbMatchupPrediction | null;
```

`mapMlbGameDetail.ts`:

```ts
matchupPrediction: detail.matchup_prediction
  ? {
      awayWinPct: detail.matchup_prediction.away_win_pct,
      homeWinPct: detail.matchup_prediction.home_win_pct,
      sourceLabel: detail.matchup_prediction.source_label,
    }
  : null,
```

Set `matchupPrediction: null` on every object in `testFixtures.ts` that builds `MlbGameDetailView`.

- [ ] **Step 5: Run mapper test + API check**

```bash
cd frontend && npm test -- --run src/features/mlb/lib/mapMlbGameDetail.test.ts
cd frontend && npm run check:api
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  frontend/openapi.json \
  backend/openapi-golden.json \
  frontend/src/shared/lib/api.schema.d.ts \
  frontend/src/features/mlb/lib/types.ts \
  frontend/src/features/mlb/lib/mapMlbGameDetail.ts \
  frontend/src/features/mlb/lib/mapMlbGameDetail.test.ts \
  frontend/src/features/mlb/lib/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): map matchupPrediction through OpenAPI types

EOF
)"
```

---

### Task 3: `MlbMatchupPrediction` component

**Files:**
- Create: `frontend/src/features/mlb/game/MlbMatchupPrediction.tsx`
- Create: `frontend/src/features/mlb/game/MlbMatchupPrediction.test.tsx`

**Interfaces:**
- Consumes: `detail: Pick<MlbGameDetailView, "away" | "home" | "matchupPrediction">`
- Produces: React card or `null`

- [ ] **Step 1: Write failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MlbMatchupPrediction } from "./MlbMatchupPrediction";
import { mlbScheduledDetail } from "../lib/testFixtures";

describe("MlbMatchupPrediction", () => {
  it("renders bar, percents, and source", () => {
    render(
      <MlbMatchupPrediction
        detail={{
          ...mlbScheduledDetail,
          matchupPrediction: {
            awayWinPct: 59,
            homeWinPct: 41,
            sourceLabel: "ESPN game projection",
          },
        }}
      />,
    );
    expect(screen.getByText("Matchup prediction")).toBeInTheDocument();
    expect(screen.getByText("59%")).toBeInTheDocument();
    expect(screen.getByText("41%")).toBeInTheDocument();
    expect(screen.getByText("ESPN game projection")).toBeInTheDocument();
    expect(screen.getByText("Matchup prediction").closest("section")).toHaveClass(
      "bg-[#3a3d42]",
    );
  });

  it("renders nothing without prediction", () => {
    const { container } = render(
      <MlbMatchupPrediction
        detail={{ ...mlbScheduledDetail, matchupPrediction: null }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

(Use the real scheduled fixture export name from `testFixtures.ts` if different.)

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- --run src/features/mlb/game/MlbMatchupPrediction.test.tsx
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement component**

```tsx
import { GameSection } from "@/shared/ui/GameSection";
import type { MlbGameDetailView } from "../lib/types";

type Props = {
  detail: Pick<MlbGameDetailView, "away" | "home" | "matchupPrediction">;
};

export function MlbMatchupPrediction({ detail }: Props) {
  const prediction = detail.matchupPrediction;
  if (!prediction) return null;

  return (
    <GameSection data-testid="mlb-matchup-prediction">
      <h2 className="text-[18px] font-semibold text-white">Matchup prediction</h2>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full">
        <div
          className="h-full"
          style={{
            width: `${prediction.awayWinPct}%`,
            backgroundColor: detail.away.color,
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${prediction.homeWinPct}%`,
            backgroundColor: detail.home.color,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[14px] text-white/70">
        <span>
          {detail.away.abbrev}{" "}
          <span>{`${prediction.awayWinPct}%`}</span>
        </span>
        <span>
          <span>{`${prediction.homeWinPct}%`}</span> {detail.home.abbrev}
        </span>
      </div>

      <p className="mt-2 text-[14px] text-white/50">{prediction.sourceLabel}</p>
    </GameSection>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- --run src/features/mlb/game/MlbMatchupPrediction.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add \
  frontend/src/features/mlb/game/MlbMatchupPrediction.tsx \
  frontend/src/features/mlb/game/MlbMatchupPrediction.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): add Matchup prediction Preview card

EOF
)"
```

---

### Task 4: Wire Preview right rail + docs

**Files:**
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.tsx`
- Modify: `frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx`
- Modify: `md/system-design.md`
- Modify: `docs/superpowers/specs/2026-08-07-mlb-matchup-prediction-design.md` (Status → Implemented)

**Interfaces:**
- Consumes: `detail.matchupPrediction` via existing `detail` prop on `MlbProjectedLineups`
- Produces: right-column order Odds → Game Info → Matchup prediction

- [ ] **Step 1: Write failing placement test**

In `MlbProjectedLineups.test.tsx`, render with a detail that has `matchupPrediction` set, then:

```ts
const right = screen.getByTestId("mlb-preview-right-column");
expect(right).toContainElement(screen.getByTestId("mlb-matchup-prediction"));
// Odds / Game Info still present above:
expect(right).toContainElement(screen.getByTestId("mlb-game-odds-board")); // use real testid if different
expect(right).toContainElement(screen.getByText("Game Info"));
```

Assert DOM order: Matchup prediction section appears after Game Info text within the right column (e.g. `compareDocumentPosition` or child index).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- --run src/features/mlb/game/MlbProjectedLineups.test.tsx
```

Expected: FAIL (prediction not in right column)

- [ ] **Step 3: Wire component**

In `MlbProjectedLineups.tsx` right column, after `<MlbGameInfo detail={detail} />`:

```tsx
<MlbMatchupPrediction detail={detail} />
```

Import from `./MlbMatchupPrediction`.

- [ ] **Step 4: Update `md/system-design.md`**

On the `/mlb/games/:gamePk` row, note Preview right rail includes Matchup prediction (ESPN) under Game Info when present.

- [ ] **Step 5: Mark spec implemented**

In the design spec header: `Status: Implemented`.

- [ ] **Step 6: Run placement tests**

```bash
cd frontend && npm test -- --run \
  src/features/mlb/game/MlbProjectedLineups.test.tsx \
  src/features/mlb/game/MlbMatchupPrediction.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add \
  frontend/src/features/mlb/game/MlbProjectedLineups.tsx \
  frontend/src/features/mlb/game/MlbProjectedLineups.test.tsx \
  md/system-design.md \
  docs/superpowers/specs/2026-08-07-mlb-matchup-prediction-design.md
git commit -m "$(cat <<'EOF'
feat(mlb): show Matchup prediction under Preview Game Info

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Preview only under Game Info | Task 4 |
| ESPN predictor via existing summary | Task 1 |
| Soft-fail → null / hide card | Tasks 1, 3 |
| `MlbMatchupPrediction` schema + OpenAPI | Tasks 1–2 |
| GameSection 18px + team-color bar | Task 3 |
| Source `ESPN game projection` | Task 1 |
| system-design note | Task 4 |
| Live/Final unchanged | Task 4 (no mounts) |

## Placeholder / consistency self-review

- No TBD/TODO left in steps.
- Field names consistent: API snake_case ↔ view camelCase.
- Fixture defaults updated so existing Preview tests keep compiling after Task 2.
