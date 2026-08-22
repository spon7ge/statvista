import { useState } from "react";
import type { ApiWnbaTeamPreviewResponse } from "@/shared/lib/api";
import { GameSection } from "@/shared/ui/GameSection";
import { teamColor } from "../league/wnbaTeamColors";

type TeamLeaderCard = {
  key: "ppg" | "rpg" | "apg" | "bpg" | "spg";
  label: string;
  rank: number | null;
  value: string;
  playerId: string;
  lastName: string;
  headshotUrl: string | null;
};

type RosterSeasonRow = {
  playerId: string;
  name: string;
  jersey: string | null;
  position: string | null;
  gp: number | null;
  min: string | null;
  pts: string | null;
  reb: string | null;
  ast: string | null;
  stl: string | null;
  blk: string | null;
  to: string | null;
  fgPct: string | null;
  fg3Pct: string | null;
  ftPct: string | null;
  shEff: string | null;
  scEff: string | null;
  ppep: string | null;
  rtg: string | null;
  plusMinus: string | null;
};

type TeamPreviewView = {
  leaders: TeamLeaderCard[];
  roster: RosterSeasonRow[];
};

const ROSTER_COLS = [
  "#",
  "POS",
  "GP",
  "MIN",
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "TO",
  "FG%",
  "3P%",
  "FT%",
  "SH-EFF",
  "SC-EFF",
  "PPEP",
  "RTG",
  "+/-",
] as const;

function mapLeader(
  card: ApiWnbaTeamPreviewResponse["leaders"][number],
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

function mapWnbaTeamPreview(data: ApiWnbaTeamPreviewResponse): TeamPreviewView {
  return {
    leaders: data.leaders.map(mapLeader),
    roster: data.roster.map((row) => ({
      playerId: row.player_id,
      name: row.name,
      jersey: row.jersey,
      position: row.position,
      gp: row.gp,
      min: row.min,
      pts: row.pts,
      reb: row.reb,
      ast: row.ast,
      stl: row.stl,
      blk: row.blk,
      to: row.to,
      fgPct: row.fg_pct,
      fg3Pct: row.fg3_pct,
      ftPct: row.ft_pct,
      shEff: row.sh_eff,
      scEff: row.sc_eff,
      ppep: row.ppep,
      rtg: row.rtg,
      plusMinus: row.plus_minus,
    })),
  };
}

function cell(value: string | number | null): string | number {
  return value ?? "–";
}

function rosterValues(row: RosterSeasonRow): Array<string | number> {
  return [
    cell(row.jersey),
    cell(row.position),
    cell(row.gp),
    cell(row.min),
    cell(row.pts),
    cell(row.reb),
    cell(row.ast),
    cell(row.stl),
    cell(row.blk),
    cell(row.to),
    cell(row.fgPct),
    cell(row.fg3Pct),
    cell(row.ftPct),
    cell(row.shEff),
    cell(row.scEff),
    cell(row.ppep),
    cell(row.rtg),
    cell(row.plusMinus),
  ];
}

function colWidth(col: string): string {
  if (col === "SH-EFF" || col === "SC-EFF" || col === "PPEP") {
    return "w-14 shrink-0";
  }
  if (col === "MIN" || col === "FG%" || col === "3P%" || col === "FT%") {
    return "w-12 shrink-0";
  }
  if (col === "POS") {
    return "w-10 shrink-0";
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
        data-testid={`wnba-team-leader-headshot-${card.key}`}
        className="mt-2 size-14 rounded-full bg-white/10 object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      data-testid={`wnba-team-leader-headshot-fallback-${card.key}`}
      className="mt-2 flex size-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/50"
    >
      {initial}
    </span>
  );
}

function TeamLeadersSection({
  leaders,
  accentColor,
}: {
  leaders: TeamLeaderCard[];
  accentColor: string;
}) {
  if (leaders.length === 0) return null;

  return (
    <GameSection className="w-full !p-3">
      <h2 className="text-center text-[18px] font-semibold text-white">
        Team Leaders
      </h2>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {leaders.map((card) => (
          <div
            key={card.key}
            data-testid={`wnba-team-leader-card-${card.key}`}
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
                data-testid={`wnba-team-leader-rank-${card.key}`}
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

function RosterTable({ rows }: { rows: RosterSeasonRow[] }) {
  return (
    <GameSection className="w-full !p-3">
      <h2 className="text-[18px] font-semibold text-white">Roster</h2>
      <div data-testid="wnba-team-roster-table" className="mt-2 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-[14px] text-white/55">No season stats available</p>
        ) : (
          <div className="min-w-max">
            <div className="flex items-baseline gap-3 border-b border-white/[0.08] pb-1.5 text-[14px] tracking-wide text-white/40">
              <span className="w-28 shrink-0">PLAYER</span>
              <div className="flex gap-x-2">
                {ROSTER_COLS.map((col) => (
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
              {rows.map((row) => (
                <li
                  key={row.playerId}
                  className="flex items-baseline gap-3 border-b border-white/[0.06] py-1.5 text-[18px]"
                >
                  <span className="w-28 shrink-0 truncate whitespace-nowrap text-white">
                    {row.name}
                  </span>
                  <div className="flex gap-x-2 font-mono">
                    {rosterValues(row).map((value, colIndex) => (
                      <span
                        key={`${row.playerId}-${ROSTER_COLS[colIndex]}`}
                        className={`${colWidth(ROSTER_COLS[colIndex]!)} text-right tabular-nums text-white`}
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

export function WnbaTeamPreview({
  data,
  isPending,
  error,
}: {
  data: ApiWnbaTeamPreviewResponse | null;
  isPending: boolean;
  error: string | null;
}) {
  if (isPending) {
    return (
      <div data-testid="wnba-team-preview" className="text-[14px] text-white/55">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="wnba-team-preview" className="text-[14px] text-white/70">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div data-testid="wnba-team-preview" className="text-[14px] text-white/55">
        No season stats available
      </div>
    );
  }

  const view = mapWnbaTeamPreview(data);
  const accentColor = teamColor(data.team.abbrev);

  return (
    <div data-testid="wnba-team-preview" className="flex flex-col gap-3">
      <TeamLeadersSection leaders={view.leaders} accentColor={accentColor} />
      <RosterTable rows={view.roster} />
    </div>
  );
}
