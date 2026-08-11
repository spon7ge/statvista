# WNBA Matchup Prediction MLB Parity

## Goal

Restyle WNBA preview **Matchup prediction** to match MLB’s card: centered title, flanking team marks, tall pill with in-segment percentages. Drop the source line.

## Non-goals

- Shared cross-league component
- Backend / API changes to `matchup_prediction`
- Changing prediction math or data mapping

## Design

Rebuild `MatchupPrediction` to mirror `MlbMatchupPrediction`:

| Element | Behavior |
| --- | --- |
| Title | Centered `text-[18px] font-semibold` — “Matchup prediction” |
| Away mark | Logo (`logoUrl`) + abbrev, left of pill |
| Pill | `h-9` rounded-full; each half team color with centered `14px` bold `%` |
| Home mark | Same as away, `flex-row-reverse` |
| Source | Do not render `sourceLabel` |

Add `data-testid="wnba-matchup-prediction"` and `wnba-matchup-prediction-pill`.

Update `MatchupPrediction.test.tsx`: assert layout/testids/%/abbrevs; assert source text absent.

## Files

- `frontend/src/features/basketball/game/MatchupPrediction.tsx`
- `frontend/src/features/basketball/game/MatchupPrediction.test.tsx`
