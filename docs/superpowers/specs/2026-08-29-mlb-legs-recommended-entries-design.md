# MLB Legs — recommended complete entries

Date: 2026-08-29  
Status: Approved  
Product: statvista  
Related: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` (pricing unchanged); `/mlb/legs`; `GET /api/mlb/legs`

## Goal

Change `/mlb/legs` from a flat PLAY shortlist into **zero or more complete DFS entries** of size **N**, where N is the selected query (`legs`). Each card is disjoint on player, fills **exactly N** priced PLAY legs, and respects PrizePicks / Underdog entry constraints we can enforce from snapshots (one pick per player; Flex 6 same-game cap). An empty `entries` list is a correct outcome.

This is still research copy (no locks / guaranteed EV). Cards are recommended complete entries for the selected size, not a guaranteed ticket and not a correlation-priced parlay.

Pricing, coverage, break-evens, and Props/`prop_fair` stay as in the pricer spec. This spec only adds packing and the public `entries` shape.

## Non-goals

- Re-searching combinations (swap a high-margin same-game Flex leg to unlock another card)
- Overlapping cards (same player on two entries)
- Showing leftover PLAY that did not fit a card
- WNBA / NBA Legs; `/api/wnba/legs`
- Changing `prop_fair`, `/mlb/prop_picks`, or board routes
- Profit / CLV tracking
- Live scrape of PrizePicks/Underdog “cannot combine” matrices beyond: standard-only seed, drop goblin/demon, one player per card, Flex max 2 per `game_id`, Power/UD unrestricted same-game
- Flex 3, Underdog `boosted`, invented goblin/demon multipliers
- Cap on number of cards (show **all** complete cards)

## Decisions

| Topic | Choice |
| --- | --- |
| Surface | Cards only. No public flat PLAY array |
| Sizes | PP Power 2–6; PP Flex **6 only**; UD Standard 2–6. Same 422 rules as today |
| Completeness | Every card has `len(legs) == N`. Never a partial card |
| Card count | All complete cards; remainder `< N` discarded |
| Player reuse | `match_player_key` appears in **at most one** card in the response (and at most once inside a card) |
| Same game | Power and UD Standard: no per-game cap. Flex 6: **max 2** legs with the same non-null `game_id` on one card. Null `game_id` treated as distinct (same as pricer spec) |
| Packer | Greedy, after PLAY sort (`margin_pts` desc, `fair_prob` desc, `player` asc). Not globally optimal |
| API | Same `GET /api/mlb/legs?app=&format=&legs=` |
| Warning | `flex_same_game_warning` remains on the envelope and is **always false** after packing (cap replaces the old top-6 flat-list warning) |
| Empty | Valid when no complete card (including PLAY pool `< N` or Flex cap blocking a fill) |
| Example overlay | `?example=1` still layout-only; fixtures are **cards** of size N, labeled not live |

## Architecture

```text
get_mlb_legs()  (unchanged through price_line)
        └─ PLAY pool (sorted)
              └─ pack_entries(play, n, format)  # pure
                    └─ entries[] of length 0, 1, 2, … each with n legs
```

Packer lives in `betting` (e.g. `legs_pack.py`) next to `legs_pricer.py`. Assembler calls it after PLAY collection. No I/O in the packer. Input rows include assembly `player_key` (`match_player_key`); the public `MlbLegsPlay` still has display `player` only.

### Pack algorithm

`used_players` starts empty. Repeat:

1. `card = []`, `game_counts = {}`.
2. Scan PLAY in sort order. Skip if `match_player_key` is in `used_players` or already on `card`. On Flex 6, skip if `game_id` is non-null and `game_counts[game_id] >= 2`.
3. Else append; increment `game_counts` when `game_id` is non-null.
4. If `len(card) == n`, emit the card, add its player keys to `used_players`, go to step 1.
5. If the scan ends with `len(card) < n`, **stop**. Do not emit that card. Remaining PLAY (including unused keys) is `unpacked_remainder`.

## API

Query, 422, `Cache-Control: no-store`, 5-minute cache key `(app, format, legs)` unchanged.

**Remove** top-level `legs: MlbLegsPlay[]`.

**Add** `entries: MlbLegsEntry[]` where:

- `MlbLegsEntry.rank`: 1…k (emit order)
- `MlbLegsEntry.legs`: exactly `n` `MlbLegsPlay` objects (same play schema as today). Re-number each card’s `play.rank` to **1…n** in pack order.

`legs_surfaced` = number of PLAY rows **on cards** (`k * n`).

`rejected_summary` keys (all always present, may be 0):

- `insufficient_coverage`
- `insufficient_sharp`
- `below_threshold`
- `unpriceable_payout`
- `unpacked_remainder` — PLAY that cleared the EV gate but did not land on a card

Identity:

```text
legs_evaluated == legs_surfaced + sum(rejected_summary.values())
```

`legs_surfaced == sum(len(e.legs) for e in entries)`. Assert unique `match_player_key` across all packed plays. UD `break_even_min` / `break_even_max` are min/max among **packed** legs only (`null` if `entries` is empty).

OpenAPI regen (`REQUIRED_MLB_PATHS` already lists `/api/mlb/legs`). Update `md/system-design.md` page ↔ API row when this ships.

## UI

`/mlb/legs` MLB board: existing app / format / size chips. One block per entry (“Entry 1” …), N rows each, same expand audit as today. Do not render a list outside cards.

Copy: complete entries for the **selected size**; research only; not a lock. Flex 6: no same-game banner (impossible under the cap).

Empty vs stale vs missing snapshot vs loading vs error unchanged in spirit; add copy when PLAY may exist but `entries` is empty: no complete N-pick for this format.

`/wnba/legs` still no fetch. `?example=1`: two example cards of size N (enough unique fixture players); keep `example` on the URL when chips change.

## Error handling

| Case | Behavior |
| --- | --- |
| Bad query | 422 (unchanged) |
| DFS age > 60 min | 200, `entries []`, `dfs_snapshot_stale`, `unpacked_remainder = 0` (no PLAY priced) |
| PLAY pool `< n` | 200, `entries []`, `unpacked_remainder =` PLAY count |
| Flex cannot fill 6 under same-game cap | 200, `entries []` or fewer cards; leftover PLAY in `unpacked_remainder` |
| Snapshot / Parlay failure | Soft-fail; never invent books (unchanged) |

## Testing

- Packer: 5 PLAY, n=4 → one card + `unpacked_remainder` 1
- Same `match_player_key` never on two cards or twice in one card (second market skipped)
- Flex: third same `game_id` skipped; 6 filled from other games when the pool allows
- Flex: cannot complete 6 → no card
- Power: 3+ same `game_id` allowed on one card
- Route: body has `entries`, no top-level `legs` array; identity holds
- UI: N rows per card; empty `entries` empty state; WNBA no fetch
- Props tests still pass

## Success criteria

1. Switching 2–6 (and Flex 6) only shows cards of that exact length, or empty.
2. No partial cards; no leftover PLAY on the page.
3. One player per card and per response; Flex ≤2 per `game_id`.
4. Pricer / Props / WNBA Legs unchanged.
5. Identity equation holds with `unpacked_remainder`.
6. Research copy only.

## Later

- Optimal (non-greedy) packing
- Official PP/UD combo APIs if they expose more pairing bans
- Overlapping alternate cards
- Profit tracking
