# MLB live Game flow + Hit chart side-by-side

Date: 2026-08-03  
Status: Approved for planning  
Scope: Live `/mlb/game/:gamePk` only — compact Game flow beside Hit chart  
Audience: Frontend implementers of `MlbGameDetailPage` and `MlbWinProbability`

## Goal

On **live** MLB game detail, reduce vertical dominance of Game flow and place it **side by side** with Hit chart (desktop), so both visualizations share one viewport band instead of stacking full-width tall charts.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Page-only grid on live center (Approach 1) |
| Desktop split | Game flow ~2/3 (`lg:col-span-2`), Hit chart ~1/3 (`lg:col-span-1`) |
| Mobile (`< lg`) | Stack: Game flow above Hit chart |
| Chart height | Optional `compact` on `MlbWinProbability`; live row passes `compact` (viewBox height **280** vs **520** default) |
| Final games | Unchanged (`MlbFinalCenter` keeps current 3-col viz row) |
| API / data | No backend or schema changes |

## Non-goals

- Changing final-center layout or scoring-plays placement
- WNBA `WinProbabilityPanel` / game detail
- Backend, OpenAPI, or win-probability series shape
- New shared `MlbLiveVizRow` abstraction (YAGNI for this slice)

---

## 1. Live page layout

In `MlbGameDetailPage`, when `detail.status === "live"`, replace the sequential:

```text
… → MlbWinProbability → MlbHitChart
```

with:

```text
div.grid.items-start.gap-4.lg:grid-cols-3
  MlbWinProbability  (lg:col-span-2, compact)
  MlbHitChart        (lg:col-span-1)
```

Other live sections keep current order above this row: header → linescore → situation → PBP → box → **viz row**.

`data-testid="mlb-live-center"` remains on the live wrapper. The viz row gets `data-testid="mlb-live-viz-row"` for structure assertions.

---

## 2. Compact Game flow

### API

```tsx
MlbWinProbability({ detail, compact?: boolean })
```

- `compact` omitted / `false` → current `CHART_GEOMETRY` (width 640, height **520**).
- `compact={true}` → same width and padding philosophy, height **280**; path helpers (`xForIndex`, `yForPct`, `buildSplitSeriesPaths`, scrub) must use the active geometry so scrubbing and labels stay correct.

Prefer a small geometry factory or dual constants in `mlbWinProbabilityPaths.ts` rather than hard-coding 520 inside the React component only.

### Visual

- Heading / unavailable copy stay the same (“Game flow”).
- Live passes `compact`; final continues default (tall) unless a later change opts in.

### Hit chart

No structural change; existing `max-w-16rem` field sits naturally in the 1-col slot.

---

## 3. Testing

| Area | Expectation |
| --- | --- |
| `MlbGameDetailPage` / live center | Live fixture includes `mlb-live-viz-row` with Game flow + Hit chart |
| `MlbWinProbability` | With `compact`, SVG `viewBox` uses reduced height; without, keeps 520 |
| `mlbWinProbabilityPaths` | Path/y helpers remain correct for compact geometry (extend or parameterize existing tests) |
| Final | Existing `MlbFinalCenter` tests still pass unchanged |

---

## 4. Out of scope / follow-ups

- Aligning final’s Game flow to the same compact height
- Extracting a reusable viz-row component
- Docs: optional one-line note in live game-detail design if maintainers want cross-links; not required for ship
