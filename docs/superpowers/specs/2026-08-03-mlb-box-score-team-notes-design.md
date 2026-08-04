# MLB box score — per-team notes + richer pitchers

Date: 2026-08-03  
Status: Approved for planning  
Scope: Enrich the Box tab (`MlbBoxScore`) with ESPN-style batting/pitching notes, richer pitcher columns, and a bordered panel per team  
Audience: Implementers of `GET /api/mlb/games/{gamePk}` box_score normalization and `frontend/src/components/mlb/MlbBoxScore.tsx`

## Goal

On the final (and live) Box view, each team appears in its own visual box containing batters, batting notes, pitchers (with decision / HR / ERA / Totals), and pitching footnotes — matching the ESPN-style screenshot the product referenced, without copying ESPN chrome.

## Decisions

| Topic | Choice |
| --- | --- |
| Approach | Pass-through batting notes from Stats `teams.*.info` + enrich pitcher rows; build per-team pitching footnotes from pitcher stats (Approach A) |
| Layout | Two side-by-side **team boxes** (away | home); each box owns that team’s batters, notes, pitchers, footnotes |
| Pitcher columns | `IP H R ER BB K HR ERA` (replace current trailing `P` column; pitch counts move to footnotes) |
| Decisions | Append Stats pitcher `note` (e.g. `(W, 16-5)`, `(L, 1-1)`, `(H)`) after the name when present |
| ERA | Prefer `seasonStats.pitching.era`; game `stats.pitching.era` is often null |
| Totals row | From `teamStats.pitching` for that side |
| Batting notes | Pass through MLB fieldList labels/values under titles `BATTING` (and optionally `BASERUNNING` / `FIELDING` when present) |
| Pitching footnotes | Per team, derived: Pitches-strikes, Groundouts-flyouts, Batters faced, Inherited runners-scored |
| Game-level `boxscore.info` | Out of scope for this slice (umpires, weather, attendance, mixed-team pitch strings) |
| Summary Team Stats | Unchanged; still Summary-tab only (`MlbFinalTeamStats`) |

## Non-goals

- Moving AVG/OBP/SLG team comparison onto the Box tab
- Showing umpires / weather / attendance / venue footer from game-level `boxscore.info`
- Rewriting MLB batting-note wording into shortened names (use Stats strings as-is)
- Shared game-level pitching-notes footer (mixed away+home names)
- Changing WNBA box score
- Redesigning Summary / play feed

---

## 1. Data sources (MLB Stats live feed)

From `liveData.boxscore`:

| Need | Source |
| --- | --- |
| Batting / baserunning / fielding note lines | `teams.{away,home}.info[]` → `{ title, fieldList: [{ label, value }] }` |
| Pitcher line + decision | `players[ID].stats.pitching` (`note`, IP/H/R/ER/BB/K/HR, pitches, strikes, GO/FO, BF, inherited) |
| Season ERA | `players[ID].seasonStats.pitching.era` |
| Pitching totals | `teams.{away,home}.teamStats.pitching` |

When `info` is missing (early live / sparse fixtures), omit note sections; tables still render.

---

## 2. Backend API shape

Extend existing `MlbBoxScore` (additive fields; keep current batter rows).

### Note line

```text
MlbBoxNoteLine { label: str, value: str }
```

### Per-team note groups (optional lists)

On `MlbBoxScore` (or nested per-side object — implementer’s choice as long as mapper is clear):

- `away_batting_notes` / `home_batting_notes` — from `info` title `BATTING`
- `away_baserunning_notes` / `home_baserunning_notes` — title `BASERUNNING` (omit if empty)
- `away_fielding_notes` / `home_fielding_notes` — title `FIELDING` (omit if empty)

Empty lists when title absent.

### Enriched `MlbPitcherRow`

Additive optional fields (existing fields unchanged):

| Field | Type | Source |
| --- | --- | --- |
| `hr` | int \| null | `stats.pitching.homeRuns` |
| `era` | str \| null | `seasonStats.pitching.era` (fallback game era) |
| `decision` | str \| null | `stats.pitching.note` (trim; keep parentheses) |
| `strikes` | int \| null | `stats.pitching.strikes` |
| `ground_outs` | int \| null | `stats.pitching.groundOuts` |
| `fly_outs` | int \| null | `stats.pitching.flyOuts` (prefer flyOuts over airOuts for footnote) |
| `batters_faced` | int \| null | `stats.pitching.battersFaced` |
| `inherited_runners` | int \| null | `stats.pitching.inheritedRunners` |
| `inherited_runners_scored` | int \| null | `stats.pitching.inheritedRunnersScored` |

`pitches` remains as today (`numberOfPitches` / `pitchesThrown`).

### Pitching totals

```text
MlbPitchingTotals {
  ip, h, r, er, bb, k, hr, era  // same nullability conventions as pitcher row
}
```

- `away_pitching_totals` / `home_pitching_totals` from `teamStats.pitching`, or null if missing.

OpenAPI / `api.schema.d.ts` regenerated or hand-updated to match project habit for MLB schemas.

---

## 3. Frontend

### Mapping

`mapMlbGameDetail` copies new box_score fields into `MlbBoxScore` / `MlbPitcherRow` view types.

### `MlbBoxScore` layout

```text
[ Box score heading ]

[ Away team box ]          [ Home team box ]
  header (abbrev/logo)       header
  Batters table              Batters table
  Batting notes…             Batting notes…
  (+ baserun/field if any)   …
  Pitchers table             Pitchers table
    … rows + Totals            …
  Pitching footnotes         Pitching footnotes
```

- **Team box:** bordered / softly elevated panel using existing game-section surface language (quiet dark UI — not new purple/glow chrome). One box per team.
- Side-by-side when `sideBySide` (final Box tab); stacked on narrow / non-sideBySide as today.
- Pitcher header columns: `IP H R ER BB K HR ERA`.
- Name cell: `{name}{decision ? " " + decision : ""}`.
- Totals: label `Totals` in name column; values from `pitching_totals`; hide Totals row if totals null.
- **Batting notes:** for each non-empty note line, render `Label: value` (bold/medium label, muted value). Skip empty values.
- **Pitching footnotes:** only include a line when at least one pitcher has data for that metric; format like ESPN:
  - `Pitches-strikes:` `Name pitches-strikes; …`
  - `Groundouts-flyouts:` `Name go-fo; …`
  - `Batters faced:` `Name n; …`
  - `Inherited runners-scored:` only pitchers with inherited runners > 0 (or scored > 0): `Name ir-scored; …`
- Use display names already on pitcher rows (full names OK; no separate short-name pipeline this slice).

### Tests

- Backend: normalize fixture or patched live feed with `info` + enriched pitching → assert note labels and pitcher `decision` / `hr` / `era`.
- Frontend: `MlbBoxScore` renders team boxes, a batting note label, pitcher decision, HR/ERA headers, Totals, and a pitching footnote when fixture provides them.
- Mapper unit coverage for new fields.

---

## 4. Error / empty behavior

| Case | Behavior |
| --- | --- |
| No box_score | Component returns null (unchanged) |
| Batters only, no notes | Tables only; no empty note chrome |
| Pitchers without strikes/BF | Omit that footnote line |
| Missing season ERA | Show `–` in ERA cell |
| Live early game, empty `info` | No notes until Stats populates |

---

## 5. Out of scope follow-ups (optional later)

- Shorten batting-note player names to ESPN-style initials
- Game meta footer (umpires, weather, T, Att)
- Hold / save / blown-save badges beyond Stats `note` string
