# WNBA MLB-parity matchup preview

Date: 2026-08-10  
Status: Approved for planning  
Product: **statvista**

Supersedes (pregame layout + scope):

- Vertical stack sections of [2026-07-30-wnba-scheduled-matchup-preview-design.md](./2026-07-30-wnba-scheduled-matchup-preview-design.md)
- Pregame “existing stack / no Props tab / no new APIs” notes in [2026-08-09-wnba-mlb-parity-chrome-design.md](./2026-08-09-wnba-mlb-parity-chrome-design.md)

Keeps: RotoWire projected starters ([2026-07-31-wnba-rotowire-projected-starters-design.md](./2026-07-31-wnba-rotowire-projected-starters-design.md)); live/final Summary|Box chrome from 2026-08-09 parity.

## Goal

Bring scheduled WNBA game detail to MLB-style matchup preview: teams header with **record** and **last 10**, centered **Preview / Away / Home / Props** tabs, and a two-column Preview grid with odds, game info, prediction, leaders, projected starters, team stats + ranks, and injuries.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Full MLB tab parity: Preview + Away + Home + Props |
| Approach | Mirror MLB API + UI pattern (Approach 1) — ESPN-first |
| Header | Flush away\|home color slabs; show `record` and `{last10} in Last 10`; date / status / share meta above |
| Tabs | Centered under header: Preview · Away team name · Home team name · Props |
| Preview left | Projected Starters → Game Info → Matchup Prediction → Game Leaders |
| Preview right | Odds → Team Stats + `#rank` → Injuries |
| Game Leaders | MLB-style cards; top across both teams for **PPG · RPG · APG** (one leader per category) |
| Team Stats rows | Curated ESPN team-stats subset: **PTS, FG%, 3P%, FT%, REB, AST, STL, BLK, TO** + league rank |
| Away / Home | Season leaders (PPG / RPG / APG for that team) + full roster averages table |
| Props | PrizePicks / Underdog sub-tabs; client-filter `GET /api/wnba/props/today` to this game’s teams |
| Odds | Reuse `GET /api/wnba/odds/today`; game-scoped board on Preview |
| Data sources | ESPN primary (summary, standings, team stats, roster); keep RotoWire for starters |
| Missing data | Soft-fail; hide empty sections / omit ranks; never fail game detail |
| Live / final | Unchanged (Summary \| Box); no this Preview chrome |
| NBA | Unchanged |

## Non-goals

- Shared MLB/WNBA shell refactor
- New DFS scrapers or Prop Picks product rewrite
- Pulling ranks from stats.wnba.com / nba_api unless ESPN fails and a follow-up explicitly adds fallbacks
- Dumping all ESPN team-stat columns into Preview (use curated subset above)
- Changing Matchups hub cards beyond what’s needed for consistency

## Architecture

```
/games/:espnEventId (scheduled)
  GameDetailPage
    └── WnbaPregameCenter
          ├── WnbaPregameBroadcastHeader
          │     record + last10 slabs · centered tabs
          ├── Preview → two-column grid
          │     left:  ProjectedStarters · WnbaGameInfo · MatchupPrediction · WnbaGameLeaders
          │     right: WnbaGameOddsBoard · WnbaSeasonTeamStats · InjuryReport
          ├── Away | Home → WnbaTeamPreview
          └── Props → PrizePicks | Underdog (filter today’s props to game)

GET /api/wnba/games/{espnEventId}          # enrich scheduled payload
GET /api/wnba/odds/today                   # Preview odds (reuse)
GET /api/wnba/props/today                  # Props tab (reuse; client-filter to this game’s teams)
GET /api/wnba/games/{id}/team-preview?side= # new Away/Home payload
```

### Backend enrichment (scheduled `game` detail)

Extend `GET /api/wnba/games/{espnEventId}` (soft-fail each attachment):

| Field | Source |
| --- | --- |
| `away.record` / `home.record` | ESPN standings (W-L string) |
| `away.last_10` / `home.last_10` | ESPN standings (`Last Ten` / last-10 record string, W-L) |
| `season_team_stats` | ESPN WNBA team stats table → values + league ranks for curated rows |
| `game_leaders` | ESPN summary leaders reshaped to card payload (PPG / RPG / APG, one each across both teams) |

Keep existing: `matchup_prediction`, `projected_starters`, `injuries`, venue / game info fields.

`season_leaders` on game detail may remain on the payload for backward compatibility but is **not** rendered on Preview (use `game_leaders` cards). Away/Home leaders come from **team-preview**, not from `season_leaders`.

### New team-preview route

`GET /api/wnba/games/{espnEventId}/team-preview?side=away|home`

Response (MLB-shaped, basketball fields):

- Leaders: PPG, RPG, APG for that team (value, optional league rank, name, headshot, jersey/position as available)
- Roster rows: jersey, position, GP, MIN, PTS, REB, AST, STL, BLK, TO, FG%, 3P%, FT%

Source: ESPN team roster + season player stats. Soft-fail → empty leaders/roster with 200 when possible; 404 only if game/side invalid.

## Page structure

### Header

- Meta: game date label · status/start time · Share
- Flush `grid-cols-2` team slabs (no gap), rounded container — logos centered in slab like MLB; text away right-aligned / home left-aligned
- Under name: record; then `{last10} in Last 10` when present
- Centered tablist: Preview | {away name} | {home name} | Props

### Preview columns

**Left (top → bottom)**

1. Projected Starters (existing RotoWire / ESPN fallback)
2. Game Info (`WnbaGameInfo` — date, venue; weather/umpires N/A omit)
3. Matchup Prediction (existing)
4. Game Leaders — three cards PPG / RPG / APG

**Right (top → bottom)**

1. Odds board — moneyline / total / spread per available book
2. Team Stats — away | label | home; value + muted `#rank`; highlight leader by raw value
3. Injuries (existing)

### Away / Home

- Leader cards for PPG · RPG · APG
- Full roster table with season averages (columns listed above)

### Props

- Sub-tabs: PrizePicks | Underdog (mirror MLB pregame)
- Client-filter `/api/wnba/props/today` to players on this game’s two teams (no new game-scoped props route in this pass)
- Empty: “No props for this game”; error copy without breaking the shell

## Frontend components

| Piece | Action |
| --- | --- |
| `WnbaPregameCenter` | Tabs + column layout |
| `WnbaPregameBroadcastHeader` (new; mirror MLB) | Record, last10, centered pregame tabs — leave live `WnbaBroadcastHeader` for Summary\|Box |
| `WnbaGameOddsBoard` | New (MLB odds board pattern) |
| `WnbaSeasonTeamStats` | New |
| `WnbaGameLeaders` | New card UI (replace Preview use of list `SeasonLeaders`) |
| `WnbaTeamPreview` | New |
| `ProjectedStarters`, `MatchupPrediction`, `InjuryReport`, `WnbaGameInfo` | Reuse / mount in new slots |
| Mappers / types / OpenAPI | Extend for new fields + team-preview |
| Hooks | `useWnbaOdds` (existing), props hook filtered by game, `useWnbaTeamPreview` (new) |

## Error handling

- Enrichment failures: leave field null; UI hides section or omits `#rank`
- Odds / props / team-preview query errors: section-level message; header + other tabs still work
- Never 500 the whole game detail solely because standings/stats/leaders failed

## Testing

- Backend: normalize/attach record, last_10, season_team_stats (+ranks), game_leaders; team-preview leaders + roster; soft-fail paths
- Frontend: header shows record/last10; centered tabs; Preview column order; leaders/odds/stats empty states; Away/Home render; Props filter; mapper snake→camel
- Regen OpenAPI / `api.schema.d.ts` when schemas change
- Update `md/system-design.md` page ↔ API row for `/games/:espnEventId` and new team-preview route

## Out of scope follow-ups

- NBA scheduled preview parity
- Non-ESPN rank fallbacks
- Expanding Preview team-stats to the full ESPN column set
