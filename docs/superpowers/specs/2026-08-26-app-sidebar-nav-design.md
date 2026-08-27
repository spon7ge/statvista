# App sidebar navigation

Date: 2026-08-26  
Status: Approved  
Scope: Frontend chrome only (`HomeChromeLayout`, primary nav, league section nav)

## Goal

Remove the top `HomeNav` and the per-page horizontal `LeagueSubnav`. Replace them with a left sidebar that switches leagues and league sections in one tree. Mobile uses a hamburger drawer instead of a persistent sidebar.

## Context

Today the site has two nav layers:

- `HomeNav` — logo, NBA / WNBA / MLB (official logos), unused Settings control. Mobile: leagues dropdown.
- `LeagueSubnav` — imported on league hub / player / chatbot pages. Explore (Matchups, Props, …) and Learn (chatbots). Mobile: sections dropdown.

The live ticker sits under the header; the disclaimer footer sits at the bottom of the page. WNBA game detail lives at `/games/:espnEventId` (no `/wnba` prefix).

## Decisions

- Sidebar owns league switching **and** section nav. Horizontal `LeagueSubnav` is removed.
- Desktop: persistent full-height sidebar. Ticker lives in the **content column**, not above the sidebar.
- Mobile (`< sm`): slim top bar (hamburger + logo → `/`); sidebar is a left drawer. Ticker is full width under the bar.
- Home is a real page (`/`). The Home **row** navigates there; a separate chevron expands/collapses the league list.
- Visual language stays current statvista (flat panel, `border-white/10`, muted whites, `bg-white/10` active). Official NBA / WNBA / MLB logos sit beside league labels. Not a Statmuse stacked-card clone.
- Implementation: grow `HomeChromeLayout`; do not introduce a separately named AppShell.

## Shell layout

`HomeChromeLayout` remains the route chrome wrapping the same `AppRouter` child routes.

### Desktop (`sm` and up)

Two columns, `min-h-screen`:

1. **Sidebar** — full viewport height, ~15rem wide, existing background/border tokens. Logo + `AppSidebar` tree. Does not scroll the ticker; if the tree overflows, the sidebar itself scrolls.
2. **Main column** — `LiveTicker`, then `<Outlet />`, then `SiteFooter`.

No top header on desktop.

### Mobile (below `sm`)

1. Slim top bar: hamburger (opens drawer) + statvista mark + wordmark linking to `/`.
2. Full-width `LiveTicker`.
3. `<Outlet />`.
4. `SiteFooter`.

Drawer: same `AppSidebar` as desktop, overlay from the left, dimmed backdrop. Closes on route change, Escape, hamburger toggle, or backdrop click. Focus is not trapped beyond Escape + backdrop (match existing dropdown patterns).

### Pages that gain sidebar

Every `HomeChromeLayout` route, including game detail (`/games/:espnEventId`, `/mlb/games/:gamePk`) and player pages that previously had no or only horizontal subnav.

## Nav tree

Single shared config (leagues from `HomeNav` + sections from `LeagueSubnav`). Do not duplicate path strings on pages.

### Home

- Row is a `Link` to `/`. Active when pathname is exactly `/`.
- Chevron toggles league-list expansion without navigating.
- Default: league list **expanded**.
- On `/`, no league is selected; league rows show logos only (no nested sections).

### Leagues

| League | Logo | Default href |
|--------|------|----------------|
| NBA | existing `nba_logo.png` | `/nba/matchups` |
| WNBA | existing `wnba_logo.png` | `/wnba/matchups` |
| MLB | existing ESPN league PNG | `/mlb/matchups` |

Active league is the one whose path prefix matches (see Path matching). **Only the active league** nests section rows. Other leagues are logo + label links to that league’s matchups hub.

### Sections under the active league

Keep Explore / Learn grouping with the same small uppercase labels as today’s subnav.

**Explore** (order unchanged):

- All leagues: Matchups, Props, then NBA skips EV+; WNBA/MLB include EV+.
- Then: Leaders, Standings, research tab (NBA: Playoff race; WNBA/MLB: Arbitrage), Futures.

**Learn:**

- MLB: MLB Chatbot → `/mlb/chatbot`
- WNBA: WNBA Chatbot → `/wnba/chatbot`
- NBA: How it works, Glossary (no href)

**Hrefs** (same rules as `LeagueSubnav.itemPath`):

- Matchups → `/{league}/matchups`
- Props → `/{league}/prop_picks` only if league is not NBA
- Leaders / Standings / Futures → `/{league}/…` only for WNBA and MLB
- Chatbots as above
- Anything else: visible, `disabled`, not a link (current grayed treatment)

Clicking another league navigates to its matchups hub; nested sections move under that league.

### Path matching

| Path | Active league | Nested sections |
|------|----------------|-----------------|
| `/` | none | no |
| `/nba/…` | NBA | yes |
| `/wnba/…` | WNBA | yes |
| `/mlb/…` | MLB | yes |
| `/games/:espnEventId` | WNBA | yes (WNBA sections; no extra “game” row) |

Section `aria-current="page"` uses the same suffix rules as today (`/matchups`, `/prop_picks`, `/leaders`, `/standings`, `/futures`, `/chatbot`). Game and player URLs highlight the league row, not a section, unless the path also matches a section.

### Settings

Unused control remains at the **bottom of the sidebar** (icon button, `aria-label="Settings"`). No settings page.

### Out of chrome scope

- Scores, News, Trending, Examples, Blog, Shop, BETA badges
- New routes
- API changes
- Collapsible desktop sidebar
- Persisting drawer or Home-chevron state in `localStorage`
- Navigating to the analogous section in another league (always that league’s matchups)

## Components

| Unit | Responsibility |
|------|----------------|
| `features/home/lib/appNav.ts` | Leagues, logos, default hrefs, per-league Explore/Learn items, href-or-disabled, `isActiveSection(pathname)` |
| `AppSidebar` | Renders the tree: Home, leagues + logos, nested sections, Settings. Home chevron. `aria-label="Primary"` |
| `HomeChromeLayout` | Desktop two-column; mobile bar + drawer; ticker in main column; footer |
| Pages | Stop importing `LeagueSubnav` |

Delete `HomeNav` once unused. Delete `LeagueSubnav` once unused. Move tests onto `AppSidebar` / `HomeChromeLayout`.

Drawer open state is `useState` in `HomeChromeLayout` (or a tiny wrapper). Not global.

## Visual

- Flat sidebar, not stacked rounded Statmuse cards.
- Active row: `bg-white/10`, full white text (same as current nav pills).
- Inactive: white / muted; hover `hover:bg-white/5`.
- Disabled: `text-white/25` (or current disabled subnav token), `cursor-not-allowed`.
- Nested sections indent under the active league.
- League logos: `size-5`, `aria-hidden`, same assets as `HomeNav`.

## Docs

Update `md/system-design.md`: shared chrome is sidebar + live ticker + footer (not top `HomeNav`). No page ↔ API table changes (routes unchanged).

## Testing

- Chrome: merged WNBA + MLB ticker still renders; disclaimer footer still renders.
- Desktop: no top `HomeNav` header; sidebar visible; ticker is in the main column (not a full-width strip above the sidebar).
- Mobile classes: sidebar hidden until drawer open; hamburger bar is `sm:hidden` (or equivalent); desktop sidebar `hidden sm:flex` / `sm:block`.
- Home link → `/`; `aria-current` on `/`.
- League links → `/{id}/matchups`; logos present; `aria-current` on `/wnba/matchups` for WNBA only.
- On `/mlb/leaders`, MLB nested; Matchups not current; Leaders current; WNBA has no nested list.
- Disabled NBA items are not links.
- Chatbot items link to `/mlb/chatbot` and `/wnba/chatbot`.
- `/games/:espnEventId` treats WNBA as active.
- Drawer: open via hamburger; close on Escape, backdrop, and after clicking a link.
- `AppRouter` / page tests that assumed `LeagueSubnav` in the page still find section links via the layout sidebar (render pages inside `HomeChromeLayout` or assert in chrome tests).

## Files (expected)

- `frontend/src/features/home/lib/appNav.ts` — config
- `frontend/src/features/home/AppSidebar.tsx` + `.test.tsx`
- `frontend/src/app/layouts/HomeChromeLayout.tsx` + `.test.tsx`
- Remove `LeagueSubnav` from: `LeagueMatchupsPage`, `LeaguePropPicksPage`, `WnbaPlayerPropsPage`, `LeagueLeadersPage`, `LeagueStandingsPage`, `LeagueFuturesPage`, `LeagueChatbotPage`, `LeaguePlayerPage`, `MlbPropPicksPage`, `MlbLeadersPage`, `MlbStandingsPage`, `MlbFuturesPage`
- Delete `HomeNav.tsx` / `HomeNav.test.tsx`, `LeagueSubnav.tsx` / `LeagueSubnav.test.tsx` when unused
- `md/system-design.md`
