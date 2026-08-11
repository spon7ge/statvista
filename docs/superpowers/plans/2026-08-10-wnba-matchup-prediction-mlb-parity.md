# WNBA Matchup Prediction MLB Parity Implementation Plan

> **For agentic workers:** Use executing-plans or implement inline for this small task.

**Goal:** Restyle WNBA `MatchupPrediction` to match MLB’s centered title + flanking logos + tall % pill; hide source line.

**Architecture:** Rewrite `MatchupPrediction.tsx` to mirror `MlbMatchupPrediction.tsx` using WNBA `GameDetail` team fields.

**Tech Stack:** React, Vitest, Testing Library.

## Global Constraints

- No `sourceLabel` in UI.
- No backend changes.
- Commits only when user requests.
- Spec: `docs/superpowers/specs/2026-08-10-wnba-matchup-prediction-mlb-parity-design.md`

### Task 1: Rebuild MatchupPrediction + tests

**Files:**
- Modify: `frontend/src/features/basketball/game/MatchupPrediction.tsx`
- Modify: `frontend/src/features/basketball/game/MatchupPrediction.test.tsx`

- [ ] Update tests for MLB layout (testids, no source text)
- [ ] Implement MLB-parity UI
- [ ] Run vitest on MatchupPrediction (+ pregame if needed)
