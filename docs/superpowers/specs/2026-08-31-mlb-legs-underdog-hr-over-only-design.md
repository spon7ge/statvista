# MLB Legs — Underdog Over-only markets

Date: 2026-08-31  
Status: Approved  
Product: statvista  
Related: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` (amends gating for listed markets); `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md` (packer unchanged); `docs/superpowers/specs/2026-08-30-wnba-legs-design.md` (no change)

## Goal

Underdog Fantasy lists these MLB markets as **Over only** (no Under): `home_runs`, `singles`, `batter_strikeouts`, `stolen_bases`, `walks` (batter), `doubles`. Legs must not surface **Under** on those markets on the Underdog tab. Evaluate Over against the exact-line two-way consensus and break-even gate.

## Non-goals

- Unclamping Underdog `payout_multiplier` (`m > 1` still does not lower break-even)
- Pitcher `walks_allowed` (two-way; not in the Over-only set)
- PrizePicks (still favorite-only, including these stats)
- WNBA Legs, packer, payouts tables, UI chrome
- New `rejected_summary` keys
- Changing sportsbook two-way pairing, coverage, ages, hold, or log-odds consensus
- Snapshot-driven offered sides for markets outside this set

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Underdog + canonical stats `home_runs`, `singles`, `batter_strikeouts`, `stolen_bases`, `walks`, `doubles` |
| Offered side | Always **Over**. Do not invent a DFS Under |
| Grain | Still one candidate per `(player, stat, line)`. `legs_evaluated` still counts **lines** |
| Where the rule lives | MLB assembler `UD_OVER_ONLY_STATS` passes `offered_side="over"` into `price_line` |
| Default path | `offered_side` omitted → favorite-only, unchanged |
| Longshot | Forced Over may have `fair_prob < 0.35`. That is **not** an assertion failure. EV vs break-even rejects `below_threshold` |
| Reject key | No new key. Missed EV → `below_threshold` |
| Boost clamp | Unchanged: `p_be = base / min(m, 1.0)` |
| Consensus | Still requires a two-way sportsbook pair at the exact DFS line |

## Assembly

In `mlb.legs.get_mlb_legs`, after lock-filter, when `app == "underdog"` and `stat_key in UD_OVER_ONLY_STATS`, pass `offered_side="over"`. Every other seed omits it (including Underdog hits / total bases and all PrizePicks).

## Testing

- Assembly: each Over-only stat with under-favorite books → no Under PLAY
- Underdog `hits` on the same books still PLAY Under (two-way)
- PrizePicks home runs on the same books can still PLAY Under

## Success criteria

1. Underdog Legs never emits `side: "under"` for the six Over-only stats.
2. Those lines still count in `legs_evaluated`. After coverage, a longshot Over is `below_threshold`, never Under PLAY.
3. PrizePicks and two-way Underdog markets keep favorite-only gating.
4. `legs_evaluated == legs_surfaced + sum(rejected_summary.values())` still holds.
5. WNBA Legs, packer, and payouts are unchanged.
