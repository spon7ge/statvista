# MLB Parlay `*_alternate` Market Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map Parlay MLB `market_key` values ending in `_alternate` to the same canonical stats as main keys so `/mlb/prop_picks` can exact-match DFS alt lines for Novig/DK/FD and cmp books.

**Architecture:** One-line behavior change in `canonical_stat_key_from_sharp_mlb`: after `_norm`, strip a trailing `_alternate` once, then run existing prefix/alias logic. `_index_parlay` already keys by exact line — no index rewrite. WNBA keeps `select_parlay_main_lines` upstream and is out of scope.

**Tech Stack:** Python, pytest, FastAPI MLB props domain (`backend/app/domains/mlb/`).

## Global Constraints

- Scope: MLB Prop Picks Parlay attach only.
- Strip trailing `_alternate` only (extend only if live sample shows another suffix).
- Exact DFS line match unchanged; no closest-line matching.
- No Parlay `is_main` labels; no schema/UI changes.
- WNBA untouched — `select_parlay_main_lines` still filters before WNBA normalize.
- Parlay → Supabase persist remains main-line-only.
- Branding: product name **statvista** if any user-facing copy appears (none expected).

## File map

| File | Role |
| --- | --- |
| `backend/app/domains/mlb/prop_stat_keys.py` | Strip `_alternate` in sharp mapper |
| `backend/tests/test_mlb_prop_stat_keys.py` | Mapper unit tests |
| `backend/tests/test_mlb_props.py` | End-to-end Parlay alt attach regression |
| `docs/superpowers/specs/2026-08-06-mlb-parlay-alternate-market-keys-design.md` | Status → Implemented + any extra suffixes found |

---

### Task 1: Strip `_alternate` in the MLB sharp mapper

**Files:**
- Modify: `backend/app/domains/mlb/prop_stat_keys.py` (`canonical_stat_key_from_sharp_mlb`)
- Modify: `backend/tests/test_mlb_prop_stat_keys.py`
- Test: `backend/tests/test_mlb_prop_stat_keys.py`

**Interfaces:**
- Consumes: existing `_norm`, `_SHARP_ALIASES`, `_SHARP_PREFIXES`
- Produces: `canonical_stat_key_from_sharp_mlb(market_key: str) -> str | None` also accepting `*_alternate` keys

- [ ] **Step 1: Suffix verification (pre-impl)**

If `PARLAY_API_KEY` is available, fetch a live sample and list alt-looking keys:

```bash
cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/backend
# Requires PARLAY_API_KEY in env
python3 - <<'PY'
import os, collections
from app.providers.parlay.client import parlay_get
import asyncio

async def main():
    rows = await parlay_get("/sports/baseball_mlb/props", params={"limit": 10000}, timeout=60)
    keys = sorted({str(r.get("market_key") or "") for r in rows if isinstance(r, dict)})
    altish = [k for k in keys if "alt" in k.lower()]
    print("altish keys:", altish[:50])
    print("count altish:", len(altish))
    print("suffixes:", sorted({k[k.rfind("_"):] for k in altish if "_" in k}))

asyncio.run(main())
PY
```

Expected: alt keys end with `_alternate` only. If the key is missing or the call fails, proceed with docs-documented `_alternate` only and note “live sample skipped” in the commit body.

If another suffix appears (e.g. `_alt`), add it to the strip list in Step 3 and update the design doc in Task 3.

- [ ] **Step 2: Write the failing mapper tests**

Add to `backend/tests/test_mlb_prop_stat_keys.py`:

```python
def test_sharp_strips_alternate_suffix():
    assert (
        canonical_stat_key_from_sharp_mlb("player_total_bases_alternate")
        == "total_bases"
    )
    assert (
        canonical_stat_key_from_sharp_mlb("batter_strikeouts_alternate")
        == "batter_strikeouts"
    )
    assert (
        canonical_stat_key_from_sharp_mlb("pitcher_strikeouts_alternate")
        == "pitcher_strikeouts"
    )
    # Main key unchanged
    assert canonical_stat_key_from_sharp_mlb("player_total_bases") == "total_bases"


def test_sharp_alternate_and_main_share_canonical_key():
    main = canonical_stat_key_from_sharp_mlb("player_total_bases")
    alt = canonical_stat_key_from_sharp_mlb("player_total_bases_alternate")
    assert main == alt == "total_bases"
```

Keep existing `test_sharp_prefixed_and_bare_forms` / `test_sharp_unmatched_returns_none`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_prop_stat_keys.py::test_sharp_strips_alternate_suffix tests/test_mlb_prop_stat_keys.py::test_sharp_alternate_and_main_share_canonical_key -v`

Expected: FAIL (`None` or AssertionError — `_alternate` not stripped)

- [ ] **Step 4: Implement the strip**

In `canonical_stat_key_from_sharp_mlb`, immediately after `norm = _norm(market_key)`:

```python
def canonical_stat_key_from_sharp_mlb(market_key: str) -> str | None:
    """Map a ProphetX ``stat_name``, Pinnacle ``market_type``, or Parlay
    ``market_key`` to a canonical MLB stat key.

    Tries the prefixed form first (so ``batter_strikeouts`` and
    ``pitcher_strikeouts`` resolve to distinct keys) before falling back to
    the bare form (ProphetX already emits bare names).

    Parlay alt props use the same base key with a trailing ``_alternate``
    suffix (e.g. ``player_total_bases_alternate``); strip it once so alts
    share the main canonical key.
    """
    norm = _norm(market_key)
    if norm.endswith("_alternate"):
        norm = norm[: -len("_alternate")]
    for prefix in _SHARP_PREFIXES:
        # ... existing body unchanged ...
```

Do not change PP/UD mappers.

- [ ] **Step 5: Run mapper tests**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor/backend && PYTHONPATH=..:. python3 -m pytest tests/test_mlb_prop_stat_keys.py -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/prop_stat_keys.py backend/tests/test_mlb_prop_stat_keys.py
git commit -m "$(cat <<'EOF'
fix(mlb): map Parlay *_alternate market keys to canonical stats

Strip trailing _alternate so Prop Picks can exact-match DFS alt lines.
EOF
)"
```

---

### Task 2: Prop Picks regression — DFS attaches Parlay alt line

**Files:**
- Modify: `backend/tests/test_mlb_props.py`
- Test: `backend/tests/test_mlb_props.py`
- No production change expected beyond Task 1 (index already exact-line)

**Interfaces:**
- Consumes: `_stub_snapshots` / `get_mlb_props_today` with Parlay rows using `*_alternate` keys
- Produces: regression that DFS 1.5 + Novig `player_total_bases_alternate` @ 1.5 attaches while main key is only at 2.5

- [ ] **Step 1: Write the failing-or-passing regression test**

Add after the ProphetX alt attach test in `backend/tests/test_mlb_props.py`:

```python
def test_exact_line_attaches_parlay_alternate_market_key(monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_snapshots(
        monkeypatch,
        dfs_pp=[
            {
                "player_name": "Mookie Betts",
                "stat_type": "Total Bases",
                "line_score": 1.5,
                "odds_type": "standard",
                "scraped_at": now,
            },
        ],
        prophetx=[],  # force fair via Parlay Novig only
        parlay_rows=[
            {
                "player": "Mookie Betts",
                "market_key": "player_total_bases",
                "line": 2.5,
                "bookmaker": "novig",
                "over_price": -110,
                "under_price": -110,
            },
            {
                "player": "Mookie Betts",
                "market_key": "player_total_bases_alternate",
                "line": 1.5,
                "bookmaker": "novig",
                "over_price": -130,
                "under_price": 110,
            },
            {
                "player": "Mookie Betts",
                "market_key": "player_total_bases_alternate",
                "line": 0.5,
                "bookmaker": "novig",
                "over_price": -200,
                "under_price": 160,
            },
        ],
    )

    import asyncio

    response = asyncio.run(
        svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    )

    assert len(response.props) == 1
    row = response.props[0]
    assert row.line == 1.5
    assert row.books.novig is not None
    assert row.books.novig.american == -130
    assert row.source_tier == "sharp_single_source"
    assert row.fair_pct is not None
```

If Task 1 is not merged yet, this fails with `novig is None` / `no_sharp_read`. After Task 1 it should pass.

- [ ] **Step 2: Run the test**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=.:backend python3 -m pytest backend/tests/test_mlb_props.py::test_exact_line_attaches_parlay_alternate_market_key backend/tests/test_mlb_props.py::test_exact_line_mismatch_omits_book -v`

Expected: PASS for both

- [ ] **Step 3: Run WNBA main-line smoke (untouched path)**

Run: `cd /Users/alexgonzalez/Documents/NBA-Prop-Predictor && PYTHONPATH=.:backend python3 -m pytest tests/odds/test_parlay_main_lines.py backend/tests/test_parlay_props.py -q`

Expected: PASS (no intentional edits; guards against accidental WNBA bleed)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_mlb_props.py
git commit -m "$(cat <<'EOF'
test(mlb): lock Parlay *_alternate exact attach on prop picks

DFS 1.5 attaches Novig alt while main market_key only quotes 2.5.
EOF
)"
```

---

### Task 3: Mark design Implemented + rollout checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-06-mlb-parlay-alternate-market-keys-design.md`
- No code tests

**Interfaces:**
- None (docs)

- [ ] **Step 1: Update the design doc**

- Set `Status: Implemented`
- Under Suffix verification, note either “confirmed `_alternate` only from live sample on &lt;date&gt;” or “live sample skipped; shipped docs-documented `_alternate` only”
- If extra suffixes were added in Task 1, list them explicitly

Add a short **Rollout** subsection with the checklist:

```markdown
## Rollout (ops)

After deploy, for 2–3 MLB prop boards:

1. Count `source_tier == no_sharp_read` before deploy (or from a pre-deploy snapshot).
2. Recount after deploy on a comparable slate.
3. Note how many newly resolved rows attach via Parlay (Novig/DK/FD) at the DFS line.
4. Paste before/after counts in the PR description or a follow-up note.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-06-mlb-parlay-alternate-market-keys-design.md
git commit -m "$(cat <<'EOF'
docs: mark Parlay MLB *_alternate mapping implemented

Record suffix verification outcome and post-deploy count checklist.
EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Strip `_alternate` in sharp mapper | Task 1 |
| Live/docs suffix verification | Task 1 Step 1 + Task 3 |
| Mapper main + multi-alt tests | Task 1 |
| Index / DFS attach at alt line | Task 2 |
| Main-only regression | Task 1 + existing tests |
| WNBA untouched | Task 2 Step 3 |
| Rollout before/after counts | Task 3 checklist (ops, not CI) |
| Out of scope (WNBA/persist/`is_main`) | Global constraints |

## Placeholder scan

None intentional.
