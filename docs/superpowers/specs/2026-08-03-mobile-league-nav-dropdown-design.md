# Mobile league nav dropdown

## Goal

On viewports below `sm`, expose NBA / WNBA / MLB in `HomeNav` via a compact dropdown beside About. Desktop keeps the existing horizontal league links.

## Context

`HomeNav` already hides the league link row on mobile (`hidden sm:flex`). About and Settings remain visible. Mobile users currently cannot switch leagues from the header.

## Approach

Custom dropdown inside `HomeNav` (same interaction pattern as prop-picks filter menus: toggle button, Escape, outside click). No new shared primitive.

## Behavior

### Breakpoints

- **`< sm`:** League dropdown visible; desktop league link row hidden.
- **`≥ sm`:** Desktop league links visible; dropdown hidden.

### Trigger

- Placed in the primary nav, immediately before About.
- Shows current league logo + label + chevron when `pathname` starts with `/nba`, `/wnba`, or `/mlb`.
- On other routes (home, about, etc.): label **League** (no logo) + chevron.
- Active styling matches existing selected nav chrome (`bg-white/10`, full white text).

### Menu

- Lists NBA, WNBA, MLB with the same logos used on desktop.
- Each item is a `Link` to `/{league}/matchups`.
- Selecting an item navigates and closes the menu.
- Current league (if any) is marked with `aria-current="page"`.

### Accessibility

- Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` pointing at the menu.
- Menu: `role="menu"`; items use `role="menuitem"` (or keep as links inside a labeled menu).
- Close on Escape and pointer-down outside the dropdown root.

## Out of scope

- Real-device QR / external mobile preview.
- Changing About or Settings.
- Desktop nav layout changes.
- Extracting a shared Dropdown component.
- Navigating to the user’s current sub-page in another league (always matchups hub).

## Files

- `frontend/src/components/home/HomeNav.tsx` — implement dropdown.
- `frontend/src/components/home/HomeNav.test.tsx` — update/add coverage.

## Testing

- Desktop: league links still present and point at matchups hubs; About unchanged.
- Mobile classes: dropdown wrapper is `sm:hidden`; desktop league row remains `hidden sm:flex`.
- On `/wnba/matchups`, trigger shows WNBA; menu marks WNBA current.
- On `/`, trigger shows “League”; menu items link to each league’s matchups.
- Opening then Escape / outside click closes the menu.
