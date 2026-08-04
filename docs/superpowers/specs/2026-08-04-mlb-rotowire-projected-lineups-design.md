# MLB projected lineups (RotoWire) on pregame Preview

Date: 2026-08-04  
Status: Approved for planning  
Reference: [RotoWire MLB Daily Lineups](https://www.rotowire.com/baseball/daily-lineups.php) (today + tomorrow); WNBA pattern in `docs/superpowers/specs/2026-07-31-wnba-rotowire-projected-starters-design.md`

## Goal

On **scheduled** `/mlb/games/:gamePk` **Preview** tab, show **projected lineups** from RotoWire: starting pitcher + batting order (1–9) for the selected team, in **one box toggled by team logos**. Data comes from a dedicated dated API (not soft-merged into game detail). When lineups cannot be matched or are incomplete, still show the box with **“Lineups unavailable”**.

Away / Home header tabs remain stubs. Live and final pages are unchanged.

## Decisions

| Topic | Choice |
| --- | --- |
| Content | Starting pitcher + batting order 1–9 (full projected lineup) |
| Data wiring | Separate `GET /api/mlb/lineups?date=YYYY-MM-DD` (Preview fetches) |
| Date model | Client passes game’s ET calendar date; RotoWire covers today + tomorrow |
| Missing / incomplete | Always show box with **“Lineups unavailable”** |
| UI layout | One box; toggle away/home via team logos (default away) |
| Approach | Dedicated MLB RotoWire scraper + dated lineups API + Preview component |
| Soft-merge into game detail | Out of scope |
| Odds / weather / umpire | Out of scope |

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ [existing MlbPregameBroadcastHeader — Preview active]    │
├──────────────────────────────────────────────────────────┤
│ Projected lineups · RotoWire expected lineup             │
│           [Away logo]     [Home logo]                    │
│           (active state underlined / emphasized)         │
│──────────────────────────────────────────────────────────│
│ SP   Name (hand) · record · ERA                          │
│ 1    POS  Batter name (hand optional)                    │
│ …                                                        │
│ 9    POS  Batter name                                    │
└──────────────────────────────────────────────────────────┘
```

Unavailable state: same title + logo row (when teams known from game detail) + body text **“Lineups unavailable”**.

## Architecture

```
MlbPregameCenter (Preview tab)
        │
        ├─ detail.game_date (YYYY-MM-DD ET)   ← additive on game detail
        ├─ detail.away / home abbrev + logos
        │
        ▼
  useMlbLineups(date) → GET /api/mlb/lineups?date=
        │
        ▼
  mlb_lineups service (cache by ET date, ~3 min TTL)
        │
        ▼
  MLBDailyLineups scraper → rotowire.com/baseball/daily-lineups.php
        │
        ▼
  Match game by away_abbrev + home_abbrev
        │
        ├─ complete match → MlbProjectedLineups (logo toggle)
        └─ else → MlbProjectedLineups unavailable placeholder
```

## API

### `GET /api/mlb/lineups?date=YYYY-MM-DD`

| Item | Rule |
| --- | --- |
| `date` | Required; ET calendar date `YYYY-MM-DD` |
| Supported slate | Today and tomorrow relative to ET “now” (what RotoWire publishes). Other dates → `200` with `games: []` (Preview shows unavailable) |
| Cache | In-memory parsed slate, keyed by `date`, TTL ~180s |
| Failure | Soft: prefer stale cache if present; else `200` with empty `games` (do not 502 the Preview shell). Hard 502 only if we choose consistency with other scrape routes — prefer empty games for UI path C |

Response:

```json
{
  "date": "2026-08-04",
  "games": [
    {
      "away_abbrev": "LAA",
      "home_abbrev": "BAL",
      "status": "expected",
      "away": {
        "pitcher": {
          "name": "G. Rodriguez",
          "hand": "R",
          "record": "3-3",
          "era": "7.98"
        },
        "batters": [
          { "order": 1, "position": "SS", "name": "Zach Neto", "hand": "R" }
        ]
      },
      "home": {
        "pitcher": { "name": "Cade Povich", "hand": "L", "record": "1-1", "era": "5.12" },
        "batters": []
      }
    }
  ],
  "source": "rotowire",
  "fetched_at": "2026-08-04T17:00:00+00:00"
}
```

**Completeness for UI match:** Treat a side as complete when `pitcher.name` is present and `batters` has exactly 9 ordered rows. Preview only shows the lineup UI when **both** sides are complete for the matched game; otherwise unavailable.

### Additive on `GET /api/mlb/games/{gamePk}`

| Field | Source | Use |
| --- | --- | --- |
| `game_date` | `gameData.datetime.officialDate` (ET calendar `YYYY-MM-DD`) | Preview query param |

Existing `game_date_label` unchanged.

## Components

| Piece | Responsibility |
| --- | --- |
| `src/scrapers/mlb_rotowire_lineups.py` (or extend starters module) | Fetch + parse RotoWire MLB daily lineups HTML into per-game SP + batters |
| `backend/app/services/mlb_lineups.py` | Cache, date validation, normalize response |
| `backend/app/api/routes/mlb_lineups.py` | `GET /api/mlb/lineups` |
| `backend/app/schemas/mlb_lineups.py` | Response models |
| `MlbProjectedLineups` | Logo toggle + SP/order list or unavailable |
| `useMlbLineups(date)` | TanStack Query hook |
| `MlbPregameCenter` | Preview tab mounts lineups; Away/Home tabs stay stubs |
| Game detail schema/mapper | Add `game_date` |

UI note string: **“RotoWire expected lineup”** (v1; ignore confirmed vs expected in copy even if `status` is parsed).

Default selected side: **away**.

## Edge cases

- Scrape / parse failure → empty `games` → Preview **Lineups unavailable**
- Date not today/tomorrow on RotoWire → empty `games` → unavailable
- Abbrev mismatch (Stats API vs RotoWire) → try known aliases if needed; else unavailable
- Incomplete side (&lt;9 batters or missing SP) → unavailable (all-or-nothing for the matched game)
- Missing team logos → text abbrev buttons still toggle
- Live / final / halftime → no lineups fetch

## Testing

- Scraper: fixture HTML → pitcher, 9 batters, abbrevs, hands when present
- Service/route: cache hit, empty games for unsupported date, soft failure
- Frontend: logo toggles away/home; matched lineup renders; unavailable copy; only on Preview
- Mapper: `game_date` on detail view

## Out of scope

- Soft-merge lineups into MLB game-detail payload
- Odds, weather, umpire, DFS salaries from the RotoWire card
- Real Away / Home tab bodies
- Restoring missing WNBA `rotowire_starters_scraper.py` on main (tracked separately if needed)
- Computing lineups from Stats API boxscore

## Success criteria

- Scheduled Preview shows toggleable projected lineup when RotoWire has a complete matchup for that ET date
- Missing data always shows **Lineups unavailable** in the same box
- Live and final game pages unchanged
- `GET /api/mlb/lineups?date=` is documented in OpenAPI and `md/system-design.md`
