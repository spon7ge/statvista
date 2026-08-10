import { useState } from "react";
import type { ApiMlbTeamPreviewResponse } from "@/shared/lib/api";
import { GameSection } from "@/shared/ui/GameSection";
import { teamColor } from "../league/mlbTeamColors";

type TeamLeaderCard = {
  key: "hr" | "avg" | "ops" | "era" | "so" | "whip";
  label: string;
  rank: number | null;
  value: string;
  playerId: string;
  lastName: string;
  headshotUrl: string | null;
};

type BatterSeasonRow = {
  playerId: string;
  name: string;
  g: number | null;
  ab: number | null;
  r: number | null;
  h: number | null;
  hr: number | null;
  rbi: number | null;
  bb: number | null;
  so: number | null;
  sb: number | null;
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
};

type PitcherSeasonRow = {
  playerId: string;
  name: string;
  g: number | null;
  gs: number | null;
  w: number | null;
  l: number | null;
  sv: number | null;
  h: number | null;
  er: number | null;
  bb: number | null;
  so: number | null;
  ip: string | null;
  era: string | null;
  whip: string | null;
};

type TeamPreviewView = {
  battingLeaders: TeamLeaderCard[];
  pitchingLeaders: TeamLeaderCard[];
  battingRoster: BatterSeasonRow[];
  pitchingRoster: PitcherSeasonRow[];
};

const BATTING_COLS = [
  "G",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "AB",
  "R",
  "H",
  "HR",
  "RBI",
  "BB",
  "SO",
  "SB",
] as const;

const PITCHING_COLS = [
  "G",
  "GS",
  "W",
  "L",
  "SV",
  "IP",
  "H",
  "ER",
  "BB",
  "SO",
  "ERA",
  "WHIP",
] as const;

function mapLeader(
  card: ApiMlbTeamPreviewResponse["batting_leaders"][number],
): TeamLeaderCard {
  return {
    key: card.key,
    label: card.label,
    rank: card.rank,
    value: card.value,
    playerId: card.player_id,
    lastName: card.last_name,
    headshotUrl: card.headshot_url,
  };
}

function mapMlbTeamPreview(data: ApiMlbTeamPreviewResponse): TeamPreviewView {
  return {
    battingLeaders: data.batting_leaders.map(mapLeader),
    pitchingLeaders: data.pitching_leaders.map(mapLeader),
    battingRoster: data.batting_roster.map((row) => ({
      playerId: row.player_id,
      name: row.name,
      g: row.g,
      ab: row.ab,
      r: row.r,
      h: row.h,
      hr: row.hr,
      rbi: row.rbi,
      bb: row.bb,
      so: row.so,
      sb: row.sb,
      avg: row.avg,
      obp: row.obp,
      slg: row.slg,
      ops: row.ops,
    })),
    pitchingRoster: data.pitching_roster.map((row) => ({
      playerId: row.player_id,
      name: row.name,
      g: row.g,
      gs: row.gs,
      w: row.w,
      l: row.l,
      sv: row.sv,
      h: row.h,
      er: row.er,
      bb: row.bb,
      so: row.so,
      ip: row.ip,
      era: row.era,
      whip: row.whip,
    })),
  };
}

function cell(value: string | number | null): string | number {
  return value ?? "–";
}

function batterValues(row: BatterSeasonRow): Array<string | number> {
  return [
    cell(row.g),
    cell(row.avg),
    cell(row.obp),
    cell(row.slg),
    cell(row.ops),
    cell(row.ab),
    cell(row.r),
    cell(row.h),
    cell(row.hr),
    cell(row.rbi),
    cell(row.bb),
    cell(row.so),
    cell(row.sb),
  ];
}

function pitcherValues(row: PitcherSeasonRow): Array<string | number> {
  return [
    cell(row.g),
    cell(row.gs),
    cell(row.w),
    cell(row.l),
    cell(row.sv),
    cell(row.ip),
    cell(row.h),
    cell(row.er),
    cell(row.bb),
    cell(row.so),
    cell(row.era),
    cell(row.whip),
  ];
}

function colWidth(col: string): string {
  // Fixed widths so the row can exceed the panel and scroll horizontally
  // instead of compressing every stat into the available space.
  if (col === "AVG" || col === "OBP" || col === "SLG" || col === "OPS") {
    return "w-12 shrink-0";
  }
  // IP needs room for triple-digit values ("130.1"); w-11 overflows into Hits
  // and reads like extra decimal places.
  if (col === "IP") {
    return "w-14 shrink-0";
  }
  if (col === "ERA" || col === "WHIP" || col === "RBI") {
    return "w-11 shrink-0";
  }
  return "w-9 shrink-0";
}

function TeamLeaderHeadshot({ card }: { card: TeamLeaderCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(card.headshotUrl) && !imgFailed;
  const initial = (card.lastName.trim()[0] ?? "?").toUpperCase();

  if (showImg) {
    return (
      <img
        src={card.headshotUrl!}
        alt=""
        data-testid={`mlb-team-leader-headshot-${card.key}`}
        className="mt-2 size-14 rounded-full bg-white/10 object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      data-testid={`mlb-team-leader-headshot-fallback-${card.key}`}
      className="mt-2 flex size-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/50"
    >
      {initial}
    </span>
  );
}

function TeamLeadersSection({
  title,
  leaders,
  accentColor,
}: {
  title: string;
  leaders: TeamLeaderCard[];
  accentColor: string;
}) {
  if (leaders.length === 0) return null;

  return (
    <GameSection className="w-full !p-3">
      <h2 className="text-center text-[18px] font-semibold text-white">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {leaders.map((card) => (
          <div
            key={card.key}
            data-testid={`mlb-team-leader-card-${card.key}`}
            className="flex flex-col items-center rounded-lg p-2 text-center"
            style={{ backgroundColor: accentColor }}
          >
            <span className="text-[14px] font-semibold tracking-wide text-white/70">
              {card.label}
            </span>
            <span className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-white">
              {card.value}
            </span>
            {card.rank != null ? (
              <span
                data-testid={`mlb-team-leader-rank-${card.key}`}
                className="text-[14px] text-white/40"
              >{`#${card.rank}`}</span>
            ) : null}
            <div className="mt-2">
              <span className="text-[14px] font-semibold uppercase text-white">
                {card.lastName}
              </span>
            </div>
            <TeamLeaderHeadshot card={card} />
          </div>
        ))}
      </div>
    </GameSection>
  );
}

function SeasonTable({
  title,
  testId,
  columns,
  rows,
  valuesFor,
}: {
  title: string;
  testId: string;
  columns: readonly string[];
  rows: Array<{ playerId: string; name: string }>;
  valuesFor: (index: number) => Array<string | number>;
}) {
  return (
    <GameSection className="w-full !p-3">
      <h2 className="text-[18px] font-semibold text-white">{title}</h2>
      <div data-testid={testId} className="mt-2 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-[14px] text-white/55">No season stats available</p>
        ) : (
          <div className="min-w-max">
            <div className="flex items-baseline gap-3 border-b border-white/[0.08] pb-1.5 text-[14px] tracking-wide text-white/40">
              <span className="w-28 shrink-0">PLAYER</span>
              <div className="flex gap-x-2">
                {columns.map((col) => (
                  <span
                    key={col}
                    className={`${colWidth(col)} text-right uppercase`}
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
            <ul>
              {rows.map((row, index) => (
                <li
                  key={row.playerId}
                  className="flex items-baseline gap-3 border-b border-white/[0.06] py-1.5 text-[18px]"
                >
                  <span className="w-28 shrink-0 truncate whitespace-nowrap text-white">
                    {row.name}
                  </span>
                  <div className="flex gap-x-2 font-mono">
                    {valuesFor(index).map((value, colIndex) => (
                      <span
                        key={`${row.playerId}-${columns[colIndex]}`}
                        className={`${colWidth(columns[colIndex]!)} text-right tabular-nums text-white`}
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GameSection>
  );
}

export function MlbTeamPreview({
  data,
  isPending,
  error,
}: {
  data: ApiMlbTeamPreviewResponse | null;
  isPending: boolean;
  error: string | null;
}) {
  if (isPending) {
    return (
      <div data-testid="mlb-team-preview" className="text-[14px] text-white/55">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="mlb-team-preview" className="text-[14px] text-white/70">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div data-testid="mlb-team-preview" className="text-[14px] text-white/55">
        No season stats available
      </div>
    );
  }

  const view = mapMlbTeamPreview(data);
  const accentColor = teamColor(data.team.abbrev);

  return (
    <div
      data-testid="mlb-team-preview"
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <TeamLeadersSection
          title="Team Batting Leaders"
          leaders={view.battingLeaders}
          accentColor={accentColor}
        />
        <SeasonTable
          title="Batting"
          testId="mlb-team-batting-table"
          columns={BATTING_COLS}
          rows={view.battingRoster}
          valuesFor={(index) => batterValues(view.battingRoster[index]!)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <TeamLeadersSection
          title="Team Pitching Leaders"
          leaders={view.pitchingLeaders}
          accentColor={accentColor}
        />
        <SeasonTable
          title="Pitching"
          testId="mlb-team-pitching-table"
          columns={PITCHING_COLS}
          rows={view.pitchingRoster}
          valuesFor={(index) => pitcherValues(view.pitchingRoster[index]!)}
        />
      </div>
    </div>
  );
}
