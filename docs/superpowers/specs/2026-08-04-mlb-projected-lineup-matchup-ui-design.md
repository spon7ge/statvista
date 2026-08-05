# MLB projected lineup matchup UI (RotoWire + Stats API)

Date: 2026-08-04  
Status: Approved for planning  
Extends: [2026-08-04-mlb-rotowire-projected-lineups-design.md](./2026-08-04-mlb-rotowire-projected-lineups-design.md)  
Visual reference: user mock (pitcher season strip + lineup table with career H2H columns)

## Goal

Restyle Preview **Projected lineups** to match the mock: selected team’s starting pitcher season card, “Lineup vs [opposing SP]” subhead, and a 1–9 table with career batter-vs-pitcher **AB / H / HR / AVG**. Keep RotoWire as the source of who is in the lineup; enrich the open matchup via MLB Stats API through a dedicated matchup endpoint.

## Decisions

| Topic | Choice |
| --- | --- |
| Lineup who | RotoWire (existing slate) |
| Pitcher card stats | MLB Stats API season-to-date pitching (W-L, ERA, IP, K, WHIP) |
| Batter columns AB/H/HR/AVG | Career vs opposing SP (`vsPlayerTotal`) |
| Pairing on toggle | Selected team’s SP card + batters’ H2H vs the other team’s SP |
| Architecture | Keep `GET /api/mlb/lineups`; add `GET /api/mlb/lineups/matchup` |
| Missing H2H / unresolved ID | Soft-fail: show RotoWire name/pos; stat cells `–` |
| Incomplete RotoWire game | Unchanged: **Lineups unavailable** |
| Confirmed Stats API lineups | Out of scope |

## Layout / UX

```
┌─────────────────────────────────────────────┐
│ Projected lineups                           │
│ RotoWire expected lineup                    │
│ [Away logo]  [Home logo]                    │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ RHP Zack Littell                        │ │
│ │ W-L   ERA    IP     K     WHIP          │ │
│ │ 7–8   4.94   105.2  68    1.34          │ │
│ └─────────────────────────────────────────┘ │
│ Lineup vs Jesús Luzardo                     │
│ #  Batter         Pos  AB  H  HR  AVG       │
│ 1  James Wood     RF   10  3   0  .300      │
│ …                                           │
│ 9  …                                        │
└─────────────────────────────────────────────┘
```

- Pitcher card title: `{hand}HP {fullName}` when hand known (e.g. `RHP Zack Littell`); else name only.
- Subhead uses opposing SP full name when resolved; else RotoWire name or `TBD`.
- Empty H2H (no career ABs / lookup miss) → `–` in AB/H/HR/AVG (do not invent `.000`).
- Logo toggle, default away, and unavailable copy stay as in the parent spec.

## Architecture

```
MlbPregameCenter (Preview)
        │
        ├─ useMlbLineups(date)
        │     → GET /api/mlb/lineups?date=
        │     → match by abbrev; completeness gate (both sides SP + 9)
        │
        └─ useMlbLineupMatchup(date, away, home)  [when slate match is complete]
              → GET /api/mlb/lineups/matchup?date=&away=&home=
                    │
                    ├─ reuse cached RotoWire slate
                    ├─ find game by away/home abbrev
                    ├─ resolve mlbam personIds (people search, cached)
                    ├─ SP season pitching stats
                    ├─ each batter career vs opposing SP (vsPlayerTotal)
                    └─ enriched single-game payload
```

RotoWire remains source of truth for roster order. Stats API only enriches the one Preview matchup. Toggling away/home is client-side over the same enriched payload.

## API

### Existing (unchanged)

`GET /api/mlb/lineups?date=YYYY-MM-DD`

### New

`GET /api/mlb/lineups/matchup?date=YYYY-MM-DD&away=WSH&home=SF`

| Item | Rule |
| --- | --- |
| Params | `date` (ET `YYYY-MM-DD`), `away`, `home` team abbreviations (case-insensitive) |
| RotoWire | Reuse slate cache from lineups service. No match / unsupported date → `200` with `away`/`home` null (or omit sides) and empty enrichment; Preview already gated by slate completeness |
| Person resolve | `GET https://statsapi.mlb.com/api/v1/people/search?names={name}&sportIds=1` |
| Pitcher season | `GET …/people/{id}/stats?stats=season&group=pitching&season={year}&sportId=1` where `{year}` is the four-digit year from `date` |
| Batter H2H | `GET …/people/{batterId}/stats?stats=vsPlayerTotal&group=hitting&opposingPlayerId={oppSpId}&sportId=1` |
| Cache | In-memory keyed by `date|away|home` (normalized abbrevs), TTL ~180s (aligned with lineups slate cache) |
| Failure | Soft: return RotoWire names where possible; omit `mlbam_id` / `vs_pitcher` / season fields when lookups fail. Prefer empty/partial matchup over 502 for Preview. |

Example response:

```json
{
  "date": "2026-08-04",
  "away_abbrev": "WSH",
  "home_abbrev": "SF",
  "status": "expected",
  "away": {
    "pitcher": {
      "name": "Zack Littell",
      "hand": "R",
      "mlbam_id": 641793,
      "wins": 7,
      "losses": 8,
      "era": "4.97",
      "innings_pitched": "112.1",
      "strikeouts": 70,
      "whip": "1.34"
    },
    "batters": [
      {
        "order": 1,
        "position": "RF",
        "name": "James Wood",
        "hand": "L",
        "mlbam_id": 695578,
        "vs_pitcher": { "ab": 10, "h": 3, "hr": 0, "avg": ".300" }
      }
    ]
  },
  "home": {
    "pitcher": {
      "name": "Jesús Luzardo",
      "hand": "L",
      "mlbam_id": 666200,
      "wins": null,
      "losses": null,
      "era": null,
      "innings_pitched": null,
      "strikeouts": null,
      "whip": null
    },
    "batters": [
      {
        "order": 1,
        "position": "LF",
        "name": "Example Batter",
        "hand": "R",
        "mlbam_id": null,
        "vs_pitcher": null
      }
    ]
  },
  "source": "rotowire+statsapi",
  "fetched_at": "2026-08-04T17:00:00+00:00"
}
```

`home` in the example shows partial enrichment (null season / null `vs_pitcher`). Successful responses include both sides with up to 9 batters each from RotoWire. Optional season fields and `vs_pitcher` may be omitted or null when unresolved; frontend treats missing as `–`.

**Docs:** Add matchup route to OpenAPI export and `md/system-design.md` page ↔ API table for `/mlb/games/:gamePk`.

## Components

| Piece | Responsibility |
| --- | --- |
| `mlb_lineups` service (extend) | Matchup orchestration; person-id + stats helpers; matchup cache |
| `GET /api/mlb/lineups/matchup` | New route + schema models (pitcher season + `vs_pitcher`) |
| `MlbProjectedLineups` | Mock layout: pitcher card, “Lineup vs …”, table columns |
| `useMlbLineupMatchup` | TanStack Query; enabled when Preview has complete slate match |
| `MlbPregameCenter` | Wire matchup hook into projected lineups panel |

Name resolution notes:

- Prefer search query built from RotoWire display name; strip initial-only forms toward searchable tokens when needed.
- If search returns multiple people, prefer active MLB player with closest full-name match; else soft-fail that player.
- Accents (e.g. Jesús) handled by Stats API search when full name is used.

## Edge cases

- Incomplete / unmatched RotoWire → unavailable; do not depend on matchup for the gate
- Matchup request fails after slate match → show RotoWire order/names with `–` stats
- Single player ID miss → that row `–`; others still enrich
- Empty `vsPlayerTotal` splits → `–` (not `.000`)
- Missing logos → abbrev toggle buttons unchanged
- Live / final → no lineups/matchup fetch

## Testing

- Backend: map season pitching + `vsPlayerTotal` → schema; soft-fail empty search/stats; cache key `date|away|home`
- Frontend: pitcher card fields; “Lineup vs …” uses opposing SP; table columns; `–` for missing `vs_pitcher`; logo toggle; unavailable unchanged
- Route/OpenAPI: matchup params validated; documented in system-design table

## Out of scope

- Replacing RotoWire with Stats API confirmed lineups
- Enriching the full daily slate in `GET /api/mlb/lineups`
- Season-only (non-career) BvP, sortable headers, dotted-label tooltips
- Live/final projected lineup panels
- Odds / weather / umpire

## Success criteria

- Preview lineup panel matches the mock structure when RotoWire + Stats enrichment succeed
- Career H2H and pitcher season stats populate from Stats API for resolved players
- Partial enrichment never hides RotoWire names/order
- Incomplete RotoWire match still shows **Lineups unavailable**
- `GET /api/mlb/lineups/matchup` documented in OpenAPI and `md/system-design.md`
