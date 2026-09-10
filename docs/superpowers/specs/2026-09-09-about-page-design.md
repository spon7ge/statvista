# About page — product + stack + sources

Date: 2026-09-09  
Status: Approved for planning  
Product: statvista  
Related: sidebar Site nav (`AppSidebar`); root README data/stack tables; older HoopVista About specs (superseded branding)

## Goal

Ship a static `/about` page under shared chrome that explains what **statvista** is, what Props / Legs / Games do, and lists the tech stack and data sources truthfully. Wire the sidebar About control to that route.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Product intro + what-you-can-do + tech stack + data sources |
| Length | Medium (~one scroll, not a one-screen stub and not a long essay) |
| Visual | Match Props / Legs / Games chrome (title row + page column); no marketing hero |
| Architecture | Single static page; content in one `AboutContent` component |
| Routing | `/about` under `HomeChromeLayout` |
| Data | Static strings only — no API / CMS |
| Brand | **statvista** (never HoopVista / hoopvista) |
| League pills | None on About |
| Blog / Settings | Stay inert buttons |

## Non-goals

- Blog or Settings pages
- Contributors section
- Marketing hero / edge-to-edge imagery
- Markdown-driven or CMS copy pipeline
- Changing Props / Legs / Games product behavior
- Backend routes for About

## Routing & chrome

| Path | Element |
| --- | --- |
| `/about` | `AboutPage` → `AboutContent` under `HomeChromeLayout` |
| Sidebar About | `Link` to `/about`; `aria-current="page"` when active |

Page uses the same `chrome-title-row` / `chrome-title` / `CHROME_PAGE_X` / `CHROME_TITLE_TOP` pattern as Legs and Arbitrage. Heading text: **About**.

## Page structure

1. **Title** — `About`
2. **Intro** — 2–3 short paragraphs:
   - Research site for **MLB** and **WNBA** player props and games
   - Compare DFS lines to sportsbooks in one place
   - Educational / research-only; not a tipster feed or betting ticket; gamble responsibly
3. **What you can do** — short bullets:
   - **Props** — DFS-anchored player lines next to sportsbook odds
   - **Legs** — priced PrizePicks / Underdog entry shortlists
   - **Games** — dated slates and game centers
   - Note: **Arbitrage** is a shell (not wired yet); **NBA** is a placeholder
4. **Tech stack** — truthful list matching README: React 19, Vite, TanStack Query, Tailwind · FastAPI + Pydantic · Postgres (Supabase or local)
5. **Data sources** — linked list matching README:

| Source | Used for |
|--------|----------|
| ESPN | WNBA scoreboard / standings / game summary / win probability; MLB win-probability bridge |
| stats.wnba.com | Season leaders, player bio / averages / gamelog |
| MLB Stats API | MLB scoreboard and live/final game feeds |
| ParlayAPI / Sharp | Sportsbook odds (spreads, totals, player props) |
| Supabase (Postgres) | PrizePicks / Underdog snapshots and other odds tables |
| RotoWire | Projected starters / lineups |

External links: `target="_blank"` and `rel="noopener noreferrer"`.

No cards. No hero image. Sections use ordinary headings + body type on existing tokens.

## File layout

```
frontend/src/pages/AboutPage.tsx
frontend/src/features/about/AboutContent.tsx
frontend/src/features/about/AboutContent.test.tsx
frontend/src/app/AppRouter.tsx              # add /about
frontend/src/features/home/AppSidebar.tsx   # About → Link
md/system-design.md                         # page ↔ route note
```

## Testing

- `AboutContent` renders title sections: intro voice (statvista), What you can do, Tech stack, Data sources; at least one external source link
- `AppRouter`: `/about` shows About heading (replace current “not found at /about” expectation)
- `AppSidebar`: About is a link to `/about`; `aria-current` on `/about`

## Success criteria

- Sidebar About navigates to `/about` and shows active state
- Page matches existing chrome and includes product + stack + sources copy
- Copy is research/educational, not promotional betting advice
- No new backend dependency
