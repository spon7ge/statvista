import { GameSection } from "@/components/game/GameSection";
import type {
  MlbBatterRow,
  MlbBoxNoteLine,
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbPitcherRow,
  MlbPitchingTotals,
} from "./types";

const BATTER_COLS = ["AB", "R", "H", "RBI", "BB", "SO"] as const;
const PITCHER_COLS = ["IP", "H", "R", "ER", "BB", "K", "HR", "ERA"] as const;

function batterValues(row: MlbBatterRow): Array<string | number> {
  return [
    row.ab ?? "–",
    row.r ?? "–",
    row.h ?? "–",
    row.rbi ?? "–",
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

  const inherited = footnoteSegments(pitchers, (row) => {
    const ir = row.inheritedRunners;
    const scored = row.inheritedRunnersScored;
    if (ir === null || scored === null) return null;
    if (ir <= 0 && scored <= 0) return null;
    return `${ir}-${scored}`;
  });
  if (inherited) {
    lines.push({ label: "Inherited runners-scored", value: inherited });
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
    <div className="overflow-x-auto">
      <div className="mb-1.5 flex items-baseline gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: team.color }}>
          {team.abbrev}
        </span>
        <span className="font-medium text-white/90">Batters</span>
      </div>
      <div className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(6,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.08] pb-1.5 text-[9px] tracking-wide text-white/40">
        <span>Player</span>
        {BATTER_COLS.map((col) => (
          <span key={col} className="text-right uppercase">
            {col}
          </span>
        ))}
      </div>
      <ul>
        {batters.map((batter) => (
          <li
            key={`${team.id}-${batter.name}-${batter.order ?? ""}`}
            className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(6,minmax(1.6rem,1fr))] gap-x-1.5 border-b border-white/[0.06] py-1.5 text-[11px]"
          >
            <span className="truncate text-white">
              {batter.name}
              {batter.position ? (
                <span className="ml-1 text-white/40">{batter.position}</span>
              ) : null}
            </span>
            {batterValues(batter).map((value, index) => (
              <span
                key={`${batter.name}-${BATTER_COLS[index]}`}
                className="text-right tabular-nums text-white/85"
              >
                {value}
              </span>
            ))}
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
    <div className="overflow-x-auto">
      <div className="mb-1.5 flex items-baseline gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: team.color }}>
          {team.abbrev}
        </span>
        <span className="font-medium text-white/90">Pitchers</span>
      </div>
      <div className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(8,minmax(1.5rem,1fr))] gap-x-1.5 border-b border-white/[0.08] pb-1.5 text-[9px] tracking-wide text-white/40">
        <span>Pitcher</span>
        {PITCHER_COLS.map((col) => (
          <span key={col} className="text-right uppercase">
            {col}
          </span>
        ))}
      </div>
      <ul>
        {pitchers.map((pitcher) => (
          <li
            key={`${team.id}-${pitcher.name}`}
            className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(8,minmax(1.5rem,1fr))] gap-x-1.5 border-b border-white/[0.06] py-1.5 text-[11px]"
          >
            <span className="truncate text-white">
              {pitcher.name}
              {pitcher.decision ? (
                <span className="ml-1 text-white/55">{pitcher.decision}</span>
              ) : null}
            </span>
            {pitcherValues(pitcher).map((value, index) => (
              <span
                key={`${pitcher.name}-${PITCHER_COLS[index]}`}
                className="text-right tabular-nums text-white/85"
              >
                {value}
              </span>
            ))}
          </li>
        ))}
        {totals ? (
          <li className="grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(8,minmax(1.5rem,1fr))] gap-x-1.5 border-t border-white/[0.12] pt-1.5 text-[11px] font-medium">
            <span className="text-white/90">Totals</span>
            {totalsValues(totals).map((value, index) => (
              <span
                key={`totals-${PITCHER_COLS[index]}`}
                className="text-right tabular-nums text-white/85"
              >
                {value}
              </span>
            ))}
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
    <div
      data-testid={testId}
      className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"
    >
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
    <GameSection className="!p-3 space-y-5" data-testid="mlb-box-score">
      <h2 className="text-sm font-semibold text-white">Box score</h2>
      <div className={sideBySide ? "overflow-x-auto" : undefined}>
        <div
          data-testid="mlb-box-score-layout"
          className={
            sideBySide
              ? "grid min-w-[42rem] grid-cols-2 gap-5"
              : "grid gap-5 lg:grid-cols-2"
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
      </div>
    </GameSection>
  );
}
