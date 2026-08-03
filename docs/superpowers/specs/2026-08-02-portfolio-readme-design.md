# Portfolio README redesign

Date: 2026-08-02  
Status: Implemented  
Scope: Replace root `README.md` with a portfolio-first page  
Audience: Recruiters, hiring managers, future contributors glancing at the repo

## Goal

Rewrite the root README so a visitor immediately understands **what statvista is**, **where data comes from**, that the product is **not publicly deployed yet**, and can **watch a local screen recording** of the current UI — without wading through medallion/Docker essays.

## Non-goals

- Redeploying or documenting a production host URL (this repo is not deployed)
- Rewriting `backend/`, `frontend/`, `docker/`, or `models/` READMEs beyond linking them
- Keeping the current long architecture / quick-start body in the root README
- Uploading the demo to YouTube/Loom (ship a repo-hosted video file)

## Design

### Structure (approved: Pitch → Video → Sources → Stack)

1. **Title + one-liner** — `statvista`: interactive NBA / WNBA analytics site (MLB live surfaces in progress); props context, live trackers, game centers.
2. **Status** — Explicit line: **not publicly deployed yet**; local / self-hosted demo only.
3. **Demo** — Screen recording copied into `assets/` (from Desktop `Screen Recording 2026-08-02 at 9.37.03 PM.mov`). Prefer a GitHub-friendly format (`mp4` or `webm` if conversion is practical; otherwise `.mov` with a note). Embed with a relative path + short caption.
4. **What it does** — Short bullets: home live board, WNBA matchups / prop picks / leaders / standings / futures / player + game detail, MLB matchups + live/final game detail. Educational disclaimer.
5. **Data sources** — Table aligned with the live site (not only the old About-page subset):

   | Source | Used for |
   |--------|----------|
   | ESPN | WNBA scoreboard, standings, futures, game summary / win probability |
   | stats.wnba.com | Leaders, player bio / season / gamelog |
   | MLB Stats API | MLB scoreboard, live/final game feeds |
   | ParlayAPI / Sharp | WNBA & MLB sportsbook odds (spreads, totals, props) |
   | Supabase odds snapshots | PrizePicks / Underdog DFS prop lines |
   | RotoWire | Projected starters (scheduled games) |
   | NBA Stats API (`nba_api`) | Historical NBA ingest / research pipeline |
   | The Odds API | Historical / research prop ingest |
   | Basketball-Reference | WNBA context tables (About / research) |

6. **Tech stack** — Compact table: React 19 + Vite + TanStack Query; FastAPI; Postgres/Supabase; Python ETL + quantile ML (research path).
7. **Try locally** — One short paragraph + links to `frontend/README.md`, `backend/README.md`, `docker/README.md`. No full compose walkthrough in root.
8. **Disclaimer** — Educational only; gamble responsibly.

### Content tone

- Portfolio / product voice (match About page: “statvista”, fan-friendly analytics).
- Do **not** claim a live public URL. Do **not** link `spon7ge.github.io/HoopVista/` (different project).
- Keep engineering depth discoverable via links, not inline.

### Asset handling

- Copy recording → `assets/demo/` (or `assets/screenshots/`) with a stable name, e.g. `statvista-demo.mov` / `.mp4`.
- Update `assets/screenshots/README.md` only if it still claims SVG placeholders are the primary README media; optional one-line note pointing at the demo video.
- Large binary: commit only if the user wants it in git; otherwise document the path and use LFS / external host later. **Default for implementation:** copy into `assets/demo/` and reference from README (user supplied the file for this purpose).

### Out of root README

Move / leave documented elsewhere (already exist):

- Mermaid medallion diagrams, nested JSON flattening essays → historical docs / `models/README.md` / system design specs
- Full Docker quick start → `docker/README.md`
- Screenshot placeholder grid of SVG dashboards → optional; not required for the new top section

## Success criteria

- [x] Root README opens with product pitch + not-deployed status
- [x] Demo video is visible or clearly linked from the README
- [x] Data sources section matches what powers the current website
- [x] No false claim of public deployment
- [x] Deep setup remains one click away via linked READMEs
