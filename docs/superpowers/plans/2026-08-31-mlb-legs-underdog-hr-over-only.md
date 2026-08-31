# Underdog Home-Run Over-Only Legs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Underdog MLB Legs from emitting Under home runs; evaluate Over only and let longshots fail the existing EV gate.

**Architecture:** `price_line` grows optional `offered_side`. When omitted, gating stays favorite-only (including the `fair_prob < 0.35` assertion). When set, that side is evaluated and the assertion is skipped. `mlb.legs.get_mlb_legs` passes `offered_side="over"` only for Underdog `home_runs`. WNBA and every other MLB market omit the argument.

**Tech Stack:** Python 3, FastAPI, Pydantic, pytest. No OpenAPI or frontend change.

**Spec:** `docs/superpowers/specs/2026-08-31-mlb-legs-underdog-hr-over-only-design.md`

## Global Constraints

- Product name: **statvista**.
- Scope is Underdog + canonical stat `home_runs` only. PrizePicks HRs and other UD markets stay favorite-only.
- Do **not** unclamp `payout_multiplier` (`m > 1` must not lower break-even).
- Do **not** add `rejected_summary` keys. Missed EV → `below_threshold`.
- Do **not** change sportsbook two-way pairing, coverage, ages, hold, log-odds, packer, or payouts tables.
- Do **not** pass `offered_side` from `wnba.legs.get_wnba_legs`.
- Never invent a DFS Under. Consensus still requires a two-way sportsbook pair at the exact DFS line.
- Tests with code (TDD). Run pytest from `backend` with `PYTHONPATH=..:.`.
- Follow `md/claude.md` if present, else nearby Legs patterns. Small focused changes.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/betting/legs_pricer.py` | Optional `offered_side` on `price_line`; skip 0.35 assertion when set |
| `backend/tests/test_legs_pricer.py` | Pricer unit tests for forced Over vs favorite-only |
| `backend/app/domains/mlb/legs.py` | Pass `offered_side="over"` for Underdog `home_runs` |
| `backend/tests/test_mlb_legs.py` | Assembly: UD HR never PLAY Under; PP HR still can |
| `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` | Pointer to the amendment (grain / longshot / diagram) |
| `md/system-design.md` | MLB Legs diagram: UD home_runs Over-only |

No new files. Do not edit `wnba/legs.py`, `legs_payouts.py`, `legs_pack.py`, or frontend.

---

### Task 1: Pricer `offered_side`

**Files:**
- Modify: `backend/tests/test_legs_pricer.py`
- Modify: `backend/app/domains/betting/legs_pricer.py` (`price_line` signature and side gate, currently ~141–216)

**Interfaces:**
- Consumes: existing `price_line(*, quotes, dfs_line, app, format, legs, payout_multiplier)` and `_q` / `_price` / `_fav_trio` in `test_legs_pricer.py`
- Produces: `price_line(..., offered_side: Literal["over", "under"] | None = None) -> PriceResult`. Omitted → favorite-only. Set → that side’s `fair_prob`; skip `fair_prob < 0.35` assertion; then same `p_be` / disagreement / margin gate.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_legs_pricer.py` (keep existing `_FAV_OVER` / `_fav_trio`). Longshot two-way: Over +200 / Under −250 → multiplicative fair Over ≈ 0.318 (< 0.35).

```python
# Under is the favorite: Over +200 / Under -250, hold ~0.047, fair over ~0.318.
_DOG_OVER, _DOG_UNDER = 200, -250


def _dog_trio():
    return [
        _q("pinnacle", _DOG_OVER, _DOG_UNDER),
        _q("draftkings", _DOG_OVER, _DOG_UNDER),
        _q("betmgm", _DOG_OVER, _DOG_UNDER),
    ]


def test_offered_over_on_under_favorite_is_below_threshold_not_under_play():
    result = _price(_dog_trio(), offered_side="over")
    assert isinstance(result, RejectResult)
    assert result.reason == "below_threshold"


def test_offered_over_longshot_does_not_raise():
    result = _price(_dog_trio(), offered_side="over")
    assert isinstance(result, RejectResult)
    assert result.reason == "below_threshold"


def test_omitted_offered_side_still_plays_under_when_under_is_favorite():
    result = _price(_dog_trio())
    assert isinstance(result, PlayResult)
    assert result.side == "under"
    assert result.fair_prob > 0.5


def test_offered_over_still_plays_when_over_is_favorite():
    result = _price(_fav_trio(), offered_side="over")
    assert isinstance(result, PlayResult)
    assert result.side == "over"
```

`_price` already forwards `**kwargs` into `price_line`, so `offered_side=` will TypeError until the signature exists.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && PYTHONPATH=..:. python -m pytest tests/test_legs_pricer.py::test_offered_over_on_under_favorite_is_below_threshold_not_under_play tests/test_legs_pricer.py::test_offered_over_longshot_does_not_raise tests/test_legs_pricer.py::test_omitted_offered_side_still_plays_under_when_under_is_favorite tests/test_legs_pricer.py::test_offered_over_still_plays_when_over_is_favorite -v
```

Expected: FAIL (`TypeError: price_line() got an unexpected keyword argument 'offered_side'`). If the working tree already added the kwarg but not the gate, expect `test_offered_over_*` to PLAY Under or raise `RuntimeError: gated fair_prob < 0.35 is unreachable under favorite-only`.

- [ ] **Step 3: Implement `offered_side` on `price_line`**

In `backend/app/domains/betting/legs_pricer.py`, add the argument and replace the favorite-only block.

Signature (keep every existing keyword-only arg):

```python
def price_line(
    *,
    quotes: list[BookQuote],
    dfs_line: float,
    app: str,
    format: str,
    legs: int,
    payout_multiplier: float | None,
    offered_side: Literal["over", "under"] | None = None,
) -> PriceResult:
```

Replace the block that currently reads:

```python
    if p_over > 0.5:
        side: Literal["over", "under"] = "over"
        fair_prob = p_over
    elif p_under > 0.5:
        side = "under"
        fair_prob = p_under
    else:
        return RejectResult(reason="below_threshold")

    if fair_prob < 0.35:
        raise RuntimeError("gated fair_prob < 0.35 is unreachable under favorite-only")
```

with:

```python
    if offered_side == "over":
        side: Literal["over", "under"] = "over"
        fair_prob = p_over
    elif offered_side == "under":
        side = "under"
        fair_prob = p_under
    elif p_over > 0.5:
        side = "over"
        fair_prob = p_over
    elif p_under > 0.5:
        side = "under"
        fair_prob = p_under
    else:
        return RejectResult(reason="below_threshold")

    if offered_side is None and fair_prob < 0.35:
        raise RuntimeError("gated fair_prob < 0.35 is unreachable under favorite-only")
```

Leave coverage, log-odds, `p_be`, disagreement adder, and margin gate unchanged. Do not change `BookQuote` (books stay two-way).

- [ ] **Step 4: Run the new tests and the full pricer file**

Run:

```bash
cd backend && PYTHONPATH=..:. python -m pytest tests/test_legs_pricer.py -v
```

Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/betting/legs_pricer.py backend/tests/test_legs_pricer.py
git commit -m "$(cat <<'EOF'
Let Legs price a forced Over when Underdog does not offer Under.

Home-run longshots must reject below_threshold instead of gating the unplayable favorite Under.
EOF
)"
```

---

### Task 2: MLB assembler passes Over for Underdog home runs

**Files:**
- Modify: `backend/tests/test_mlb_legs.py`
- Modify: `backend/app/domains/mlb/legs.py` (`price_line` call ~493–500)
- Modify: `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md` (grain / longshot / architecture pointer)
- Modify: `md/system-design.md` (MLB Legs diagram line that says favorite side only)

**Interfaces:**
- Consumes: `price_line(..., offered_side: Literal["over", "under"] | None = None)` from Task 1; `legs_io` fixture; `_play_books`; `_pp`; `get_mlb_legs`
- Produces: `get_mlb_legs` calls `price_line(..., offered_side="over")` iff `app == "underdog"` and `stat_key == "home_runs"`. Otherwise omits / passes `None`. Packed PLAY must never include `side="under"` for UD home runs.

- [ ] **Step 1: Write the failing assembly tests**

Add helpers next to `_pp` in `backend/tests/test_mlb_legs.py`:

```python
def _ud(player: str, stat: str, line: float, *, scraped_at=None, payout_multiplier: float = 1.0):
    return {
        "player_name": player,
        "stat_name": stat,
        "line_score": line,
        "side": "over",
        "payout_multiplier": payout_multiplier,
        "scraped_at": scraped_at if scraped_at is not None else _fresh(),
    }


def _under_fav_books(player: str, stat_px: str, stat_pin: str, line: float):
    """Pinnacle + DK + MGM with Under as the favorite (swap of _play_books prices)."""
    return {
        "px": [],
        "novig": [],
        "pin": _two_way_rows(
            player=player,
            stat=stat_pin,
            line=line,
            over=_FAV_UNDER,
            under=_FAV_OVER,
            market_field="market_type",
            stake=None,
        ),
        "parlay": (
            _two_way_rows(
                player=player,
                stat=stat_pin,
                line=line,
                over=_FAV_UNDER,
                under=_FAV_OVER,
                market_field="market_type",
                stake=None,
                sportsbook="draftkings",
            )
            + _two_way_rows(
                player=player,
                stat=stat_pin,
                line=line,
                over=_FAV_UNDER,
                under=_FAV_OVER,
                market_field="market_type",
                stake=None,
                sportsbook="betmgm",
            )
        ),
    }
```

`_FAV_UNDER` is `+170` and `_FAV_OVER` is `-200`, so Over=+170 / Under=−200 makes Under the favorite (same juice as `_play_books`, flipped). That is enough for PP Power 2 to PLAY Under. UD forced Over on the same quotes misses BE → `below_threshold`.

Append:

```python
@pytest.mark.asyncio
async def test_underdog_home_runs_do_not_play_under(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["ud"] = [
        _ud("Aaron Judge", "home_runs", 0.5),
        _ud("Giancarlo Stanton", "home_runs", 0.5),
    ]
    judge = _under_fav_books("Aaron Judge", "home_runs", "batter_home_runs", 0.5)
    stanton = _under_fav_books("Giancarlo Stanton", "home_runs", "batter_home_runs", 0.5)
    legs_io["pin"] = judge["pin"] + stanton["pin"]
    legs_io["parlay"] = judge["parlay"] + stanton["parlay"]
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"), ("Giancarlo Stanton", "NYY"))
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="underdog", format="standard", legs=2)

    packed = _packed_plays(body)
    assert all(not (leg.market == "Home Runs" and leg.side == "under") for leg in packed)
    assert body.entries == []
    assert body.legs_evaluated == 2
    assert body.rejected_summary.below_threshold == 2
    _assert_identity(body)


@pytest.mark.asyncio
async def test_prizepicks_home_runs_can_still_play_under(legs_io):
    from app.domains.mlb.legs import get_mlb_legs

    legs_io["pp"] = [
        _pp("Aaron Judge", "Home Runs", 0.5),
        _pp("Giancarlo Stanton", "Home Runs", 0.5),
    ]
    judge = _under_fav_books("Aaron Judge", "home_runs", "batter_home_runs", 0.5)
    stanton = _under_fav_books("Giancarlo Stanton", "home_runs", "batter_home_runs", 0.5)
    legs_io["pin"] = judge["pin"] + stanton["pin"]
    legs_io["parlay"] = judge["parlay"] + stanton["parlay"]
    legs_io["roster"] = _roster(("Aaron Judge", "NYY"), ("Giancarlo Stanton", "NYY"))
    legs_io["scoreboard"] = _scoreboard(_game("111", "NYY", "BOS", "scheduled"))

    body = await get_mlb_legs(app="prizepicks", format="power", legs=2)

    packed = _packed_plays(body)
    assert len(body.entries) == 1
    assert {leg.side for leg in packed} == {"under"}
    assert all(leg.market == "Home Runs" for leg in packed)
    _assert_identity(body)
```

- [ ] **Step 2: Run tests to verify the UD case fails**

Run:

```bash
cd backend && PYTHONPATH=..:. python -m pytest tests/test_mlb_legs.py::test_underdog_home_runs_do_not_play_under tests/test_mlb_legs.py::test_prizepicks_home_runs_can_still_play_under -v
```

Expected: `test_underdog_home_runs_do_not_play_under` FAIL (`entries` non-empty and/or `below_threshold != 2`, packed legs `side == "under"`). `test_prizepicks_home_runs_can_still_play_under` should already PASS (favorite-only).

- [ ] **Step 3: Pass `offered_side` from the MLB assembler**

In `backend/app/domains/mlb/legs.py`, at the `price_line(...)` call inside the seed loop, set the kwarg from app + canonical stat. Do not change `_seed_lines`.

```python
        offered_side = (
            "over" if app == "underdog" and stat_key == "home_runs" else None
        )
        result = price_line(
            quotes=quotes,
            dfs_line=line_f,
            app=app,
            format=format,
            legs=legs,
            payout_multiplier=bucket["payout_multiplier"],
            offered_side=offered_side,
        )
```

Do not edit `backend/app/domains/wnba/legs.py`.

- [ ] **Step 4: Run assembly tests plus WNBA Legs regression**

Run:

```bash
cd backend && PYTHONPATH=..:. python -m pytest tests/test_mlb_legs.py tests/test_wnba_legs.py tests/test_legs_pricer.py -v
```

Expected: PASS.

- [ ] **Step 5: Point existing docs at the exception**

In `docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md`:

- Related line: append `Underdog HR Over-only amendment (\`docs/superpowers/specs/2026-08-31-mlb-legs-underdog-hr-over-only-design.md\`)` if missing.
- Grain row: favorite-only **except** Underdog `home_runs` (always Over — see 2026-08-31 amendment).
- Longshot row: 0.35 assertion is favorite-only; UD HR Over skips it and rejects `below_threshold`.
- Architecture diagram last line: `favorite side only (UD home_runs: Over only)`.
- Pricer candidate paragraph: add the same exception sentence pointing at the amendment spec.

If this file already has unrelated local edits (Novig stake / margin), keep those; only add the HR pointers if they are not there.

In `md/system-design.md`, change the MLB Legs pricer line from:

```text
       ├─ legs_pricer (log-odds, coverage gates, favorite side only)
```

to:

```text
       ├─ legs_pricer (log-odds, coverage gates, favorite side only; UD home_runs Over only)
```

Leave the WNBA diagram as `favorite side only`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/legs.py backend/tests/test_mlb_legs.py docs/superpowers/specs/2026-08-29-mlb-legs-pricer-design.md md/system-design.md
git commit -m "$(cat <<'EOF'
Force Underdog home-run Legs to Over so unplayable Unders cannot pack.

PrizePicks HRs stay favorite-only; longshot UD Overs reject below_threshold.
EOF
)"
```

Do not stage `backend/data/cache/**` or `data/props/**`.

---

## Self-review

**Spec coverage:** Over-only UD HR → Task 2 assembler. Pricer `offered_side` + skip 0.35 assertion → Task 1. `below_threshold` / identity / grain unchanged → Task 2 tests. PP HR still favorite-only → Task 2 PP test. WNBA omit arg → Task 2 does not edit `wnba/legs.py` and runs `test_wnba_legs.py`. Boost clamp / packer / new reject keys / other one-sided markets → not in any task (non-goals).

**Placeholders:** none.

**Types:** `offered_side: Literal["over", "under"] | None = None` in Task 1; Task 2 passes `"over"` or `None`.
