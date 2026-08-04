# Mobile Explore / Learn subnav dropdowns

## Goal

On viewports below `sm`, collapse `LeagueSubnav` Explore and Learn into **one** sections dropdown. Desktop keeps the existing inline label + pill row.

## Behavior

- Mobile trigger shows the active section name (e.g. Standings) or **Sections**.
- Menu groups: small light-grey **Explore** / **Learn** headers; item text white.
- Space before the Learn group; Escape + deferred outside `pointerdown` close.
- Avoid clipping: no `overflow-x-auto` on the mobile row; menu uses a high z-index.

## Files

- `frontend/src/components/league/LeagueSubnav.tsx`
- `frontend/src/components/league/LeagueSubnav.test.tsx`
