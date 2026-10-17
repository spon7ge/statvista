# Blog placeholder — index + stub articles

Date: 2026-10-17  
Status: Approved for planning  
Product: statvista  
Related: sidebar Site nav (`AppSidebar`); About page chrome pattern; `AppRouter` / `HomeChromeLayout`

## Goal

Ship a temporary Blog surface: a two-post index (two cards per row) and simple placeholder article pages, so Blog is a real Site destination instead of an inert button.

## Decisions

| Topic | Choice |
| --- | --- |
| Architecture | Static TypeScript post catalog; no CMS / Markdown / API |
| Index layout | Exactly **2** posts in one row (`1` col mobile → `2` col from `sm`) |
| Card fields | Title, accent “image” block (solid/gradient + short label), est. read time |
| Images | Color/gradient blocks only — no photo assets |
| Article pages | `/blog/:slug` with title, read time, accent block, short placeholder body |
| Unknown slug | Existing `NotFoundPage` |
| Nav | Sidebar Blog → `Link` to `/blog` with `aria-current` when active |
| Chrome | Match About: title row under `HomeChromeLayout`; no league pills, no marketing hero |
| Brand | **statvista** |

## Routes

| Path | Element |
| --- | --- |
| `/blog` | `BlogPage` → index grid |
| `/blog/:slug` | `BlogPostPage` → stub article from catalog |
| Sidebar Blog | `Link` to `/blog` |

## Posts (day one)

| Slug | Title | Est. read | Accent label |
| --- | --- | --- | --- |
| `read-a-prop-line` | How to read a prop line before you bet | 4 min | LINES |
| `hit-rate-l5-l10-l15` | L5 / L10 / L15: what hit rate actually means | 6 min | FORM |

Each post also has a stable accent color/gradient token (CSS classes using existing theme colors — no purple glow aesthetic).

## Index UI

- Chrome title: **Blog**
- Grid of links; each card:
  - Accent block (aspect ~16/10) with label centered or cornered
  - Title (heading or strong text)
  - Est. read copy: `{n} min read`
- Cards are the interaction affordance (navigate to post) — not decorative marketing cards

## Article UI

- Chrome title can stay **Blog** or show post title in content (prefer content H1 = post title; chrome title **Blog**)
- Accent block (same as card)
- Est. read
- 2–3 short paragraphs of placeholder copy (topical filler + “Full article coming soon.”)
- Link back to `/blog`

## Non-goals

- Real photography or stock images
- Authors, tags, publish dates, RSS
- Markdown / MDX pipeline
- Backend routes
- More than two posts on day one
- Settings page

## Files (expected)

| Area | Responsibility |
| --- | --- |
| `frontend/src/features/blog/posts.ts` | Catalog + lookup by slug |
| `frontend/src/features/blog/BlogIndex.tsx` | Two-card grid |
| `frontend/src/features/blog/BlogPost.tsx` | Stub article body |
| `frontend/src/pages/BlogPage.tsx` | Index chrome wrapper |
| `frontend/src/pages/BlogPostPage.tsx` | Article chrome + slug param |
| `frontend/src/app/AppRouter.tsx` | Routes |
| `frontend/src/features/home/AppSidebar.tsx` | Blog `Link` |
| Tests | Index renders 2 cards; post page by slug; unknown slug → not found; sidebar link |
| `md/system-design.md` | Page ↔ API table row for `/blog` and `/blog/:slug` |

## Tests

- Index shows both titles, both read times, two links to correct slugs
- Grid is two columns from `sm` (class assertion acceptable)
- Known slug renders title + placeholder body
- Unknown slug renders NotFound
- Sidebar Blog is a link to `/blog` with `aria-current` when on blog routes
