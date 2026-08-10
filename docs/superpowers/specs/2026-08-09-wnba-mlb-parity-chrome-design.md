# WNBA MLB-parity chrome (hubs + game detail)

Date: 2026-08-09  
Status: Approved for planning  
Product: **statvista**

## Goal

Make the WNBA experience look and feel like MLB where data already exists: colored hub banners with a WNBA sport mark, and a broadcast-style game center with **shot chart** in the MLB **hit chart** slot. Do not rewrite Prop Picks into MLB’s hybrid fair/edge board in this pass.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Whole WNBA surface: hubs + game detail + player banner chrome |
| Depth | Chrome + game-detail structure (recommended option B) — not full Prop Picks product parity |
| Approach | Mirror MLB in place (Approach 1) — WNBA-specific headers/centers; no shared shell refactor of MLB |
| Hub banners | Leaders, Standings, Futures, Prop Picks, Player — MLB-style `rounded-3xl` colored banners + mark |
| Sport mark | Existing `wnba_basketball.png` (not crossed bats) |
| Banner colors | Same roles as MLB: Leaders orange, Standings navy, Futures dark green, Props emerald; Player distinct accent (e.g. burnt orange) |
| Matchups | Leave as-is (`LeagueHero` already present) |
| Prop Picks board | Banner chrome (+ app tabs if filters already exist); **keep** current wide table |
| Player page | Banner chrome only; keep headshot/bio/recent games below |
| Game live/final | Broadcast score header; **Summary \| Box** under header; two-column Summary; Box = existing box score |
| Status label | **Above** score slabs (e.g. Final / live clock) |
| Venue | **Not** in score header; Game Info rail only |
| Player of the Game | **Out of scope** — omit |
| Pitch zone | Omit (no WNBA equivalent) |
| Hit chart → Shot chart | Existing `ShotChart` on Summary **right** rail (MLB hit-chart slot) |
| Play feed | MLB pattern: **Scoring plays \| All plays** switch; default scoring; group by period (colored cards like MLB half-innings). Use existing `plays.scoring` |
| Pregame | Broadcast header chrome wrapping existing stack: MatchupPrediction → ProjectedStarters → SeasonLeaders → InjuryReport |
| Pregame Props tab | **Not** in this pass |
| Backend | **No new API routes** — existing WNBA game + league endpoints |

> **Superseded (pregame only):** Scheduled matchup preview layout, Away/Home team-preview, Props tab, and related game-detail enrichment are implemented in [2026-08-10-wnba-mlb-parity-matchup-preview-design.md](./2026-08-10-wnba-mlb-parity-matchup-preview-design.md). Live/final Summary\|Box chrome from this doc remains in force.
| NBA | Unchanged |

## Non-goals

- Extracting a shared `LeagueHubBanner` / game-center shell used by both MLB and WNBA
- MLB-style hybrid Prop Picks list, fair/edge ranking, or sharp-book UX rewrite
- Game-scoped Props tab on WNBA pregame
- Player of the Game card
- Pitch-zone analogue
- Changing home scoreboard / ticker chrome
- Dropping WNBA Leaders → player profile links (MLB has no profiles; keep WNBA links)

## Architecture

### Hub banners

```
LeagueLeadersPage / Standings / Futures / PropPicks / Player
        │
        ├── LeagueSubnav (unchanged)
        ├── Wnba*Header banner (mark + title; Props may include existing app chrome)
        └── Existing board / player content
```

- Implement as WNBA components under `frontend/src/features/basketball/league/` (and player page), mirroring `MlbLeadersHeader` / `MlbStandingsHeader` / `MlbFuturesHeader` / `MlbPropPicksHeader` structure and typography (~32–36px title, ~7.5rem min height).
- Wire into existing `League*Page` and `LeaguePlayerPage`.

### Game detail

```
GameDetailPage
        │
        ├── scheduled → WnbaPregameCenter
        │                 header + MatchupPrediction + Starters + Leaders + Injuries
        ├── live/halftime → WnbaLiveCenter
        └── final → WnbaFinalCenter
                      │
                      ├── Score header (status ABOVE slabs; no venue)
                      ├── Summary | Box tabs (UNDER header)
                      ├── Summary:
                      │     Left: Scoring/All play feed (period groups)
                      │     Right: quarter score → team stats → win prob → ShotChart → Game Info
                      └── Box: existing BoxScore
```

Primary files today:

| Role | Current | Target |
| --- | --- | --- |
| Page | `frontend/src/pages/GameDetailPage.tsx` | Route to status centers |
| Shot chart | `features/basketball/game/ShotChart.tsx` | Right-rail Summary slot |
| Play-by-play | `features/basketball/game/PlayByPlay.tsx` | Replace/adapt to MLB scoring/all + period groups |
| MLB reference | `MlbLiveCenter` / `MlbFinalCenter` / `MlbFinalPlayFeed` | Layout + play-filter pattern only |

### Data

| Need | Source |
| --- | --- |
| Shots, plays (`scoring`), win prob + `teamStats`, box, venue, status | Existing `GET /api/wnba/games/{espnEventId}` via `useGameDetail` / `mapGameDetail` |
| Quarter linescore | Prefer API if present; else derive from scoring plays / period scores; else fall back to simple total-score card |
| Hub seasons / boards | Existing `/api/wnba/leaders`, standings, futures, props/today |

No OpenAPI / backend contract changes required for the happy path. If period linescore cannot be derived cleanly, ship the simple score card without blocking the shell.

### Error / empty states

- Missing shots → ShotChart empty state (existing behavior)
- No scoring plays → “No plays available” (mirror MLB feed)
- Missing venue → omit Game Info venue row
- Hub data errors → keep existing board error/loading patterns under new banners

## Testing

- Hub headers: banner color mark present; title includes WNBA + season (or “Props” / “Player” as appropriate)
- Game center: status above header; Summary|Box under header; ShotChart on Summary rail; Box tab shows box score
- Play feed: defaults to Scoring plays; All plays shows non-scoring; period grouping
- No Player of the Game / pitch zone / venue in score header
- Player page: banner above existing header content
- Regression: Matchups page unchanged; Prop Picks table still renders

## Success criteria

1. WNBA Leaders / Standings / Futures / Prop Picks / Player visually match MLB hub banner chrome (with basketball mark).
2. Live/final WNBA game pages use Summary|Box broadcast layout with shot chart where MLB shows hit chart.
3. Play feed uses Scoring plays | All plays like MLB.
4. No new backend endpoints; Prop Picks board UX otherwise unchanged.

## Follow-ups (out of this pass)

- Shared league banner abstraction used by MLB + WNBA
- Pregame Props tab filtered from `/api/wnba/props/today`
- Prop Picks hybrid list / fair edge parity
- Stronger linescore if ESPN exposes period scores natively
