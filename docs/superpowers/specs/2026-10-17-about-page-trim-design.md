# About page — description + tech stack only

Date: 2026-10-17  
Status: Approved for planning  
Product: statvista  
Related: `frontend/src/features/about/AboutContent.tsx`; supersedes content scope in `2026-09-09-about-page-design.md` for intro / sections (routing and chrome unchanged)

## Goal

Slim the static `/about` page to a short product description and the existing tech stack block. Remove all other About copy sections.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Description paragraph + Tech stack section only |
| Disclaimer | Remove gamble-responsibly / educational-use note |
| What you can do | Remove |
| Data sources | Remove (including linked/plain source constants) |
| Architecture | Keep `AboutPage` → `AboutContent`; edit content in place |
| Routing / chrome | Unchanged (`/about` under `HomeChromeLayout`) |
| Brand | **statvista** |

## Copy

**Description** (no heading):

> I built **statvista** to make pre-bet research easier. It puts the sites I’d normally jump between into one place so you can look up players, lines, and upcoming games without hopping around.

**Tech stack** (keep heading + current line):

> React 19, Vite, TanStack Query, Tailwind · FastAPI + Pydantic · Postgres (Supabase or local)

## Non-goals

- Changing route, sidebar, or page chrome
- Adding CMS / Markdown-driven copy
- Restoring data sources or feature lists
- Backend changes

## Tests

Update `AboutContent.test.tsx` to assert:

- Description mentions research / players / lines / games intent (statvista present)
- Tech stack heading and React 19 line present
- “What you can do”, “Data sources”, disclaimer text, and source links absent

## Files

| File | Change |
| --- | --- |
| `frontend/src/features/about/AboutContent.tsx` | New description; remove extra sections and source constants |
| `frontend/src/features/about/AboutContent.test.tsx` | Match new surface |
