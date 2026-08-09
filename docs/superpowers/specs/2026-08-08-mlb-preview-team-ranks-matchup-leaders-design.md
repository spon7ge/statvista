# MLB Preview Team Ranks & Matchup Leaders

Date: 2026-08-08  
Status: Draft

## Goal

On MLB game **Preview**, enrich the existing **Team Stats** comparison with league ranks, and add a **Matchup Leaders** box under Matchup prediction that shows up to three league-ranked players from either team’s active roster for a short curated set of categories.

Brand as **statvista**.

## Decisions

| Topic | Choice |
| --- | --- |
| Team Stats display | Keep away/home raw comparison; add league rank beside each value (e.g. `142 · #3`) |
| Rank source | League-wide `GET /api/v1/teams/stats?stats=season&group={hitting\|pitching}&season=&sportId=1`, sorted server-side |
| Player pool | Active roster for both teams (not limited to projected lineup) |
| Leaders categories | Hitting: HR, AVG, OPS · Pitching: ERA, SO, WHIP (tabs) |
| Leaders depth | Up to 3 combined across both rosters, in league rank order |
| Placement | Team Stats stays left column; Matchup Leaders under Matchup prediction (right column) |
| API approach | Extend `GET /api/mlb/games/{gamePk}` (Approach 1) — no new public routes |
| Missing data | Soft-fail; omit ranks / hide leaders box; never fail game detail |

## Architecture

```
MlbGameDetailPage (scheduled Preview)
  └── MlbPregameCenter → MlbProjectedLineups
        left column:
          Projected lineups
          MlbSeasonTeamStats   ← ranks added beside values
          MlbInjuryReport
        right column:
          MlbGameOddsBoard
          MlbGameInfo
          MlbMatchupPrediction
          MlbMatchupLeaders    ← new (null → render nothing)

GET /api/mlb/games/{gamePk}
  └── season team stats attachment (evolved)
        league-wide /teams/stats (hitting + pitching)
        → values + ranks for away/home on season_team_stats
        (replaces per-team /teams/{id}/stats when league path succeeds;
         fall back to current per-team values with null ranks)
  └── new matchup leaders attachment
        + active rosters (away + home)
        + league leaderboards for 6 categories (top 10 each)
        + intersect → top 3 per category
```

## Page structure

### Preview

Left column unchanged in order: lineups → Team Stats → Injuries.

Right column stack:

1. `MlbGameOddsBoard` (existing)
2. `MlbGameInfo` (existing)
3. `MlbMatchupPrediction` (existing)
4. `MlbMatchupLeaders` (new)

### Live / Final / Box

No Matchup Leaders UI. Rank fields may still be present on the payload if attached for all statuses (preferred when cached cheaply); UI simply does not render the new box.

## Team Stats UI

- Existing charcoal `GameSection`, title **Team Stats**, away | label | home rows.
- Stats unchanged: HR, R, H, AVG, OBP, SLG, ERA, SO, BB.
- When `{stat}_rank` is present, show muted `#N` beside the value (same row, same side).
- When rank is missing, show value only (current look).
- Leader dots still compare **raw values** (not ranks). Lower-is-better for ERA and BB unchanged.

## Matchup Leaders UI

- Charcoal `GameSection`; title **Matchup Leaders** (18px semibold white).
- Category tabs: **HR · AVG · OPS · ERA · SO · WHIP**.
- Active tab: up to 3 rows — league rank, player name, team abbrev, optional side logo from `detail.away` / `detail.home` by `side`, stat value.
- Empty category (roster ∩ leaders = ∅): short copy — “No top leaders on either roster.”
- Payload always includes all six category keys when `matchup_leaders` is non-null (empty `leaders` lists allowed).
- Entire `matchup_leaders` null → component returns `null` (no empty shell).

## Data & API

### Team ranks — extend `MlbSeasonTeamStatLine`

Additive optional rank fields (1-based), parallel to existing values:

```
hr_rank, r_rank, h_rank, avg_rank, obp_rank, slg_rank,
era_rank, so_rank, bb_rank: int | null
```

Values remain as today (`hr`, `r`, `h`, `avg`, `obp`, `slg`, `era`, `so`, `bb`).

### Matchup leaders — new on `MlbGameDetail`

```
matchup_leaders: MlbMatchupLeaders | null

MlbMatchupLeaders:
  categories: list[MlbMatchupLeaderCategory]

MlbMatchupLeaderCategory:
  key: "hr" | "avg" | "ops" | "era" | "so" | "whip"
  label: str          # e.g. "HR", "AVG"
  leaders: list[MlbMatchupLeaderEntry]  # 0–3

MlbMatchupLeaderEntry:
  rank: int
  player_id: str
  name: str
  team_abbrev: str
  side: "away" | "home"
  value: str          # display-ready (same formatting idea as /mlb/leaders)
```

### Upstream Stats API

| Need | Endpoint | Notes |
| --- | --- | --- |
| League team season stats | `GET /api/v1/teams/stats?stats=season&group={hitting\|pitching}&season=&sportId=1` | One call per group; sort client/server to assign ranks for both clubs |
| Active roster | `GET /api/v1/teams/{teamId}/roster?rosterType=active` | Away + home; player ids for intersection |
| League leaders | Prefer existing season `/api/v1/stats` sorted pattern in `mlb/leaders.py` (GP + qualification) | Categories: HR, AVG, OPS, ERA, SO, WHIP; rate boards use `playerPool=qualified` |

Optional: `/api/v1/stats/leaders` is acceptable if it proves simpler for a category, but prefer one consistent path with the Leaders page for formatting and qualification.

### Ranking rules (teams)

- Sort all MLB teams by the stat for that season.
- Higher-better: HR, R, H, AVG, OBP, SLG, SO.
- Lower-better: ERA, BB.
- **Competition ranking** on ties (e.g. 1, 2, 2, 4).
- Only need ranks for the two teams in the game; still compute from the full league list.

### Leaders intersection rules

1. Fetch (or cache) league board for the category with **limit = 10** (same TOP_N as `/api/mlb/leaders`). Players outside the top 10 do not appear — by design.
2. Load active roster person ids for away and home.
3. Keep board rows whose `player_id` is in either roster set.
4. Preserve league order; take first **3**.
5. Tag `side` from which roster the player belongs to.
6. Always emit all six categories when the block is non-null; a category with no roster overlap has `leaders: []`.

### Caching

- League team-stats (hitting + pitching): season-scoped TTL ~10–15 min, shared across games.
- Per-category leaderboards: same TTL band as `/api/mlb/leaders` (~10 min).
- Active rosters: shorter per-team TTL (e.g. ~5–15 min).

### Soft-fail

- League team-stats path fails → fall back to existing per-team value fetch; all `*_rank` fields null.
- One roster fails → intersect with the other roster only.
- One category leaderboard fails → that category has `leaders: []`; keep the other five.
- Rosters and all six leaderboards unusable → `matchup_leaders: null`.
- Never raise out of game detail for these enrichments.

### Season

Use the same current MLB season year convention as standings/leaders (`America/New_York` year), consistent with existing season team stats attachment.

## Frontend mapping

- Extend `mapMlbGameDetail` / types for rank fields and `matchupLeaders`.
- `MlbSeasonTeamStats`: render `#N` when rank non-null.
- New `MlbMatchupLeaders` under `MlbMatchupPrediction` in `MlbProjectedLineups` right column.
- Tests: ranks shown/hidden; leaders placement; tabs; empty category copy; null hide.

## Testing

### Backend

- Parse league `/teams/stats` splits → competition ranks for both teams.
- Leaders ∩ roster → ≤3 entries with correct `side` / `rank` / `value`.
- Soft-fail: roster miss, category miss, total miss.
- Schema: game detail includes new fields without breaking existing clients.

### Frontend

- Team Stats shows muted rank beside value; omits when null.
- Matchup Leaders under Matchup prediction; hidden when null.
- Tab switch updates list; empty state copy when `leaders` empty.

## Out of scope

- Separate public API routes for ranks or leaders
- Lineup-only (vs roster) filtering
- Team-level leaderboard UI / “rankings toggle”
- Extra leader categories beyond the six
- Showing Matchup Leaders on Live / Final
- Changing which Team Stats columns are shown

## Success criteria

- Preview Team Stats shows league `#N` next to values when ranks resolve.
- Preview right rail shows Matchup Leaders under Matchup prediction with six tabs and up to three roster-overlapping league leaders per tab.
- Stats API / roster failures never break game detail; UI degrades gracefully.
