# Prop Player Match Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Join DFS-seeded prop rows to Parlay/scraper books when names differ only by accents or a small alias map — WNBA and MLB — without changing DFS display names.

**Architecture:** Add `match_player_key` (strong Unicode norm + optional aliases) in `domains/betting`. Replace weak `_norm_player` (`strip().casefold()`) on board/book join keys in WNBA/MLB props assemble and Parlay index builders. Display `player_name` stays DFS verbatim.

**Tech Stack:** Python 3, FastAPI props assemble, pytest

## Global Constraints

- Product name: **statvista**
- Spec: `docs/superpowers/specs/2026-08-19-prop-player-match-keys-design.md`
- DFS remains board seed and display source (PrizePicks / Underdog)
- No ESPN identity hub; no fuzzy matching; no Jr./III auto-strip
- Combo names containing ` + ` stay unmatched
- Do not rewrite stored scraper/Parlay snapshot rows
- Apostrophes preserved (`A'ja`)

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/app/domains/betting/player_match_keys.py` | `strong_norm_player_name`, `PLAYER_NAME_ALIASES`, `match_player_key` |
| `backend/tests/test_player_match_keys.py` | Unit tests for norm + aliases |
| `backend/app/domains/wnba/props.py` | Book/board join keys via `match_player_key` |
| `backend/app/domains/mlb/props.py` | Same + `index_parlay_api_odds_by_book` |
| `backend/app/providers/parlay/wnba_board.py` | Parlay side/board index keys |
| `backend/app/providers/parlay/mlb_props.py` | Parlay MLB index keys |
| `backend/tests/test_wnba_props.py` | Accent + alias `books_main` join tests |
| `backend/tests/test_mlb_props.py` | Same for MLB assemble / snapshot index |
| `md/system-design.md` | One-line note on prop join keys |

---

### Task 1: Shared `match_player_key` helper

**Files:**
- Create: `backend/app/domains/betting/player_match_keys.py`
- Create: `backend/tests/test_player_match_keys.py`

**Interfaces:**
- Produces:
  - `strong_norm_player_name(name: str) -> str`
  - `PLAYER_NAME_ALIASES: dict[str, str]`
  - `match_player_key(name: str) -> str`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_player_match_keys.py`:

```python
from __future__ import annotations

from app.domains.betting.player_match_keys import (
    PLAYER_NAME_ALIASES,
    match_player_key,
    strong_norm_player_name,
)


def test_strong_norm_strips_accents():
    assert strong_norm_player_name("Janelle Salaün") == "janelle salaun"
    assert strong_norm_player_name("Laura Juškaitė") == "laura juskaite"
    assert strong_norm_player_name("Leïla Lacan") == "leila lacan"
    assert strong_norm_player_name("Janelle Salaun") == "janelle salaun"


def test_strong_norm_preserves_apostrophe():
    assert strong_norm_player_name("A'ja Wilson") == "a'ja wilson"


def test_strong_norm_collapses_whitespace():
    assert strong_norm_player_name("  Caitlin   Clark  ") == "caitlin clark"


def test_strong_norm_empty():
    assert strong_norm_player_name("") == ""
    assert strong_norm_player_name("   ") == ""


def test_match_player_key_alias_middle_name():
    assert match_player_key("Jessica Lynn Shepard") == "jessica shepard"
    assert match_player_key("Jessica Shepard") == "jessica shepard"


def test_match_player_key_without_alias_is_strong_norm():
    assert match_player_key("Janelle Salaün") == "janelle salaun"


def test_aliases_are_strong_normed_and_unique():
    assert len(PLAYER_NAME_ALIASES) == len(set(PLAYER_NAME_ALIASES))
    for src, dst in PLAYER_NAME_ALIASES.items():
        assert src == strong_norm_player_name(src)
        assert dst == strong_norm_player_name(dst)
        assert src != dst


def test_combo_name_is_not_aliased_to_solo():
    key = match_player_key("Gabby Williams + Kayla McBride")
    assert "+" in key or " + " in key
    assert key != match_player_key("Gabby Williams")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_player_match_keys.py -v`

Expected: FAIL (module not found / import error)

- [ ] **Step 3: Implement the helper**

Create `backend/app/domains/betting/player_match_keys.py`:

```python
"""Shared prop-board player join keys (DFS ↔ Parlay / scrapers)."""

from __future__ import annotations

import re
import unicodedata

# Alternate strong-normed spellings → canonical strong-normed (prefer DFS shape).
PLAYER_NAME_ALIASES: dict[str, str] = {
    "jessica lynn shepard": "jessica shepard",
}

_WS = re.compile(r"\s+")


def strong_norm_player_name(name: str) -> str:
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = _WS.sub(" ", s.casefold().strip())
    return s


def match_player_key(name: str) -> str:
    key = strong_norm_player_name(name)
    if not key:
        return ""
    return PLAYER_NAME_ALIASES.get(key, key)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_player_match_keys.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/betting/player_match_keys.py \
  backend/tests/test_player_match_keys.py
git commit -m "$(cat <<'EOF'
feat(betting): add match_player_key with strong norm and aliases

EOF
)"
```

---

### Task 2: Wire WNBA props + Parlay board indexes

**Files:**
- Modify: `backend/app/domains/wnba/props.py`
- Modify: `backend/app/providers/parlay/wnba_board.py`
- Modify: `backend/tests/test_wnba_props.py`

**Interfaces:**
- Consumes: `match_player_key(name: str) -> str`
- Produces: WNBA board/`books`/`books_main` keys use `match_player_key`; display `player_name` unchanged

- [ ] **Step 1: Write failing assemble tests**

Append to `backend/tests/test_wnba_props.py` (mirror `test_books_main_attaches_main_quotes` stubs):

```python
@pytest.mark.asyncio
async def test_books_main_joins_accent_variant_names(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    pp = [
        {
            "player_name": "Janelle Salaün",
            "stat_type": "points",
            "line_score": 12.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=None,
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_prophetx",
        lambda league="wnba", mains_only=False, **_kw: [
            {
                "player_name": "Janelle Salaun",
                "stat_name": "points",
                "line_score": 13.5,
                "side": "over",
                "american_price": -110,
                "scraped_at": now,
                "is_main": True,
            },
            {
                "player_name": "Janelle Salaun",
                "stat_name": "points",
                "line_score": 13.5,
                "side": "under",
                "american_price": -110,
                "scraped_at": now,
                "is_main": True,
            },
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_novig", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert out.props[0].player_name == "Janelle Salaün"
    main = out.props[0].books_main.prophetx
    assert main is not None
    assert main.line == 13.5


@pytest.mark.asyncio
async def test_books_main_joins_aliased_middle_name(monkeypatch):
    now = datetime(2026, 8, 11, 20, 0, tzinfo=timezone.utc)
    pp = [
        {
            "player_name": "Jessica Shepard",
            "stat_type": "points",
            "line_score": 10.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]

    async def fake_parlay(**kwargs):
        return ParlayWnbaNormalized(
            prizepicks_board=[],
            book_indexes={},
            as_of=None,
            unavailable=False,
        )

    monkeypatch.setattr(svc, "fetch_wnba_parlay_board_normalized", fake_parlay)
    monkeypatch.setattr(svc, "fetch_latest_prizepicks", lambda league="wnba": pp)
    monkeypatch.setattr(svc, "fetch_latest_underdog", lambda league="wnba": [])
    monkeypatch.setattr(
        svc,
        "fetch_latest_novig",
        lambda league="wnba", mains_only=False, **_kw: [
            {
                "player_name": "Jessica Lynn Shepard",
                "stat_name": "points",
                "line_score": 11.5,
                "side": "over",
                "american_price": -105,
                "scraped_at": now,
                "is_main": True,
            },
            {
                "player_name": "Jessica Lynn Shepard",
                "stat_name": "points",
                "line_score": 11.5,
                "side": "under",
                "american_price": -115,
                "scraped_at": now,
                "is_main": True,
            },
        ],
    )
    monkeypatch.setattr(svc, "fetch_latest_prophetx", lambda league="wnba", **_kw: [])
    monkeypatch.setattr(svc, "fetch_latest_pinnacle", lambda league="wnba": [])

    async def fake_roster():
        return {}

    monkeypatch.setattr(svc, "get_wnba_player_index", fake_roster)

    out = await svc.get_wnba_props_today(app="prizepicks", format="power", legs=4)
    assert out.props[0].player_name == "Jessica Shepard"
    main = out.props[0].books_main.novig
    assert main is not None
    assert main.line == 11.5
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_wnba_props.py::test_books_main_joins_accent_variant_names tests/test_wnba_props.py::test_books_main_joins_aliased_middle_name -v`

Expected: FAIL (`books_main` null / assertion on `main is not None`)

- [ ] **Step 3: Replace weak norm in WNBA props**

In `backend/app/domains/wnba/props.py`:

1. Add import:

```python
from app.domains.betting.player_match_keys import match_player_key
```

2. Delete local `_norm_player`.

3. Replace every `_norm_player(...)` call used for board/side/main keys with `match_player_key(...)` (currently ~lines 207, 265, 365). Keep `norm_player_name` for ESPN roster enrichment only.

- [ ] **Step 4: Replace weak norm in WNBA Parlay board**

In `backend/app/providers/parlay/wnba_board.py`:

1. Add: `from app.domains.betting.player_match_keys import match_player_key`
2. Delete local `_norm_player`.
3. Replace all `_norm_player(...)` with `match_player_key(...)` (PP dedupe pairs + board/side index keys).

- [ ] **Step 5: Run WNBA tests**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_wnba_props.py tests/test_parlay_wnba_board.py -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/wnba/props.py \
  backend/app/providers/parlay/wnba_board.py \
  backend/tests/test_wnba_props.py
git commit -m "$(cat <<'EOF'
feat(wnba): join prop books with match_player_key

EOF
)"
```

---

### Task 3: Wire MLB props + Parlay indexes

**Files:**
- Modify: `backend/app/domains/mlb/props.py`
- Modify: `backend/app/providers/parlay/mlb_props.py`
- Modify: `backend/tests/test_mlb_props.py`

**Interfaces:**
- Consumes: `match_player_key(name: str) -> str`
- Produces: MLB board/`books`/`books_main` and `index_parlay_api_odds_by_book` use `match_player_key`

- [ ] **Step 1: Write failing tests**

In `backend/tests/test_mlb_props.py`, add (uses existing `_stub_snapshots` / `_parlay` helpers from this file):

```python
def test_index_parlay_api_odds_matches_accent_variants():
    from app.domains.betting.player_match_keys import match_player_key

    rows = [
        {
            "sportsbook": "draftkings",
            "player_name": "José Ramírez",
            "market_type": "total_bases",
            "side": "over",
            "line_score": 1.5,
            "american_price": -120,
            "scraped_at": "2026-08-19T12:00:00Z",
        },
        {
            "sportsbook": "draftkings",
            "player_name": "José Ramírez",
            "market_type": "total_bases",
            "side": "under",
            "line_score": 1.5,
            "american_price": 100,
            "scraped_at": "2026-08-19T12:00:00Z",
        },
    ]
    indexes = svc.index_parlay_api_odds_by_book(rows)
    key_over = (match_player_key("Jose Ramirez"), "total_bases", "over", 1.5)
    assert key_over in indexes["draftkings"]
    assert indexes["draftkings"][key_over]["american"] == -120


@pytest.mark.asyncio
async def test_books_main_joins_accent_variant_names_mlb(monkeypatch):
    now = datetime.now(timezone.utc)
    pp = [
        {
            "player_name": "Jose Ramirez",
            "stat_type": "Total Bases",
            "line_score": 1.5,
            "odds_type": "standard",
            "scraped_at": now,
        }
    ]
    novig = [
        {
            "player_name": "José Ramírez",
            "stat_name": "total_bases",
            "line_score": 2.5,
            "side": "over",
            "american_price": -115,
            "scraped_at": now,
            "is_main": True,
        },
        {
            "player_name": "José Ramírez",
            "stat_name": "total_bases",
            "line_score": 2.5,
            "side": "under",
            "american_price": -105,
            "scraped_at": now,
            "is_main": True,
        },
    ]
    _stub_snapshots(
        monkeypatch,
        dfs_pp=pp,
        novig=novig,
        parlay=_parlay(book_indexes={}),
        parlay_api_odds=[],
    )
    monkeypatch.setattr(svc, "get_mlb_player_index", lambda: _async_return({}))
    out = await svc.get_mlb_props_today(app="prizepicks", format="power", legs=4)
    assert out.props[0].player_name == "Jose Ramirez"
    main = out.props[0].books_main.novig
    assert main is not None
    assert main.line == 2.5
    assert main.over_american == -115
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_mlb_props.py::test_index_parlay_api_odds_matches_accent_variants tests/test_mlb_props.py::test_books_main_joins_accent_variant_names_mlb -v`

Expected: FAIL (`key_over` missing and/or `books_main.novig` is None) until Steps 3–4 wire `match_player_key`.

- [ ] **Step 3: Replace weak norm in MLB props**

In `backend/app/domains/mlb/props.py`:

1. `from app.domains.betting.player_match_keys import match_player_key`
2. Delete `_norm_player`
3. Replace `_norm_player(...)` at board/side/main keys and inside `index_parlay_api_odds_by_book` (~lines 200, 255, 288, 389) with `match_player_key(...)`
4. Keep ESPN `norm_player_name` for roster enrichment

- [ ] **Step 4: Replace weak norm in MLB Parlay provider**

In `backend/app/providers/parlay/mlb_props.py`:

1. Import `match_player_key`
2. Delete `_norm_player`
3. Replace all `_norm_player(...)` with `match_player_key(...)`

- [ ] **Step 5: Run MLB tests**

Run: `cd backend && PYTHONPATH=..:. pytest tests/test_mlb_props.py -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/mlb/props.py \
  backend/app/providers/parlay/mlb_props.py \
  backend/tests/test_mlb_props.py
git commit -m "$(cat <<'EOF'
feat(mlb): join prop books with match_player_key

EOF
)"
```

---

### Task 4: Docs + regression sweep

**Files:**
- Modify: `md/system-design.md` (prop picks data-flow bullet)
- Spec status already Approved; leave status or set Implemented after merge

**Interfaces:**
- Produces: docs note that prop book joins use `match_player_key` (strong norm + aliases)

- [ ] **Step 1: Update system-design**

In the prop-picks bullet under backend notes, add a short clause:

`Player book joins use match_player_key (accent-stripped norm + small aliases); DFS display names unchanged.`

- [ ] **Step 2: Regression**

Run:

```bash
cd backend && PYTHONPATH=..:. pytest \
  tests/test_player_match_keys.py \
  tests/test_wnba_props.py \
  tests/test_mlb_props.py \
  tests/test_parlay_wnba_board.py \
  tests/test_dfs_attach.py \
  -v
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add md/system-design.md
git commit -m "$(cat <<'EOF'
docs: note prop player match_player_key joins

EOF
)"
```

- [ ] **Step 4: Mark spec implemented**

In `docs/superpowers/specs/2026-08-19-prop-player-match-keys-design.md`, set `Status: Implemented` and commit with the docs change if not already in Step 3.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Strong norm + aliases helper | Task 1 |
| Seed alias `jessica lynn shepard` → `jessica shepard` | Task 1 |
| Wire WNBA props + Parlay board | Task 2 |
| Wire MLB props + Parlay + snapshot indexer | Task 3 |
| Display names unchanged | Tasks 2–3 assertions |
| Combo unmatched / no fuzzy / no ESPN hub | Task 1 combo test; Global Constraints |
| Assemble accent + alias tests | Tasks 2–3 |
| Docs | Task 4 |

Placeholder scan: clean. Task 3 MLB tests are fully specified.
