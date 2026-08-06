import type {
  MlbBatterRow,
  MlbBoxNoteLine,
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbPitcherRow,
  MlbPitchingTotals,
} from "../lib/types";

const BATTER_COLS = ["AB", "R", "H", "RBI", "HR", "SB", "BB", "K"] as const;
const PITCHER_COLS = ["IP", "H", "R", "ER", "BB", "K", "HR", "ERA"] as const;

/** Keeps W/L/S/H only — drops record like "(W, 12-6)" → "W". */
function formatPitcherDecision(decision: string): string {
  const match = decision.match(/[WLSH]/i);
  return match ? match[0].toUpperCase() : decision;
}

function batterValues(row: MlbBatterRow): Array<string | number> {
  return [
    row.ab ?? "–",
    row.r ?? "–",
    row.h ?? "–",
    row.rbi ?? "–",
    row.hr ?? "–",
    row.sb ?? "–",
    row.bb ?? "–",
    row.so ?? "–",
  ];
}

function pitcherValues(row: MlbPitcherRow): Array<string | number> {
  return [
    row.ip ?? "–",
    row.h ?? "–",
    row.r ?? "–",
    row.er ?? "–",
    row.bb ?? "–",
    row.k ?? "–",
    row.hr ?? "–",
    row.era ?? "–",
  ];
}

function totalsValues(totals: MlbPitchingTotals): Array<string | number> {
  return [
    totals.ip ?? "–",
    totals.h ?? "–",
    totals.r ?? "–",
    totals.er ?? "–",
    totals.bb ?? "–",
    totals.k ?? "–",
    totals.hr ?? "–",
    totals.era ?? "–",
  ];
}

function TeamHeader({ team }: { team: MlbGameDetailTeam }) {
  return (
    <div className="flex items-center gap-2">
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          className="size-6 object-contain"
        />
      ) : null}
      <span className="text-[18px] font-semibold text-white">
        {team.abbrev}
      </span>
    </div>
  );
}

function NoteLines({ notes }: { notes: MlbBoxNoteLine[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-1 text-[11px] leading-snug text-white/70">
      {notes.map((note) => (
        <li key={`${note.label}:${note.value}`}>
          <span className="font-semibold text-white/90">{note.label}:</span>{" "}
          <span>{note.value}</span>
        </li>
      ))}
    </ul>
  );
}

function footnoteSegments(
  pitchers: MlbPitcherRow[],
  format: (row: MlbPitcherRow) => string | null,
): string | null {
  const parts = pitchers
    .map((row) => {
      const value = format(row);
      return value ? `${row.name} ${value}` : null;
    })
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("; ") : null;
}

function PitchingFootnotes({ pitchers }: { pitchers: MlbPitcherRow[] }) {
  if (pitchers.length === 0) return null;

  const lines: Array<{ label: string; value: string }> = [];

  const pitchesStrikes = footnoteSegments(pitchers, (row) => {
    if (row.pitches === null || row.strikes === null) return null;
    return `${row.pitches}-${row.strikes}`;
  });
  if (pitchesStrikes) {
    lines.push({ label: "Pitches-strikes", value: pitchesStrikes });
  }

  const groundFly = footnoteSegments(pitchers, (row) => {
    if (row.groundOuts === null || row.flyOuts === null) return null;
    return `${row.groundOuts}-${row.flyOuts}`;
  });
  if (groundFly) {
    lines.push({ label: "Groundouts-flyouts", value: groundFly });
  }

  const battersFaced = footnoteSegments(pitchers, (row) => {
    if (row.battersFaced === null) return null;
    return String(row.battersFaced);
  });
  if (battersFaced) {
    lines.push({ label: "Batters faced", value: battersFaced });
  }

  if (lines.length === 0) return null;

  return (
    <ul className="space-y-1 text-[11px] leading-snug text-white/70">
      {lines.map((line) => (
        <li key={line.label}>
          <span className="font-semibold text-white/90">{line.label}:</span>{" "}
          <span>{line.value}</span>
        </li>
      ))}
    </ul>
  );
}

function BatterTable({
  team,
  batters,
}: {
  team: MlbGameDetailTeam;
  batters: MlbBatterRow[];
}) {
  if (batters.length === 0) return null;
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2">
        <TeamHeader team={team} />
      </div>
      <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.08] pb-1.5 text-[14px] tracking-wide text-white/40">
        <span className="min-w-0 flex-1">Batters</span>
        <div className="flex shrink-0 gap-x-0">
          {BATTER_COLS.map((col) => (
            <span key={col} className="w-7 text-right uppercase">
              {col}
            </span>
          ))}
        </div>
      </div>
      <ul>
        {batters.map((batter) => (
          <li
            key={`${team.id}-${batter.name}-${batter.order ?? ""}`}
            className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] py-1.5 text-[18px]"
          >
            <span className="min-w-0 flex-1 whitespace-nowrap text-white">
              {batter.name}
              {batter.position ? (
                <span className="ml-1 text-white/40">{batter.position}</span>
              ) : null}
            </span>
            <div className="flex shrink-0 gap-x-0">
              {batterValues(batter).map((value, index) => (
                <span
                  key={`${batter.name}-${BATTER_COLS[index]}`}
                  className="w-7 text-right tabular-nums text-white/85"
                >
                  {value}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PitcherTable({
  team,
  pitchers,
  totals,
}: {
  team: MlbGameDetailTeam;
  pitchers: MlbPitcherRow[];
  totals: MlbPitchingTotals | null;
}) {
  if (pitchers.length === 0) return null;
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.08] pb-1.5 text-[14px] tracking-wide text-white/40">
        <span className="min-w-0 flex-1">Pitchers</span>
        <div className="flex shrink-0 gap-x-0">
          {PITCHER_COLS.map((col) => (
            <span
              key={col}
              className={`text-right uppercase ${col === "ERA" ? "w-9" : "w-7"}`}
            >
              {col}
            </span>
          ))}
        </div>
      </div>
      <ul>
        {pitchers.map((pitcher) => (
          <li
            key={`${team.id}-${pitcher.name}`}
            className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] py-1.5 text-[18px]"
          >
            <span className="min-w-0 flex-1 whitespace-nowrap text-white">
              {pitcher.name}
              {pitcher.decision ? (
                <span className="ml-1 text-white/55">
                  {formatPitcherDecision(pitcher.decision)}
                </span>
              ) : null}
            </span>
            <div className="flex shrink-0 gap-x-0">
              {pitcherValues(pitcher).map((value, index) => (
                <span
                  key={`${pitcher.name}-${PITCHER_COLS[index]}`}
                  className={`text-right tabular-nums text-white/85 ${
                    PITCHER_COLS[index] === "ERA" ? "w-9" : "w-7"
                  }`}
                >
                  {value}
                </span>
              ))}
            </div>
          </li>
        ))}
        {totals ? (
          <li className="flex items-baseline justify-between gap-2 border-t border-white/[0.12] pt-1.5 text-[18px] font-medium">
            <span className="min-w-0 flex-1 text-white/90">Totals</span>
            <div className="flex shrink-0 gap-x-0">
              {totalsValues(totals).map((value, index) => (
                <span
                  key={`totals-${PITCHER_COLS[index]}`}
                  className={`text-right tabular-nums text-white/85 ${
                    PITCHER_COLS[index] === "ERA" ? "w-9" : "w-7"
                  }`}
                >
                  {value}
                </span>
              ))}
            </div>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TeamBox({
  team,
  batters,
  pitchers,
  battingNotes,
  baserunningNotes,
  fieldingNotes,
  pitchingTotals,
  testId,
}: {
  team: MlbGameDetailTeam;
  batters: MlbBatterRow[];
  pitchers: MlbPitcherRow[];
  battingNotes: MlbBoxNoteLine[];
  baserunningNotes: MlbBoxNoteLine[];
  fieldingNotes: MlbBoxNoteLine[];
  pitchingTotals: MlbPitchingTotals | null;
  testId: string;
}) {
  if (
    batters.length === 0 &&
    pitchers.length === 0 &&
    battingNotes.length === 0 &&
    baserunningNotes.length === 0 &&
    fieldingNotes.length === 0
  ) {
    return null;
  }

  return (
    <div data-testid={testId} className="min-w-0 w-full space-y-3">
      {batters.length === 0 ? <TeamHeader team={team} /> : null}
      <BatterTable team={team} batters={batters} />
      <NoteLines notes={battingNotes} />
      <NoteLines notes={baserunningNotes} />
      <NoteLines notes={fieldingNotes} />
      <PitcherTable team={team} pitchers={pitchers} totals={pitchingTotals} />
      <PitchingFootnotes pitchers={pitchers} />
    </div>
  );
}

export function MlbBoxScore({
  detail,
  sideBySide = false,
}: {
  detail: MlbGameDetailView;
  sideBySide?: boolean;
}) {
  const box = detail.boxScore;
  if (!box) return null;

  const hasBatters =
    box.awayBatters.length > 0 || box.homeBatters.length > 0;
  const hasPitchers =
    box.awayPitchers.length > 0 || box.homePitchers.length > 0;
  const hasNotes =
    box.awayBattingNotes.length > 0 ||
    box.homeBattingNotes.length > 0 ||
    box.awayBaserunningNotes.length > 0 ||
    box.homeBaserunningNotes.length > 0 ||
    box.awayFieldingNotes.length > 0 ||
    box.homeFieldingNotes.length > 0;
  if (!hasBatters && !hasPitchers && !hasNotes) return null;

  return (
    <section data-testid="mlb-box-score">
      <div
        data-testid="mlb-box-score-layout"
        className={
          sideBySide
            ? "grid w-full grid-cols-2 items-start gap-2"
            : "grid w-full items-start gap-4 lg:grid-cols-2 lg:gap-2"
        }
      >
        <TeamBox
          testId="mlb-box-team-away"
          team={detail.away}
          batters={box.awayBatters}
          pitchers={box.awayPitchers}
          battingNotes={box.awayBattingNotes}
          baserunningNotes={box.awayBaserunningNotes}
          fieldingNotes={box.awayFieldingNotes}
          pitchingTotals={box.awayPitchingTotals}
        />
        <TeamBox
          testId="mlb-box-team-home"
          team={detail.home}
          batters={box.homeBatters}
          pitchers={box.homePitchers}
          battingNotes={box.homeBattingNotes}
          baserunningNotes={box.homeBaserunningNotes}
          fieldingNotes={box.homeFieldingNotes}
          pitchingTotals={box.homePitchingTotals}
        />
      </div>
    </section>
  );
}
