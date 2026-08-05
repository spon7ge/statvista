# MLB Live Matchup + Pitch Zone Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the live Summary left column to an ESPN-style matchup + pitch-zone stack (headshots, spin, batter silhouette) above the play feed, with additive Stats API fields.

**Architecture:** Extend `MlbPlayerCard` / `MlbPitch` in normalize + OpenAPI. Map through frontend view types. Restyle `MlbLiveMatchupPanel` and `MlbPitchZone`. Compose matchup → `MlbPitchZone` → play feed in `MlbLiveCenter` (stop using pitchZone-only `MlbLiveSituation` on that path). Final/scheduled unchanged.

**Tech Stack:** FastAPI/Pydantic, pytest, React, TypeScript, Vitest/RTL, Tailwind, openapi-typescript

## Global Constraints

- Live Summary left column only; right rail, Box tab, broadcast header unchanged
- Placement: matchup → pitch zone → play feed
- High fidelity: headshots + spin + batter silhouette SVG
- Additive API fields only (no breaking removals)
- Omit missing spin/headshot/stats — never invent
- Keep statvista `GAME_SECTION_SURFACE` cards
- Product name **statvista** in user-facing copy
- Follow `md/claude.md` and existing `frontend/src/components/mlb/` + `backend/app/services/mlb_game_detail.py` patterns
- Update `md/system-design.md` only if the `/mlb/games/:gamePk` row becomes inaccurate

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/schemas/mlb_game_detail.py` | Additive `id`/`headshot_url` on player card; `spin_rate`/`spin_direction` on pitch |
| `backend/app/services/mlb_game_detail.py` | Headshot URL helper; populate id/headshot; read breaks spin |
| `backend/tests/test_mlb_game_detail_normalize.py` | Normalize coverage |
| `frontend/openapi.json` + `src/lib/api.schema.d.ts` | Regenerated contract |
| `frontend/src/components/mlb/types.ts` | View-model fields |
| `frontend/src/components/mlb/mapMlbGameDetail.ts` | Snake → camel |
| `frontend/src/components/mlb/testFixtures.ts` | Live fixture headshots + spin |
| `frontend/src/components/mlb/MlbLiveMatchupPanel.tsx` | ESPN-style matchup chrome |
| `frontend/src/components/mlb/MlbLiveMatchupPanel.test.tsx` | Matchup assertions |
| `frontend/src/components/mlb/MlbPitchZone.tsx` | Zone + silhouette + pitch footer cards |
| `frontend/src/components/mlb/MlbPitchZone.test.tsx` | Zone/footer assertions |
| `frontend/src/components/mlb/MlbLiveCenter.tsx` | Compose matchup + pitch zone + feed |
| `frontend/src/components/mlb/MlbLiveCenter.test.tsx` | DOM order with matchup |

---

### Task 1: Backend additive situation fields (id, headshot, spin)

**Files:**
- Modify: `backend/app/schemas/mlb_game_detail.py`
- Modify: `backend/app/services/mlb_game_detail.py`
- Modify: `backend/tests/test_mlb_game_detail_normalize.py`
- Regenerate: `frontend/openapi.json`, `frontend/src/lib/api.schema.d.ts`

**Interfaces:**
- Produces (Pydantic / OpenAPI snake_case):
  - `MlbPlayerCard.id: int | None = None`
  - `MlbPlayerCard.headshot_url: str | None = None`
  - `MlbPitch.spin_rate: float | None = None` (accept int from API via float coerce)
  - `MlbPitch.spin_direction: float | None = None`
- Headshot URL helper:

```python
HEADSHOT = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:67:current.png/w_213,q_auto:best/"
    "v1/people/{id}/headshot/67/current"
)

def _headshot_url(person_id: int | None) -> str | None:
    if person_id is None:
        return None
    return HEADSHOT.format(id=person_id)
```

- `_player_card` must accept/pass `id` and `headshot_url` from `_person_id(person)`
- `_pitches_from_events` reads `breaks = _as_dict(pitch_data.get("breaks"))` then `spin_rate=_float_or_none(breaks.get("spinRate"))`, `spin_direction=_float_or_none(breaks.get("spinDirection"))`

- [ ] **Step 1: Write failing normalize tests**

Append to `backend/tests/test_mlb_game_detail_normalize.py`:

```python
def test_normalize_situation_player_ids_and_headshots():
    detail = normalize_mlb_live_feed(
        _payload(), game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    situation = detail.situation
    assert situation is not None
    assert situation.at_bat is not None
    assert situation.at_bat.id is not None
    assert situation.at_bat.headshot_url is not None
    assert str(situation.at_bat.id) in situation.at_bat.headshot_url
    assert "people/" in situation.at_bat.headshot_url
    assert situation.pitching is not None
    assert situation.pitching.id is not None
    assert situation.pitching.headshot_url is not None


def test_normalize_pitch_spin_from_breaks():
    payload = _payload()
    mutated = False
    for play in payload["liveData"]["plays"]["allPlays"]:
        for event in play.get("playEvents") or []:
            if isinstance(event, dict) and event.get("isPitch"):
                pitch_data = event.setdefault("pitchData", {})
                breaks = pitch_data.setdefault("breaks", {})
                breaks["spinRate"] = 2286
                breaks["spinDirection"] = 63
                mutated = True
                break
        if mutated:
            break
    assert mutated
    detail = normalize_mlb_live_feed(
        payload, game_pk="776543", fetched_at="2026-08-02T18:00:00+00:00"
    )
    assert detail.situation is not None
    spins = [p for p in detail.situation.pitches if p.spin_rate is not None]
    assert len(spins) >= 1
    assert spins[0].spin_rate == 2286
    assert spins[0].spin_direction == 63
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=.:backend pytest backend/tests/test_mlb_game_detail_normalize.py::test_normalize_situation_player_ids_and_headshots backend/tests/test_mlb_game_detail_normalize.py::test_normalize_pitch_spin_from_breaks -v`

Expected: FAIL (missing attributes / AssertionError on None)

- [ ] **Step 3: Implement schema + normalize**

1. Extend `MlbPlayerCard` and `MlbPitch` in `backend/app/schemas/mlb_game_detail.py` with the fields above.
2. Add `HEADSHOT` constant + `_headshot_url` near `TEAM_LOGO` in `mlb_game_detail.py`.
3. Update `_player_card`:

```python
def _player_card(
    person: dict | None,
    *,
    hand: str | None = None,
    summary: str | None = None,
) -> MlbPlayerCard | None:
    if not isinstance(person, dict):
        return None
    name = person.get("fullName") or person.get("name")
    if not name:
        return None
    person_id = _person_id(person)
    return MlbPlayerCard(
        name=str(name),
        hand=hand,
        summary=summary,
        id=person_id,
        headshot_url=_headshot_url(person_id),
    )
```

4. In `_pitches_from_events`, after `pitch_data = ...`, add breaks extraction and pass into `MlbPitch(...)`.

- [ ] **Step 4: Run normalize tests**

Run: `PYTHONPATH=.:backend pytest backend/tests/test_mlb_game_detail_normalize.py -v`

Expected: PASS (all normalize tests)

- [ ] **Step 5: Export OpenAPI + regenerate TS types**

```bash
PYTHONPATH=.:backend python3 -c "from app.openapi_export import export_openapi; export_openapi()"
cd frontend && npm run generate:api
```

Confirm `MlbPlayerCard` / `MlbPitch` in `frontend/src/lib/api.schema.d.ts` include the new fields.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/mlb_game_detail.py \
  backend/app/services/mlb_game_detail.py \
  backend/tests/test_mlb_game_detail_normalize.py \
  frontend/openapi.json \
  frontend/src/lib/api.schema.d.ts
git commit -m "$(cat <<'EOF'
feat(mlb): add headshot and pitch spin fields to game detail

EOF
)"
```

---

### Task 2: Frontend map + types + fixtures

**Files:**
- Modify: `frontend/src/components/mlb/types.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.ts`
- Modify: `frontend/src/components/mlb/testFixtures.ts`
- Modify: `frontend/src/components/mlb/mapMlbGameDetail.test.ts` (extend if present; else add asserts in existing situation mapping test)

**Interfaces:**
- Consumes OpenAPI fields from Task 1
- Produces view types:

```ts
export type MlbPlayerCard = {
  name: string;
  hand: string | null;
  summary: string | null;
  id: number | null;
  headshotUrl: string | null;
};

export type MlbPitch = {
  number: number;
  type: string | null;
  mph: number | null;
  result: string | null;
  isStrike: boolean;
  zoneX: number | null;
  zoneY: number | null;
  spinRate: number | null;
  spinDirection: number | null;
};
```

- Map helper for player cards:

```ts
function mapPlayerCard(card: { name: string; hand?: string | null; summary?: string | null; id?: number | null; headshot_url?: string | null } | null) {
  if (!card) return null;
  return {
    name: card.name,
    hand: card.hand ?? null,
    summary: card.summary ?? null,
    id: card.id ?? null,
    headshotUrl: card.headshot_url ?? null,
  };
}
```

- Pitch map adds `spinRate: pitch.spin_rate ?? null`, `spinDirection: pitch.spin_direction ?? null`

- [ ] **Step 1: Update types + write/adjust failing map test**

Update `types.ts` as above.

In `mapMlbGameDetail.test.ts`, assert mapped situation includes `headshotUrl` / `spinRate` when API fixture/mock provides them (extend the live mock payload used by that test, or construct a minimal situation object if the test already stubs). If the test file only checks top-level status, add:

```ts
it("maps situation headshots and pitch spin", () => {
  // Use existing raw detail builder / fixture; mutate pitches[0].spin_rate = 2286
  // and at_bat.id / headshot_url before mapMlbGameDetail
  const mapped = mapMlbGameDetail(raw);
  expect(mapped.situation?.atBat?.id).not.toBeNull();
  expect(mapped.situation?.atBat?.headshotUrl).toContain("people/");
  expect(mapped.situation?.pitches.some((p) => p.spinRate === 2286)).toBe(true);
});
```

Exact raw shape: follow whatever `mapMlbGameDetail.test.ts` already uses for `MlbGameDetail` (snake_case API type).

- [ ] **Step 2: Run map test to verify fail**

Run: `cd frontend && npx vitest run src/components/mlb/mapMlbGameDetail.test.ts`

Expected: FAIL (missing fields / undefined)

- [ ] **Step 3: Implement mapping + fixtures**

Update `mapMlbGameDetail.ts` situation mapping for pitches and player cards.

Update `testFixtures.ts` `mlbLiveDetail.situation`:

- Each pitch: add `spinRate` / `spinDirection` (e.g. pitch 1: `2286` / `63`; pitch 2: `2280` / `199`; or null on one pitch to cover omit)
- Each of `atBat` / `onDeck` / `pitching`: add `id` (any positive ints) and `headshotUrl` (full mlbstatic URL or a placeholder `https://img.mlbstatic.com/.../people/605141/headshot/67/current`)

Also update `mlbFinalDetail` situation player/pitch objects if TypeScript requires the new required fields (use `null` for id/headshot/spin on final fixture pitches/cards).

- [ ] **Step 4: Run map + typecheck focused tests**

Run: `cd frontend && npx vitest run src/components/mlb/mapMlbGameDetail.test.ts src/components/mlb/MlbLiveMatchupPanel.test.tsx src/components/mlb/MlbPitchZone.test.tsx`

Expected: PASS (existing tests still compile/run; map test green)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/types.ts \
  frontend/src/components/mlb/mapMlbGameDetail.ts \
  frontend/src/components/mlb/mapMlbGameDetail.test.ts \
  frontend/src/components/mlb/testFixtures.ts
git commit -m "$(cat <<'EOF'
feat(mlb): map headshot and pitch spin into live detail view

EOF
)"
```

---

### Task 3: Restyle `MlbLiveMatchupPanel`

**Files:**
- Modify: `frontend/src/components/mlb/MlbLiveMatchupPanel.tsx`
- Modify: `frontend/src/components/mlb/MlbLiveMatchupPanel.test.tsx`

**Interfaces:**
- Consumes: `MlbGameDetailView` with `situation.atBat|pitching.headshotUrl`, `summary`, runners, count, outs
- Keeps `data-testid="mlb-live-matchup"`
- Visual structure:

```
[logo] Batting          diamond          Pitching [logo]
headshot                outs dots        headshot
ShortName  POS          COUNT            ShortName  HAND
summary line                             summary line
```

- Short name helper: first initial + last token (`"Mookie Betts"` → `"M. Betts"`); if single token, use full name
- Outs dots: filled white when out recorded (`bg-white`), empty = `border border-white/40` (screenshot style; replace current red filled dots)
- Headshot: `<img>` with `onError` → hide img and show a simple circular placeholder (`bg-white/10` with initials or generic mark)
- Labels: literal `"Batting"` / `"Pitching"` (not just abbrev pills); keep team logo when `logoUrl` present
- Center: `MlbBaseDiamond` then outs then large `balls - strikes` (order may match screenshot: diamond → outs → count — use screenshot order: diamond, outs, count)

- [ ] **Step 1: Write failing tests**

Extend `MlbLiveMatchupPanel.test.tsx`:

```tsx
it("renders batting/pitching labels and headshot images", () => {
  render(<MlbLiveMatchupPanel detail={mlbLiveDetail} />);
  expect(screen.getByText(/^Batting$/i)).toBeInTheDocument();
  expect(screen.getByText(/^Pitching$/i)).toBeInTheDocument();
  expect(screen.getByTestId("mlb-live-matchup-headshot-batter")).toBeInTheDocument();
  expect(screen.getByTestId("mlb-live-matchup-headshot-pitcher")).toBeInTheDocument();
  expect(screen.getByText("M. Betts")).toBeInTheDocument();
  expect(screen.getByText("C. Sale")).toBeInTheDocument();
});
```

Keep existing count / outs / unavailable tests; update name assertions from full name to short name if the primary display switches (or assert short name in addition). Prefer short name as primary visible name to match screenshot.

- [ ] **Step 2: Run tests to verify fail**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveMatchupPanel.test.tsx`

Expected: FAIL (missing labels / headshot testids / short names)

- [ ] **Step 3: Implement restyle**

Rewrite layout of `MlbLiveMatchupPanel` to the three-column structure. Add helpers:

```ts
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]![0]!.toUpperCase()}. ${parts[parts.length - 1]}`;
}
```

Headshot component with testids `mlb-live-matchup-headshot-batter` / `mlb-live-matchup-headshot-pitcher` (use `role="img"` or the img itself with those testids). Position from existing `findBatterPosition`; show position next to batter short name; show pitcher `hand` next to pitcher short name.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveMatchupPanel.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveMatchupPanel.tsx \
  frontend/src/components/mlb/MlbLiveMatchupPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): restyle live matchup panel to ESPN card layout

EOF
)"
```

---

### Task 4: Restyle `MlbPitchZone`

**Files:**
- Modify: `frontend/src/components/mlb/MlbPitchZone.tsx`
- Modify: `frontend/src/components/mlb/MlbPitchZone.test.tsx`

**Interfaces:**
- Consumes: `MlbSituation` with pitches including `spinRate` / `spinDirection`
- Root: keep wrapping `GameSection`; add `data-testid="mlb-pitch-zone"`
- Remove the `"Pitch zone"` heading (screenshot has no title)
- Layout:

```
[ batter silhouette SVG ] [ strike zone SVG with plate + numbered dots ]
[ pitch footer: horizontal grid of cards ]
```

- Footer card per pitch:

```
(● n) Result
mph type
Spin: {spinRate} rpm, {spinDirection} deg   // omit entire spin line if both null
```

- Ball markers: green fill; strike: red fill (keep contrast)
- Empty pitches: muted “No pitches yet” spanning footer
- Batter silhouette: inline SVG (simple LHB/RHB stance silhouette is fine as static art; do not depend on hand for v1 unless trivial — default right-handed batter silhouette left of zone)

- [ ] **Step 1: Write failing tests**

Replace/extend `MlbPitchZone.test.tsx`:

```tsx
describe("MlbPitchZone", () => {
  it("renders zone, pitch markers, footer mph/type, and spin when present", () => {
    render(<MlbPitchZone situation={mlbLiveDetail.situation!} />);
    expect(screen.getByTestId("mlb-pitch-zone")).toBeInTheDocument();
    expect(screen.queryByText(/^Pitch zone$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Ball$/i)).toBeInTheDocument();
    expect(screen.getByText(/Called Strike/i)).toBeInTheDocument();
    expect(screen.getByText(/95\.2 mph/i)).toBeInTheDocument();
    expect(screen.getByText(/Spin:\s*2286 rpm,\s*63 deg/i)).toBeInTheDocument();
    expect(screen.getByTestId("mlb-pitch-zone-batter-silhouette")).toBeInTheDocument();
  });

  it("omits spin line when spin fields are null", () => {
    const situation = {
      ...mlbLiveDetail.situation!,
      pitches: [
        {
          ...mlbLiveDetail.situation!.pitches[0]!,
          spinRate: null,
          spinDirection: null,
        },
      ],
    };
    render(<MlbPitchZone situation={situation} />);
    expect(screen.queryByText(/Spin:/i)).not.toBeInTheDocument();
  });
});
```

Ensure fixture pitch 1 has spin values from Task 2.

- [ ] **Step 2: Run tests to verify fail**

Run: `cd frontend && npx vitest run src/components/mlb/MlbPitchZone.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement restyle**

Rewrite `MlbPitchZone.tsx` UI while keeping `plotPitch` / zone geometry constants (adjust viewBox if needed for plate + wider frame). Add silhouette SVG with `data-testid="mlb-pitch-zone-batter-silhouette"`. Footer: `grid` with `grid-cols-2` (or auto-fit) and a divider between cards.

Spin line renderer:

```tsx
function SpinLine({ pitch }: { pitch: MlbPitch }) {
  if (pitch.spinRate == null && pitch.spinDirection == null) return null;
  const parts: string[] = [];
  if (pitch.spinRate != null) parts.push(`${Math.round(pitch.spinRate)} rpm`);
  if (pitch.spinDirection != null) parts.push(`${Math.round(pitch.spinDirection)} deg`);
  return <p className="text-[11px] text-white/45">Spin: {parts.join(", ")}</p>;
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/mlb/MlbPitchZone.test.tsx`

Expected: PASS

Also run: `cd frontend && npx vitest run src/components/mlb/MlbLiveSituation.test.tsx`

Expected: PASS — if the pitchZone variant still asserts `"Pitch zone"` text, update that test to look for `mlb-pitch-zone` instead (heading removed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbPitchZone.tsx \
  frontend/src/components/mlb/MlbPitchZone.test.tsx \
  frontend/src/components/mlb/MlbLiveSituation.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): restyle pitch zone with silhouette and spin footer

EOF
)"
```

---

### Task 5: Wire `MlbLiveCenter` left stack + page assertions

**Files:**
- Modify: `frontend/src/components/mlb/MlbLiveCenter.tsx`
- Modify: `frontend/src/components/mlb/MlbLiveCenter.test.tsx`
- Modify: `frontend/src/pages/MlbGameDetailPage.test.tsx` (assert matchup present on live)
- Modify: `md/system-design.md` only if needed

**Interfaces:**
- Left column Summary:

```tsx
<div className="space-y-4">
  <MlbLiveMatchupPanel detail={detail} />
  <MlbPitchZone
    situation={
      detail.situation ?? {
        balls: 0,
        strikes: 0,
        outs: 0,
        runners: { first: false, second: false, third: false },
        pitches: [],
        atBat: null,
        onDeck: null,
        pitching: null,
        latestPlayText: null,
      }
    }
  />
  {/* Prefer: only render pitch zone when situation != null */}
  <MlbFinalPlayFeed detail={detail} />
</div>
```

**Preferred composition (use this):**

```tsx
<div className="space-y-4">
  <MlbLiveMatchupPanel detail={detail} />
  {detail.situation ? (
    <MlbPitchZone situation={detail.situation} />
  ) : null}
  <MlbFinalPlayFeed detail={detail} />
</div>
```

- Remove `MlbLiveSituation` import/usage from `MlbLiveCenter`
- Matchup already no-ops content when situation null; pitch zone omitted when null

- [ ] **Step 1: Update failing center + page tests**

In `MlbLiveCenter.test.tsx`, change Summary order assertions:

```tsx
const matchup = within(summary).getByTestId("mlb-live-matchup");
const pitchZone = within(summary).getByTestId("mlb-pitch-zone");
const playFeed = within(summary).getByTestId("mlb-final-play-feed");

expect(
  matchup.compareDocumentPosition(pitchZone) & Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
expect(
  pitchZone.compareDocumentPosition(playFeed) & Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
```

Remove reliance on `mlb-live-situation`. On Box tab, assert matchup/pitch zone gone too.

In `MlbGameDetailPage.test.tsx` live test, add:

```tsx
expect(screen.getByTestId("mlb-live-matchup")).toBeInTheDocument();
expect(screen.getByTestId("mlb-pitch-zone")).toBeInTheDocument();
```

(and stop requiring `mlb-live-situation` if currently asserted)

- [ ] **Step 2: Run tests to verify fail**

Run: `cd frontend && npx vitest run src/components/mlb/MlbLiveCenter.test.tsx src/pages/MlbGameDetailPage.test.tsx`

Expected: FAIL (matchup missing / old situation testid)

- [ ] **Step 3: Wire center**

Update `MlbLiveCenter.tsx` left column as specified; import `MlbLiveMatchupPanel` and `MlbPitchZone`.

- [ ] **Step 4: Run regression suite**

```bash
cd frontend && npx vitest run \
  src/components/mlb/MlbLiveCenter.test.tsx \
  src/components/mlb/MlbLiveMatchupPanel.test.tsx \
  src/components/mlb/MlbPitchZone.test.tsx \
  src/components/mlb/MlbFinalCenter.test.tsx \
  src/pages/MlbGameDetailPage.test.tsx
```

Expected: all PASS

If `md/system-design.md` still says pitch-zone-only for live, refresh the UI cell to “live Summary/Box with ESPN-style matchup + pitch zone”.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mlb/MlbLiveCenter.tsx \
  frontend/src/components/mlb/MlbLiveCenter.test.tsx \
  frontend/src/pages/MlbGameDetailPage.test.tsx \
  md/system-design.md
git commit -m "$(cat <<'EOF'
feat(mlb): stack ESPN-style matchup above pitch zone on live Summary

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Additive id / headshot_url | Task 1 |
| Additive spin_rate / spin_direction | Task 1 |
| Frontend map + fixtures | Task 2 |
| Matchup restyle (labels, headshots, outs, count) | Task 3 |
| Pitch zone silhouette + footer + spin omit | Task 4 |
| Left column order matchup → zone → feed | Task 5 |
| Right rail / Box / header unchanged | Task 5 (no edits) |
| Final unchanged | Task 5 regression |
| Omit missing data | Tasks 3–4 |
| system-design if needed | Task 5 |

## Self-review notes

- No TBD placeholders; headshot URL pattern fixed to mlbstatic template from the design
- Preferred `MlbLiveCenter` composition omits pitch zone when `situation` is null (matches design edge case)
- `MlbLiveSituation` remains in codebase for its own tests / unused full variant — not deleted in this plan (cleanup follow-up OK)
- Spin types use `float | None` in Python to accept int API values via existing `_float_or_none`
