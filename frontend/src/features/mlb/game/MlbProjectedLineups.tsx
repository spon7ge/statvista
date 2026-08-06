import { useState } from "react";
import { GameSection } from "@/shared/ui/GameSection";
import type {
  ApiMlbLineupBatter,
  ApiMlbLineupGame,
  ApiMlbLineupMatchupResponse,
  ApiMlbLineupSide,
} from "@/shared/lib/api";
import type { MlbGameDetailTeam, MlbGameDetailView } from "../lib/types";
import { MlbInjuryReport } from "./MlbInjuryReport";
import { MlbGameOddsBoard } from "./MlbGameOddsBoard";
import { MlbSeasonTeamStats } from "./MlbSeasonTeamStats";
import type { MlbOddsBoardView } from "../lib/mlbOddsBoard";

type TeamSide = "away" | "home";
type MatchupSide = NonNullable<ApiMlbLineupMatchupResponse["away"]>;
type MatchupBatter = MatchupSide["batters"][number];

type Props = {
  detail: MlbGameDetailView;
  game: ApiMlbLineupGame | null;
  matchup?: ApiMlbLineupMatchupResponse | null;
  /** True while the lineups fetch is in flight and has no data yet. */
  isPending?: boolean;
  oddsView?: MlbOddsBoardView | null;
  oddsPending?: boolean;
};

function LogoToggleButton({
  team,
  side,
  active,
  onClick,
}: {
  team: MlbGameDetailTeam;
  side: TeamSide;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`mlb-lineup-toggle-${side}`}
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          className="size-5 object-contain"
        />
      ) : null}
      <span style={{ color: active || team.logoUrl ? undefined : team.color }}>
        {team.abbrev}
      </span>
    </button>
  );
}

function orderedBatters(batters: ApiMlbLineupBatter[]): ApiMlbLineupBatter[] {
  return [...batters].sort((a, b) => a.order - b.order);
}

function orderedMatchupBatters(batters: MatchupBatter[]): MatchupBatter[] {
  return [...batters].sort((a, b) => a.order - b.order);
}

function mergeMatchupBatters(
  slateBatters: ApiMlbLineupBatter[],
  matchupBatters: MatchupBatter[],
) {
  const matchupByOrder = new Map(
    orderedMatchupBatters(matchupBatters).map((batter) => [batter.order, batter]),
  );
  return orderedBatters(slateBatters).map((batter) => {
    const matchupBatter = matchupByOrder.get(batter.order);
    return {
      ...batter,
      mlbam_id: matchupBatter?.mlbam_id ?? null,
      vsPitcher: matchupBatter?.vs_pitcher ?? null,
    };
  });
}

function formatPitcherHand(hand: string | null | undefined): string | null {
  if (!hand) return null;
  const letter = hand.trim().charAt(0).toUpperCase();
  return letter === "L" || letter === "R" ? letter : null;
}

function formatPitcherTitle(
  hand: string | null | undefined,
  name: string | null | undefined,
): string {
  const pitcherName = name ?? "TBD";
  const handLetter = formatPitcherHand(hand);
  return handLetter ? `${pitcherName} - ${handLetter}` : pitcherName;
}

function formatStat(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === ""
    ? "–"
    : String(value);
}

function formatRecord(
  wins: number | null | undefined,
  losses: number | null | undefined,
): string {
  return wins === null ||
    wins === undefined ||
    losses === null ||
    losses === undefined
    ? "–"
    : `${wins}–${losses}`;
}

function PitcherCard({
  slateSide,
  matchupSide,
}: {
  slateSide: ApiMlbLineupSide;
  matchupSide: MatchupSide | null;
}) {
  const pitcher = matchupSide?.pitcher ?? slateSide.pitcher;
  const stats = [
    {
      label: "Record",
      value: matchupSide
        ? formatRecord(matchupSide.pitcher.wins, matchupSide.pitcher.losses)
        : "–",
    },
    {
      label: "ERA",
      value: matchupSide ? formatStat(matchupSide.pitcher.era) : "–",
    },
    {
      label: "WHIP",
      value: matchupSide ? formatStat(matchupSide.pitcher.whip) : "–",
    },
    {
      label: "K/9",
      value: matchupSide ? formatStat(matchupSide.pitcher.k_per_9) : "–",
    },
    {
      label: "BB/9",
      value: matchupSide ? formatStat(matchupSide.pitcher.bb_per_9) : "–",
    },
    {
      label: "K/BB",
      value: matchupSide
        ? formatStat(matchupSide.pitcher.strikeout_walk_ratio)
        : "–",
    },
  ];

  const handLetter = formatPitcherHand(pitcher.hand);

  return (
    <div className="rounded-lg border border-white/10 p-3">
      <h3
        aria-label={formatPitcherTitle(pitcher.hand, pitcher.name)}
        className="text-center text-[18px] font-semibold text-white"
      >
        <span>{pitcher.name ?? "TBD"}</span>
        {handLetter ? (
          <>
            <span className="mx-1 font-normal text-white/35">-</span>
            <span className="text-[14px] font-medium text-white/40">
              {handLetter}
            </span>
          </>
        ) : null}
      </h3>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 text-center">
            <p className="text-[14px] font-medium text-white/40">{stat.label}</p>
            <p className="mt-0.5 truncate text-[18px] font-medium text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineupTable({
  slateSide,
  matchupSide,
  opposingPitcherName,
}: {
  slateSide: ApiMlbLineupSide;
  matchupSide: MatchupSide | null;
  opposingPitcherName: string;
}) {
  const batters = matchupSide
    ? mergeMatchupBatters(slateSide.batters, matchupSide.batters)
    : orderedBatters(slateSide.batters).map((batter) => ({
        ...batter,
        vsPitcher: null,
      }));

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-[18px] font-medium text-white/55">
        Lineup vs {opposingPitcherName}
      </h3>
      {batters.length === 0 ? (
        <p className="text-[18px] text-white/50">No batters listed</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] table-fixed text-left text-[18px]">
            <thead>
              <tr className="border-b border-white/10 text-[14px] text-white/40">
                <th className="w-7 py-1.5 pr-1 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">Batter</th>
                <th className="w-10 py-1.5 pr-1 font-medium">Pos</th>
                <th className="w-9 py-1.5 text-right font-medium">AB</th>
                <th className="w-8 py-1.5 text-right font-medium">H</th>
                <th className="w-8 py-1.5 text-right font-medium">HR</th>
                <th className="w-12 py-1.5 text-right font-medium">AVG</th>
              </tr>
            </thead>
            <tbody>
              {batters.map((batter) => (
                <tr
                  key={`${batter.order}-${batter.name ?? ""}`}
                  className="border-b border-white/[0.06] last:border-b-0"
                >
                  <td className="py-2 pr-1 text-white/40">{batter.order}</td>
                  <td className="py-2 pr-2 text-white">
                    <span className="block truncate">
                      {batter.name ?? "TBD"}
                    </span>
                  </td>
                  <td className="py-2 pr-1 text-white/50">
                    {batter.position ?? "–"}
                  </td>
                  <td className="py-2 text-right text-white/65">
                    {formatStat(batter.vsPitcher?.ab)}
                  </td>
                  <td className="py-2 text-right text-white/65">
                    {formatStat(batter.vsPitcher?.h)}
                  </td>
                  <td className="py-2 text-right text-white/65">
                    {formatStat(batter.vsPitcher?.hr)}
                  </td>
                  <td className="py-2 text-right text-white/65">
                    {formatStat(batter.vsPitcher?.avg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LineupSideView({
  slateSide,
  matchupSide,
  opposingPitcherName,
}: {
  slateSide: ApiMlbLineupSide;
  matchupSide: MatchupSide | null;
  opposingPitcherName: string;
}) {
  return (
    <>
      <PitcherCard slateSide={slateSide} matchupSide={matchupSide} />
      <LineupTable
        slateSide={slateSide}
        matchupSide={matchupSide}
        opposingPitcherName={opposingPitcherName}
      />
    </>
  );
}

export function MlbProjectedLineups({
  detail,
  game,
  matchup,
  isPending,
  oddsView = null,
  oddsPending,
}: Props) {
  const [side, setSide] = useState<TeamSide>("away");
  const opposingSide = side === "away" ? "home" : "away";
  const opposingPitcherName =
    matchup?.[opposingSide]?.pitcher.name ??
    game?.[opposingSide].pitcher.name ??
    "TBD";

  return (
    <div className="space-y-4" data-testid="mlb-projected-lineups-stack">
      <div
        data-testid="mlb-preview-lineups-odds-grid"
        className="grid items-start gap-4 lg:grid-cols-2"
      >
        {/* Left column: Team Stats + Injuries share the lineups column width */}
        <div
          data-testid="mlb-preview-left-column"
          className="min-w-0 space-y-4"
        >
          <GameSection
            className="w-full !p-3"
            data-testid="mlb-projected-lineups"
          >
            <div className="mb-3 flex flex-col items-center gap-2">
              <h2 className="text-center text-[18px] font-semibold leading-snug text-white">
                Projected Rotowire Lineups
              </h2>
              <div className="flex items-center justify-center gap-1">
                <LogoToggleButton
                  team={detail.away}
                  side="away"
                  active={side === "away"}
                  onClick={() => setSide("away")}
                />
                <LogoToggleButton
                  team={detail.home}
                  side="home"
                  active={side === "home"}
                  onClick={() => setSide("home")}
                />
              </div>
            </div>
            {isPending ? (
              <p className="text-[18px] text-white/50">Loading lineups…</p>
            ) : !game ? (
              <p className="text-[18px] text-white/50">Lineups unavailable</p>
            ) : (
              <LineupSideView
                slateSide={game[side]}
                matchupSide={matchup?.[side] ?? null}
                opposingPitcherName={opposingPitcherName}
              />
            )}
          </GameSection>
          <MlbSeasonTeamStats detail={detail} />
          <MlbInjuryReport detail={detail} />
        </div>
        <MlbGameOddsBoard
          detail={detail}
          view={oddsView}
          isPending={oddsPending}
        />
      </div>
    </div>
  );
}
