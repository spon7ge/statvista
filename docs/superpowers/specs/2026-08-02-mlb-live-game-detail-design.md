# MLB live game detail (`/mlb/games/:gamePk`)

Date: 2026-08-02  
Status: Approved for planning  
Scope: Replace the MLB game stub with a live-only game center (Stats API + ESPN win probability)  
Audience: Implementers of `/api/mlb/games/{gamePk}` and `MlbGameDetailPage`

## Goal

When a user opens a live MLB game from Live Now, the ticker, or matchups, show a real game center at `/mlb/games/:gamePk`. Content follows the boxseats-style live center (linescore, pitch zone, diamond/count, at-bat context, play-by-play, scoring plays, box score, win-probability flow, hit chart). Visual language stays HoopVista quiet surfaces — not boxseats chrome. Data attribution: `MLB Stats API · ESPN`.

## Decisions

| Topic | Choice |
| --- | --- |
| Architecture | Stats-primary live feed + ESPN win probability (Approach 2) |
| Route | Keep `/mlb/games/:gamePk`; replace `MlbGameStubPage` |
| Status scope | **Live only** this slice |
| Not live | Thin status page (header + short message + back); no empty panel shells |
| Theme | Reuse `GAME_SECTION_SURFACE`, red live accent, white mono scores, Geist |
| Call value | Light stakes from ESPN win-% delta when available; no RE288 / Statcast engine |
| Milestones | Out of scope |
| WNBA game detail | Unchanged (`components/game/*` untouched) |

## Non-goals

- Milestone watch
- Custom RE288 / leverage-index engine
- Scheduled preview panels (matchup prediction, projected starters, etc.)
- Full final-game archive center (final gets the same thin not-live treatment for now)
- Park-specific SVG wall dimensions beyond what feed coords + a simple field outline allow
- About-page copy updates (optional follow-up)
- Refactoring WNBA detail into a shared multi-sport page

---

## 1. Architecture

```text
/mlb/games/:gamePk   (HomeChromeLayout)
        │
        ▼
useMlbGameDetail(gamePk)
        │
        ▼
GET /api/mlb/games/{gamePk}
        ├─ Stats API  /api/v1.1/game/{gamePk}/feed/live
        │     linescore · situation · pitches · PBP · box · hit coords
        └─ ESPN bridge (game date + away/home → event id)
              MLB summary winprobability → game-flow series + optional stakes Δ
```

Entry points already link via `gameDetailHref` → `/mlb/games/{mlbGamePk}` (Live Now, ticker, matchup cards). No link-shape change required.

### ESPN bridge

1. Read game date and team identity from the Stats live feed (or schedule hydrate).
2. Fetch ESPN MLB scoreboard for that ET calendar date.
3. Match event by team abbreviations / names (tolerant of abbrev differences via a small alias map if needed).
4. Fetch `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={id}`.
5. Soft-fail: if bridge or summary fails, still return Stats-normalized payload with `win_probability` / stakes null.

Cache bridge results briefly (event id per `gamePk`) so live polling does not re-scan the scoreboard every tick.

---

## 2. Backend API

### Endpoint

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/mlb/games/{gamePk}` | Primary detail feed |

- Validate `gamePk` as digits (reject garbage → **404**).
- Response `Cache-Control: no-store`.
- In-process TTL ~15s while live; longer OK for not-live.
- Stale-while-error: serve last good payload if Stats fails after a prior success; **502** if never cached; **404** for unknown/unavailable game when Stats says missing.
- ESPN soft-fail never upgrades a successful Stats response to 502.

### Upstream

| Source | URL / role |
| --- | --- |
| MLB Stats live feed | `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live` |
| ESPN scoreboard | Date lookup to resolve `event` id |
| ESPN MLB summary | Win probability series (+ optional stakes from latest Δ) |

### Status mapping

Reuse shared status literals: `"scheduled" | "live" | "halftime" | "final"`. MLB never emits `halftime`. Map Stats `abstractGameState` / `detailedState`: **live** only for in-progress games; warmup, delayed, suspended, postponed, scheduled → `scheduled` (thin page); completed → `final`.

### Normalized response

```json
{
  "mlb_game_pk": "776543",
  "league": "mlb",
  "status": "live",
  "status_label": "Top 6th",
  "venue": "Dodger Stadium",
  "away": { "id": "…", "abbrev": "BOS", "name": "Boston Red Sox", "score": 6, "color": "#…", "logo_url": "…" },
  "home": { "id": "…", "abbrev": "LAD", "name": "Los Angeles Dodgers", "score": 3, "color": "#…", "logo_url": "…" },
  "linescore": {
    "innings": [{ "num": 1, "away_runs": 2, "home_runs": 0 }, "..."],
    "away": { "runs": 6, "hits": 7, "errors": 0 },
    "home": { "runs": 3, "hits": 5, "errors": 0 },
    "current_inning": 6,
    "inning_half": "top"
  },
  "situation": {
    "balls": 1,
    "strikes": 2,
    "outs": 1,
    "runners": { "first": false, "second": false, "third": false },
    "at_bat": { "name": "…", "hand": "R", "summary": "…" },
    "on_deck": { "name": "…", "hand": "S", "summary": "…" },
    "pitching": { "name": "…", "hand": "R", "summary": "…" },
    "pitches": [
      {
        "number": 1,
        "type": "Slider",
        "mph": 89,
        "result": "Called Strike",
        "is_strike": true,
        "zone_x": 0.06,
        "zone_y": 0.12
      }
    ],
    "latest_play_text": "Ball"
  },
  "plays": [],
  "scoring_plays": [],
  "box_score": {
    "away_batters": [],
    "home_batters": [],
    "away_pitchers": [],
    "home_pitchers": []
  },
  "hit_chart": [
    { "id": "…", "team": "away", "result": "hr", "x": 0.1, "y": 0.8, "player_name": "…" }
  ],
  "win_probability": {
    "home_abbrev": "LAD",
    "away_abbrev": "BOS",
    "points": [{ "play_id": "…", "label": "Top 6", "home_win_pct": 0.15 }],
    "stakes": { "home_win_delta": -0.04, "label": "≈ 4 pts win%" }
  },
  "sources": ["mlb_stats_api", "espn"],
  "fetched_at": "ISO-8601"
}
```

**Play:** `id`, `inning`, `half` (`top`|`bottom`), `text`, `scoring`, `away_score`, `home_score`, optional `event` abbrev (`K`, `HR`, …).

**Batter row:** `order`, `name`, `position`, `ab`, `r`, `h`, `rbi`, `bb`, `so` (nulls allowed).

**Pitcher row:** `name`, `ip`, `h`, `r`, `er`, `bb`, `k`, `pitches` (nulls allowed).

Nullable / omit rules:

- `situation`, pitch zone coords, hit points: null/empty when unavailable.
- `win_probability`: null when ESPN bridge fails or series empty; omit `stakes` when fewer than two points or delta unavailable.
- `linescore.innings`: include started innings; null runs for unfinished halves.
- Team `color`: Stats team colors when present; otherwise fixed away/home fallbacks (not purple).

### OpenAPI

Export route → `frontend/openapi.json` → regenerate types → `fetchMlbGameDetail` in `lib/api.ts` → `npm run check:api`.

---

## 3. Frontend

### Page

`MlbGameDetailPage` at `/mlb/games/:gamePk` under `HomeChromeLayout`.

| State | UI |
| --- | --- |
| Loading (never had data) | Skeleton matching quiet surfaces |
| Error / never loaded | “Unable to load game” + Back |
| Not `live` | Compact header (teams/score/status) + one sentence (“Not live yet” / “Final — live center for completed games coming soon”) + Back |
| `live` | Full center below |

Back navigates to `/` (same as WNBA detail) unless a stronger prior exists already in chrome — keep `/` for parity.

### Live layout (top → bottom)

1. Back row + `status_label` · venue · attribution `Data: MLB Stats API · ESPN` (show ESPN in the string when `sources` includes espn; if Stats-only, `Data: MLB Stats API`).
2. **Linescore header** — team rows (logo optional, name in team color, white mono score) + inning grid 1–9+ with R/H/E; current inning column accent (red, quiet).
3. **Live situation** (`lg:grid-cols-2`):
   - Pitch zone SVG + numbered pitch list (strike vs ball color; muted secondary text).
   - Diamond + balls/strikes/outs + optional stakes line; AT BAT / ON DECK / PITCHING.
4. **Play-by-play | Scoring plays** (`lg:grid-cols-2`) — PBP chronological for the current half-inning (half-inning filter pills; default = current); scoring plays chronological for the whole game. Event badges muted (HR may use red sparingly).
5. **Box score** — away | home batters; pitchers under each side.
6. **Game flow** — step/line win-% chart; mid-line at 50%; tooltip with half-inning label + both win %. If `win_probability` is null, show the section shell with muted “Win probability unavailable” (keeps layout stable).
7. **Hit chart** — Both / away / home pills; legend HR / Hit / Out; simple field + points. If no points, muted empty copy inside the shell.

### Theme rules

- Surfaces: `GAME_SECTION_SURFACE` (or shared import from `components/game/GameSection` — shared constant only, no WNBA component coupling beyond that).
- Live accent: red pulse / `text-red-400` for in-progress only.
- No amber score boxes, no violet accents, no floating badge clutter on charts.
- Cards only where they are interaction/section shells already established on WNBA detail.

### Components & files

```text
frontend/src/pages/MlbGameDetailPage.tsx
frontend/src/hooks/useMlbGameDetail.ts
frontend/src/components/mlb/
  types.ts
  mapMlbGameDetail.ts
  MlbGameHeader.tsx
  MlbLinescore.tsx
  MlbLiveSituation.tsx
  MlbPitchZone.tsx
  MlbPlayByPlay.tsx
  MlbBoxScore.tsx
  MlbWinProbability.tsx
  MlbHitChart.tsx
backend/app/schemas/mlb_game_detail.py
backend/app/services/mlb_game_detail.py
backend/app/services/mlb_espn_bridge.py   # or helpers inside mlb_game_detail
backend/app/api/routes/mlb_game_detail.py
```

Remove or re-export: delete stub usage from `AppRouter`; `MlbGameStubPage` can be deleted once the real page ships.

### Polling

`useMlbGameDetail`: refetch ~15–18s while `status === "live"`; stop for scheduled/final. Keep last good data on refetch error.

---

## 4. Testing

| Area | Coverage |
| --- | --- |
| Backend normalize | Live-feed fixture → status, linescore, situation, pitches, plays, scoring plays, box, hit_chart |
| Backend ESPN | Merge winprobability; soft-fail leaves Stats intact |
| Backend route | 200 + no-store; 404 bad pk; 502 empty cache; not-live still 200 with thin payload |
| Frontend | Live sections render; not-live thin state; hit-chart filter; win-prob absent hides cleanly |
| Router | `/mlb/games/:gamePk` mounts detail under chrome (update stub test) |
| Contract | OpenAPI export + `check:api` |

---

## 5. Success criteria

- Clicking a live MLB game opens `/mlb/games/:gamePk` with linescore, live situation (pitch + diamond), PBP/scoring, box, and hit chart from Stats.
- When ESPN bridge succeeds, game-flow chart and optional stakes appear; attribution includes ESPN.
- When ESPN fails, Stats panels still work; win-prob section degrades gracefully.
- Scheduled/final show thin not-live UI — no broken empty grids.
- Theme matches WNBA quiet game detail (not boxseats).
- WNBA `/games/:espnEventId` behavior unchanged.
- Backend tests + frontend tests + `check:api` pass.

## Maintenance

After implementation, update `docs/superpowers/specs/2026-08-02-website-api-system-design.md` so `/mlb/games/:gamePk` maps to `GET /api/mlb/games/{gamePk}` (Stats live feed + ESPN WP) instead of the stub.
