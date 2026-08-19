# Prop player match keys — strong norm + aliases

Date: 2026-08-19  
Status: Approved  
Related: WNBA/MLB prop picks player boards; Parlay / ProphetX / Novig / Pinnacle book joins

## Goal

Improve prop-book joins when Parlay API and scraper name spellings differ from DFS seed names (PrizePicks / Underdog), for **both WNBA and MLB**. Display names stay DFS. No ESPN identity hub.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope | Prop-book joins only (approach A); both leagues |
| Board seed | Unchanged — DFS scrapers still define which props exist and display `player_name` |
| Match key | Strong Unicode normalize (NFKD → strip combining marks → casefold → strip/collapse whitespace) + optional alias map |
| Aliases | Small static map: alternate strong-normed spelling → canonical strong-normed spelling (prefer book/scraper → DFS shape) |
| ESPN | Remains enrichment only (team / headshot / position); not the join hub |
| Fuzzy matching | Out of scope |
| Combo DFS names (`A + B`) | Remain unmatched; no split heuristic |
| Apostrophes (`A'ja`) | Kept (not stripped) |
| Jr. / III auto-strip | Out of scope for v1; add aliases only if a real miss appears |
| Stored snapshots | Do not rewrite scraper/Parlay rows; match at assemble/index time only |

## Architecture

```
DFS seed row.player_name  ──display──► API / UI (unchanged spelling)
        │
        └─ match_player_key(name)
              1. strong_norm(name)
              2. ALIASES.get(key, key)
              └─ join key for books_main / side indexes

Parlay / ProphetX / Novig / Pinnacle player fields
        └─ same match_player_key(...) when building indexes
```

Join dimensions stay as today: `(match_key, canonical_stat[, line])` for fair/`books`; `(match_key, stat)` for `books_main` main-line pick.

## Shared helper

New module: `backend/app/domains/betting/player_match_keys.py`

- `strong_norm_player_name(name: str) -> str` — same semantics as ESPN `norm_player_name` (accent strip), plus collapse internal whitespace to a single space after strip.
- `match_player_key(name: str) -> str` — `ALIASES.get(strong_norm_player_name(name), strong_norm_player_name(name))`.
- `PLAYER_NAME_ALIASES: dict[str, str]` — keys and values already strong-normed; seed with known misses, e.g. `jessica lynn shepard` → `jessica shepard`. Grow only when a real join failure is confirmed.

Call sites replace weak `_norm_player` (`strip().casefold()` only) used for **book joins** in:

- `backend/app/domains/wnba/props.py`
- `backend/app/domains/mlb/props.py`
- `backend/app/providers/parlay/wnba_board.py` (index keys)
- `backend/app/providers/parlay/mlb_props.py` (index keys)

Do **not** change display fields. Optional follow-up (same PR if trivial): point ESPN roster enrichment keys at `strong_norm_player_name` so accented DFS names hit ASCII ESPN roster entries without relying on duplicate logic — still not an ESPN join hub for books.

Out of scope for this change: `odds_api/mlb_props.py` unless it feeds the same prop-picks assemble path; pipeline/`src/utils` norms.

## Alias policy

1. Prefer mapping **book/scraper spelling → DFS spelling** so board keys stay DFS-shaped when DFS is the seed.
2. Aliases must be unique by construction (one target per source key); unit test that values are strong-normed and keys do not collide.
3. No automatic “drop middle name” rule — only explicit aliases (avoids Williams/Clark false positives).

## Error handling

- Empty / whitespace-only names → empty match key; row skips book attach as today.
- Alias miss → strong norm alone (no error).
- Persist / HTTP paths unchanged; this is pure join-key behavior.

## Testing

- Unit: strong norm accents (`Salaün` ≡ `Salaun`, `Juškaitė` ≡ `Juskaite`, `Leïla` ≡ `Leila`); apostrophe preserved (`A'ja`).
- Unit: alias resolves middle-name variant to DFS key.
- Assemble / index: DFS row joins book row when only accents or a seeded alias differ; identical ASCII still joins; `Name A + Name B` does not match solo book players.
- Regression: existing prop/stat key tests still pass.

## Non-goals

- Stable ESPN (or other) player ids across sources
- Renaming players inside scrapers or Supabase snapshot rows
- Matching combo props to two singles
- Using match fill rate as a substitute for book coverage (NL can still mean “book has no line”)

## Success criteria

- Known accent mismatches join books without aliases.
- Seeded middle-name aliases join.
- DFS display names unchanged in API responses.
- WNBA and MLB prop assemble both use the shared helper.
