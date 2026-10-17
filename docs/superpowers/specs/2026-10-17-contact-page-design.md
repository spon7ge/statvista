# Contact page — form UI stub (no send)

Date: 2026-10-17  
Status: Approved for planning  
Product: statvista  
Related: sidebar Site nav (`AppSidebar`); About / Blog chrome pattern

## Goal

Ship a `/contact` page that shows how a contact email form will look: **Name**, **Subject**, **Description**. Sending is not wired — Send stays disabled with “Coming soon.” Backend email comes later.

## Decisions

| Topic | Choice |
| --- | --- |
| Route | `/contact` under `HomeChromeLayout` |
| Nav | Contact → `Link` to `/contact` with `aria-current` when active |
| Chrome title | **Contact** |
| Fields | Name (text), Subject (text), Description (textarea) |
| Send | Disabled button + helper text “Coming soon” |
| Network | None — no API, mailto, or form action |
| Local state | Optional controlled inputs for typing feel; no submit handler |
| Typography | Public Sans via `.contact-content` (same idea as About/Blog) |
| Brand | **statvista** |

## Non-goals

- Backend email / third-party form hosts
- mailto: handoff
- Client-side validation beyond ordinary form markup
- Success toast or post-submit UX
- Captcha

## Files (expected)

| Area | Responsibility |
| --- | --- |
| `frontend/src/features/contact/ContactForm.tsx` | Form UI stub |
| `frontend/src/pages/ContactPage.tsx` | Chrome wrapper |
| `frontend/src/app/AppRouter.tsx` | Route |
| `frontend/src/features/home/AppSidebar.tsx` | Contact `Link` |
| Tests | Form fields, disabled Send, Coming soon, sidebar link, route |
| `md/system-design.md` / `README.md` | Contact routes; send not wired |

## Tests

- `/contact` renders Contact heading and three labeled fields
- Send button is disabled; “Coming soon” is visible
- Sidebar Contact is a link to `/contact` with `aria-current` on that path
