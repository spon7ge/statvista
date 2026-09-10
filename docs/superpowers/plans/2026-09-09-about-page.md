# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static `/about` page under shared chrome with product intro, what-you-can-do, tech stack, and data sources, and wire the sidebar About control to that route.

**Architecture:** Thin `AboutPage` composes `AboutContent` (static copy, no API). Route nests under `HomeChromeLayout`. Sidebar About becomes a `Link` to `/about` with `aria-current` when active. Match Legs/Arbitrage chrome title row; no league pills, no cards, no hero.

**Tech Stack:** React 19, React Router, Vitest + Testing Library, existing `CHROME_*` layout tokens / `ui.css` chrome classes.

## Global Constraints

- Brand name in user-facing copy: **statvista** (never HoopVista / hoopvista)
- Static page only — no backend route, no CMS, no fetch
- Visual: match Props/Legs/Games chrome; no marketing hero; no cards
- Blog and Settings stay inert buttons
- External source links: `target="_blank"` and `rel="noopener noreferrer"`
- Spec: `docs/superpowers/specs/2026-09-09-about-page-design.md`
- Prefer not to invent new CSS tokens; reuse existing type/spacing classes

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/features/about/AboutContent.tsx` | Static sections + copy |
| `frontend/src/features/about/AboutContent.test.tsx` | Content presence tests |
| `frontend/src/pages/AboutPage.tsx` | Thin chrome wrapper around `AboutContent` |
| `frontend/src/app/AppRouter.tsx` | Register `/about` |
| `frontend/src/app/AppRouter.test.tsx` | `/about` renders About (not 404) |
| `frontend/src/features/home/AppSidebar.tsx` | About → `Link` |
| `frontend/src/features/home/AppSidebar.test.tsx` | About link + aria-current |
| `md/system-design.md` | Add `/about` to page ↔ API table |

---

### Task 1: AboutContent (static copy)

**Files:**
- Create: `frontend/src/features/about/AboutContent.test.tsx`
- Create: `frontend/src/features/about/AboutContent.tsx`
- Test: `frontend/src/features/about/AboutContent.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: `export function AboutContent(): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AboutContent } from "./AboutContent";

describe("AboutContent", () => {
  it("renders product intro, sections, and data source links", () => {
    render(<AboutContent />);
    expect(screen.getByText(/statvista/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /what you can do/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tech stack/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /data sources/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/props/i)).toBeInTheDocument();
    expect(screen.getByText(/legs/i)).toBeInTheDocument();
    expect(screen.getByText(/games/i)).toBeInTheDocument();
    expect(screen.getByText(/react 19/i)).toBeInTheDocument();
    const espn = screen.getByRole("link", { name: /espn/i });
    expect(espn).toHaveAttribute("href", "https://www.espn.com/");
    expect(espn).toHaveAttribute("target", "_blank");
    expect(espn).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: /mlb stats api/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rotowire/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/features/about/AboutContent.test.tsx`

Expected: FAIL (module or `AboutContent` not found)

- [ ] **Step 3: Implement AboutContent**

Create `frontend/src/features/about/AboutContent.tsx`:

```tsx
const DATA_SOURCES: { name: string; href: string; usedFor: string }[] = [
  {
    name: "ESPN",
    href: "https://www.espn.com/",
    usedFor:
      "WNBA scoreboard, standings, game summary / win probability; MLB win-probability bridge",
  },
  {
    name: "stats.wnba.com",
    href: "https://stats.wnba.com/",
    usedFor: "Season leaders, player bio / averages / gamelog",
  },
  {
    name: "MLB Stats API",
    href: "https://statsapi.mlb.com/",
    usedFor: "MLB scoreboard and live/final game feeds",
  },
  {
    name: "ParlayAPI / Sharp",
    href: "https://www.espn.com/",
    usedFor: "Sportsbook odds (spreads, totals, player props)",
  },
  {
    name: "RotoWire",
    href: "https://www.rotowire.com/",
    usedFor: "Projected starters / lineups",
  },
];
```

**Do not** invent a public marketing URL for ParlayAPI/Sharp if none is used in README — for that row either:

- use a plain `<span>` for the name (not a link), or
- link only sources that have stable public URLs in the README (ESPN, stats.wnba.com, MLB Stats API, RotoWire) and list ParlayAPI / Sharp and Supabase as text rows without `href`.

Prefer text rows without fake `href` for ParlayAPI / Sharp and Supabase (Postgres). Update the test accordingly: assert ESPN / MLB Stats API / RotoWire links; assert text for ParlayAPI and Supabase.

Full component body (structure):

```tsx
export function AboutContent() {
  return (
    <div className="max-w-3xl space-y-10 text-[16px] leading-relaxed text-c3">
      <div className="space-y-4">
        <p>
          <strong className="text-c3">statvista</strong> is a research site for
          MLB and WNBA player props and games. Compare DFS lines to sportsbooks
          in one place.
        </p>
        <p>
          Educational and research use only — not a tipster feed and not a
          betting ticket. Sports betting involves risk. Gamble responsibly.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="about-what">
        <h2 id="about-what" className="font-display text-[20px] text-c3">
          What you can do
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Props</strong> — DFS-anchored player lines next to
            sportsbook odds
          </li>
          <li>
            <strong>Legs</strong> — priced PrizePicks / Underdog entry
            shortlists
          </li>
          <li>
            <strong>Games</strong> — dated slates and game centers
          </li>
        </ul>
        <p className="text-[14px] text-c3/80">
          Arbitrage is a shell (not wired yet). NBA is a placeholder.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="about-stack">
        <h2 id="about-stack" className="font-display text-[20px] text-c3">
          Tech stack
        </h2>
        <p>
          React 19, Vite, TanStack Query, Tailwind · FastAPI + Pydantic ·
          Postgres (Supabase or local)
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="about-sources">
        <h2 id="about-sources" className="font-display text-[20px] text-c3">
          Data sources
        </h2>
        <ul className="space-y-3">
          {/* linked rows for ESPN, stats.wnba.com, MLB Stats API, RotoWire */}
          {/* plain text rows for ParlayAPI / Sharp and Supabase (Postgres) */}
        </ul>
      </section>
    </div>
  );
}
```

Adjust `text-c3/80` if the project bans alpha variants beyond the allowed 10%/40% — if so use `text-c3` only.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/features/about/AboutContent.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit** (only if the user asked for commits; otherwise skip)

```bash
git add frontend/src/features/about/AboutContent.tsx frontend/src/features/about/AboutContent.test.tsx
git commit -m "$(cat <<'EOF'
Add static AboutContent with product, stack, and data sources.

EOF
)"
```

---

### Task 2: AboutPage + router

**Files:**
- Create: `frontend/src/pages/AboutPage.tsx`
- Modify: `frontend/src/app/AppRouter.tsx`
- Modify: `frontend/src/app/AppRouter.test.tsx`
- Test: `frontend/src/app/AppRouter.test.tsx`

**Interfaces:**
- Consumes: `AboutContent` from `@/features/about/AboutContent`
- Consumes: `CHROME_PAGE_X`, `CHROME_TITLE_TOP` from `@/app/layouts/chrome`
- Produces: `export function AboutPage(): JSX.Element`; route `/about`

- [ ] **Step 1: Write the failing router test**

Replace the existing `/about` not-found test in `AppRouter.test.tsx` with:

```tsx
  it("renders About at /about", () => {
    renderWithProviders(["/about"]);
    expect(
      screen.getByRole("heading", { name: /^about$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /what you can do/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /page not found/i }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/app/AppRouter.test.tsx -t "renders About at /about"`

Expected: FAIL (still Not Found, or missing About heading)

- [ ] **Step 3: Add AboutPage and route**

`frontend/src/pages/AboutPage.tsx`:

```tsx
import { CHROME_PAGE_X, CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { AboutContent } from "@/features/about/AboutContent";

export function AboutPage() {
  return (
    <div className="space-y-0 pb-8">
      <section className={`max-w-6xl space-y-6 pb-16 sm:pb-20 ${CHROME_PAGE_X}`}>
        <div
          data-testid="about-header"
          className={`relative z-20 flex flex-col gap-4 ${CHROME_TITLE_TOP}`}
        >
          <div className="chrome-title-row">
            <h1 className="chrome-title">About</h1>
          </div>
        </div>
        <AboutContent />
      </section>
    </div>
  );
}
```

In `AppRouter.tsx`, import `AboutPage` and add inside the `HomeChromeLayout` route group (before the closing `</Route>` of that group):

```tsx
        <Route path="/about" element={<AboutPage />} />
```

Keep `/about` **inside** chrome, not beside `NotFoundPage`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/app/AppRouter.test.tsx src/features/about/AboutContent.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit** (only if requested)

```bash
git add frontend/src/pages/AboutPage.tsx frontend/src/app/AppRouter.tsx frontend/src/app/AppRouter.test.tsx
git commit -m "$(cat <<'EOF'
Add /about route under shared chrome.

EOF
)"
```

---

### Task 3: Sidebar About link + system-design note

**Files:**
- Modify: `frontend/src/features/home/AppSidebar.tsx`
- Modify: `frontend/src/features/home/AppSidebar.test.tsx`
- Modify: `md/system-design.md`
- Test: `frontend/src/features/home/AppSidebar.test.tsx`

**Interfaces:**
- Consumes: `pathname` from `useLocation`
- Produces: About `Link` with `to="/about"` and `aria-current` when `pathname === "/about"`

- [ ] **Step 1: Update sidebar tests to expect a link**

In `AppSidebar.test.tsx`, in the Site nav assertions, change About from button to link:

```tsx
    expect(within(siteNav).getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(within(siteNav).getByRole("button", { name: "Blog" })).toBeInTheDocument();
```

Add a focused case:

```tsx
  it("marks About current on /about", () => {
    renderSidebar("/about");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/features/home/AppSidebar.test.tsx`

Expected: FAIL (About still a button / no aria-current)

- [ ] **Step 3: Wire About Link in AppSidebar**

In `AppSidebar.tsx`, replace the About button with:

```tsx
          <Link
            to="/about"
            aria-current={pathname === "/about" ? "page" : undefined}
            className={rowClass(pathname === "/about")}
          >
            <IconInfo />
            About
          </Link>
```

Leave Blog and Settings as buttons.

In `md/system-design.md` page ↔ API table, add a row (near the top of the route table, after `/` is fine):

```markdown
| `/about` | Static About (product intro, tech stack, data sources); sidebar Site link | — | none | `AboutPage` / `AboutContent`; no API |
```

Also update the chrome paragraph if it still implies About is inert: say About routes to `/about`; Blog and Settings remain placeholders.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/features/home/AppSidebar.test.tsx src/app/AppRouter.test.tsx src/features/about/AboutContent.test.tsx src/app/layouts/HomeChromeLayout.test.tsx`

Expected: PASS

- [ ] **Step 5: Manual check**

With `npm run dev`: open `/about`, confirm chrome title **About**, sections, and external links. Click sidebar About from `/mlb/matchups` and confirm active gold state.

- [ ] **Step 6: Commit** (only if requested)

```bash
git add frontend/src/features/home/AppSidebar.tsx frontend/src/features/home/AppSidebar.test.tsx md/system-design.md
git commit -m "$(cat <<'EOF'
Wire sidebar About to /about and document the route.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `/about` under HomeChromeLayout | Task 2 |
| Chrome title **About** | Task 2 |
| Product intro (statvista, MLB/WNBA, research-only) | Task 1 |
| What you can do (Props/Legs/Games + Arb/NBA notes) | Task 1 |
| Tech stack matching README | Task 1 |
| Data sources matching README | Task 1 |
| External links noopener | Task 1 |
| Sidebar About link + aria-current | Task 3 |
| Blog/Settings stay buttons | Task 3 |
| system-design page ↔ API row | Task 3 |
| Router + content + sidebar tests | Tasks 1–3 |
| No API / no hero / no cards | Tasks 1–2 |
