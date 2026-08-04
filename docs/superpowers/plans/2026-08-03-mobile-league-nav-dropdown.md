# Mobile League Nav Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile viewports, expose NBA / WNBA / MLB in `HomeNav` via a compact dropdown beside About; keep the desktop horizontal league links unchanged.

**Architecture:** Extend `HomeNav` with a mobile-only custom dropdown (toggle + Escape + outside click), matching the prop-picks filter menu pattern. No new shared UI primitive. Desktop league row stays `hidden sm:flex`; dropdown wrapper is `sm:hidden`.

**Tech Stack:** React, React Router (`Link`, `useLocation`), lucide-react (`ChevronDown`), Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-03-mobile-league-nav-dropdown-design.md`

## Global Constraints

- Product name remains **statvista** in UI copy.
- League destinations remain `/{league}/matchups` (nba | wnba | mlb).
- Do not change About or Settings behavior.
- Do not extract a shared Dropdown component.
- Commits only if the user explicitly requests them (skip Step commit otherwise).

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/components/home/HomeNav.tsx` | Desktop league links + mobile league dropdown |
| `frontend/src/components/home/HomeNav.test.tsx` | Nav / dropdown behavior coverage |

---

### Task 1: Failing tests for mobile league dropdown

**Files:**
- Modify: `frontend/src/components/home/HomeNav.test.tsx`
- Test: `frontend/src/components/home/HomeNav.test.tsx`

**Interfaces:**
- Consumes: existing `HomeNav` export
- Produces: failing assertions that drive Task 2

- [ ] **Step 1: Update the existing mobile-hiding test and add dropdown tests**

Replace the first test and append new cases. Keep About / desktop link tests intact.

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HomeNav } from "./HomeNav";

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HomeNav />
    </MemoryRouter>,
  );
}

describe("HomeNav", () => {
  it("labels the primary nav and hides desktop league links on mobile", () => {
    renderNav("/");

    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NBA" }).parentElement).toHaveClass(
      "hidden",
      "sm:flex",
    );
    expect(
      screen.getByRole("button", { name: /league/i }).parentElement,
    ).toHaveClass("sm:hidden");
    expect(screen.getByRole("link", { name: "About" }).parentElement).not.toHaveClass(
      "hidden",
    );
  });

  // ... keep existing About / desktop league link / logo tests ...

  it("shows League trigger on home and opens matchups links", async () => {
    const user = userEvent.setup();
    renderNav("/");

    const trigger = screen.getByRole("button", { name: /^league$/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const menu = screen.getByRole("menu", { name: "Leagues" });
    expect(menu).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "NBA" }),
    ).toHaveAttribute("href", "/nba/matchups");
    expect(
      screen.getByRole("menuitem", { name: "WNBA" }),
    ).toHaveAttribute("href", "/wnba/matchups");
    expect(
      screen.getByRole("menuitem", { name: "MLB" }),
    ).toHaveAttribute("href", "/mlb/matchups");
  });

  it("shows current league on the mobile trigger and marks it in the menu", async () => {
    const user = userEvent.setup();
    renderNav("/wnba/matchups");

    const trigger = screen.getByRole("button", { name: /wnba/i });
    await user.click(trigger);

    expect(screen.getByRole("menuitem", { name: "WNBA" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("menuitem", { name: "NBA" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("closes the league menu on Escape", async () => {
    const user = userEvent.setup();
    renderNav("/");

    await user.click(screen.getByRole("button", { name: /^league$/i }));
    expect(screen.getByRole("menu", { name: "Leagues" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Leagues" })).not.toBeInTheDocument();
  });
});
```

Note: desktop tests still use `getByRole("link", { name: "NBA" })` etc. Mobile menu items use `menuitem`. When the menu is closed, only the desktop (hidden) links exist in the DOM — that is fine for Testing Library queries that do not care about visibility CSS.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend && npx vitest run src/components/home/HomeNav.test.tsx
```

Expected: FAIL — no league dropdown button / menu roles yet.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add frontend/src/components/home/HomeNav.test.tsx
git commit -m "test: cover mobile league nav dropdown"
```

---

### Task 2: Implement mobile league dropdown in HomeNav

**Files:**
- Modify: `frontend/src/components/home/HomeNav.tsx`
- Test: `frontend/src/components/home/HomeNav.test.tsx`

**Interfaces:**
- Consumes: `leagues` const already in `HomeNav.tsx`
- Produces: mobile dropdown with trigger + menu as specified

- [ ] **Step 1: Implement dropdown**

Update `HomeNav.tsx` to:

```tsx
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, ChevronDown, Settings } from "lucide-react";
import nbaLogo from "@/assets/nba_logo.png";
import wnbaLogo from "@/assets/wnba_logo.png";

const MLB_LOGO =
  "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png";

const leagues = [
  { id: "nba", label: "NBA", icon: nbaLogo },
  { id: "wnba", label: "WNBA", icon: wnbaLogo },
  { id: "mlb", label: "MLB", icon: MLB_LOGO },
] as const;

export function HomeNav() {
  const { pathname } = useLocation();
  const aboutActive = pathname === "/about";
  const activeLeague =
    leagues.find((league) => pathname.startsWith(`/${league.id}`)) ?? null;

  const [leagueOpen, setLeagueOpen] = useState(false);
  const leagueMenuId = useId();
  const leagueRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leagueOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!leagueRootRef.current?.contains(event.target as Node)) {
        setLeagueOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLeagueOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [leagueOpen]);

  return (
    <header className="border-b border-white/10 bg-black">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-white no-underline">
          <BarChart3 className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
          <span className="text-[17px] font-semibold tracking-tight">
            statvista
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-3" aria-label="Primary">
            <div className="hidden items-center gap-1 sm:flex">
              {leagues.map((league) => {
                const active = pathname.startsWith(`/${league.id}`);
                return (
                  <Link
                    key={league.id}
                    to={`/${league.id}/matchups`}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-[14px] font-medium text-white no-underline"
                        : "flex items-center gap-2 rounded-md px-3 py-1 text-[14px] font-medium text-white/55 no-underline transition-colors hover:text-white"
                    }
                  >
                    <img
                      src={league.icon}
                      alt=""
                      aria-hidden
                      className="size-5 shrink-0 object-contain"
                    />
                    {league.label}
                  </Link>
                );
              })}
            </div>

            <div ref={leagueRootRef} className="relative sm:hidden">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={leagueOpen}
                aria-controls={leagueMenuId}
                onClick={() => setLeagueOpen((open) => !open)}
                className={
                  activeLeague
                    ? "inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[14px] font-medium text-white"
                    : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[14px] font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-white"
                }
              >
                {activeLeague ? (
                  <>
                    <img
                      src={activeLeague.icon}
                      alt=""
                      aria-hidden
                      className="size-5 shrink-0 object-contain"
                    />
                    {activeLeague.label}
                  </>
                ) : (
                  "League"
                )}
                <ChevronDown
                  className="size-3.5 opacity-70"
                  aria-hidden
                  strokeWidth={1.75}
                />
              </button>
              {leagueOpen ? (
                <ul
                  id={leagueMenuId}
                  role="menu"
                  aria-label="Leagues"
                  className="absolute top-full right-0 z-20 mt-1.5 min-w-[9rem] rounded-lg border border-white/10 bg-black py-0.5"
                >
                  {leagues.map((league) => {
                    const active = pathname.startsWith(`/${league.id}`);
                    return (
                      <li key={league.id} role="none">
                        <Link
                          role="menuitem"
                          to={`/${league.id}/matchups`}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setLeagueOpen(false)}
                          className={
                            active
                              ? "flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium text-white no-underline bg-white/10"
                              : "flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium text-white/70 no-underline hover:bg-white/5 hover:text-white"
                          }
                        >
                          <img
                            src={league.icon}
                            alt=""
                            aria-hidden
                            className="size-5 shrink-0 object-contain"
                          />
                          {league.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <Link
              to="/about"
              aria-current={aboutActive ? "page" : undefined}
              className={
                aboutActive
                  ? "rounded-md bg-white/10 px-2.5 py-1 text-[14px] font-medium text-white no-underline"
                  : "rounded-md px-2.5 py-1 text-[14px] font-medium text-white/55 no-underline transition-colors hover:bg-white/5 hover:text-white"
              }
            >
              About
            </Link>
          </nav>

          <button
            type="button"
            aria-label="Settings"
            className="rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
```

Accessible name notes:
- Neutral trigger text is `League` → button name `/^league$/i`.
- Active trigger includes logo (decorative) + label → name matches `/wnba/i` etc. Chevron is aria-hidden.

- [ ] **Step 2: Run tests to verify they pass**

Run:

```bash
cd frontend && npx vitest run src/components/home/HomeNav.test.tsx
```

Expected: PASS (all HomeNav tests).

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add frontend/src/components/home/HomeNav.tsx frontend/src/components/home/HomeNav.test.tsx
git commit -m "feat: add mobile league dropdown to HomeNav"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Mobile dropdown before About | Task 2 |
| Desktop links unchanged (`hidden sm:flex`) | Task 2 |
| Dropdown `sm:hidden` | Task 2 |
| Trigger shows current league or “League” | Task 2 |
| Menu links to matchups hubs + logos | Task 2 |
| Escape / outside click close | Task 2 |
| Tests for trigger, menu, Escape, breakpoints | Task 1 |
