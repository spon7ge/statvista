# App Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace top `HomeNav` and per-page `LeagueSubnav` with a chrome-owned left sidebar (hamburger drawer on mobile) that switches leagues and league sections in one tree.

**Architecture:** Extract nav data into `appNav.ts`. Render it with `AppSidebar`. Grow `HomeChromeLayout` into a desktop two-column shell (sidebar + ticker/outlet/footer) and a mobile top bar + drawer. Pages stop rendering `LeagueSubnav`. No new routes or APIs.

**Tech Stack:** React 19, React Router 7 (`Link`, `useLocation`, `Outlet`), Tailwind CSS v4, lucide-react, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-26-app-sidebar-nav-design.md`

## Global Constraints

- Product name in UI copy is **statvista**.
- Visual language stays current statvista (flat panel, `border-white/10`, muted whites, `bg-white/10` active). Official NBA / WNBA / MLB logos beside league labels. Not Statmuse stacked cards.
- Desktop breakpoint is Tailwind `sm`. Sidebar ~15rem (`w-60`).
- League default hrefs remain `/{nba|wnba|mlb}/matchups`.
- `/games/:espnEventId` is WNBA for nav matching.
- Settings stays a non-functional `aria-label="Settings"` control.
- No new routes, no API changes, no Scores/News/extra destinations, no `localStorage` persistence.
- If working in an isolated worktree, create it via superpowers:using-git-worktrees at execution time.
- Skip git commit steps unless the user explicitly asked to commit.

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/features/home/lib/appNav.ts` | Leagues, logos, section lists, hrefs, active-path helpers |
| `frontend/src/features/home/lib/appNav.test.ts` | Pure unit tests for those helpers |
| `frontend/src/features/home/AppSidebar.tsx` | Logo, Home + chevron, nested league tree, Settings |
| `frontend/src/features/home/AppSidebar.test.tsx` | Sidebar tree / a11y / logos / disabled items |
| `frontend/src/app/layouts/HomeChromeLayout.tsx` | Desktop two-column; mobile bar + drawer; ticker in main column |
| `frontend/src/app/layouts/HomeChromeLayout.test.tsx` | Ticker/footer still work; sidebar/drawer chrome |
| `frontend/src/pages/*.tsx` (listed in Task 5) | Remove `LeagueSubnav` |
| `frontend/src/pages/*.test.tsx` (listed in Task 5) | Drop assertions that required in-page subnav |
| `frontend/src/features/home/HomeNav.tsx` + `.test.tsx` | Delete after unused |
| `frontend/src/features/basketball/league/LeagueSubnav.tsx` + `.test.tsx` | Delete after unused |
| `md/system-design.md` | Chrome description: sidebar not `HomeNav` |

---

### Task 1: `appNav` config

**Files:**
- Create: `frontend/src/features/home/lib/appNav.ts`
- Test: `frontend/src/features/home/lib/appNav.test.ts`

**Interfaces:**
- Consumes: `LeagueSlug` from `@/shared/lib/types`; `nba_logo.png` / `wnba_logo.png` from `@/assets`
- Produces:
  - `NAV_LEAGUES: readonly NavLeague[]`
  - `type NavLeague = { id: LeagueSlug; label: string; icon: string; href: string }`
  - `type NavGroup = "explore" | "learn"`
  - `type NavSection = { label: string; href: string | null; group: NavGroup }`
  - `activeLeagueFromPath(pathname: string): LeagueSlug | null`
  - `sectionHref(league: LeagueSlug, item: string): string | null`
  - `isActiveSection(pathname: string, item: string): boolean`
  - `sectionsFor(league: LeagueSlug): readonly NavSection[]`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/home/lib/appNav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NAV_LEAGUES,
  activeLeagueFromPath,
  isActiveSection,
  sectionHref,
  sectionsFor,
} from "./appNav";

describe("activeLeagueFromPath", () => {
  it("returns null on home", () => {
    expect(activeLeagueFromPath("/")).toBeNull();
  });

  it("matches league prefixes", () => {
    expect(activeLeagueFromPath("/nba/matchups")).toBe("nba");
    expect(activeLeagueFromPath("/wnba/leaders")).toBe("wnba");
    expect(activeLeagueFromPath("/mlb/games/9")).toBe("mlb");
  });

  it("treats /games/:id as WNBA", () => {
    expect(activeLeagueFromPath("/games/401857098")).toBe("wnba");
  });
});

describe("NAV_LEAGUES", () => {
  it("lists NBA, WNBA, MLB with matchups hrefs", () => {
    expect(NAV_LEAGUES.map((l) => l.id)).toEqual(["nba", "wnba", "mlb"]);
    expect(NAV_LEAGUES[0]?.href).toBe("/nba/matchups");
    expect(NAV_LEAGUES[1]?.href).toBe("/wnba/matchups");
    expect(NAV_LEAGUES[2]?.href).toBe("/mlb/matchups");
    expect(NAV_LEAGUES[0]?.icon).toMatch(/nba_logo/);
    expect(NAV_LEAGUES[1]?.icon).toMatch(/wnba_logo/);
    expect(NAV_LEAGUES[2]?.icon).toBe(
      "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
    );
  });
});

describe("sectionHref", () => {
  it("returns live hrefs for WNBA explore + chatbot", () => {
    expect(sectionHref("wnba", "Matchups")).toBe("/wnba/matchups");
    expect(sectionHref("wnba", "Props")).toBe("/wnba/prop_picks");
    expect(sectionHref("wnba", "Leaders")).toBe("/wnba/leaders");
    expect(sectionHref("wnba", "Standings")).toBe("/wnba/standings");
    expect(sectionHref("wnba", "Futures")).toBe("/wnba/futures");
    expect(sectionHref("wnba", "WNBA Chatbot")).toBe("/wnba/chatbot");
    expect(sectionHref("wnba", "EV+")).toBeNull();
    expect(sectionHref("wnba", "Arbitrage")).toBeNull();
  });

  it("disables NBA props/leaders/standings/futures", () => {
    expect(sectionHref("nba", "Matchups")).toBe("/nba/matchups");
    expect(sectionHref("nba", "Props")).toBeNull();
    expect(sectionHref("nba", "Leaders")).toBeNull();
    expect(sectionHref("nba", "Standings")).toBeNull();
    expect(sectionHref("nba", "Futures")).toBeNull();
    expect(sectionHref("nba", "How it works")).toBeNull();
  });
});

describe("isActiveSection", () => {
  it("marks suffixes the same way LeagueSubnav did", () => {
    expect(isActiveSection("/wnba/standings", "Standings")).toBe(true);
    expect(isActiveSection("/wnba/prop_picks", "Props")).toBe(true);
    expect(isActiveSection("/mlb/prop_picks/player/aaron-judge", "Props")).toBe(
      true,
    );
    expect(isActiveSection("/mlb/chatbot", "MLB Chatbot")).toBe(true);
    expect(isActiveSection("/wnba/leaders", "Matchups")).toBe(false);
  });
});

describe("sectionsFor", () => {
  it("includes EV+ and Arbitrage on WNBA/MLB, not NBA", () => {
    const wnba = sectionsFor("wnba").map((s) => s.label);
    expect(wnba).toContain("EV+");
    expect(wnba).toContain("Arbitrage");
    expect(wnba).toContain("WNBA Chatbot");
    expect(wnba).not.toContain("Playoff race");

    const nba = sectionsFor("nba").map((s) => s.label);
    expect(nba).not.toContain("EV+");
    expect(nba).toContain("Playoff race");
    expect(nba).toContain("How it works");
    expect(nba).toContain("Glossary");
  });

  it("tags explore vs learn groups", () => {
    const mlb = sectionsFor("mlb");
    expect(mlb.find((s) => s.label === "Matchups")?.group).toBe("explore");
    expect(mlb.find((s) => s.label === "MLB Chatbot")?.group).toBe("learn");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/home/lib/appNav.test.ts`

Expected: FAIL — `Cannot find module './appNav'` (or similar).

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/features/home/lib/appNav.ts`:

```ts
import nbaLogo from "@/assets/nba_logo.png";
import wnbaLogo from "@/assets/wnba_logo.png";
import type { LeagueSlug } from "@/shared/lib/types";

const MLB_LOGO = "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png";

export type NavGroup = "explore" | "learn";

export type NavSection = {
  label: string;
  href: string | null;
  group: NavGroup;
};

export type NavLeague = {
  id: LeagueSlug;
  label: string;
  icon: string;
  href: string;
};

export const NAV_LEAGUES: readonly NavLeague[] = [
  { id: "nba", label: "NBA", icon: nbaLogo, href: "/nba/matchups" },
  { id: "wnba", label: "WNBA", icon: wnbaLogo, href: "/wnba/matchups" },
  { id: "mlb", label: "MLB", icon: MLB_LOGO, href: "/mlb/matchups" },
];

export function activeLeagueFromPath(pathname: string): LeagueSlug | null {
  if (pathname.startsWith("/nba")) return "nba";
  if (pathname.startsWith("/wnba") || pathname.startsWith("/games/")) {
    return "wnba";
  }
  if (pathname.startsWith("/mlb")) return "mlb";
  return null;
}

export function sectionHref(league: LeagueSlug, item: string): string | null {
  if (item === "Matchups") return `/${league}/matchups`;
  if (item === "Props" && league !== "nba") return `/${league}/prop_picks`;
  if (item === "Leaders" && (league === "wnba" || league === "mlb")) {
    return `/${league}/leaders`;
  }
  if (item === "Standings" && (league === "wnba" || league === "mlb")) {
    return `/${league}/standings`;
  }
  if (item === "Futures" && (league === "wnba" || league === "mlb")) {
    return `/${league}/futures`;
  }
  if (item === "MLB Chatbot") return "/mlb/chatbot";
  if (item === "WNBA Chatbot") return "/wnba/chatbot";
  return null;
}

export function isActiveSection(pathname: string, item: string): boolean {
  if (item === "Matchups") return pathname.endsWith("/matchups");
  if (item === "Props") return pathname.includes("/prop_picks");
  if (item === "Leaders") return pathname.endsWith("/leaders");
  if (item === "Standings") return pathname.endsWith("/standings");
  if (item === "Futures") return pathname.endsWith("/futures");
  if (item === "MLB Chatbot" || item === "WNBA Chatbot") {
    return pathname.endsWith("/chatbot");
  }
  return false;
}

function exploreLabels(league: LeagueSlug): readonly string[] {
  const researchTab = league === "nba" ? "Playoff race" : "Arbitrage";
  const afterProps = league === "nba" ? [] : (["EV+"] as const);
  return [
    "Matchups",
    "Props",
    ...afterProps,
    "Leaders",
    "Standings",
    researchTab,
    "Futures",
  ];
}

function learnLabels(league: LeagueSlug): readonly string[] {
  if (league === "mlb") return ["MLB Chatbot"];
  if (league === "wnba") return ["WNBA Chatbot"];
  return ["How it works", "Glossary"];
}

export function sectionsFor(league: LeagueSlug): readonly NavSection[] {
  return [
    ...exploreLabels(league).map((label) => ({
      label,
      href: sectionHref(league, label),
      group: "explore" as const,
    })),
    ...learnLabels(league).map((label) => ({
      label,
      href: sectionHref(league, label),
      group: "learn" as const,
    })),
  ];
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd frontend && npm test -- src/features/home/lib/appNav.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/home/lib/appNav.ts frontend/src/features/home/lib/appNav.test.ts
git commit -m "Add shared appNav config for sidebar league and section links."
```

---

### Task 2: `AppSidebar` tree

**Files:**
- Create: `frontend/src/features/home/AppSidebar.tsx`
- Test: `frontend/src/features/home/AppSidebar.test.tsx`

**Interfaces:**
- Consumes: `NAV_LEAGUES`, `activeLeagueFromPath`, `isActiveSection`, `sectionsFor` from `./lib/appNav`; `StatvistaBarsMark`; `Link` + `useLocation`; `ChevronDown`, `ChevronUp`, `Settings` from lucide-react
- Produces: `export function AppSidebar(): JSX.Element` — `nav aria-label="Primary"` containing brand link named `statvista`, Home link to `/`, league logo links, nested sections for the active league only, Settings button

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/home/AppSidebar.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

function renderSidebar(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar />
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  it("labels primary nav, links Home to /, and keeps Settings", () => {
    renderSidebar("/");
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("points league links at matchups hubs with official logos", () => {
    renderSidebar("/");
    expect(screen.getByRole("link", { name: "NBA" })).toHaveAttribute(
      "href",
      "/nba/matchups",
    );
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.getByRole("link", { name: "MLB" })).toHaveAttribute(
      "href",
      "/mlb/matchups",
    );
    const images = document.querySelectorAll('nav img[aria-hidden="true"]');
    expect(images).toHaveLength(3);
    expect(images[0]?.getAttribute("src")).toMatch(/nba_logo/);
    expect(images[1]?.getAttribute("src")).toMatch(/wnba_logo/);
    expect(images[2]?.getAttribute("src")).toBe(
      "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
    );
  });

  it("does not nest sections on home", () => {
    renderSidebar("/");
    expect(screen.queryByRole("link", { name: "Matchups" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WNBA" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("nests WNBA sections only under WNBA and marks the current section", () => {
    renderSidebar("/wnba/standings");
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "NBA" })).not.toHaveAttribute(
      "aria-current",
    );
    const standings = screen.getByRole("link", { name: "Standings" });
    expect(standings).toHaveAttribute("href", "/wnba/standings");
    expect(standings).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Matchups" })).toHaveAttribute(
      "href",
      "/wnba/matchups",
    );
    expect(screen.queryByRole("link", { name: "MLB Chatbot" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WNBA Chatbot" })).toHaveAttribute(
      "href",
      "/wnba/chatbot",
    );
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Learn")).toBeInTheDocument();
  });

  it("treats /games/:id as WNBA and does not add a game row", () => {
    renderSidebar("/games/401857098");
    expect(screen.getByRole("link", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Matchups" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Game" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps NBA placeholder items disabled and omits EV+", () => {
    renderSidebar("/nba/matchups");
    expect(screen.getByRole("button", { name: "Leaders" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Props" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Playoff race" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "EV+" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arbitrage" })).not.toBeInTheDocument();
  });

  it("collapses leagues when the Home chevron is toggled", async () => {
    const user = userEvent.setup();
    renderSidebar("/mlb/leaders");
    expect(screen.getByRole("link", { name: "MLB" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leaders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const toggle = screen.getByRole("button", { name: "Toggle leagues" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "MLB" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leaders" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/home/AppSidebar.test.tsx`

Expected: FAIL — `Cannot find module './AppSidebar'`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/features/home/AppSidebar.tsx`:

```tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import { StatvistaBarsMark } from "@/shared/ui/StatvistaBarsMark";
import {
  NAV_LEAGUES,
  activeLeagueFromPath,
  isActiveSection,
  sectionsFor,
} from "./lib/appNav";

function rowClass(active: boolean, enabled: boolean): string {
  if (!enabled) {
    return "flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[14px] font-medium text-white/25";
  }
  if (active) {
    return "flex w-full items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline";
  }
  return "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] font-medium text-white no-underline transition-colors hover:bg-white/5";
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const [leaguesOpen, setLeaguesOpen] = useState(true);
  const activeLeague = activeLeagueFromPath(pathname);
  const homeActive = pathname === "/";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background px-3 py-4">
      <Link
        to="/"
        className="mb-4 flex items-center gap-2 px-1 text-white no-underline"
      >
        <StatvistaBarsMark />
        <span className="text-[18px] font-semibold tracking-tight">
          statvista
        </span>
      </Link>

      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="flex items-center gap-1">
          <Link
            to="/"
            aria-current={homeActive ? "page" : undefined}
            className={`flex-1 ${rowClass(homeActive, true)}`}
          >
            Home
          </Link>
          <button
            type="button"
            aria-label="Toggle leagues"
            aria-expanded={leaguesOpen}
            onClick={() => setLeaguesOpen((open) => !open)}
            className="rounded-md p-1.5 text-white transition-colors hover:bg-white/5"
          >
            {leaguesOpen ? (
              <ChevronUp className="size-3.5 opacity-70" aria-hidden strokeWidth={1.75} />
            ) : (
              <ChevronDown className="size-3.5 opacity-70" aria-hidden strokeWidth={1.75} />
            )}
          </button>
        </div>

        {leaguesOpen
          ? NAV_LEAGUES.map((league) => {
              const leagueActive = activeLeague === league.id;
              const sections = leagueActive ? sectionsFor(league.id) : [];
              const explore = sections.filter((s) => s.group === "explore");
              const learn = sections.filter((s) => s.group === "learn");
              return (
                <div key={league.id} className="mt-0.5">
                  <Link
                    to={league.href}
                    aria-current={leagueActive ? "page" : undefined}
                    className={rowClass(leagueActive, true)}
                  >
                    <img
                      src={league.icon}
                      alt=""
                      aria-hidden
                      className="size-5 shrink-0 object-contain"
                    />
                    {league.label}
                  </Link>
                  {explore.length > 0 ? (
                    <div className="mt-1 ml-4">
                      <p className="px-2.5 pb-1 text-[10px] font-medium tracking-[0.14em] text-white/35 uppercase">
                        Explore
                      </p>
                      {explore.map((item) =>
                        item.href ? (
                          <Link
                            key={item.label}
                            to={item.href}
                            aria-current={
                              isActiveSection(pathname, item.label)
                                ? "page"
                                : undefined
                            }
                            className={rowClass(
                              isActiveSection(pathname, item.label),
                              true,
                            )}
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <button
                            key={item.label}
                            type="button"
                            disabled
                            className={rowClass(false, false)}
                          >
                            {item.label}
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                  {learn.length > 0 ? (
                    <div className="mt-2 ml-4 border-t border-white/10 pt-2">
                      <p className="px-2.5 pb-1 text-[10px] font-medium tracking-[0.14em] text-white/35 uppercase">
                        Learn
                      </p>
                      {learn.map((item) =>
                        item.href ? (
                          <Link
                            key={item.label}
                            to={item.href}
                            aria-current={
                              isActiveSection(pathname, item.label)
                                ? "page"
                                : undefined
                            }
                            className={rowClass(
                              isActiveSection(pathname, item.label),
                              true,
                            )}
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <button
                            key={item.label}
                            type="button"
                            disabled
                            className={rowClass(false, false)}
                          >
                            {item.label}
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
      </nav>

      <button
        type="button"
        aria-label="Settings"
        className="mt-3 rounded-md p-1.5 text-white transition-colors hover:bg-white/5"
      >
        <Settings className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd frontend && npm test -- src/features/home/AppSidebar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/home/AppSidebar.tsx frontend/src/features/home/AppSidebar.test.tsx
git commit -m "Add AppSidebar tree with Home, league logos, and nested sections."
```

---

### Task 3: Desktop two-column chrome

**Files:**
- Modify: `frontend/src/app/layouts/HomeChromeLayout.tsx`
- Modify: `frontend/src/app/layouts/HomeChromeLayout.test.tsx`

**Interfaces:**
- Consumes: `AppSidebar` from `@/features/home/AppSidebar`
- Produces: layout is `sm:flex-row`; desktop sidebar column `hidden sm:flex w-60 shrink-0 self-stretch border-r border-white/10`; ticker lives in the flex-1 column **after** the sidebar, not above it; `HomeNav` is no longer rendered

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/app/layouts/HomeChromeLayout.test.tsx` (keep the existing ticker/footer test):

```tsx
  it("puts a primary sidebar beside the ticker, not HomeNav", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^leagues$/i }),
    ).not.toBeInTheDocument();

    const sidebar = screen.getByRole("navigation", { name: "Primary" }).closest(
      "aside",
    );
    expect(sidebar).toHaveClass("hidden", "sm:flex", "w-60");
    const root = container.firstElementChild;
    expect(root).toHaveClass("sm:flex-row");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/app/layouts/HomeChromeLayout.test.tsx`

Expected: FAIL — no `aside` / still has Leagues dropdown from `HomeNav`.

- [ ] **Step 3: Write minimal implementation**

Replace `frontend/src/app/layouts/HomeChromeLayout.tsx` with:

```tsx
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/features/home/AppSidebar";
import { LiveTicker } from "@/features/home/LiveTicker";
import { mergeLeagueScoreboards } from "@/features/home/lib/mergeLeagueScoreboards";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { useMlbScoreboard } from "@/features/mlb/hooks/useMlbScoreboard";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";

export function HomeChromeLayout() {
  const wnba = useWnbaScoreboard();
  const mlb = useMlbScoreboard();
  const { tickerGames, hasNeverLoaded } = mergeLeagueScoreboards([wnba, mlb]);
  return (
    <div className="flex min-h-screen flex-col bg-background text-white sm:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col self-stretch border-r border-white/10 sm:flex">
        <AppSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <LiveTicker games={tickerGames} isError={hasNeverLoaded} />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
```

Leave `HomeNav.tsx` in the tree for now (deleted in Task 6). It is simply unused.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd frontend && npm test -- src/app/layouts/HomeChromeLayout.test.tsx`

Expected: PASS (ticker + footer test still passes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/layouts/HomeChromeLayout.tsx frontend/src/app/layouts/HomeChromeLayout.test.tsx
git commit -m "Move chrome to a desktop sidebar with ticker in the content column."
```

---

### Task 4: Mobile hamburger drawer

**Files:**
- Modify: `frontend/src/app/layouts/HomeChromeLayout.tsx`
- Modify: `frontend/src/app/layouts/HomeChromeLayout.test.tsx`

**Interfaces:**
- Consumes: `AppSidebar`; `useLocation` to close the drawer on `pathname` change
- Produces: below `sm`, a header with `Open menu` + brand link; drawer `id="app-sidebar-drawer"` containing `AppSidebar`; backdrop `Close menu`; Escape closes; desktop `aside` unchanged

- [ ] **Step 1: Write the failing tests**

Append to `HomeChromeLayout.test.tsx`:

```tsx
  it("opens a mobile drawer from the hamburger and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/wnba/matchups"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/wnba/matchups" element={<div>matchups</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const bar = screen.getByRole("banner");
    expect(bar).toHaveClass("sm:hidden");
    expect(within(bar).getByRole("link", { name: "statvista" })).toHaveAttribute(
      "href",
      "/",
    );

    const open = screen.getByRole("button", { name: "Open menu" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();

    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    const drawer = document.getElementById("app-sidebar-drawer");
    expect(drawer).toBeTruthy();
    expect(within(drawer!).getByRole("link", { name: "WNBA" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer after navigating a sidebar link", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomeChromeLayout />}>
            <Route path="/" element={<div>home</div>} />
            <Route path="/wnba/matchups" element={<div>matchups</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("app-sidebar-drawer");
    await user.click(within(drawer!).getByRole("link", { name: "WNBA" }));
    expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
    expect(screen.getByText("matchups")).toBeInTheDocument();
  });
```

At the top of `HomeChromeLayout.test.tsx`, change the Testing Library import to `import { render, screen, within } from "@testing-library/react";` and add `import userEvent from "@testing-library/user-event";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/app/layouts/HomeChromeLayout.test.tsx`

Expected: FAIL — no `banner` / `Open menu`.

- [ ] **Step 3: Write minimal implementation**

Replace `HomeChromeLayout.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/features/home/AppSidebar";
import { LiveTicker } from "@/features/home/LiveTicker";
import { mergeLeagueScoreboards } from "@/features/home/lib/mergeLeagueScoreboards";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { StatvistaBarsMark } from "@/shared/ui/StatvistaBarsMark";
import { useMlbScoreboard } from "@/features/mlb/hooks/useMlbScoreboard";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";

export function HomeChromeLayout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wnba = useWnbaScoreboard();
  const mlb = useMlbScoreboard();
  const { tickerGames, hasNeverLoaded } = mergeLeagueScoreboards([wnba, mlb]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-white sm:flex-row">
      <header className="flex h-12 items-center gap-3 border-b border-white/10 px-4 sm:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar-drawer"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-1.5 text-white hover:bg-white/5"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
        <Link to="/" className="flex items-center gap-2 text-white no-underline">
          <StatvistaBarsMark />
          <span className="text-[18px] font-semibold tracking-tight">
            statvista
          </span>
        </Link>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col self-stretch border-r border-white/10 sm:flex">
        <AppSidebar />
      </aside>

      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/60 sm:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="app-sidebar-drawer"
            className="fixed inset-y-0 left-0 z-50 w-60 border-r border-white/10 bg-background sm:hidden"
          >
            <AppSidebar />
          </div>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <LiveTicker games={tickerGames} isError={hasNeverLoaded} />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
```

Note: with the drawer closed, `getByRole("link", { name: "statvista" })` is the header brand. With it open there are two (header + sidebar); the first test queries it before opening.

Desktop Task 3 test still finds Primary nav on the `aside` (jsdom does not hide `hidden sm:flex`). The mobile drawer is a second `AppSidebar` only when open.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd frontend && npm test -- src/app/layouts/HomeChromeLayout.test.tsx src/features/home/AppSidebar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/layouts/HomeChromeLayout.tsx frontend/src/app/layouts/HomeChromeLayout.test.tsx
git commit -m "Add mobile hamburger drawer for the app sidebar."
```

---

### Task 5: Remove `LeagueSubnav` from pages

**Files:**
- Modify: `frontend/src/pages/LeagueMatchupsPage.tsx` (three usages)
- Modify: `frontend/src/pages/LeaguePropPicksPage.tsx`
- Modify: `frontend/src/pages/WnbaPlayerPropsPage.tsx`
- Modify: `frontend/src/pages/LeagueLeadersPage.tsx`
- Modify: `frontend/src/pages/LeagueStandingsPage.tsx`
- Modify: `frontend/src/pages/LeagueFuturesPage.tsx`
- Modify: `frontend/src/pages/LeagueChatbotPage.tsx`
- Modify: `frontend/src/pages/LeaguePlayerPage.tsx`
- Modify: `frontend/src/pages/MlbPropPicksPage.tsx`
- Modify: `frontend/src/pages/MlbLeadersPage.tsx`
- Modify: `frontend/src/pages/MlbStandingsPage.tsx`
- Modify: `frontend/src/pages/MlbFuturesPage.tsx`
- Modify: `frontend/src/pages/LeagueStandingsPage.test.tsx`
- Modify: `frontend/src/pages/LeagueLeadersPage.test.tsx`
- Modify: `frontend/src/pages/LeagueFuturesPage.test.tsx`
- Modify: `frontend/src/pages/LeaguePlayerPage.test.tsx`
- Modify: `frontend/src/pages/MlbFuturesPage.test.tsx`

**Interfaces:**
- Consumes: none (pages no longer import nav)
- Produces: pages render hero/body only; section `aria-current` is owned by `AppSidebar` in chrome. `AppRouter.test.tsx` already wraps `HomeChromeLayout`, so its Standings / Futures / Chatbot link assertions keep working.

- [ ] **Step 1: Write the failing tests (page tests no longer require in-page subnav)**

In each of these files, **delete** the nav assertions (keep data/header assertions):

`LeagueStandingsPage.test.tsx` — remove:

```tsx
    expect(screen.getByRole("link", { name: "Standings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
```

`LeagueLeadersPage.test.tsx` — remove:

```tsx
    expect(screen.getByRole("link", { name: "Leaders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
```

`LeagueFuturesPage.test.tsx` — remove:

```tsx
    expect(screen.getByRole("link", { name: "Futures" })).toHaveAttribute(
      "aria-current",
      "page",
    );
```

`LeaguePlayerPage.test.tsx` — remove:

```tsx
    expect(screen.getByRole("link", { name: "Leaders" })).toBeInTheDocument();
```

`MlbFuturesPage.test.tsx` — remove the two Futures-link expects; keep heading, board, and World Series tab asserts. Rename the test to `renders header, board, and World Series tab` if the name mentions subnav.

- [ ] **Step 2: Run tests to verify they fail or would fail after JSX removal**

Run: `cd frontend && npm test -- src/pages/LeagueStandingsPage.test.tsx src/pages/LeagueLeadersPage.test.tsx src/pages/LeagueFuturesPage.test.tsx src/pages/LeaguePlayerPage.test.tsx src/pages/MlbFuturesPage.test.tsx`

Expected: PASS after assertion removal (pages still have `LeagueSubnav` until Step 3). This step locks the new contract: page tests do not own nav.

- [ ] **Step 3: Remove `LeagueSubnav` from pages**

In every page listed above:

1. Delete `import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";`
2. Delete the `<LeagueSubnav league="…" />` / `<LeagueSubnav league={league} />` JSX line.

`LeagueMatchupsPage.tsx` has three: NBA placeholder, `WnbaMatchupsPage`, `MlbMatchupsPage`.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test -- src/pages src/app/AppRouter.test.tsx src/app/layouts/HomeChromeLayout.test.tsx`

Expected: PASS. `AppRouter.test.tsx` still finds Standings / Futures / Chatbot links because it renders `HomeChromeLayout`.

If any other test fails looking for `LeagueSubnav` or a sections dropdown, remove that assertion the same way (nav lives in chrome).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages
git commit -m "Stop rendering LeagueSubnav on league pages now that chrome owns nav."
```

---

### Task 6: Delete old nav, update docs, full test run

**Files:**
- Delete: `frontend/src/features/home/HomeNav.tsx`
- Delete: `frontend/src/features/home/HomeNav.test.tsx`
- Delete: `frontend/src/features/basketball/league/LeagueSubnav.tsx`
- Delete: `frontend/src/features/basketball/league/LeagueSubnav.test.tsx`
- Modify: `md/system-design.md` (chrome sentences)
- Modify: `frontend/src/shared/ui/StatvistaBarsMark.tsx` (comment that names HomeNav)

**Interfaces:**
- Consumes: Task 3–5 (nothing imports `HomeNav` / `LeagueSubnav`)
- Produces: docs match the new shell

- [ ] **Step 1: Write the failing doc/comment check by editing the expected chrome text first**

In `md/system-design.md`:

- Line ~43: change `Shared chrome (\`HomeChromeLayout\`) wraps most routes with nav, live ticker, and footer.` to `Shared chrome (\`HomeChromeLayout\`) wraps most routes with a left sidebar (mobile hamburger drawer), live ticker in the content column, and footer.`
- Line ~68: change `HomeChromeLayout (HomeNav + LiveTicker + SiteFooter)` to `HomeChromeLayout (AppSidebar + LiveTicker + SiteFooter)`

In `StatvistaBarsMark.tsx`, change the comment from `same geometry as next to “statvista” in HomeNav` to `same geometry as next to “statvista” in the app sidebar`.

- [ ] **Step 2: Delete unused nav files**

Delete the four files listed above. Grep the repo for `HomeNav` and `LeagueSubnav` (except this plan/spec) and fix any leftover imports.

- [ ] **Step 3: Run the full frontend test suite**

Run: `cd frontend && npm test`

Expected: PASS. `HomeNav.test.tsx` / `LeagueSubnav.test.tsx` no longer exist; coverage lives in `appNav.test.ts`, `AppSidebar.test.tsx`, and `HomeChromeLayout.test.tsx`.

- [ ] **Step 4: Commit**

```bash
git add md/system-design.md frontend/src/shared/ui/StatvistaBarsMark.tsx
git add -u frontend/src/features/home/HomeNav.tsx frontend/src/features/home/HomeNav.test.tsx frontend/src/features/basketball/league/LeagueSubnav.tsx frontend/src/features/basketball/league/LeagueSubnav.test.tsx
git commit -m "Remove HomeNav and LeagueSubnav; document sidebar chrome."
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Shared `appNav` config; same hrefs as `LeagueSubnav` | 1 |
| Official logos; Home `/` + chevron; nested sections only under active league | 2 |
| Explore/Learn labels; disabled placeholders; Settings at bottom | 2 |
| `/games/:id` → WNBA; no extra game row | 1 + 2 |
| Desktop two-column; ticker in content column; no top `HomeNav` | 3 |
| Mobile hamburger + drawer; close Escape/backdrop/navigate | 4 |
| Remove `LeagueSubnav` from all listed pages | 5 |
| Delete old components; `md/system-design.md` | 6 |
| No new routes / APIs / Statmuse extra items | all (omitted) |
