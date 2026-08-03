# Portfolio README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root `README.md` with a portfolio-first page (pitch, not-deployed status, demo video, data sources, stack, local links) per `docs/superpowers/specs/2026-08-02-portfolio-readme-design.md`.

**Architecture:** Copy the user-supplied screen recording into `assets/demo/`, rewrite root README as a short portfolio landing page, and leave deep Docker/medallion content in existing sub-READMEs.

**Tech Stack:** Markdown, GitHub-flavored media embed, local `.mov`/`.mp4` asset

## Global Constraints

- Brand name in copy: **statvista** (not HoopVista).
- Status: **not publicly deployed yet** — do not link `spon7ge.github.io/HoopVista/`.
- Demo source file: `/Users/alexgonzalez/Desktop/Screen Recording 2026-08-02 at 9.37.03 PM.mov`
- Demo destination: `assets/demo/statvista-demo.mov`
- Do not expand root README with full Docker quick-start or medallion essays.
- Do not commit unless the user explicitly asks (user rule overrides plan commit steps — stage only / skip commit steps).

---

### Task 1: Copy demo recording into the repo

**Files:**
- Create: `assets/demo/statvista-demo.mov`
- Create: `assets/demo/README.md` (one-line description of the asset)

**Interfaces:**
- Consumes: Desktop screen recording path above
- Produces: Stable relative path `assets/demo/statvista-demo.mov` for README embed

- [ ] **Step 1: Create directory and copy file**

```bash
mkdir -p assets/demo
cp "/Users/alexgonzalez/Desktop/Screen Recording 2026-08-02 at 9.37.03 PM.mov" \
  assets/demo/statvista-demo.mov
ls -lh assets/demo/statvista-demo.mov
```

Expected: file exists, ~22MB.

- [ ] **Step 2: Optionally convert to mp4 for broader GitHub playback**

If `ffmpeg` is available:

```bash
ffmpeg -y -i assets/demo/statvista-demo.mov -c:v libx264 -pix_fmt yuv420p -c:a aac \
  assets/demo/statvista-demo.mp4
```

If conversion succeeds, README should prefer `statvista-demo.mp4`. If `ffmpeg` is missing, keep `.mov` only.

- [ ] **Step 3: Write `assets/demo/README.md`**

```markdown
# Demo assets

- `statvista-demo.mov` / `statvista-demo.mp4` — local UI walkthrough for the root README (not a production deploy).
```

- [ ] **Step 4: Verify asset path from repo root**

```bash
test -f assets/demo/statvista-demo.mov && echo OK
```

Expected: `OK`

---

### Task 2: Rewrite root `README.md`

**Files:**
- Modify: `README.md` (full replace)
- Optional modify: `assets/screenshots/README.md` — add one line pointing to `assets/demo/` for the primary README media

**Interfaces:**
- Consumes: `assets/demo/statvista-demo.mp4` if present, else `.mov`
- Produces: Portfolio-first root README matching the approved spec sections

- [ ] **Step 1: Replace `README.md` with the following content**

Use `statvista-demo.mp4` in the video `src` if that file exists after Task 1; otherwise use `.mov`.

```markdown
# statvista

Interactive basketball (and baseball) analytics — live scoreboards, matchup boards, prop context, and game centers for fans who want a clearer view of the slate.

**Status:** Not publicly deployed yet. Run locally to try the current build.

> Educational project only. Sports betting involves risk. Gamble responsibly.

---

## Demo

Local walkthrough of the current UI (home, league hubs, props, game detail):

<video src="assets/demo/statvista-demo.mp4" controls width="100%"></video>

If the player does not render in your GitHub client, download the file: [statvista-demo.mp4](assets/demo/statvista-demo.mp4).

---

## What it does

statvista is a React + FastAPI research site that turns public sports feeds into readable boards:

- **Home** — brand hero plus a merged LIVE NOW board (WNBA + MLB)
- **WNBA** — matchups with odds, DFS/US prop picks, leaders, standings, futures, player pages, and full game centers
- **MLB** — dated matchups with odds, plus live and final game detail (situation, win probability)
- **NBA** — matchups hub scaffolded; historical prop research pipeline still in the repo

The public site read path talks to live upstream APIs (and Supabase odds snapshots). A separate Postgres medallion + quantile-ML path remains for research / batch props — see linked docs below.

---

## Where the data comes from

| Source | Used for |
|--------|----------|
| [ESPN](https://www.espn.com/) | WNBA scoreboard, standings, futures, game summary / win probability; MLB win-probability bridge |
| [stats.wnba.com](https://stats.wnba.com/) | Season leaders, player bio / averages / gamelog |
| [MLB Stats API](https://statsapi.mlb.com/) | MLB scoreboard and live/final game feeds |
| ParlayAPI / Sharp | WNBA and MLB sportsbook odds (spreads, totals, player props) |
| Supabase (Postgres) | PrizePicks / Underdog DFS prop snapshots; research warehouse |
| [RotoWire](https://www.rotowire.com/) | Projected starters for scheduled WNBA games |
| [NBA Stats API](https://github.com/swar/nba_api) (`nba_api`) | Historical NBA schedules and box scores (research ingest) |
| [The Odds API](https://the-odds-api.com) | Historical / research player-prop lines |
| [Basketball-Reference](https://www.basketball-reference.com/wnba/) | WNBA context tables |

---

## Tech stack

| Layer | Tools |
|-------|-------|
| Frontend | React 19, TypeScript, Vite, TanStack Query, Tailwind |
| API | FastAPI, Pydantic, OpenAPI → generated TS types |
| Live adapters | ESPN, stats.wnba.com, MLB Stats API, Parlay/Sharp, RotoWire |
| Storage | PostgreSQL (Supabase or local Docker) |
| Research ML | Python, dbt medallion layers, XGBoost quantile models |

---

## Try it locally

Deep setup lives next to the code:

- [frontend/README.md](frontend/README.md) — React app (`npm run dev`)
- [backend/README.md](backend/README.md) — FastAPI read path
- [docker/README.md](docker/README.md) — Compose profiles (Postgres, API, ETL)
- [models/README.md](models/README.md) — Prop ML methodology

Minimal loop: start the API, set `VITE_API_BASE_URL` if needed, run the frontend, open `http://localhost:5173`.

---

## Further reading

| Doc | Contents |
|-----|----------|
| [docs/superpowers/specs/2026-08-02-website-api-system-design.md](docs/superpowers/specs/2026-08-02-website-api-system-design.md) | Page ↔ API map for the live site |
| [docs/superpowers/specs/2026-08-02-portfolio-readme-design.md](docs/superpowers/specs/2026-08-02-portfolio-readme-design.md) | Why this README is shaped this way |

---

This project was made for **educational purposes only**. Sports betting involves risk. Gamble responsibly.
```

- [ ] **Step 2: Sanity-check README links and media path**

```bash
test -f README.md
grep -q "Not publicly deployed yet" README.md
grep -q "assets/demo/statvista-demo" README.md
grep -q "spon7ge.github.io/HoopVista" README.md && echo FAIL || echo OK_no_wrong_url
```

Expected: file exists; status string present; demo path present; `OK_no_wrong_url`.

- [ ] **Step 3: Optional one-liner in `assets/screenshots/README.md`**

Append:

```markdown
Primary product demo for the root README lives in [`assets/demo/`](../demo/).
```

---

### Task 3: Mark design status complete

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-portfolio-readme-design.md` — set Status to `Implemented`

- [ ] **Step 1: Update status line**

Change `Status: Draft (awaiting user review)` → `Status: Implemented`

- [ ] **Step 2: Visual check**

Open `README.md` in the editor and confirm sections: pitch, status, demo, what it does, data sources, stack, local links, disclaimer.

---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Pitch + one-liner | Task 2 |
| Not deployed status | Task 2 |
| Demo recording in assets + embed | Task 1 + 2 |
| What it does | Task 2 |
| Data sources table | Task 2 |
| Tech stack | Task 2 |
| Try locally via links | Task 2 |
| Disclaimer | Task 2 |
| No false public URL | Task 2 verification |
| Deep setup out of root | Task 2 (links only) |
