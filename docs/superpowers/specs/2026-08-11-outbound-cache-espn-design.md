# Outbound cache for ESPN (and similar) fetches

**Date:** 2026-08-11  
**Status:** Approved  
**Plan:** `docs/superpowers/plans/2026-08-11-outbound-cache-espn.md`
**Product:** statvista  

## Problem

Public ESPN `site.api` / `apis.v2` endpoints occasionally return **403 Forbidden**. The backend then fails WNBA standings (502) and team roster / team-preview enrichment even though the same URLs often worked minutes earlier.

Today many domain modules already use in-process TTL caches, refresh locks, and stale-on-error. That helps within one process lifetime but:

- Does not survive uvicorn reload / restart
- Does not rate-limit or back off outbound ESPN calls
- Does not share one coalesced GET across different call sites hitting the same URL
- Roster fetches still fan out with bare `httpx` and little protection

## Goal

Add a **shared outbound JSON cache** so the backend serves from its own store first, matches fetch frequency to data volatility, coalesces concurrent calls, rate-limits / backs off upstream, and uses stale-while-revalidate — without rewriting every domain cache in v1.

## Decision summary

| Choice | Decision |
|--------|----------|
| Store | Process memory (L1) + disk JSON (L2) under `backend/data/cache/outbound/` |
| Shape | Shared helper module, not per-feature copy-paste |
| First callers | WNBA standings + WNBA ESPN roster (and teams index if used by roster build) |
| Not in v1 | ETag/If-None-Match, Supabase, migrating all domains, inventing ESPN multi-roster batch APIs |

This matches existing disk-cache precedent (`data/cache/mlb_player_of_the_game/`).

## Architecture

### Module

`backend/app/core/outbound_cache.py`

Primary API (conceptual):

```python
async def get_json(
    key: str,
    url: str,
    *,
    ttl_seconds: float,
    headers: dict[str, str] | None = None,
    timeout_seconds: float = 10.0,
) -> Any:
    ...
```

Helpers for tests: clear memory + optional disk, inspect backoff state.

### Responsibilities (v1)

1. **Explicit TTLs** — fresh window per key; last-good body retained past TTL for SWR / error fallback
2. **Memory + disk** — disk envelope survives restart; memory avoids repeated disk reads
3. **Request coalescing** — `key → asyncio.Future` (or equivalent) so concurrent callers share one upstream GET
4. **Per-host rate limit** — simple min-interval / token bucket for hosts such as `site.api.espn.com`
5. **Backoff** — on 403 / 429 / 5xx, delay further attempts to that host (exponential, capped)
6. **Stale-while-revalidate** — if body exists but TTL expired, return stale immediately and schedule a coalesced background refresh
7. **Default browser-like headers** — `User-Agent` + `Accept: application/json` (aligned with current standings fetch)

### Disk envelope

Path: `data/cache/outbound/<safe_key>.json` (cwd relative to backend process, same pattern as POTG).

Example:

```json
{
  "key": "espn:wnba:standings",
  "url": "https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings",
  "fetched_at": 1723412345.0,
  "ttl_seconds": 600,
  "body": {}
}
```

`safe_key` = filesystem-safe transform of `key` (replace `:` / `/` as needed). Optional env override for cache root later; default is enough for v1.

## Data flow

1. Memory hit within TTL → return body
2. Else load disk → if within TTL, hydrate memory → return body
3. Else if body exists but TTL expired → return body + schedule coalesced refresh
4. Else cold miss → await coalesced upstream GET (respect host limiter + backoff)
5. On success → update memory + write disk envelope
6. On failure → if any L1/L2 body exists, return it and keep/extend host backoff; else raise

Domain layers (e.g. `get_wnba_standings` normalized response cache) may remain. They call `outbound_cache.get_json` instead of raw `httpx` for the ESPN payload.

## TTLs (fresh window)

| Key | Fresh TTL | Notes |
|-----|-----------|--------|
| `espn:wnba:standings` | 10 minutes | Matches current domain `CACHE_TTL_SECONDS` |
| `espn:wnba:roster:{team_id}` | 15 minutes (900s) | Low volatility; high fan-out today |
| `espn:wnba:teams` | 1 hour (3600s) | Nearly static |

Stale bodies are kept beyond TTL until overwritten by a successful refresh (no “forever empty” success cache; failures do not clear good snapshots).

### Host policy (ESPN)

- Baseline: 1 request/second to ESPN hosts (tunable constant)
- On 403 / 429 / 5xx: exponential backoff starting at ~30s, doubling, **cap 10 minutes**, before another attempt to that host
- Soft-fail responses while backing off use stale when available

## Error handling

| Situation | Behavior |
|-----------|----------|
| Upstream error + stale exists | Return stale; log warning (key, status, backoff) |
| Upstream error + no stale | Raise (preserves today’s cold-start 502 path) |
| Disk read/write failure | Log; continue with memory / upstream; do not crash the request |
| Background SWR refresh fails | Log only; next request retries under backoff |

Never delete a good disk snapshot because a refresh failed.

## First callers (v1 wiring)

1. `backend/app/domains/wnba/standings.py` — `fetch_espn_standings` → `get_json("espn:wnba:standings", ...)`
2. `backend/app/providers/espn/wnba_roster.py` — `fetch_espn_roster` / teams list → keyed `get_json`

No route or OpenAPI changes. Frontend unchanged. Update `md/system-design.md` briefly to note that WNBA standings/roster JSON is served via outbound disk+memory cache (source remains ESPN).

## Testing

Unit tests with mocked HTTP (no live ESPN):

- Fresh memory/disk hit skips HTTP
- Expired body → returns stale and triggers one coalesced refresh
- N concurrent cold misses → single upstream call
- 403 with stale → returns stale; call within backoff skips HTTP
- 403 with no stale → raises
- Successful refresh updates memory and disk envelope

## Mapping to the eight practices

| Practice | v1 |
|----------|----|
| 1. Cache + serve from own store | Memory + disk JSON |
| 2. Match fetch freq to volatility | Per-key TTLs above |
| 3. Explicit TTLs, not forever | Fresh TTL + retained stale fallback |
| 4. Conditional requests | **Out of scope** (follow-up) |
| 5. Request coalescing | Inflight map by key |
| 6. Rate limit + backoff | Per-host limiter + 403/429/5xx backoff |
| 7. Batch where possible | Coalesce + sequential under limiter; no fake multi-roster ESPN API |
| 8. Stale-while-revalidate | Return expired body + background refresh |

## Out of scope (explicit)

- ETag / `If-None-Match` / `If-Modified-Since`
- Supabase or shared multi-instance store
- Migrating MLB, scoreboard, leaders, odds, stats.wnba, etc. onto the helper
- Changing public API contracts
- Guaranteeing ESPN never 403s (mitigation only: fewer calls + survive on last-good)

## Follow-ups (after v1)

1. Conditional requests once envelopes store `etag` / `last_modified`
2. Opt in more ESPN / stats.wnba call sites
3. Durable shared store (Supabase) if multiple API workers need one cache

## Success criteria

- With a warm disk snapshot, standings and roster-backed team preview remain usable across process restart while ESPN returns 403
- Concurrent duplicate keys produce one upstream GET
- Unit tests cover hit / SWR / coalesce / backoff / hard-fail paths without network
