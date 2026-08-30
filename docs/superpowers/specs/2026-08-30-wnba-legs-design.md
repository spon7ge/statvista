# WNBA Legs — 1:1 port of the MLB Legs product

Date: 2026-08-30  
Status: Approved  
Product: statvista  
Related: MLB pricer (`docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md`); MLB packed entries (`docs/superpowers/specs/2026-08-29-mlb-legs-recommended-entries-design.md`); empty `/wnba/legs` shell; WNBA props (`wnba.props`, `prop_fair`)

## Goal

Ship `/wnba/legs` as the same product as `/mlb/legs`: PrizePicks / Underdog **standard** lines priced against a **devigged, weighted sportsbook consensus at that exact line**, then packed into **complete N-pick `entries`**. Empty `entries` is a correct outcome.

Pricing, coverage, break-evens, packing, query params, and UI chrome match MLB. This spec covers **league adapters** (WNBA snapshots, basketball stat keys, scoreboard, roster) and **shared surface** (envelope schema, board). It does not re-specify the pricer or packer.

## Non-goals

- NBA Legs (page stays empty / disabled)
- Changing `legs_pricer`, `legs_payouts`, or `legs_pack` behavior
- Changing `prop_fair`, `GET /api/wnba/props/today`, `/wnba/prop_picks`, or `/mlb/legs` product behavior
- Live Parlay fetch on the Legs path (WNBA Props may still use live Parlay; Legs does not)
- Off-market fitting, news classifier, Fliff / Kalshi / bet365, goblin / demon lines, Pick6, Shin, profit / CLV
- PrizePicks Flex 3 as a selectable control; Underdog `boosted`
- Extracting a generic multi-league assembler

## Decisions

| Topic | Choice |
| --- | --- |
| Product | 1:1 with current MLB Legs (priced PLAY + greedy complete-N `entries`) |
| Page | `/wnba/legs` |
| API | `GET /api/wnba/legs?app=&format=&legs=` |
| Fair engine | Existing `legs_pricer` — do **not** call `prop_fair` |
| Payouts | Existing `legs_payouts` tables; `payouts_assumed: true` |
| Packer | Existing `legs_pack`; Flex 6 max 2 legs per `game_id`; `flex_same_game_warning` always false |
| Default URL | `?app=prizepicks&format=power&legs=4` |
| Line match | Exact DFS line only |
| DFS seed | `fetch_latest_prizepicks("wnba")` / `fetch_latest_underdog("wnba")`; PP `odds_type` **standard** only |
| Books | ProphetX, Novig, Pinnacle (alts); Parlay DK/FD/BetMGM/Caesars from **`odds.wnba_parlay_api_odds` snapshot** |
| Parlay | Snapshot only. Empty → `parlay_unavailable`, continue with PX/Novig/Pinnacle. Never live Parlay for Legs |
| Stat keys | Basketball: `canonical_stat_key_from_pp` / `_ud` / `_exchange` in `betting.prop_stat_keys` |
| Coverage / ages / hold / stake | Identical to MLB pricer spec (45 / 120 min; hold > 12%; PX stake required; Novig stake optional) |
| Locked games | Drop `live`, `halftime`, and `final` (WNBA scoreboard; `halftime` is in-progress) |
| `game_id` | `espn_event_id` when set, else `id`; omit when unknown; null treated as distinct for Flex cap |
| Team / matchup | ESPN WNBA roster → team abbrev; scoreboard → `AWAY @ HOME` |
| Cache | In-process **5 minutes** per `(app, format, legs)` in the **WNBA** assembler (not shared with MLB). Frontend `staleTime` **5 minutes** |
| Schema | Shared Pydantic models in `betting.schemas_legs`. MLB OpenAPI name `MlbLegsResponse` stays (alias/subclass). Add `WnbaLegsResponse` with the same fields |
| UI | Shared `features/legs/LegsBoard`; `/mlb/legs` and `/wnba/legs` both render it. NBA still empty |

Pricer and packer rules (favorite-only grain, log-odds consensus, independence, disagreement adder, UD `p_be = base / min(m, 1.0)`, identity with `unpacked_remainder`) are **inherited unchanged** from the two MLB specs above.

## Architecture

```text
Browser  /wnba/legs?app=&format=&legs=
        │
        ▼
useWnbaLegs  →  GET /api/wnba/legs
        │
        ▼
wnba.legs.get_wnba_legs()
        ├─ validate via legs_payouts (not wnba.prop_formats)
        ├─ seed PrizePicks or Underdog (wnba, standard only)
        ├─ if DFS age > 60 min → empty entries, dfs_snapshot_stale, keep lines_seeded
        ├─ exact-line two-ways: PX / Novig / Pinnacle alts
        │    + Parlay DK/FD/MGM/Caesars from odds.wnba_parlay_api_odds
        ├─ pair O+U; PX stake>0; Novig stake optional; hold>12% out;
        │    sharp/exchange 45 min; supporting 120 min
        ├─ drop live / halftime / final
        ├─ attach espn event id as game_id; roster for team + matchup
        ├─ legs_pricer per (player, stat, line)  # favorite side only
        └─ legs_pack → entries[]
```

`/mlb/legs` keeps `get_mlb_legs()` and MLB snapshots. Do not call MLB tables from the WNBA path or WNBA tables from the MLB path.

## Components

| Unit | Role |
| --- | --- |
| `betting.legs_pricer` / `legs_payouts` / `legs_pack` | Unchanged |
| `betting.schemas_legs` | Shared envelope: play, entry, rejected_summary, response. Field set identical to current `MlbLegsResponse` |
| `wnba.legs.get_wnba_legs()` | WNBA assembler + 5-min in-process cache |
| `wnba.props.index_parlay_api_odds_by_book` | Same contract as MLB’s helper in `mlb.props`; basketball stat keys; snapshot rows only |
| `GET /api/wnba/legs` | Same query and 422 rules as `GET /api/mlb/legs` |
| `useWnbaLegs` | Lives next to other WNBA hooks; query key `["wnba","legs",app,format,legs]`; `staleTime` 5 min |
| `features/legs/LegsBoard` | Move today’s `MlbLegsBoard` here. Accepts the envelope + loading/error from the page. Chrome copy unchanged except `slate` comes from the envelope |

`LeagueLegsPage`: `/mlb/legs` calls `useMlbLegs` and renders `LegsBoard`; `/wnba/legs` calls `useWnbaLegs` and renders the same `LegsBoard`; NBA path does not fetch.

## Assembly

1. `validate_legs_query(app, format, legs)`. Invalid → **422**.
2. Seed latest WNBA PrizePicks or Underdog snapshot. PP **standard** only. Unknown basketball markets skipped (no candidate). Set `lines_seeded`.
3. `dfs_snapshot_age_minutes` from latest seed `scraped_at` vs `generated_at`. If **> 60**, return empty `entries` + `dfs_snapshot_stale`. Do not price. Keep `lines_seeded`.
4. Exact-line two-way indexes: PX, Novig, Pinnacle (`mains_only=False`); Parlay DK/FD/BetMGM/Caesars including alts from `fetch_latest_parlay_api_odds("wnba")`. `match_player_key`. No Fliff/Kalshi/bet365.
5. Attach `stake` on PX/Novig. Missing column → `None`. Novig still prices; ProphetX without both sides `> 0` is excluded.
6. Book age vs this assemble `generated_at`: sharp/exchange **45 min**, supporting **120 min**.
7. Today’s WNBA scoreboard: drop `live` / `halftime` / `final`. `game_id` is `espn_event_id` when set, otherwise `id`. Soft-fail scoreboard → skip lock filter, omit `game_id` when unknown. Soft-fail roster → empty team/matchup, still price.
8. Pricer per remaining **line**; sort PLAY (`margin_pts` desc, `fair_prob` desc, `player` asc); `pack_entries`. `flex_same_game_warning` is always **false**.
9. Soft-fail empty DFS: **200**, empty `entries`, `prizepicks_unavailable` / `underdog_unavailable`, `lines_seeded = 0`. Empty Parlay: `parlay_unavailable`, continue.

Envelope matches MLB field-for-field except `slate` is `WNBA YYYY-MM-DD` (`generated_at` date, UTC). Disclaimers: reuse the current MLB Legs strings verbatim.

Identity (inherited):

```text
legs_evaluated == legs_surfaced + sum(rejected_summary.values())
legs_surfaced == sum(len(e.legs) for e in entries)
```

`rejected_summary` keys (all always present): `insufficient_coverage`, `insufficient_sharp`, `below_threshold`, `unpriceable_payout`, `unpacked_remainder`.

`coverage_funnel_ratio` when `legs_evaluated > 0`; `coverage_funnel_collapsed` if evaluated ≥ 20 and ratio ≥ 0.95.

Do not use WNBA Props live `book_indexes` or `collect_board_quotes()`.

## API

`GET /api/wnba/legs`

| Param | Values |
| --- | --- |
| `app` | `prizepicks` \| `underdog` |
| `format` | PP: `power` \| `flex`. UD: `standard` only |
| `legs` | PP power: 2–6. PP flex: **6 only**. UD: 2–6 |

Invalid combination → **422**. `Cache-Control: no-store`. HTTP **200** for empty `entries`.

OpenAPI: add `/api/wnba/legs` to `REQUIRED_WNBA_PATHS`; regen frontend types. Update `md/system-design.md` page ↔ API row.

## UI

`/wnba/legs` fetches `useWnbaLegs`. Default `?app=prizepicks&format=power&legs=4`, `replace: true`.

Shared board: PrizePicks \| Underdog; Power 2–6 or Flex 6 (no Flex 3); UD Standard 2–6. Packed **entries** cards only. Expand = per-book audit. Show `generated_at`. PrizePicks: envelope `base_break_even`. Underdog: packed `break_even_min`–`break_even_max`. Non-monotonicity sentence follows the **selected app**.

Empty copy: stale DFS vs missing snapshot vs no complete N-pick vs loading vs error — same as MLB.

`/mlb/legs` still uses `useMlbLegs` only. NBA does not fetch.

## Error handling

| Case | Behavior |
| --- | --- |
| Bad query | 422 |
| DFS age > 60 min | 200, empty `entries`, `dfs_snapshot_stale`, `lines_seeded` set, `unpacked_remainder = 0` |
| Missing DFS snapshot | 200, empty `entries`, `prizepicks_unavailable` / `underdog_unavailable`, `lines_seeded = 0` |
| Empty Parlay snapshot | `parlay_unavailable`; continue with PX/Novig/Pinnacle |
| Scoreboard / roster failure | Soft-fail; never invent books or games |
| ProphetX no stake / hold > 12% / power unsolved / stale quote | Exclude that book |
| No sharp/exchange | `insufficient_sharp` |
| Sharp + only MGM/Caesars as the other two | `insufficient_coverage` |
| PLAY pool cannot fill N | 200, empty or fewer cards; leftover in `unpacked_remainder` |
| Identity fail | Test failure; do not ship |

## Testing

- **Pricer / payouts / packer:** existing tests unchanged; no new pricer behavior.
- **Assembly / route:** default `prizepicks/power/4` envelope; 422 on flex/3 and boosted; DFS age > 60 skips PLAY with `lines_seeded > 0`; empty snapshot warnings; exact-line alts pair, off-line quotes do not; live/halftime/final dropped, scheduled kept; PX stake required, Novig null stake prices; identity; `coverage_funnel_ratio` when evaluated > 0; Flex 6 max 2 per `game_id`; `slate` starts with `WNBA`; WNBA path never reads `league=mlb` snapshots; MLB route tests still pass.
- **UI:** `/wnba/legs` calls WNBA hook not MLB; `/mlb/legs` still MLB-only; Flex 3 absent; `generated_at` visible; UD min–max BE; empty vs stale vs missing snapshot; NBA empty.
- **Contract:** OpenAPI includes `/api/wnba/legs`; `md/system-design.md` updated.

## Success criteria

1. `/wnba/legs` shows complete N-pick entries or an explicit empty state (threshold/pack, stale DFS, or missing snapshot).
2. Fair audit is the same shape as MLB (books, hold, method, weights, line on every probability).
3. Gates, payouts, packing, and query 422 rules match MLB; only data sources and `game_id` / lock statuses differ.
4. Identity equation holds with `unpacked_remainder`.
5. Props / `prop_fair` / `/mlb/legs` product behavior unchanged.
6. NBA Legs stays empty; WNBA Legs does not call `GET /api/mlb/legs`.
7. `generated_at` shown; server + client cache 5 minutes, caches not shared across leagues.

## Later (not this spec)

Inherited from the MLB specs (off-market lines, Shin, news classifier, mixed UD modifiers, NBA Legs). No additional WNBA-only later items.
