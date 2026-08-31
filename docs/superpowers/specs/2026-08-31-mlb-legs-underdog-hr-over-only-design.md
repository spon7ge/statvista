# MLB Legs — Underdog home runs are Over-only

Date: 2026-08-31  
Status: Approved  
Product: statvista  
Related: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` (amends gating for one market); `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md` (packer unchanged); `docs/superpowers/specs/2026-08-30-wnba-legs-design.md` (no change)

## Goal

Underdog Fantasy lists MLB **home runs** as Over 0.5 only (no Under). Legs must not surface **Under** home runs on the Underdog tab. Evaluate the offered Over against the existing exact-line two-way consensus and EV gate. Typical longshot Overs fail that gate; an empty result for those lines is correct.

## Non-goals

- Unclamping Underdog `payout_multiplier` (`m > 1` still does not lower break-even)
- Other one-sided Underdog markets (stolen bases, doubles, singles, batter strikeouts)
- PrizePicks home runs (still favorite-only)
- WNBA Legs, packer, payouts tables, UI chrome
- New `rejected_summary` keys
- Changing sportsbook two-way pairing, coverage, ages, hold, or log-odds consensus

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Underdog + canonical stat `home_runs` only |
| Offered side | Always **Over**. Do not invent a DFS Under |
| Grain | Still one candidate per `(player, stat, line)`. `legs_evaluated` still counts **lines** |
| Where the rule lives | MLB assembler passes `offered_side="over"` into `price_line`. Not a pricer allowlist |
| Default path | `offered_side` omitted → favorite-only, unchanged |
| Longshot | Forced Over may have `fair_prob < 0.35`. That is **not** an assertion failure. Existing EV math rejects `below_threshold` |
| Reject key | No new key. Missed EV → `below_threshold` |
| Boost clamp | Unchanged: `p_be = base / min(m, 1.0)` |
| Consensus | Still requires a two-way sportsbook pair at the exact DFS line |

## Pricer

`price_line` gains optional `offered_side: Literal["over", "under"] | None = None`.

**Omitted.** Same as today: Over if `p_over > 0.5`, Under if `p_under > 0.5`, else `below_threshold`. Internal assertion `fair_prob < 0.35` remains — still unreachable on this path.

**Set.** Use that side’s fair probability (`p_over` or `1 - p_over`). Do not re-pick the favorite. Skip the 0.35 assertion. Then the same `p_be`, disagreement adder, and margin gate. Fail → `below_threshold`. Coverage / sharp rejects still fire first.

Callers that omit the argument (WNBA, PrizePicks, non-HR Underdog) are bit-identical to today.

## Assembly

In `mlb.legs.get_mlb_legs`, after lock-filter, when `app == "underdog"` and `stat_key == "home_runs"`, pass `offered_side="over"`. Every other seed omits it.

Do not change `_seed_lines` grain. Do not drop HR lines from the seed. Sportsbook indexes stay two-way at the DFS line (Underdog not offering Under does not make books one-sided).

## Identity and UI

`rejected_summary` keys unchanged. Forced-Over HRs that miss EV increment `below_threshold`. Unoffered Under is never a candidate.

No API field, envelope, or frontend change. PLAY HRs that clear (rare: Over that is also a favorite and beats BE + margin) show `side: "over"`.

## Testing

- Pricer: under-favorite quotes + `offered_side="over"` → evaluates Over; does not PLAY Under; longshot does not raise; typically `below_threshold`
- Pricer: over-favorite quotes + `offered_side="over"` → still PLAY Over when margin clears
- Pricer: omitted `offered_side` still favorite-only (Under PLAY when Under is the favorite)
- Assembly: Underdog HR seed with under-favorite books → no Under PLAY; identity holds via `below_threshold`
- PrizePicks HR on the same books can still PLAY Under

## Success criteria

1. Underdog Legs never emits `side: "under"` for `home_runs`.
2. Those lines still count in `legs_evaluated`. After coverage, a longshot Over is `below_threshold`, never Under PLAY.
3. PrizePicks HRs and all other markets keep favorite-only gating.
4. `legs_evaluated == legs_surfaced + sum(rejected_summary.values())` still holds.
5. WNBA Legs, packer, and payouts are unchanged.

## Later (not this spec)

| Item | Rule |
| --- | --- |
| Other one-sided DFS markets | Snapshot-driven offered sides (stolen bases, etc.) |
| Boosted longshot Overs | Entry-level `1 / (M × ∏ m_i)` before considering PLAY on +300 HR Overs |
