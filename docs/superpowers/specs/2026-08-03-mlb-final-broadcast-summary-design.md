# MLB final game Summary/Box redesign (broadcast archive shell)

Date: 2026-08-03  
Status: Approved for planning  
Reference: user screenshot (SDP @ AZ final — Summary tab with scoring plays + linescore + team stats)

## Goal

Restructure the **final** branch of `/mlb/games/:gamePk` so the first viewport matches the ESPN-style final Summary layout (high fidelity): split header, Summary | Box tabs, scoring/all play cards, linescore with pitcher decisions, and team-stats comparison. Keep win probability and hit chart **below** the tab content. Extend the game-detail API with additive fields from MLB Stats API (primary), keeping ESPN soft-merge for win probability.

Live and scheduled layouts are out of scope.

## Decisions

| Topic | Choice |
| --- | --- |
| Fidelity | **A** — UI + backend fields so play cards and team stats match the screenshot |
| Win prob / hit chart | **B** — keep below Summary/Box content (scroll further) |
| Box tab | Full box score only; **side-by-side** away \| home (do not stack) |
| Play-card action icons | **A** — omit (outcome pill + mph/ft/deg only) |
| Approach | Rebuild final shell + extend normalize/schema (dedicated components; do not overload live broadcast pieces) |
| Share control | UI affordance only; no share backend |
| Data sources | **MLB Stats API** primary; **ESPN** for existing win-prob merge; **Baseball Savant** only as a later fallback if Stats API `hitData` is empty in practice |

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Today / date label          Final              [share]   │
├────────────────────────────┬─────────────────────────────┤
│ Away slab (team color)     │ Home slab (team color)      │
│ logo · record · abbrev     │ abbrev · record · logo      │
│ large score                │ large score                 │
│ (winner emphasis)          │ (winner emphasis)           │
├────────────────────────────┴─────────────────────────────┤
│ [ Summary | Box ] tabs                                   │
├──────────────────────────────────────────────────────────┤
│ Summary (desktop ≥ lg):                                  │
│  Left ~55%: [Scoring Plays | All Plays] + play cards     │
│  Right ~45%: Linescore + W/L(/S) · Team Stats comparison │
│ Box:                                                     │
│  Away batters+pitchers  |  Home batters+pitchers         │
├──────────────────────────────────────────────────────────┤
│ Win probability  |  Hit chart                            │
└──────────────────────────────────────────────────────────┘
```

### Desktop (≥ lg)

- Header strip + split slabs full width.
- Summary: two-column grid (plays | linescore+team stats).
- Box: two equal columns (away | home).

### Mobile

- Header slabs remain side-by-side when space allows.
- Summary stacks: plays → linescore/decisions → team stats.
- Box: keep side-by-side when width allows; stack only under a narrow breakpoint if overflow forces it.

## Components

| Piece | Responsibility |
| --- | --- |
| `MlbFinalBroadcastHeader` | Date label · Final · share affordance; split colored slabs with logo, record, abbrev, large score; winner emphasis |
| `MlbFinalTabs` | Summary \| Box tab state |
| `MlbFinalPlayFeed` | Scoring / All toggle; colored play cards (half-inning, description, outcome pill, mph/ft/deg when present) |
| `MlbFinalLinescoreCard` | Reuse `MlbLinescore` + decisions (`W:` / `L:` / optional `S:`) |
| `MlbFinalTeamStats` | Away/home logos; rows HR R H SB LOB AVG OBP SLG ERA K; leader highlight circles |
| `MlbBoxScore` | Box tab only; layout forced side-by-side |
| `MlbFinalCenter` | Composition wrapper for final branch |
| Existing below | `MlbWinProbability`, `MlbHitChart` unchanged in behavior |

Live components (`MlbLiveBroadcastHeader`, matchup panel, team-toggle batters, etc.) stay untouched.

## Data / API (additive on `MlbGameDetail`)

No new endpoints. Extend normalize in `backend/app/services/mlb_game_detail.py` and schemas; regenerate OpenAPI / frontend types.

| Field | Source (Stats API) | UI use |
| --- | --- | --- |
| `away` / `home.record` | Team `leagueRecord` on feed/boxscore | Header `58-55` |
| `game_date_label` | `gameData.datetime` | `Today` / `Yesterday` / short date |
| `decisions` `{ winner, loser, save? }` (name strings) | `liveData.decisions` | Under linescore |
| Play: `exit_velo`, `launch_angle`, `total_distance` | Play event `hitData` | Card footer |
| Play: `scoring_team` (`away` \| `home` \| null) | Score delta / half | Card background tint |
| Play: keep `event`; UI maps to display label (`home_run` → `Home Run`) | Existing | Outcome pill |
| `team_stats` away/home aggregates | Boxscore team batting/pitching totals | Comparison rail |

Omit optional fields when missing (do not invent zeros for Statcast). Existing win-probability ESPN soft-merge unchanged.

### Team-stats leader rules

- Higher-is-better: HR, R, H, SB, LOB, AVG, OBP, SLG, K.
- Lower-is-better: ERA.
- Tie → no winner circle; never invent a leader.

## Edge cases

- Missing Statcast on a play → hide mph/ft/deg row entirely.
- Missing decisions → omit W/L/S lines.
- Missing record → show abbrev + score only.
- Empty scoring-plays list → empty state under Scoring toggle.
- Share button → non-functional UI affordance only (no `navigator.share`, no backend).

## Testing

- Backend: normalize unit tests for decisions, hitData metrics, record, `game_date_label`, `team_stats`, `scoring_team` (extend fixtures; capture a real final feed snippet if current fixture lacks fields).
- Frontend: header Final/date/scores; Summary default tab; Scoring↔All toggle; Box side-by-side; win-prob + hit-chart still render below.

## Out of scope

- Live / scheduled redesign
- Share backend / deep-link sharing product
- ESPN play-card chrome icons (grid / field / multi-diamond)
- Baseball Savant fetch in v1 (follow-up only if Stats API `hitData` is insufficient)
- Changing ESPN win-probability merge semantics
- Replacing hit chart / win-prob charts themselves

## Success criteria

1. Final first viewport visually matches the reference composition (header, tabs, play cards, linescore+decisions, team stats).
2. Box tab shows full box score side-by-side.
3. Win probability and hit chart remain available below the fold.
4. Additive API fields populate from MLB Stats API when present; graceful omission when absent.
5. Live and scheduled branches unchanged.
