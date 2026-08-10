# MLB Standings Division / Conference Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Division | Conference tabs on `/mlb/standings` so users can switch between six division tables and full AL / NL league tables.

**Architecture:** Client-only view switch. Keep `GET /api/mlb/standings` unchanged. A pure helper flattens each league’s division rows, sorts by PCT then wins, and recomputes `#` / `GB`. Header gains underline tabs (Prop Picks pattern); grid renders division or conference layout from the same payload.

**Tech Stack:** React 19 · TypeScript · Vite · Vitest · Testing Library · Tailwind 4

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-mlb-standings-division-conference-tabs-design.md`
- Coding standards: `md/claude.md`
- Brand: **statvista**
- Frontend-only — no backend, OpenAPI, or schema changes
- Default tab: **Division**
- Conference = American League + National League full tables (not wild card)
- Columns unchanged: `#` · Team · `W-L` · `PCT` · `GB` · `L10` · Strk
- Tab chrome: underline tablist matching `MlbPropPicksHeader` / `MlbFinalBroadcastHeader`
- No URL query sync in v1
- Verify: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/buildMlbConferenceStandings.test.ts src/features/mlb/league/MlbStandingsHeader.test.tsx src/features/mlb/league/MlbStandingsGrid.test.tsx src/features/mlb/league/MlbStandingsDivisionCard.test.tsx src/pages/MlbStandingsPage.test.tsx && npm run build`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/features/mlb/league/buildMlbConferenceStandings.ts` | Pure helper: leagues → conference sections with recomputed rank/GB |
| `frontend/src/features/mlb/league/buildMlbConferenceStandings.test.ts` | Unit tests for sort + GB |
| `frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx` | Generalize to accept `{ key, label, teams }` (keep export name) |
| `frontend/src/features/mlb/league/MlbStandingsDivisionCard.test.tsx` | Card still renders label + rows |
| `frontend/src/features/mlb/league/MlbStandingsHeader.tsx` | Navy banner + Division \| Conference tabs |
| `frontend/src/features/mlb/league/MlbStandingsHeader.test.tsx` | Tablist behavior |
| `frontend/src/features/mlb/league/MlbStandingsGrid.tsx` | `view` prop; division vs conference layouts |
| `frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx` | Both views |
| `frontend/src/pages/MlbStandingsPage.tsx` | Own `view` state; wire header ↔ grid |
| `frontend/src/pages/MlbStandingsPage.test.tsx` | Click Conference shows league table |

---

### Task 1: Conference derivation helper

**Files:**
- Create: `frontend/src/features/mlb/league/buildMlbConferenceStandings.ts`
- Create: `frontend/src/features/mlb/league/buildMlbConferenceStandings.test.ts`

**Interfaces:**
- Consumes: `ApiMlbStandingsLeague[]` from `@/shared/lib/api`
- Produces:
  - `export type MlbStandingsTableSection = { key: string; label: string; teams: ApiMlbStandingsRow[] }`
  - `export function buildMlbConferenceStandings(leagues: ApiMlbStandingsLeague[]): MlbStandingsTableSection[]`
  - Order: AL then NL (preserve input league order after filtering known keys, or map `al` then `nl`)
  - Each section `key` = league `key`, `label` = league `label`
  - Teams sorted by numeric PCT desc, then `wins` desc; `rank` reassigned 1…N; `gb` recomputed vs leader

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import type { ApiMlbStandingsLeague } from "@/shared/lib/api";
import { buildMlbConferenceStandings } from "./buildMlbConferenceStandings";

function row(
  partial: Partial<ApiMlbStandingsLeague["divisions"][number]["teams"][number]> & {
    team_id: string;
    abbrev: string;
    wins: number;
    losses: number;
    pct: string;
  },
) {
  return {
    rank: partial.rank ?? 1,
    team_id: partial.team_id,
    abbrev: partial.abbrev,
    name: partial.name ?? partial.abbrev,
    logo_url: null,
    wins: partial.wins,
    losses: partial.losses,
    wl: `${partial.wins}-${partial.losses}`,
    pct: partial.pct,
    gb: partial.gb ?? "-",
    l10: partial.l10 ?? "5-5",
    streak: partial.streak ?? "W1",
  };
}

const sample: ApiMlbStandingsLeague[] = [
  {
    key: "al",
    label: "American League",
    divisions: [
      {
        key: "al_east",
        label: "AL East",
        teams: [
          row({ team_id: "1", abbrev: "NYY", wins: 60, losses: 40, pct: ".600" }),
          row({ team_id: "2", abbrev: "BOS", wins: 50, losses: 50, pct: ".500" }),
        ],
      },
      {
        key: "al_central",
        label: "AL Central",
        teams: [
          row({ team_id: "3", abbrev: "CLE", wins: 55, losses: 45, pct: ".550" }),
        ],
      },
    ],
  },
  {
    key: "nl",
    label: "National League",
    divisions: [
      {
        key: "nl_east",
        label: "NL East",
        teams: [
          row({ team_id: "4", abbrev: "PHI", wins: 58, losses: 42, pct: ".580" }),
        ],
      },
    ],
  },
];

describe("buildMlbConferenceStandings", () => {
  it("returns AL then NL sections with teams sorted by pct then wins", () => {
    const sections = buildMlbConferenceStandings(sample);
    expect(sections.map((s) => s.key)).toEqual(["al", "nl"]);
    expect(sections[0].teams.map((t) => t.abbrev)).toEqual(["NYY", "CLE", "BOS"]);
    expect(sections[0].teams.map((t) => t.rank)).toEqual([1, 2, 3]);
  });

  it("recomputes GB vs league leader (half games included)", () => {
    const sections = buildMlbConferenceStandings(sample);
    expect(sections[0].teams[0].gb).toBe("-");
    // CLE: ((60-55)+(45-40))/2 = 5
    expect(sections[0].teams[1].gb).toBe("5");
    // BOS: ((60-50)+(50-40))/2 = 10
    expect(sections[0].teams[2].gb).toBe("10");
  });

  it("formats half-game GB with one decimal", () => {
    const leagues: ApiMlbStandingsLeague[] = [
      {
        key: "al",
        label: "American League",
        divisions: [
          {
            key: "al_east",
            label: "AL East",
            teams: [
              row({ team_id: "1", abbrev: "A", wins: 50, losses: 50, pct: ".500" }),
              row({ team_id: "2", abbrev: "B", wins: 49, losses: 50, pct: ".495" }),
            ],
          },
        ],
      },
    ];
    const [al] = buildMlbConferenceStandings(leagues);
    expect(al.teams[1].gb).toBe("0.5");
  });

  it("returns empty array for empty leagues", () => {
    expect(buildMlbConferenceStandings([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/buildMlbConferenceStandings.test.ts`

Expected: FAIL — module not found / `buildMlbConferenceStandings` not defined

- [ ] **Step 3: Implement helper**

Create `frontend/src/features/mlb/league/buildMlbConferenceStandings.ts`:

```ts
import type {
  ApiMlbStandingsLeague,
  ApiMlbStandingsRow,
} from "@/shared/lib/api";

export type MlbStandingsTableSection = {
  key: string;
  label: string;
  teams: ApiMlbStandingsRow[];
};

function parsePct(pct: string): number {
  const n = Number.parseFloat(pct);
  return Number.isFinite(n) ? n : 0;
}

function formatGamesBack(leader: ApiMlbStandingsRow, team: ApiMlbStandingsRow): string {
  if (team.team_id === leader.team_id) return "-";
  const gb =
    (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
  if (gb <= 0) return "-";
  return Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
}

function rankLeagueTeams(teams: ApiMlbStandingsRow[]): ApiMlbStandingsRow[] {
  const sorted = [...teams].sort((a, b) => {
    const pctDiff = parsePct(b.pct) - parsePct(a.pct);
    if (pctDiff !== 0) return pctDiff;
    return b.wins - a.wins;
  });
  if (sorted.length === 0) return [];
  const leader = sorted[0];
  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
    gb: formatGamesBack(leader, team),
  }));
}

export function buildMlbConferenceStandings(
  leagues: ApiMlbStandingsLeague[],
): MlbStandingsTableSection[] {
  const byKey = new Map(leagues.map((league) => [league.key, league]));
  const ordered: ApiMlbStandingsLeague[] = [];
  for (const key of ["al", "nl"] as const) {
    const league = byKey.get(key);
    if (league) ordered.push(league);
  }
  for (const league of leagues) {
    if (league.key !== "al" && league.key !== "nl") ordered.push(league);
  }

  return ordered.map((league) => {
    const seen = new Set<string>();
    const flat: ApiMlbStandingsRow[] = [];
    for (const division of league.divisions) {
      for (const team of division.teams) {
        if (seen.has(team.team_id)) continue;
        seen.add(team.team_id);
        flat.push(team);
      }
    }
    return {
      key: league.key,
      label: league.label,
      teams: rankLeagueTeams(flat),
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/buildMlbConferenceStandings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if user requested commits)

```bash
git add frontend/src/features/mlb/league/buildMlbConferenceStandings.ts \
  frontend/src/features/mlb/league/buildMlbConferenceStandings.test.ts
git commit -m "$(cat <<'EOF'
feat(mlb): derive conference standings from division rows

EOF
)"
```

---

### Task 2: Generalize standings table card

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx`
- Create: `frontend/src/features/mlb/league/MlbStandingsDivisionCard.test.tsx`

**Interfaces:**
- Consumes: `MlbStandingsTableSection` shape `{ key, label, teams }` (compatible with `ApiMlbStandingsDivision`)
- Produces: same visual card; prop renamed to `section` (or keep `division` but type as `{ key: string; label: string; teams: ApiMlbStandingsRow[] }`)

- [ ] **Step 1: Write the failing card test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MlbStandingsDivisionCard } from "./MlbStandingsDivisionCard";

describe("MlbStandingsDivisionCard", () => {
  it("renders section label and team abbrev", () => {
    render(
      <MlbStandingsDivisionCard
        section={{
          key: "al",
          label: "American League",
          teams: [
            {
              rank: 1,
              team_id: "147",
              abbrev: "NYY",
              name: "Yankees",
              logo_url: null,
              wins: 60,
              losses: 40,
              wl: "60-40",
              pct: ".600",
              gb: "-",
              l10: "6-4",
              streak: "W2",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "American League" }),
    ).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("60-40")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandingsDivisionCard.test.tsx`

Expected: FAIL on `section` prop (component still expects `division`)

- [ ] **Step 3: Update card to accept `section`**

In `MlbStandingsDivisionCard.tsx`, change props to:

```ts
type MlbStandingsDivisionCardProps = {
  section: {
    key: string;
    label: string;
    teams: ApiMlbStandingsRow[];
  };
};
```

Use `section.label`, `section.key`, `section.teams` in the JSX (same markup as today). Update import to `ApiMlbStandingsRow` if needed. Update `MlbStandingsGrid.tsx` call sites from `division={division}` to `section={division}` in the same task so the app still typechecks.

- [ ] **Step 4: Run card + grid tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandingsDivisionCard.test.tsx src/features/mlb/league/MlbStandingsGrid.test.tsx`

Expected: PASS (update grid test/render if it constructs the card directly)

- [ ] **Step 5: Commit** (only if user requested commits)

```bash
git add frontend/src/features/mlb/league/MlbStandingsDivisionCard.tsx \
  frontend/src/features/mlb/league/MlbStandingsDivisionCard.test.tsx \
  frontend/src/features/mlb/league/MlbStandingsGrid.tsx \
  frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx
git commit -m "$(cat <<'EOF'
refactor(mlb): generalize standings table card section prop

EOF
)"
```

---

### Task 3: Header Division | Conference tabs

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbStandingsHeader.tsx`
- Modify: `frontend/src/features/mlb/league/MlbStandingsHeader.test.tsx`

**Interfaces:**
- Consumes: `season: number`, `view: "division" | "conference"`, `onViewChange: (view) => void`
- Produces: exported type `MlbStandingsView = "division" | "conference"`

- [ ] **Step 1: Write failing tab tests**

Extend `MlbStandingsHeader.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MLB_STANDINGS_BANNER_NAVY,
  MlbStandingsHeader,
} from "./MlbStandingsHeader";

describe("MlbStandingsHeader", () => {
  it("renders a navy banner titled MLB {season} Standings with bats mark", () => {
    render(
      <MlbStandingsHeader
        season={2026}
        view="division"
        onViewChange={() => {}}
      />,
    );
    // ...existing assertions...
  });

  it("exposes Division and Conference tabs with Division selected by default", () => {
    render(
      <MlbStandingsHeader
        season={2026}
        view="division"
        onViewChange={() => {}}
      />,
    );
    const division = screen.getByRole("tab", { name: "Division" });
    const conference = screen.getByRole("tab", { name: "Conference" });
    expect(division).toHaveAttribute("aria-selected", "true");
    expect(conference).toHaveAttribute("aria-selected", "false");
  });

  it("calls onViewChange when Conference is clicked", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(
      <MlbStandingsHeader
        season={2026}
        view="division"
        onViewChange={onViewChange}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Conference" }));
    expect(onViewChange).toHaveBeenCalledWith("conference");
  });
});
```

Keep the existing navy/bats assertions; only add the required props.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandingsHeader.test.tsx`

Expected: FAIL — missing props / no tabs

- [ ] **Step 3: Implement tabs on header**

Update `MlbStandingsHeader.tsx` to match Prop Picks tablist pattern:

```tsx
import crossedBatsMark from "@/assets/mlb-crossed-bats.png";

export type MlbStandingsView = "division" | "conference";

type MlbStandingsHeaderProps = {
  season: number;
  view: MlbStandingsView;
  onViewChange: (view: MlbStandingsView) => void;
};

export const MLB_STANDINGS_BANNER_NAVY = "#0A2351";

const VIEW_TABS: { id: MlbStandingsView; label: string }[] = [
  { id: "division", label: "Division" },
  { id: "conference", label: "Conference" },
];

export function MlbStandingsHeader({
  season,
  view,
  onViewChange,
}: MlbStandingsHeaderProps) {
  return (
    <div data-testid="mlb-standings-header" className="relative z-20 space-y-3">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: MLB_STANDINGS_BANNER_NAVY }}
      >
        {/* existing banner body unchanged */}
      </div>

      <div
        role="tablist"
        aria-label="Standings view"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`mlb-standings-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            aria-controls={`mlb-standings-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-[18px] font-medium transition-colors ${
              view === tab.id
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => onViewChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Temporarily update `MlbStandingsPage.tsx` to pass `view="division"` and `onViewChange={() => {}}` so TypeScript builds (full wiring in Task 5).

- [ ] **Step 4: Run header tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandingsHeader.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit** (only if user requested commits)

```bash
git add frontend/src/features/mlb/league/MlbStandingsHeader.tsx \
  frontend/src/features/mlb/league/MlbStandingsHeader.test.tsx \
  frontend/src/pages/MlbStandingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): add Division and Conference tabs to standings header

EOF
)"
```

---

### Task 4: Grid conference view

**Files:**
- Modify: `frontend/src/features/mlb/league/MlbStandingsGrid.tsx`
- Modify: `frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx`

**Interfaces:**
- Consumes: existing props + `view: MlbStandingsView`
- Produces: when `view === "conference"`, two section cards from `buildMlbConferenceStandings(leagues)` in `lg:grid-cols-2`; loading/error/empty unchanged for both views

- [ ] **Step 1: Extend grid tests**

Add to `MlbStandingsGrid.test.tsx` (pass `view="division"` on existing renders):

```tsx
it("renders conference league tables when view is conference", () => {
  render(<MlbStandingsGrid leagues={sample} view="conference" />);
  expect(
    screen.getByRole("heading", { name: "American League" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "National League" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("AL East")).not.toBeInTheDocument();
});
```

Use existing `sample` fixture; ensure it includes enough teams that conference headings appear as `h3` card titles. If sample only has AL East label today, assert card heading roles carefully — conference uses league labels as card titles (`h3`), while division view uses league labels as `h2` section titles. Prefer:

```tsx
expect(screen.getByText("American League")).toBeInTheDocument();
expect(screen.queryByText("AL East")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandingsGrid.test.tsx`

Expected: FAIL — `view` prop missing / AL East still present

- [ ] **Step 3: Implement view branching**

In `MlbStandingsGrid.tsx`:

```tsx
import type { ApiMlbStandingsLeague } from "@/shared/lib/api";
import { buildMlbConferenceStandings } from "./buildMlbConferenceStandings";
import type { MlbStandingsView } from "./MlbStandingsHeader";
import { MlbStandingsDivisionCard } from "./MlbStandingsDivisionCard";

type MlbStandingsGridProps = {
  leagues: ApiMlbStandingsLeague[];
  view: MlbStandingsView;
  isLoading?: boolean;
  isError?: boolean;
};
```

When not loading/error/empty and `view === "conference"`:

```tsx
const conferences = buildMlbConferenceStandings(leagues);
return (
  <div className="space-y-10">
    <div
      id="mlb-standings-conference-panel"
      role="tabpanel"
      aria-labelledby="mlb-standings-conference-tab"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {conferences.map((section) => (
        <MlbStandingsDivisionCard key={section.key} section={section} />
      ))}
    </div>
    <p className="text-[14px] text-white/35">Data: statsapi.mlb.com</p>
  </div>
);
```

Division branch: wrap existing AL/NL sections in `id="mlb-standings-division-panel" role="tabpanel" aria-labelledby="mlb-standings-division-tab"`. Keep attribution.

- [ ] **Step 4: Run grid tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/MlbStandingsGrid.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit** (only if user requested commits)

```bash
git add frontend/src/features/mlb/league/MlbStandingsGrid.tsx \
  frontend/src/features/mlb/league/MlbStandingsGrid.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): render conference standings grid view

EOF
)"
```

---

### Task 5: Page wiring + integration test

**Files:**
- Modify: `frontend/src/pages/MlbStandingsPage.tsx`
- Modify: `frontend/src/pages/MlbStandingsPage.test.tsx`

**Interfaces:**
- Consumes: `MlbStandingsView` state default `"division"`
- Produces: header `view` / `onViewChange` wired to grid `view`

- [ ] **Step 1: Write failing page test**

```tsx
import userEvent from "@testing-library/user-event";

it("switches to conference league tables when Conference tab is clicked", async () => {
  const user = userEvent.setup();
  // reuse existing successful fetchMock payload that includes AL East
  renderPage();
  expect(await screen.findByText("AL East")).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Conference" }));
  expect(screen.queryByText("AL East")).not.toBeInTheDocument();
  expect(screen.getByText("American League")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Conference" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
```

Ensure the mock payload’s American League `label` is `"American League"` so the conference card title is findable after switch. Existing page test already uses that label as an `h2` in division view — after switch it becomes the card `h3`; `getByText` is fine.

- [ ] **Step 2: Run page test to verify failure**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/pages/MlbStandingsPage.test.tsx`

Expected: FAIL — tab click does not hide AL East (or tabs missing)

- [ ] **Step 3: Wire page state**

```tsx
import { useState } from "react";
import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { MlbStandingsGrid } from "@/features/mlb/league/MlbStandingsGrid";
import {
  MlbStandingsHeader,
  type MlbStandingsView,
} from "@/features/mlb/league/MlbStandingsHeader";
import { useMlbStandings } from "@/features/mlb/hooks/useMlbStandings";

export function MlbStandingsPage() {
  const { data, isLoading, hasNeverLoaded } = useMlbStandings();
  const season = data?.season ?? new Date().getFullYear();
  const [view, setView] = useState<MlbStandingsView>("division");

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <MlbStandingsHeader
          season={season}
          view={view}
          onViewChange={setView}
        />
        <MlbStandingsGrid
          leagues={data?.leagues ?? []}
          view={view}
          isLoading={isLoading && !data}
          isError={hasNeverLoaded}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run full verification**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/frontend && npm run test -- --run src/features/mlb/league/buildMlbConferenceStandings.test.ts src/features/mlb/league/MlbStandingsHeader.test.tsx src/features/mlb/league/MlbStandingsGrid.test.tsx src/features/mlb/league/MlbStandingsDivisionCard.test.tsx src/pages/MlbStandingsPage.test.tsx && npm run build`

Expected: all PASS; build succeeds

- [ ] **Step 5: Commit** (only if user requested commits)

```bash
git add frontend/src/pages/MlbStandingsPage.tsx \
  frontend/src/pages/MlbStandingsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(mlb): wire standings Division and Conference tab state

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Division \| Conference tabs under header | Task 3 |
| Default Division | Tasks 3, 5 |
| Division layout unchanged | Tasks 2, 4 |
| Conference = AL + NL full tables | Tasks 1, 4 |
| Recompute rank + GB client-side | Task 1 |
| No backend/API change | Global Constraints |
| Prop Picks-style underline tabs | Task 3 |
| Shared card styling | Task 2 |
| Loading/error/empty shared | Task 4 |
| Tests for helper, header, grid, page | Tasks 1–5 |
| Out of scope: wild card, URL sync, backend fields | Not planned |

## Placeholder / type consistency check

- `MlbStandingsView` defined in Task 3; consumed in Tasks 4–5
- `MlbStandingsTableSection` / `buildMlbConferenceStandings` defined in Task 1; consumed in Task 4
- Card prop `section` introduced in Task 2; grid updated same task
- No TBD / “implement later” steps
