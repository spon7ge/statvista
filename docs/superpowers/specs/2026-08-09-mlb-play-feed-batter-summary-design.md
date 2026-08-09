# MLB play feed batter summary next to outcome pill

Date: 2026-08-09  
Status: Approved for planning  
Parent: `docs/superpowers/specs/2026-08-03-mlb-final-header-play-cards-polish-design.md`  
Related UI polish (same session): stacked play row — description → pill + stats → Statcast

## Goal

On Scoring plays / All plays cards, show the batter’s MLB boxscore game-line summary next to the outcome pill:

```
Freeman homers (2)
[Home Run] – 2-3 | HR, RBI, 2 R
104.1 mph · 412 ft · 28.5°
```

## Decisions

| Topic | Choice |
| --- | --- |
| Format | **A** — raw MLB `stats.batting.summary` as-is (e.g. `2-3 | HR, RBI, 2 R`) |
| Field | Additive `batter_summary: string \| null` on `MlbPlay` |
| Lookup | Play `matchup.batter` id → boxscore player map → batting summary |
| Missing data | Omit stats span; keep pill / description / Statcast as today |
| Game score by pill | **Remove** (replaced by batter summary) |
| Scope | Shared `MlbFinalPlayFeed` (final + live Summary) |
| Suffix | Do **not** append `" today"` (unlike live matchup card summary) |

## Data / API

No new endpoints. Extend normalize + schema only.

| Field | Source | Notes |
| --- | --- | --- |
| `batter_summary` | `liveData.boxscore` player `stats.batting.summary` for play’s batter | Strip whitespace; empty → `null` |

Normalize changes:

1. Build (or reuse) the existing boxscore player map when normalizing plays.
2. In `_plays`, resolve batter person id from `matchup.batter`.
3. Set `batter_summary` from that player’s batting summary string.

OpenAPI / frontend `ApiMlbGameDetail` regen or hand-map; view type `MlbPlay.batterSummary`; `mapPlay` maps snake → camel.

## UI

`MlbFinalPlayFeed` play row (already stacked):

1. Description (`play.text`)
2. Row: outcome pill (when `event`) · en-dash · `batterSummary` (when present)
3. Statcast ball info when any of mph / ft / ° exist

Omit en-dash when only one of pill / summary is present.

## Edge cases

- No batter on play / batter not in boxscore / empty summary → `batter_summary: null`; no stats text.
- Summary is game-to-date boxscore line (not reconstructed as-of that at-bat) — acceptable for final and live archive-style feed.
- Non-scoring plays still show summary when available.

## Testing

- Backend: normalize fixture play with known batter → `batter_summary` matches fixture summary; missing batter → `null`.
- Frontend: mapPlay includes `batterSummary`; play feed shows pill then summary under description; score-by-pill gone; Statcast order unchanged.

## Out of scope

- Custom compact formatting (`2-3 · 1 HR · 2 RBI`)
- Season AVG beside the line
- Reconstructing historical line as-of each play
- Changing half-inning card chrome or Scoring/All toggle
