# WNBA MLB-Parity Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WNBA hubs and game detail look like MLB—colored banners with a basketball mark, and a broadcast Summary|Box game center with shot chart in the hit-chart slot and an MLB-style Scoring plays | All plays feed.

**Architecture:** Mirror MLB in place (no shared shell refactor). Add `Wnba*Header` banners on league/player pages; restructure `GameDetailPage` into Pregame/Live/Final centers that reuse existing ShotChart, BoxScore, WinProbabilityPanel, and scheduled preview sections. Frontend-only; no new API routes.

**Tech Stack:** React 19 · TypeScript · Vite · TanStack Query · React Router · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-wnba-mlb-parity-chrome-design.md`
- Coding standards: `md/claude.md` (small focused changes, strong typing, tests with code)
- Product name in copy: **statvista** (not HoopVista)
- Sport mark: `@/assets/wnba_basketball.png`
- Banner color roles (match MLB): Leaders `#F38312`, Standings `#0A2351`, Futures `#0B3D2E`, Props `#059669`, Player `#7C2D12`
- No Player of the Game; no pitch zone; no pregame Props tab; no Prop Picks hybrid rewrite
- Status label **above** score slabs; venue **not** in score header (Game Info only)
- Summary | Box tabs **under** score header
- Play feed defaults to **Scoring plays**; switch to **All plays**; group by period
- Verify frontend: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run <paths> && npm run build`
- Phases A (hubs) and B (game detail) ship independently; finish A before B if doing both

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/features/basketball/league/WnbaLeadersHeader.tsx` | Orange leaders banner |
| `frontend/src/features/basketball/league/WnbaLeadersHeader.test.tsx` | Banner tests |
| `frontend/src/features/basketball/league/WnbaStandingsHeader.tsx` | Navy standings banner |
| `frontend/src/features/basketball/league/WnbaStandingsHeader.test.tsx` | Banner tests |
| `frontend/src/features/basketball/league/WnbaFuturesHeader.tsx` | Dark green futures banner |
| `frontend/src/features/basketball/league/WnbaFuturesHeader.test.tsx` | Banner tests |
| `frontend/src/features/basketball/league/WnbaPropPicksHeader.tsx` | Emerald props banner (title only; no legs) |
| `frontend/src/features/basketball/league/WnbaPropPicksHeader.test.tsx` | Banner tests |
| `frontend/src/features/basketball/league/WnbaPlayerHeaderBanner.tsx` | Player page banner |
| `frontend/src/features/basketball/league/WnbaPlayerHeaderBanner.test.tsx` | Banner tests |
| `frontend/src/features/basketball/league/LeadersGrid.tsx` | Remove plain `<header>` title (banner replaces it) |
| `frontend/src/features/basketball/league/StandingsGrid.tsx` | Same |
| `frontend/src/features/basketball/league/FuturesBoard.tsx` | Same |
| `frontend/src/pages/LeagueLeadersPage.tsx` | Insert banner |
| `frontend/src/pages/LeagueStandingsPage.tsx` | Insert banner |
| `frontend/src/pages/LeagueFuturesPage.tsx` | Insert banner |
| `frontend/src/pages/LeaguePropPicksPage.tsx` | Insert banner; keep table + filters |
| `frontend/src/pages/LeaguePlayerPage.tsx` | Insert banner above player body |
| `frontend/src/features/basketball/game/WnbaPlayFeed.tsx` | Scoring/All switch + period groups |
| `frontend/src/features/basketball/game/WnbaPlayFeed.test.tsx` | Filter + grouping tests |
| `frontend/src/features/basketball/game/WnbaBroadcastHeader.tsx` | Status above; score slabs; Summary\|Box under |
| `frontend/src/features/basketball/game/WnbaBroadcastHeader.test.tsx` | Layout tests |
| `frontend/src/features/basketball/game/WnbaQuarterScoreCard.tsx` | Period scoring or total fallback |
| `frontend/src/features/basketball/game/WnbaGameInfo.tsx` | Venue (+ status label optional) |
| `frontend/src/features/basketball/game/WnbaTeamStatsCard.tsx` | Thin wrapper over `winProbability.teamStats` |
| `frontend/src/features/basketball/game/WnbaLiveCenter.tsx` | Live/halftime Summary\|Box shell |
| `frontend/src/features/basketball/game/WnbaFinalCenter.tsx` | Final Summary\|Box shell |
| `frontend/src/features/basketball/game/WnbaPregameCenter.tsx` | Scheduled preview under broadcast chrome |
| `frontend/src/features/basketball/game/*.test.tsx` | Center smoke tests |
| `frontend/src/pages/GameDetailPage.tsx` | Route to centers by status |
| `frontend/src/features/basketball/lib/quarterLinescore.ts` | Pure derive helper |
| `frontend/src/features/basketball/lib/quarterLinescore.test.ts` | Derive tests |
| `md/system-design.md` | Note game-detail UI structure if page↔API table needs a line |

---

## Phase A — Hub banners

### Task 1: Leaders banner

**Files:**
- Create: `frontend/src/features/basketball/league/WnbaLeadersHeader.tsx`
- Create: `frontend/src/features/basketball/league/WnbaLeadersHeader.test.tsx`
- Modify: `frontend/src/pages/LeagueLeadersPage.tsx`
- Modify: `frontend/src/features/basketball/league/LeadersGrid.tsx` (remove duplicate plain title header)

**Interfaces:**
- Consumes: `season: number`; asset `wnba_basketball.png`
- Produces: `WNBA_LEADERS_BANNER_ORANGE = "#F38312"`; `WnbaLeadersHeader({ season }: { season: number })`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WNBA_LEADERS_BANNER_ORANGE,
  WnbaLeadersHeader,
} from "./WnbaLeadersHeader";

describe("WnbaLeadersHeader", () => {
  it("renders an orange banner titled WNBA {season} Leaders with basketball mark", () => {
    render(<WnbaLeadersHeader season={2026} />);

    const header = screen.getByTestId("wnba-leaders-header");
    expect(
      screen.getByRole("heading", { name: "WNBA 2026 Leaders" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(243, 131, 18)" });
    expect(WNBA_LEADERS_BANNER_ORANGE).toBe("#F38312");
    const mark = header.querySelector("img");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src") ?? "").toMatch(/wnba_basketball/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- --run src/features/basketball/league/WnbaLeadersHeader.test.tsx`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement header (mirror `MlbLeadersHeader`)**

```tsx
import basketballMark from "@/assets/wnba_basketball.png";

export const WNBA_LEADERS_BANNER_ORANGE = "#F38312";

export function WnbaLeadersHeader({ season }: { season: number }) {
  return (
    <div data-testid="wnba-leaders-header" className="relative z-20">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: WNBA_LEADERS_BANNER_ORANGE }}
      >
        <div className="relative z-10 flex min-h-[7.5rem] items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-4 sm:gap-5">
            <img
              src={basketballMark}
              alt=""
              role="presentation"
              className="h-20 w-auto shrink-0 self-center object-contain sm:h-24"
            />
            <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
              WNBA {season} Leaders
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire page + remove LeadersGrid plain header**

In `LeagueLeadersPage`, match MLB page layout:

```tsx
<section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
  <WnbaLeadersHeader season={season} />
  <LeadersGrid ... />  {/* no season title header inside */}
</section>
```

Remove the `<header>…Leaders…</header>` block from `LeadersGrid` (keep grid/skeletons/error). Drop unused `season` prop from `LeadersGrid` **or** keep it only if still needed elsewhere—prefer remove from props if unused.

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm run test -- --run src/features/basketball/league/WnbaLeadersHeader.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/basketball/league/WnbaLeadersHeader.tsx \
  frontend/src/features/basketball/league/WnbaLeadersHeader.test.tsx \
  frontend/src/features/basketball/league/LeadersGrid.tsx \
  frontend/src/pages/LeagueLeadersPage.tsx
git commit -m "feat(wnba): add MLB-style Leaders hub banner"
```

---

### Task 2: Standings + Futures banners

**Files:**
- Create: `WnbaStandingsHeader.tsx` + `.test.tsx` (`WNBA_STANDINGS_BANNER_NAVY = "#0A2351"`, title `WNBA {season} Standings`)
- Create: `WnbaFuturesHeader.tsx` + `.test.tsx` (`WNBA_FUTURES_BANNER_GREEN = "#0B3D2E"`, title `WNBA {season} Futures`)
- Modify: `LeagueStandingsPage.tsx`, `StandingsGrid.tsx` (remove plain header)
- Modify: `LeagueFuturesPage.tsx`, `FuturesBoard.tsx` (remove plain header)

**Interfaces:**
- Same shape as Task 1 headers with respective colors/titles

- [ ] **Step 1: Write failing tests** (copy Task 1 pattern; assert navy `rgb(10, 35, 81)` and green `rgb(11, 61, 46)`)

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement both headers** (same layout as Leaders; swap color + title)

- [ ] **Step 4: Wire pages; strip duplicate titles from grids/boards**

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(wnba): add Standings and Futures hub banners"
```

---

### Task 3: Prop Picks + Player banners

**Files:**
- Create: `WnbaPropPicksHeader.tsx` + test — emerald `#059669`, heading `WNBA Props`, basketball mark, **no** legs control, **no** app tab strip (filters stay in `PropPicksFilters` / table toolbar)
- Create: `WnbaPlayerHeaderBanner.tsx` + test — `#7C2D12`, heading = player display name when provided else `Player`
- Modify: `LeaguePropPicksPage.tsx` — wrap content in `max-w-6xl` section with banner above table
- Modify: `LeaguePlayerPage.tsx` — banner above `PlayerHeader` when `data` loaded (title `data.name` or equivalent field)

**Interfaces:**
- `WnbaPropPicksHeader()` — no required props (optional `children` for future; omit if unused)
- `WnbaPlayerHeaderBanner({ title }: { title: string })`

- [ ] **Step 1: Write failing tests**

```tsx
// Prop picks
expect(screen.getByRole("heading", { name: "WNBA Props" })).toBeInTheDocument();
expect(banner).toHaveStyle({ backgroundColor: "rgb(5, 150, 105)" });

// Player
render(<WnbaPlayerHeaderBanner title="A'ja Wilson" />);
expect(screen.getByRole("heading", { name: "A'ja Wilson" })).toBeInTheDocument();
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement + wire pages**

For Prop Picks page structure:

```tsx
<LeagueSubnav league="wnba" />
<section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
  <WnbaPropPicksHeader />
  <PropPicksTable ... />
</section>
```

For Player page (loaded state), place banner inside the content column above `PlayerHeader`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add Prop Picks and Player hub banners"
```

---

## Phase B — Game detail

### Task 4: Quarter linescore helper

**Files:**
- Create: `frontend/src/features/basketball/lib/quarterLinescore.ts`
- Create: `frontend/src/features/basketball/lib/quarterLinescore.test.ts`

**Interfaces:**
- Consumes: `GameDetail` plays (`period`, `awayScore`, `homeScore`, `scoring`)
- Produces:

```ts
export type QuarterLinescoreRow = {
  period: number;
  away: number;
  home: number;
};

export type QuarterLinescore = {
  periods: QuarterLinescoreRow[];
  awayTotal: number;
  homeTotal: number;
};

/** Derive per-period scoring deltas from cumulative play scores (scoring plays only). */
export function deriveQuarterLinescore(
  plays: GameDetail["plays"],
  awayTotal: number | null,
  homeTotal: number | null,
): QuarterLinescore | null;
```

- [ ] **Step 1: Write failing tests**

Use chronological scoring plays (oldest-first for derivation). Example: Q1 ends 10-8, Q2 scoring play reaches 18-15 → period rows `{1,10,8}`, `{2,8,7}`.

```ts
import { describe, expect, it } from "vitest";
import { deriveQuarterLinescore } from "./quarterLinescore";

describe("deriveQuarterLinescore", () => {
  it("returns null when there are no scoring plays", () => {
    expect(deriveQuarterLinescore([], 0, 0)).toBeNull();
  });

  it("derives period deltas from cumulative scoring play scores", () => {
    const plays = [
      {
        id: "1",
        teamId: "a",
        period: 1,
        clock: "0:01",
        text: "x",
        scoring: true,
        awayScore: 10,
        homeScore: 8,
        shooting: false,
      },
      {
        id: "2",
        teamId: "a",
        period: 2,
        clock: "5:00",
        text: "y",
        scoring: true,
        awayScore: 18,
        homeScore: 15,
        shooting: false,
      },
    ];
    // Implementation may reverse newest-first API order internally.
    const result = deriveQuarterLinescore([...plays].reverse(), 18, 15);
    expect(result?.periods).toEqual([
      { period: 1, away: 10, home: 8 },
      { period: 2, away: 8, home: 7 },
    ]);
    expect(result?.awayTotal).toBe(18);
    expect(result?.homeTotal).toBe(15);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — sort scoring plays oldest-first; track last cumulative score; on period change or end, push delta; use team totals for final `awayTotal`/`homeTotal` when non-null

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): derive quarter linescore from scoring plays"
```

---

### Task 5: WnbaPlayFeed (Scoring / All)

**Files:**
- Create: `frontend/src/features/basketball/game/WnbaPlayFeed.tsx`
- Create: `frontend/src/features/basketball/game/WnbaPlayFeed.test.tsx`
- Do **not** delete `PlayByPlay.tsx` until centers no longer import it (Task 8); then remove or re-export if unused

**Interfaces:**
- Consumes: `detail: GameDetail`
- Produces: `WnbaPlayFeed({ detail }: { detail: GameDetail })`
- Filter: `"scoring" | "all"`; default `"scoring"`
- Group by `period`; card background = scoring team color when all plays in group share a team, else use a neutral dark card with per-row team color accents (prefer: period header card uses home/away color only for title bar—simplest MLB mirror: wrap each period group in `style={{ backgroundColor: detail.home.color }}` is wrong. **Use:** outer card `backgroundColor` from first play’s `teamId` color, or black/`GameSection` with period label only. Spec: “period-colored cards like MLB half-innings” → color by **possessing team of first play in group** or use away color for odd periods—**prefer:** `GameSection` + period title; each scoring play row can show team pill. Closest MLB: group card tinted with team color of the **majority team in that period’s filtered plays**, fallback `detail.away.color`.

Keep it simple like MLB: one card per period, `backgroundColor: detail.away.color` is incorrect. Use:

```tsx
// Period card shell: team color from first play in group
const teamColor = teamColorFor(group.plays[0]?.teamId);
```

- [ ] **Step 1: Write failing test** using `detail` from `../lib/testFixtures` (ensure fixture has ≥1 scoring and ≥1 non-scoring play)

```tsx
it("defaults to scoring plays and can switch to all plays", async () => {
  const user = userEvent.setup();
  render(<WnbaPlayFeed detail={detail} />);
  expect(screen.getByRole("button", { name: /scoring plays/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // non-scoring text absent when filter=scoring
  await user.click(screen.getByRole("button", { name: /all plays/i }));
  expect(screen.getByRole("button", { name: /all plays/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — copy control chrome from `MlbFinalPlayFeed` (pill toggle); group with `Map<period, plays[]>`; render period ordinal (`1st`/`2nd`/`3rd`/`4th`/`OT`); list play text + clock + score; empty → `No plays available`

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add Scoring/All plays feed like MLB"
```

---

### Task 6: Broadcast header + rail cards

**Files:**
- Create: `WnbaBroadcastHeader.tsx` + test
- Create: `WnbaQuarterScoreCard.tsx` + test (optional thin)
- Create: `WnbaGameInfo.tsx` + test
- Create: `WnbaTeamStatsCard.tsx` (render `detail.winProbability?.teamStats` or null)

**Interfaces:**
- `export type WnbaGameTab = "summary" | "box"`
- `WnbaBroadcastHeader({ detail, activeTab, onTabChange })`  
  - Status: centered `detail.statusLabel` **above** two-column score slabs  
  - Slabs: team color backgrounds, name, score, optional logo (mirror MLB `ScoreSlab` but **no** middle date/venue column)  
  - Tabs **below** slabs: Summary | Box  
  - Assert venue string **not** in header container
- `WnbaQuarterScoreCard({ detail })` — uses `deriveQuarterLinescore`; if null, show two-row totals only
- `WnbaGameInfo({ detail })` — venue row when `detail.venue` set

- [ ] **Step 1: Write failing header test**

```tsx
render(
  <WnbaBroadcastHeader
    detail={detail}
    activeTab="summary"
    onTabChange={() => {}}
  />,
);
expect(screen.getByText(detail.statusLabel)).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /summary/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /box/i })).toBeInTheDocument();
expect(screen.queryByText(detail.venue!)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement header + Game Info + quarter card + team stats card**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add broadcast header and summary rail cards"
```

---

### Task 7: Live + Final centers

**Files:**
- Create: `WnbaLiveCenter.tsx` + `WnbaLiveCenter.test.tsx`
- Create: `WnbaFinalCenter.tsx` + `WnbaFinalCenter.test.tsx`

**Interfaces:**
- `WnbaLiveCenter({ detail }: { detail: GameDetail })`
- `WnbaFinalCenter({ detail }: { detail: GameDetail })`
- Both: local `useState<WnbaGameTab>("summary")`
- Summary grid: `lg:grid-cols-2`, left `WnbaPlayFeed`, right stack: `WnbaQuarterScoreCard` → `WnbaTeamStatsCard` → `WinProbabilityPanel` → `ShotChart` → `WnbaGameInfo`
- Box: `<BoxScore detail={detail} />` (add `sideBySide` only if `BoxScore` already supports it; otherwise keep current layout)
- **No** Player of the Game; **no** pitch zone
- Live and Final can share the same layout component with a `data-testid` difference, or duplicate thinly like MLB—prefer one internal `WnbaInGameCenter` used by both with different test ids if that stays clear

- [ ] **Step 1: Write failing smoke tests**

```tsx
render(<WnbaFinalCenter detail={{ ...detail, status: "final" }} />);
expect(screen.getByTestId("wnba-final-center")).toBeInTheDocument();
expect(screen.getByTestId("wnba-play-feed")).toBeInTheDocument();
// shot chart section present on summary
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement centers**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(wnba): add live and final broadcast game centers"
```

---

### Task 8: Pregame center + wire GameDetailPage

**Files:**
- Create: `WnbaPregameCenter.tsx` + test
- Modify: `frontend/src/pages/GameDetailPage.tsx`
- Remove unused imports of old stacked layout; delete `PlayByPlay.tsx` if unused (update any tests that imported it)

**Interfaces:**
- `WnbaPregameCenter({ detail })` — use `WnbaBroadcastHeader` **or** a lighter scheduled header (scores null). Prefer same broadcast header with Summary-only content **without** Box tab if scores are null—**simpler approved approach:** keep existing `GameHeader` for scheduled **or** use broadcast header with status above + **no** Summary|Box tabs, then stack MatchupPrediction → ProjectedStarters → SeasonLeaders → InjuryReport. Spec: “Broadcast header chrome wrapping existing stack”. So: status + slabs (— scores) + **no** tabs + preview sections.

- [ ] **Step 1: Write failing page/center test** — scheduled fixture renders starters; live fixture renders `wnba-live-center`

- [ ] **Step 2: Update `GameDetailPage`**

```tsx
if (detail.status === "scheduled") return <WnbaPregameCenter detail={detail} />;
if (detail.status === "final") return <WnbaFinalCenter detail={detail} />;
return <WnbaLiveCenter detail={detail} />; // live + halftime
```

Keep skeleton / unable-to-load wrappers.

- [ ] **Step 3: Run targeted tests + build**

```bash
cd frontend && npm run test -- --run \
  src/features/basketball/league/WnbaLeadersHeader.test.tsx \
  src/features/basketball/league/WnbaStandingsHeader.test.tsx \
  src/features/basketball/league/WnbaFuturesHeader.test.tsx \
  src/features/basketball/league/WnbaPropPicksHeader.test.tsx \
  src/features/basketball/league/WnbaPlayerHeaderBanner.test.tsx \
  src/features/basketball/lib/quarterLinescore.test.ts \
  src/features/basketball/game/WnbaPlayFeed.test.tsx \
  src/features/basketball/game/WnbaBroadcastHeader.test.tsx \
  src/features/basketball/game/WnbaLiveCenter.test.tsx \
  src/features/basketball/game/WnbaFinalCenter.test.tsx \
  src/features/basketball/game/WnbaPregameCenter.test.tsx \
  src/pages/GameDetailPage.test.tsx
npm run build
```

Expected: all PASS; build succeeds. Create `GameDetailPage.test.tsx` if missing—smoke route statuses.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(wnba): wire MLB-style game centers on GameDetailPage"
```

---

### Task 9: Docs touch-up

**Files:**
- Modify: `md/system-design.md` — in WNBA game detail notes, mention Summary|Box broadcast layout and shot chart on Summary rail (page↔API paths unchanged)

- [ ] **Step 1: Update the page ↔ API / game detail description** to match shipped UI

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: note WNBA game detail broadcast layout"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Hub banners Leaders/Standings/Futures/Props/Player | 1–3 |
| Sport mark `wnba_basketball.png` + MLB color roles | 1–3 |
| Matchups unchanged | (no task) |
| Prop table kept | 3 |
| Player banner only | 3 |
| Broadcast header; status above; no venue in header | 6 |
| Summary\|Box under header | 6–7 |
| Shot chart = hit-chart slot | 7 |
| Scoring/All plays; period groups | 5 |
| No POTG / pitch zone / pregame Props | 7–8 |
| Pregame wraps existing preview stack | 8 |
| No new APIs | (none) |
| Tests listed in spec | per-task |

No intentional placeholders remain. Quarter linescore derivation is the only soft fallback (explicit in Task 4 + quarter card).
