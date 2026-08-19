# WNBA PrizePicks — session persistence for ~30-minute cadence

Date: 2026-08-19  
Status: Approved for planning (approach locked with user)

## Goal

Make `src/scrapers/wnba_prizepick.py` able to run about every 30 minutes with **mostly unattended** fetches. Occasional headed captcha is acceptable when DataDome invalidates the session. Fully captcha-free forever is out of scope.

## Context

- Scraper already uses `api.prizepicks.com/projections` (API path), not HTML scraping.
- Fetch order today: `curl_cffi` → `requests` → headed Playwright.
- Unlike `mlb_prizepick.py`, the WNBA scraper does **not** auto-persist cookies after a Playwright solve, and Playwright always opens a **fresh** `browser.new_context()` (no `storage_state`).
- After one successful MLB Playwright solve, a subsequent WNBA run hit a live DataDome captcha — consistent with “session burned / not reused.”

## Decisions

| Topic | Choice |
| --- | --- |
| Target file | `src/scrapers/wnba_prizepick.py` only (MLB left as-is for this change) |
| Primary strategy | Port MLB auto cookie file + add Playwright `storage_state` persistence |
| Captcha policy | Occasional manual solve OK; prefer HTTP reuse between solves |
| Proxy | Optional env hook only (`PRIZEPICKS_PROXY`); not required for v1 |
| Shared module refactor | Out of scope — duplicate MLB helpers into WNBA for a small focused change |
| Undetected-Chromedriver | Out of scope — stay on Playwright (already in ETL deps) |
| Cadence / Airflow wiring | Out of scope — scraper behavior only; caller still schedules runs |

## Architecture

```
fetch_projections_payloads()
  ├── get_cookie_for_request()     # env → auto cookie file (NEW for WNBA)
  ├── try_fetch_with_curl_cffi()   # uses Cookie header when present
  ├── try_fetch_with_requests()
  └── try_fetch_with_playwright()
        ├── load storage_state if present
        ├── optional proxy from PRIZEPICKS_PROXY
        ├── goto app.prizepicks.com, wait/clear DataDome (≤ ~120s)
        ├── fetch NBA + WNBA via in-page fetch(credentials: 'include')
        └── on success: save cookie header + storage_state for next run
```

### Persistence artifacts

Default directory: `data/props/prizepicks/`

| Artifact | Default path | Purpose |
| --- | --- | --- |
| Cookie header file | `.session_cookie.txt` | Reused by curl_cffi / requests (same file as MLB when paths shared) |
| Playwright storage | `.playwright_storage.json` | Cookies + localStorage for browser context reuse |

Overrides:

- `PRIZEPICKS_COOKIE` / `PRIZEPICKS_COOKIE_FILE` — same semantics as MLB (explicit file replaces default cookie path)
- `PRIZEPICKS_STORAGE_STATE` — optional override path for Playwright storage JSON
- `PRIZEPICKS_PROXY` — optional proxy URL passed into Playwright (and curl_cffi/requests when set)

### Playwright behavior changes

1. If storage state file exists and is valid JSON → `browser.new_context(storage_state=path)`.
2. Else → empty context (current behavior).
3. After a successful clearance + at least one league payload:
   - Build cookie header from context cookies → `save_session_cookie`
   - `context.storage_state(path=...)` to refresh the storage file
4. Keep headed default; `PRIZEPICKS_HEADLESS=1` unchanged.
5. Keep probing/clearance wait ≤ ~120s; log once when captcha interstitial is detected.

### Soft rate / anti-thrash

- Do not add new multi-profile hammering beyond existing curl_cffi profile list.
- Prefer succeeding on HTTP with the saved cookie so Playwright does not open every 30 minutes.
- If HTTP fails with DataDome, fall through to Playwright once per run (existing behavior).

### Error / docs copy

Update module docstring and failure troubleshooting to mention:

- Auto-managed cookie + storage state files
- Occasional headed captcha when session expires
- Optional `PRIZEPICKS_PROXY` for sticky residential IPs if challenges remain frequent

## Out of scope

- Changing league IDs / extract / Supabase upsert logic
- Refactoring MLB + WNBA into a shared PrizePicks module
- Captcha-solving services, undetected-chromedriver, residential proxy procurement
- Airflow DAG / cron schedule changes
- Guaranteeing zero DataDome challenges

## Testing

- Unit tests (no live network) for:
  - `cookie_file_path` / default cookie load when file present
  - `storage_state_path` resolution (default + env override)
  - Cookie header builder from Playwright-like cookie dicts (port MLB helper tests if useful)
- Do not call live PrizePicks in CI
- Manual smoke: one headed solve → confirm artifacts written → second run prefers HTTP and skips Playwright when cookie still valid

## Success criteria

1. After one successful headed Playwright solve, cookie + storage_state files exist under `data/props/prizepicks/` (or configured paths).
2. A follow-up run within session lifetime fetches via curl_cffi/requests without opening a browser when the cookie is still accepted.
3. When the cookie is rejected, Playwright reloads `storage_state`, waits for captcha if needed, and refreshes both artifacts on success.
4. Existing extract/save/CLI behavior unchanged when fetch succeeds.
5. Optional proxy env is documented and wired if set; unset behavior unchanged.

## Spec self-review

- No unresolved placeholders.
- Scope limited to WNBA scraper persistence; no contradiction with prior DataDome Playwright design (extends it).
- Ambiguity avoided: shared default cookie file with MLB is intentional so one solve can warm both scripts.
- Proxy is optional enhancement, not a dependency for success criteria 1–4.
