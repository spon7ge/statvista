# MLB Legs — DFS pricer (exact-line, hard threshold)

Date: 2026-08-29  
Status: Approved  
Product: statvista  
Related: empty Legs shells (`/mlb/legs`, `/wnba/legs`); MLB props assembly (`mlb.props`, `prop_fair`); research table (`GET /api/mlb/props/board`); Underdog HR Over-only amendment (`docs/superpowers/specs/2026-08-31-mlb-legs-underdog-hr-over-only-design.md`)

## Goal

Ship `/mlb/legs` as a **priced-leg shortlist**. Evaluate PrizePicks and Underdog **standard** lines against a **devigged, weighted sportsbook consensus at that exact line**. Return **only** legs that clear a hard EV margin over the selected entry’s break-even. An empty list is a correct outcome.

This is not a tipster feed and not a ranked copy of Props. Props keeps `prop_fair` and the research table. Legs is a **new pipeline**. Ranked legs are **not** an entry. The UI must not present the list as a parlay.

## Non-goals (v1)

- WNBA / NBA Legs (WNBA page stays the empty shell; NBA Legs stays disabled)
- Off-market distribution fitting (negative binomial / PA / gamma). No linear interpolation. Never Poisson (see Later)
- News / lineup / weather classifier (STALE / STRUCTURAL / OFF_MARKET / UNEXPLAINED)
- Suggested Power/Flex **entries**, parlay-first output, correlation construction, per-leg exposure caps across entries
- Goblin / demon PrizePicks lines (no multiplier in the PP snapshot — do not invent one)
- Replacing or changing `prop_fair`, `/mlb/prop_picks`, or `/api/mlb/props/today`
- Fliff public-lean signal (do not fetch Fliff for Legs; no `public_lean` field)
- Kalshi / bet365 pricing (no invented weights)
- Shin devig (v1 gates favorites only — residual favorite-longshot bias is conservative; Shin is a later **recall** improvement, not a v1 safety rail. Keep hold > 12% as a data-quality filter)
- Profit / CLV tracking
- Pick6 or other DFS apps
- Underdog format `boosted` and `implied_prob = 1 / payout_multiplier` (that formula is invalid on this feed)
- PrizePicks **3-pick Flex** as a selectable control (59.1% + 4.0 = 63.1% is structurally empty vs a sharp consensus)

## Decisions

| Topic | Choice |
| --- | --- |
| League | MLB only |
| Page | `/mlb/legs` |
| API | `GET /api/mlb/legs?app=&format=&legs=` |
| Fair engine | New `legs_pricer` — **do not** call `prop_fair` |
| Line match | Exact DFS line only. Consensus is **at that line**. Never average probabilities taken at different lines. Label every probability with the line it refers to |
| Coverage | (1) ≥1 Pinnacle two-way **or** sized exchange; (2) ≥2 additional books; (3) total ≥ 3; (4) ≥ **2** included books with **weight ≥ 2.0**. Pinnacle+MGM+Caesars → `insufficient_coverage`. No sharp/exchange → `insufficient_sharp` |
| Empty slate | Valid; do not lower the bar. Missing news must **not** blank the page (no UNEXPLAINED gate in v1) |
| Payouts | Assumed tables below; `payouts_assumed: true`; do **not** reuse Props `prop_formats` |
| Default URL | `?app=prizepicks&format=power&legs=4` |
| DFS variants | PrizePicks `odds_type` **standard** only. Goblin/demon dropped, not priced |
| Underdog modifier | `p_be = base_p_be / min(payout_multiplier, 1.0)`. Raw `m` stays on the audit. Never invert `m` into an implied probability |
| Grain | **One candidate per `(player, stat, line)`**. Gate the side with `fair_prob > 0.5` only, **except** Underdog Over-only stats (`home_runs`, `singles`, `batter_strikeouts`, `stolen_bases`, `walks`, `doubles` — always Over — see 2026-08-31 amendment). `legs_evaluated` counts **lines**, not sides |
| Locked games | Server drops live/final games using today’s MLB scoreboard |
| Stake | SELECT still includes `stake` when the column exists. **Novig:** NULL/missing stake does not exclude. **ProphetX:** both sides must be `> 0` |
| Consensus average | **Log-odds** (logit) weighted mean, then sigmoid — not raw probability |
| Book quote age | Supporting books (DK/FD/MGM/Caesars): **120 minutes**. Sharp/exchange (Pinnacle, Novig, sized ProphetX): **45 minutes**. Book-level only |
| DFS snapshot age | If seed age **> 60 minutes**, do **not** emit PLAY. Envelope `dfs_snapshot_age_minutes` + warning `dfs_snapshot_stale` |
| Disagreement | `max−min` over included books with **weight ≥ 2.0** only (exclude BetMGM/Caesars from the trigger). If > 4.0 pts, +1.5 on that leg’s effective margin |
| Hold rail | Exclude a book if two-way hold **> 12%** (`hold_too_high`) |
| Longshot rail | **Not** a `rejected_summary` key. Internal assertion: gated `fair_prob < 0.35` must not occur on the favorite-only path. Underdog Over-only stats may be longshot Overs; that path skips the assertion and rejects `below_threshold` (2026-08-31 amendment). Same treatment as `both_sides_cleared` on the favorite-only path |
| Cache | In-process **5 minutes** per `(app, format, legs)`. Frontend `staleTime` **5 minutes**. Show `generated_at` in the UI |
| Dedupe | One row per `(player, stat, line)`. Cross-platform (PP vs UD) is separate requests |
| Sort | `margin_pts` desc, then `fair_prob` desc, then `player` (deterministic; no jitter across 5-min refreshes) |
| Sharp label | Each PLAY leg: `sharp_anchor`: `pinnacle` if Pinnacle is included, else `exchange_only` |
| Flex correlation | Each PLAY leg has `game_id`. Flex 6: UI warn if the top 6 by sort contain ≥ 3 legs from one game |

## Architecture

```text
Browser  /mlb/legs?app=&format=&legs=
        │
        ▼
useMlbLegs  →  GET /api/mlb/legs
        │
        ▼
mlb.legs.get_mlb_legs()
        ├─ seed PrizePicks or Underdog snapshot (standard only)
        ├─ if DFS age > 60 min → empty PLAY, warning, age in envelope
        ├─ exact-line two-way indexes (PX, Novig, Pinnacle alts;
        │    Parlay DK/FD/BetMGM/Caesars including *_alternate)
        ├─ pair Over+Under; ProphetX needs stake>0 (Novig stake optional);
        │    drop hold>12%; sharp/exchange >45 min; supporting >120 min
        ├─ drop live/final games
        └─ legs_pricer per (player, stat, line)
              favorite side only (UD Over-only stats: Over) → PLAY or one reject reason
```

WNBA `/wnba/legs` does not call this API.

## Pricer

Pure module: `backend/app/domains/betting/legs_pricer.py` (no I/O). Unit-tested.

### Candidate

One DFS **standard** **line**: player, team, matchup, market, line, platform, Underdog `payout_multiplier` (default **1.0** if missing; skip candidate if multiplier `≤ 0`).

Build one two-way consensus `p_over` at that line (log-odds). Set `p_under = 1 - p_over`. **Gated side** = Over if `p_over > 0.5`, Under if `p_under > 0.5`. If `p_over == 0.5`, reject `below_threshold` (no PLAY). Do not evaluate both sides as separate candidates. **Exception:** Underdog Over-only stats always evaluate Over (`docs/superpowers/specs/2026-08-31-mlb-legs-underdog-hr-over-only-design.md`).

`both_sides_cleared` and gated `fair_prob < 0.35` are **internal assertions** only. If either fires in v1, fail the test / log; **do not** expose them in `rejected_summary` or the UI. Favorite-only gating makes both unreachable; leftover favorite-longshot bias **understates** the favorite, so v1 is conservative on PLAY (recall, not false precision).

### Book inclusion

Each book needs **both** Over and Under Americans **at the exact DFS line**. Never invent a quote. Every `devigged_prob` is labeled with `line` (the DFS line in v1).

| Book | Weight | Include when |
| --- | --- | --- |
| Pinnacle | 3.0 | Two-way, age ≤ **45 min**, hold ≤ 12% |
| Novig | 2.5 | Two-way, age ≤ **45 min**, hold ≤ 12%. Stake is not required (feed is often NULL) |
| ProphetX | 2.5 | Two-way, stake both sides `> 0`, age ≤ **45 min**, hold ≤ 12% |
| DraftKings, FanDuel | 2.0 | Two-way, age ≤ **120 min**, hold ≤ 12% |
| BetMGM, Caesars | 1.0 | Two-way, age ≤ **120 min**, hold ≤ 12% |
| Fliff, Kalshi, bet365 | — | Not loaded for Legs |

Book-level exclusions (`stale_quote`, `thin_or_one_sided`, `one_sided`, `hold_too_high`, `power_devig_unsolved`) drop that book from consensus. They are **not** `rejected_summary` keys. If the remaining set fails coverage, the **leg** is `insufficient_coverage` or `insufficient_sharp`.

**Independence.** Require all four:

1. At least one **sharp/exchange**: Pinnacle two-way (≤45 min) **or** Novig (≤45 min, stake optional) **or** ProphetX that passed stake + 45 min.
2. At least two additional included books.
3. Total included ≥ 3.
4. At least **two** included books with **weight ≥ 2.0** (non-anchor included weight ≥ 2.0).

Pinnacle+DK+MGM and Pinnacle+Novig+FD pass. **Pinnacle+MGM+Caesars fails (4)** → `insufficient_coverage`. No sharp/exchange → `insufficient_sharp`. Sharp present but (2)/(3)/(4) fail → `insufficient_coverage`.

PLAY assertion: every surfaced leg has ≥2 books at weight ≥ 2.0, so the disagreement trigger is always computable (not structurally 0 from a single anchor).

### Devig

Clip raw implied probabilities to `(ε, 1-ε)` with `ε = 1e-6` **before** hold, multiplicative, power, and logit.

`hold = p_over_raw + p_under_raw - 1`.

- **Always normalize.** Do not “use as-is” on exchanges.
- **Multiplicative** when hold **≤ 5%**: `p_side = p_raw_side / (p_over_raw + p_under_raw)`.
- **Power** when hold **> 5%**: bisection on `k ∈ [1, 10]` solving `p_over_raw^k + p_under_raw^k = 1`, tolerance `1e-9`. Fair side is `p_raw_side^k`. If `f(1) < 1` or `f(10) > 1` (no bracket) or the solver fails → exclude that book `power_devig_unsolved`.
- Tests must **not** use hold exactly `0.05` (method discontinuity). Pin fixtures at e.g. 0.04 and 0.06. Optional: assert \|Δ fair\| across the jump is bounded.

No Shin in v1.

### Consensus (same line only)

All `p_i` at the **same** line. Clip to `(ε, 1-ε)`. Weighted **log-odds**:

```text
logit(p) = log(p / (1-p))
fair_logit = sum(w_i * logit(p_i)) / sum(w_i)
p_over = 1 / (1 + exp(-fair_logit))
```

**Disagreement.** Among included books with **weight ≥ 2.0**: `book_disagreement_pts = (max p_i - min p_i) * 100`. On any PLAY leg this set has size ≥ 2 (independence rule 4). If **> 4.0**, add **+1.5** to that leg’s **effective** required margin. Weight-1.0 books cannot trip the adder.

### Break-even (assumed)

`base_p_be` from the tables (full float). Envelope `base_break_even` is this value (no modifier). UI may round to one decimal.

**Non-monotonicity is real and product-specific.** Do not flatten the tables.

PrizePicks **Power** — `base_p_be = M^(-1/n)`:

| Legs | M | ≈ display | Note |
| --- | --- | --- | --- |
| 2 | 3 | 57.7% | |
| 3 | 5 | 58.5% | **Hardest PP Power** |
| 4 | 10 | 56.2% | |
| 5 | 20 | 54.9% | |
| 6 | 37.5 | 54.7% | |

Underdog **standard** — `base_p_be = M^(-1/n)`:

| Legs | M | ≈ display | Note |
| --- | --- | --- | --- |
| 2 | 3 | 57.7% | **Hardest UD** |
| 3 | 6 | 55.0% | Easier than UD 4-pick |
| 4 | 10 | 56.2% | Harder than UD 3-pick |
| 5 | 20 | 54.9% | |
| 6 | 40 | 54.1% | |

PP peak is **n=3**. UD peak is **n=2**, and UD **n=4 is harder than n=3**. UI copy must follow the **selected app**, not the PP sentence.

PrizePicks **Flex 6** (only Flex offered in v1): ladder 25 / 2 / 0.4 → `base_p_be = 0.542`.

PrizePicks **Flex 3** is **not selectable**. Math kept so it is not reintroduced as 56%: EV `2.25 p^3 + 1.25 * 3 p^2 (1-p)`; `p = 0.560` → EV ≈ 0.913; `p = 0.591` → EV ≈ 1. Effective gate 59.1% + 4.0 = **63.1%** will not clear vs a sharp consensus. Query `format=flex&legs=3` → **422**.

**Per-leg break-even**

```text
p_be = base_p_be / min(payout_multiplier, 1.0)
```

PrizePicks: `payout_multiplier = 1`. Underdog: use the row modifier for the **clamp only**; store the **raw** `payout_multiplier` on the audit.

**Never** `1 / payout_multiplier` as an implied probability.

`m < 1` raises `p_be` (conservative if the rest of a slate is no worse). `m > 1` must **not** lower `p_be`: a single 1.15 boost in a 4-pick with three 1.0 legs pays `10 × 1.15 = 11.5` (entry BE ≈ 54.3%), not `10 × 1.15⁴ = 17.5` (BE 48.9%). Unclamped `base/m` overstates payout by ~52% and sorts boosted rows to the top. Clamp fixes that. Revisit when entry-level `1 / (M × ∏ m_i)` exists.

Discount identity unchanged: 4-pick `M=10`, `m=0.90` → `p_be = 0.562 / 0.90 = 62.5%` = `(10 × 0.9⁴)^(-1/4)`. `payouts_assumed: true`.

If `p_be >= 1`, reject `unpriceable_payout`.

### Margin gate

PLAY if `fair_prob >= p_be` (`margin_pts >= 0`). No extra pts over break-even. Book disagreement is still reported on the audit and does **not** raise the bar.

Envelope and per-leg `required_margin_pts` are **0.0**.

`margin_pts = (fair_prob - p_be) * 100` using that leg’s `p_be`. Below break-even → `below_threshold`.

### Accounting identity (tested)

`legs_evaluated` = number of **lines** sent to the pricer (post lock-filter, post standard-only, and only if DFS snapshot age ≤ 60 min).

`lines_seeded` = standard DFS **lines** in the snapshot **before** the 60-min abort and before lock-filter. On `dfs_snapshot_stale`, `lines_seeded` is still populated so a stale board is distinguishable from an empty seed.

```text
legs_evaluated == legs_surfaced + sum(rejected_summary.values())
```

`rejected_summary` keys (mutually exclusive, one reason per line):

- `insufficient_coverage`
- `insufficient_sharp`
- `below_threshold`
- `unpriceable_payout`

No `stale`, no `both_sides_cleared`, no `longshot_unpriceable`. `legs_surfaced == len(legs)`.

If DFS age > 60 min: do not run the pricer; `legs_evaluated = 0`; `legs = []`; all reject counts 0; warning `dfs_snapshot_stale`; **`lines_seeded` still set**. Identity holds (0 = 0 + 0).

**Coverage funnel.** Always emit `coverage_funnel_ratio` when `legs_evaluated > 0`:

```text
(insufficient_coverage + insufficient_sharp) / legs_evaluated
```

When `legs_evaluated = 0`, `coverage_funnel_ratio` is `null`. If `legs_evaluated >= 20` and the ratio **≥ 0.95**, add warning `coverage_funnel_collapsed` (player-key / `*_alternate` mapping or sharp outage — alert on change, not only a cliff).

### Pricer output

PLAY: `dfs_line`, gated `side`, `game_id`, `sharp_anchor` (`pinnacle` | `exchange_only`), `fair_prob`, `break_even` (per-leg, clamp-adjusted), `required_margin_pts` (effective), `margin_pts`, disagreement, books_used / books_excluded, raw `payout_multiplier`.  
Else exactly one reject reason for the identity above.

## API

`GET /api/mlb/legs`

### Query

| Param | Values |
| --- | --- |
| `app` | `prizepicks` \| `underdog` |
| `format` | PP: `power` \| `flex`. UD: `standard` only |
| `legs` | PP power: 2–6. PP flex: **6 only**. UD: 2–6 |

Invalid combination (`boosted`, `flex` + not 6) → **422**.

### Assembly

1. Validate query (dedicated Legs tables, not `mlb.prop_formats`).
2. Seed latest PrizePicks or Underdog snapshot; keep PP **standard** only. Set `lines_seeded`.
3. Compute `dfs_snapshot_age_minutes` from latest seed `scraped_at` vs `generated_at`. If **> 60**, return empty PLAY + `dfs_snapshot_stale` (do not price). Keep `lines_seeded`.
4. Exact-line two-way indexes: PX, Novig, Pinnacle (`mains_only=False`); Parlay DK/FD/BetMGM/Caesars including `*_alternate`. `match_player_key`. No Fliff/Kalshi/bet365.
5. Include `stake` on PX/Novig fetches. Missing column → `None`. Novig still prices; ProphetX without stake is excluded.
6. Drop sharp/exchange quotes older than **45 minutes** and supporting quotes older than **120 minutes** vs this assemble `generated_at`.
7. Drop live/final games. Attach `game_id` (MLB `gamePk`) when the player’s game is known; if missing, omit `game_id` (same-game warning treats missing as distinct).
8. Pricer per **line**; sort PLAY by `margin_pts` desc, `fair_prob` desc, `player` asc; `rank` 1…n. Set `sharp_anchor`. If `format=flex`, set `flex_same_game_warning` when the top `min(6, len(legs))` PLAY rows contain ≥ 3 with the same `game_id`.
9. Soft-fail empty DFS: 200, empty legs, `prizepicks_unavailable` / `underdog_unavailable`, `lines_seeded = 0`. Parlay miss: `parlay_unavailable`, continue with snapshot books.

Do not use `collect_board_quotes()` (`mains_only=True`).

### Response envelope

```text
generated_at, slate ("MLB YYYY-MM-DD"),
app, format, legs,
payouts_assumed: true,
base_break_even,                 # table / Flex 6; no UD modifier
break_even_min, break_even_max,  # among PLAY legs; null if none
base_required_margin_pts,        # 0.0; PLAY is break-even only
dfs_snapshot_age_minutes,
lines_seeded,
legs_evaluated, legs_surfaced,   # identity with rejected_summary
coverage_funnel_ratio,           # null if legs_evaluated = 0
flex_same_game_warning,          # bool; true only for Flex 6 when clustered
legs[]
rejected_summary                 # four keys; all present, may be 0
warnings[]
disclaimers[]
```

Each PLAY leg includes `break_even` (clamp-adjusted), `required_margin_pts` (effective), `game_id`, `sharp_anchor`. Frontend must not display envelope `base_required_margin_pts` next to a leg as if it were the same number.

For Underdog, chrome shows **observed PLAY `break_even_min`–`break_even_max`** (and may still print `base_break_even` as the table). PrizePicks min/max equal `base_break_even` when `m = 1`.

HTTP **200** for empty PLAY. OpenAPI regen. `md/system-design.md` row.

## UI

PLAY legs are packed into complete N-pick **`entries`** cards (no public flat PLAY list); see `docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md`.

- **MLB:** board. **WNBA:** empty shell, no fetch.

Chrome: title Legs; league pills; PrizePicks | Underdog; format + legs (**no Flex 3**; Flex is 6-pick only). Chip row far right: **`breakeven: {base_break_even}`**. No research/timestamp/payouts notes. Vertical PLAY cards (headshot, matchup, name, market line); click expands the book audit. See `docs/superpowers/specs/2026-08-31-legs-board-vertical-cards-design.md`.

Empty: threshold-empty vs `dfs_snapshot_stale` (use `lines_seeded` to tell stale-vs-empty) vs missing snapshot vs error vs loading.

`useMlbLegs` `staleTime` **5 minutes**.

## Error handling

| Case | Behavior |
| --- | --- |
| Bad query | 422 |
| DFS age > 60 min | 200, no PLAY, warning `dfs_snapshot_stale`, age field set |
| Snapshot / Parlay / scoreboard failure | Soft-fail; never invent books |
| ProphetX without stake / hold > 12% / power unsolved / stale book | Exclude book |
| No sharp/exchange | `insufficient_sharp` |
| Sharp + only MGM/Caesars as the other two | `insufficient_coverage` |
| Identity fail | Test failure; do not ship |

## Testing

- **Pricer:** hold 0.04 vs 0.06 (not 0.05); power bisection + unsolved fallback; exchanges normalized; log-odds; stake/hold/stale (45 vs 120) exclusions; `insufficient_sharp`; Pinnacle+MGM+Caesars → `insufficient_coverage`; PLAY always has ≥2 weight≥2.0 books; disagreement ignores weight 1.0; PP Power peak n=3; UD 2-pick hardest and 4>3; Flex 6 = 0.542; Flex 3 EV at 0.560 < 1 (formula unit test); UD `p_be = base / min(m,1)` (0.90 → 62.5% on 4-pick; 1.15 → same as m=1, not 48.9%); never `1/m` as implied; favorite-only grain; identity equation; sort tiebreak stable.
- **Assembly/route:** DFS age > 60 skips PLAY but `lines_seeded > 0`; 422 on flex/3 and boosted; exact-line alts; live games dropped; `stake` selected; `legs_surfaced == len(legs)`; `coverage_funnel_ratio` always when evaluated > 0; `flex_same_game_warning` when top 6 share a game; envelope `base_*`, `break_even_min`/`max`.
- **UI:** Flex 3 absent; Flex 6 same-game warning; `generated_at` visible; UD min–max BE; WNBA does not fetch.

## Later (not this spec)

| Item | Rule |
| --- | --- |
| Off-market lines | Convert each book via **its** alt ladder to a reference line, then average; then map to DFS. Extrapolation if \|DFS − reference\| **≥ 1.0**. `both_sides_cleared` becomes a real assertion |
| Strikeouts | Negative binomial. Poisson inflates the near-mean side and thins tails — not a blanket “+2 pts on overs” |
| STALE / news | Empty news must not map to UNEXPLAINED. Add OFF_MARKET (+1.5, recent gap). UNEXPLAINED = persisted through a DFS refresh |
| Shin | **Recall** improvement for favorites (devig currently understates the favorite). Not a v1 safety rail. Hold > 12% stays as data quality |
| Mixed UD modifiers | Entry-level `1 / (M × ∏ m_i)`; then drop `min(m, 1.0)` clamp |
| Entries / Fliff / goblins / `market_move` | Unchanged from prior Later table |

## Success criteria

1. Only PLAY legs, or an explicit empty state (threshold, stale DFS, or missing snapshot).
2. Auditable fair (books, hold, method, weights, line on every probability).
3. Underdog `p_be = base / min(m, 1.0)`; never `1/m` as implied prob; boosts do not sort to the top via a fake 48.9% BE.
4. PLAY requires `fair_prob >= p_be` only (no extra pts; disagreement is audit-only).
5. `legs_evaluated == legs_surfaced + sum(rejected_summary.values())`.
6. DFS snapshot > 60 min does not silently emit PLAY; `lines_seeded` still set.
7. Flex 3 is not in the picker; Flex 6 remains and warns on ≥3 same-game legs in the top 6.
8. Pinnacle+MGM+Caesars cannot form a PLAY; every PLAY has ≥2 weight≥2.0 books.
9. Props / `prop_fair` unchanged; `/wnba/legs` empty.
10. `generated_at` shown; server+client cache 5 minutes.
