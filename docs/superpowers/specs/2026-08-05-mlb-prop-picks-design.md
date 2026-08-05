# MLB Prop Picks — DFS edge board (fair / confidence / staleness)

Date: 2026-08-05  
Status: Approved for planning

## Goal

Ship `/mlb/prop_picks` as a **DFS-first, +EV-ranked** board for PrizePicks and Underdog. Users pick an app + format/leg-count; each row shows fair probability for that app’s exact line, edge vs format breakeven, source-tier confidence, sample flags, and recency — so DFS users can find legs fast without mistaking a thin single-book price for sharp consensus.

## Decisions

| Topic | Choice |
| --- | --- |
| Primary job | Find +EV legs fast (ranked by edge); no slate builder in v1 |
| Route | `/mlb/prop_picks` |
| UI layout | Hybrid ranked rows + expand (not dense table, not card feed) |
| App scope | Selected app’s board only (PrizePicks **or** Underdog) |
| Row grain | One row per `player + stat + line` on the selected app; both sides inline (recommended primary, alt muted) |
| Fair key | Per **exact line**, not per player/stat alone |
| Book attach | Exact DFS line match only (no closest-line fallback) |
| Fair stack | Tier 1 PX+Novig → Tier 2 DK+FD → else No Sharp Read |
| Pinnacle | Comparison only — never in fair number |
| Soft-books-only | Show at bottom, disabled (no edge sort weight) |
| Formats v1 | PrizePicks Power 2–6; Underdog standard 2–6; Flex/insurance later |
| Edge | `fair% − p_be` where `p_be = M^(-1/n)` from config multipliers |
| Serve path | `GET /api/mlb/props/today` — server computes fair/edge/tier/recency |
| Agreement ε | 2.0 percentage points |
| Staleness | Fresh sharp ≤10m; stale DFS ≥30m; stale sharp ≥60m; one recency chip max |
| Out of scope | Slate builder, Flex, non-exact line compares, sportsbook-only props, browser→Supabase REST as primary |

## Product rules

### Fair probability (never blend soft books into fair)

**Tier 1 — ProphetX + Novig (exact line)**

- Both present and \|fair_PX − fair_Novig\| ≤ 2.0 pp → fair = **60% PX / 40% Novig** average → badge **Sharp Consensus** (high).
- Both present and gap > 2.0 pp → fair = **ProphetX only**; Novig shown as caveat on expand → badge **Sharp Disagreement** (medium).
- Only one exchange → fair = that book → badge **Sharp Single-Source**. DK/FD may adjust **confidence chips only** (agree within 2.0 pp → `DK/FD agrees ↑`); they do **not** move the fair %.

**Tier 2 — DraftKings + FanDuel**, only when Tier 1 is empty

- Same agree/disagree pattern; slight **DK lean** when averaging (e.g. 55/45); disagree → DK primary.
- Badge **Mid-Tier Fallback** (low–medium).

**Tier 3 — never sets fair**

- Pinnacle (and other soft books): **comparison only** on expand when exact line matches.
- No Tier 1/2 coverage → badge **No Sharp Read**; no fair/edge; parked at bottom.

### Edge & formats

- Toolbar: **app** + **format/legs**.
- Breakeven (all-must-hit): \(p_{\text{be}} = M^{-1/n}\) with multipliers in a single config table per app/format/n.
- Recommended side = higher edge at the row’s line; show that edge as hero (`+3.2%` style) with copy context like “on Under at 4-pick Power”.
- Default sort: edge desc among rows with a Tier 1/2 read; No Sharp Read always last.

### Staleness

Age = time since that book’s **line/odds last changed** for this exact player/stat/side/line (not scrape poll time).

| Chip (collapsed, at most one) | Rule |
| --- | --- |
| Fresh sharp vs stale DFS | Fair-driving book age ≤ 10m **and** selected DFS age ≥ 30m **and** DFS older than sharp move |
| Fresh sharp | Fair-driving book age ≤ 10m (and combo rule false) |
| Stale sharp | Fair-driving book age ≥ 60m |
| (none) | Otherwise; expand still shows absolute ages |

Priority if multiple apply: Fresh vs stale DFS → Fresh sharp → Stale sharp → none.

### Display books

- Collapsed: DFS identity (app line) + fair/edge/tier/recency chips — not a full multi-book column grid.
- Expand: exact-line stack ProphetX, Novig, DK, FD, Pinnacle (cmp); one-line fair explainer; both-sides edges; timestamps.

## UI

### Layout (hybrid)

```
MlbPropPicksPage (/mlb/prop_picks)
  ├── Mlb league subnav (Prop Picks active)
  ├── Toolbar: app · format/legs · filters · last updated
  └── Ranked hybrid list
        ├── Collapsed row: player · stat · line · lean · edge · fair · badges
        └── Expanded: exact-line books · fair why · recency · both sides
```

### Filters (v1)

- Stat, team, recommended side (Over / Under / either)
- Source tier: Consensus · Single-Source · Disagreement · Mid-Tier
- Optional toggle: Fresh sharp vs stale DFS only
- Clear all
- No Sharp Read rows remain visible at bottom unless a future hide toggle is added (v1: always show parked)

### Empty / loading

- Loading: hybrid-row skeletons
- API error: “Prop lines unavailable”
- Filters empty: “No props match these filters”
- Missing app snapshot: short empty copy for that app

### Caption

Fair from ProphetX/Novig (then DK/FD). DFS lines from PrizePicks/Underdog. Pinnacle comparison only.

## Architecture

```
MlbPropPicksPage
  └── useMlbProps({ app, format, legs })
        │
        ▼
GET /api/mlb/props/today?app=prizepicks|underdog&format=power&legs=4
        │
        ▼
mlb_props service
  ├─ latest odds.mlb_prizepicks | odds.mlb_underdogs   # board seed
  ├─ latest odds.mlb_prophetx                          # Tier 1
  ├─ Parlay MLB props (Novig, FD, DK) + cache ~45–60s # Tier 2 / mid chips
  ├─ latest odds.mlb_pinnacle (props)                  # cmp only
  ├─ exact-line attach only
  ├─ fair / source_tier / confidence chips
  ├─ edge vs format breakeven (config multipliers)
  └─ recency chips from last-change timestamps
```

**Why backend join (not browser Supabase REST as primary):** fair tiers, exact-line matching, Parlay credentials, and breakeven must stay one shared implementation. Optional later: persist Parlay MLB books to `odds.mlb_parlay_api_odds` (WNBA pattern); not required for UI v1.

## API sketch

### `GET /api/mlb/props/today`

Query: `app`, `format`, `legs` (and optional filter passthrough later).

Response (conceptual):

```json
{
  "as_of": "2026-08-05T20:00:00Z",
  "app": "prizepicks",
  "format": "power",
  "legs": 4,
  "breakeven_pct": 56.23,
  "props": [
    {
      "player_name": "Aaron Judge",
      "team_abbrev": "NYY",
      "stat": "Total Bases",
      "line": 1.5,
      "recommended_side": "over",
      "fair_pct": 58.2,
      "edge_pct": 5.1,
      "alt_edge_pct": -2.4,
      "source_tier": "sharp_consensus",
      "confidence_chips": ["dk_fd_agrees"],
      "sample_chips": [],
      "recency_chip": "fresh_sharp_vs_stale_dfs",
      "books": {
        "prophetx": { "side": "over", "fair_pct": 58.5, "american": -140, "changed_at": "..." },
        "novig": { "side": "over", "fair_pct": 57.8, "american": -137, "changed_at": "..." },
        "draftkings": null,
        "fanduel": null,
        "pinnacle": { "side": "over", "fair_pct": 55.0, "role": "comparison", "changed_at": "..." }
      },
      "dfs": {
        "line": 1.5,
        "changed_at": "..."
      },
      "fair_explain": "PX+Novig agree within 2pp; 60/40 blend."
    }
  ]
}
```

`source_tier` enum: `sharp_consensus` | `sharp_disagreement` | `sharp_single_source` | `mid_tier_fallback` | `no_sharp_read`.

## Testing (planning expectations)

- Fair: consensus blend, disagreement → PX, single-source + DK agree chip without number change, mid-tier fallback, no-read.
- Exact line: mismatched Pinnacle/PX omitted from fair and expand attach.
- Edge: multiplier config → `p_be` → `edge_pct`; resort on format/legs change.
- Recency: chip priority and parked no-read sort.
- Frontend: collapsed/expand, app switch swaps board, filters, empty/error/loading.

## Out of scope

- Slate / entry builder
- PrizePicks Flex / Underdog insurance math
- Closest-line sportsbook matching
- Demon/goblin / non-standard DFS lines (follow WNBA: standard/main only unless product revisits)
- Reworking WNBA prop picks to this hybrid UI

## Open implementation notes (not product blockers)

- Confirm live PrizePicks Power / Underdog multipliers for the config table (state variants → document assumed default).
- Derive `changed_at` from snapshot history (prior `scraped_at` where line/odds differ) if per-quote timestamps are not stored yet.
- Novig/FD/DK MLB: live Parlay on request for v1; optional unified MLB Parlay table later.
