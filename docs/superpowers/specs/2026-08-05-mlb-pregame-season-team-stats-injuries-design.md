# MLB pregame season Team Stats + Injuries

Date: 2026-08-05  
Status: Approved for planning  
Extends: [2026-08-04-mlb-projected-lineup-matchup-ui-design.md](./2026-08-04-mlb-projected-lineup-matchup-ui-design.md)  
Visual reference: ESPN-style season comparison + IL list under Projected lineups

## Goal

On MLB game Preview, under **Projected lineups**, show a season-to-date **Team Stats** comparison and an **Injuries** report for away vs home — even when RotoWire lineups are unavailable. Soft-merge data onto the existing game detail payload.

## Decisions

| Topic | Choice |
| --- | --- |
| Team Stats meaning | Season-to-date team totals (not per-game boxscore) |
| Stats source | MLB Stats API team season hitting + pitching |
| Injuries source | ESPN summary (same bridge family as win probability) |
| Delivery | Soft-merge onto `GET /api/mlb/games/{gamePk}` |
| Placement | Always under Projected lineups inside Preview (`MlbProjectedLineups` stack) |
| Lineups gate | Independent — show stats/injuries even when “Lineups unavailable” |
| Leader mark | Team-color dots (same pattern as live/final `MlbFinalTeamStats`) |
| Stat rows | `HR · R · H · AVG · OBP · SLG · ERA · SO · BB` |
| SO / BB | Team pitching strikeouts / walks |
| ERA / BB | Lower is better for leader (pitching ERA and walks allowed) |
| SO | Higher is better (pitching strikeouts) |
| Existing game `team_stats` | Unchanged (live/final Summary only) |

## Layout / UX

```
┌─────────────────────────────────────────────┐
│ Projected lineups (existing)                │
│ … pitcher card + 1–9 table OR unavailable … │
├─────────────────────────────────────────────┤
│ [Away logo]     Team Stats     [Home logo]  │
│ 146 ●              HR              141      │
│ … R H AVG OBP SLG ERA SO BB …               │
├─────────────────────────────────────────────┤
│ Injuries                                    │
│ Away abbrev          │ Home abbrev          │
│ Name  Pos            │ Name  Pos            │
│ Status · Detail      │ Status · Detail      │
└─────────────────────────────────────────────┘
```

- Leader: small team-color dot next to the better value; ties unmarked. Lower-better: `ERA`, `BB`. Higher-better: all other rows including `SO`.
- Missing/unparsable value on either side → show `–`, no leader mark for that row.
- `season_team_stats` null → hide Team Stats section.
- `injuries` null → hide Injuries section.
- One side empty injuries, other non-empty → show report; empty side “None listed”.
- Both sides empty → treat as null (hide), matching WNBA injury report behavior.
- Away / Home preview tabs unchanged (stubs).

## Architecture

```
GET /api/mlb/games/{gamePk}
        │
        ├─ Stats live feed normalize (existing)
        ├─ soft-merge ESPN win probability (existing)
        ├─ soft-merge season_team_stats  ← NEW
        │     Stats API team season hitting + pitching
        │     year from game date; cache teamId|season
        └─ soft-merge injuries           ← NEW
              ESPN summary.injuries via existing event-id bridge
                │
MlbPregameCenter (Preview)
        │
        └─ MlbProjectedLineups
              ├─ lineup UI (existing)
              ├─ MlbSeasonTeamStats
              └─ MlbInjuryReport
```

Live/Final centers do not render these pregame sections (payload may still carry fields; UI ignores outside Preview).

## API

### Additive fields on `MlbGameDetail`

```text
season_team_stats: MlbSeasonTeamStatsPair | null
injuries: MlbInjuries | null
```

### Season line

```text
MlbSeasonTeamStatLine {
  hr: int | null
  r: int | null
  h: int | null
  avg: str | null
  obp: str | null
  slg: str | null
  era: str | null
  so: int | null
  bb: int | null
}
```

`MlbSeasonTeamStatsPair { away, home }` — both sides required when the pair is non-null.

### Injuries

Mirror WNBA / basketball shape:

```text
MlbInjury {
  name: str
  position: str | null
  status: str
  detail: str | null
}

MlbInjuries { away: list[MlbInjury], home: list[MlbInjury] }
```

### Stats API (season team stats)

- Hitting: team season stats for `hr, r, h, avg, obp, slg` (exact Stats path/group as implemented; prefer official team season endpoints over boxscore).
- Pitching: team season `era, so (strikeOuts), bb (baseOnBalls)`.
- Season year = four-digit year from game `gameDate` (ET date already on detail).
- Team ids from normalized away/home on the Stats-backed detail.

### ESPN (injuries)

- Resolve ESPN event id (existing `resolve_espn_event_id` / cached `espn_event_id`).
- Prefer reusing ESPN summary already fetched for win probability when present; otherwise soft-fetch summary for injuries.
- Map ESPN injury blocks to away/home by team id; fields: name, position, status, detail (e.g. body part / IL type).
- Soft-fail: never fail Stats-backed detail if ESPN is down.

### Cache

| Data | Key | TTL guidance |
| --- | --- | --- |
| Season team line | `teamId\|season` | ~10–15 minutes |
| ESPN summary / event id | Existing detail cache path | Align with current WP soft-merge |

Enrichment must not break existing detail TTL or live poll semantics.

### Failure

| Case | Behavior |
| --- | --- |
| Season fetch fails / both sides unusable | `season_team_stats = null` |
| ESPN injuries unavailable | `injuries = null` |
| Partial season fields | Keep pair; null fields → UI `–` |
| Incomplete RotoWire | Lineups unavailable; stats/injuries still attempted |

**Docs:** Update OpenAPI golden + `md/system-design.md` page ↔ API table for `/mlb/games/:gamePk` (note season stats + injuries on detail; Preview UI under projected lineups).

## Components

| Piece | Responsibility |
| --- | --- |
| `game_detail` soft-merge | Attach `season_team_stats` + `injuries` |
| Stats team-season helper | Fetch/normalize hitting + pitching into `MlbSeasonTeamStatLine` |
| ESPN injuries normalize | Map summary injuries → `MlbInjuries` (extend `mlb_bridge` or sibling) |
| `MlbSeasonTeamStats` | Comparison table; leader dots; hide if null |
| `MlbInjuryReport` | Two-column IL list; hide if null |
| `MlbProjectedLineups` | Render both sections below lineup UI |
| Mapper / OpenAPI | `season_team_stats`, `injuries` on frontend types |

Do not overload live/final `MlbFinalTeamStats` with season data — keep a separate pregame component so game boxscore stats stay distinct.

## Edge cases

- Scheduled game with no ESPN event match → injuries null; season stats may still load from Stats
- Doubleheader / abbrev ambiguity for ESPN match → same rules as existing WP resolve
- Rate stats as strings (`.261`); counting stats as ints; format thousands in UI if desired (optional polish)
- Live/final: do not show season Team Stats / Injuries in Summary; optional to still populate for future use

## Testing

- Backend: season line from Stats fixtures; ESPN injuries → schema; soft-fail leaves detail OK; pair null when unusable
- Frontend: row order and leader dots (ERA and BB lower-better; SO higher-better); injuries columns + “None listed”; sections under lineups when unavailable; hide when null
- OpenAPI golden + frontend schema regen when fields land
- `md/system-design.md` table updated

## Out of scope

- Away / Home tab content beyond stubs
- Changing live/final Summary `MlbFinalTeamStats` (game boxscore)
- Confirmed Stats API lineups replacing RotoWire
- Last-N / home-away split season views
- Blue-pill leader styling from the ESPN screenshot
- Non-ESPN injury sources

## Success criteria

- Preview shows season Team Stats and Injuries under Projected lineups when data is available
- Sections still appear when RotoWire lineups are unavailable
- Soft ESPN/Stats failures never 502 the game detail
- Live/final game team stats UI remains unchanged
