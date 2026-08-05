import { useState } from "react";
import { GameSection } from "@/components/game/GameSection";
import type {
  ApiMlbLineupBatter,
  ApiMlbLineupGame,
  ApiMlbLineupMatchupResponse,
  ApiMlbLineupSide,
} from "@/lib/api";
import type { MlbGameDetailTeam, MlbGameDetailView } from "./types";

type TeamSide = "away" | "home";
type MatchupSide = NonNullable<ApiMlbLineupMatchupResponse["away"]>;
type MatchupBatter = MatchupSide["batters"][number];

type Props = {
  detail: MlbGameDetailView;
  game: ApiMlbLineupGame | null;
  matchup?: ApiMlbLineupMatchupResponse | null;
  /** True while the lineups fetch is in flight and has no data yet. */
  isPending?: boolean;
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
      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
        active ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt={team.abbrev}
          className="size-5 object-contain"
        />
      ) : (
        <span style={{ color: active ? undefined : team.color }}>
          {team.abbrev}
        </span>
      )}
    </button>
  );
}

function orderedBatters(batters: ApiMlbLineupBatter[]): ApiMlbLineupBatter[] {
  return [...batters].sort((a, b) => a.order - b.order);
}

function orderedMatchupBatters(batters: MatchupBatter[]): MatchupBatter[] {
  return [...batters].sort((a, b) => a.order - b.order);
}

function formatPitcherTitle(
  hand: string | null | undefined,
  name: string | null | undefined,
): string {
  const pitcherName = name ?? "TBD";
  return hand ? `${hand.toUpperCase()}HP ${pitcherName}` : pitcherName;
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
      label: "W-L",
      value: matchupSide
        ? formatRecord(matchupSide.pitcher.wins, matchupSide.pitcher.losses)
        : "–",
    },
    {
      label: "ERA",
      value: matchupSide ? formatStat(matchupSide.pitcher.era) : "–",
    },
    {
      label: "IP",
      value: matchupSide
        ? formatStat(matchupSide.pitcher.innings_pitched)
        : "–",
    },
    {
      label: "K",
      value: matchupSide
        ? formatStat(matchupSide.pitcher.strikeouts)
        : "–",
    },
    {
      label: "WHIP",
      value: matchupSide ? formatStat(matchupSide.pitcher.whip) : "–",
    },
  ];

  return (
    <div className="rounded-lg border border-white/10 p-3">
      <h3
        aria-label={formatPitcherTitle(pitcher.hand, pitcher.name)}
        className="text-sm font-semibold text-white"
      >
        {pitcher.hand ? `${pitcher.hand.toUpperCase()}HP ` : ""}
        <span>{pitcher.name ?? "TBD"}</span>
      </h3>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <p className="text-[10px] font-medium text-white/40">{stat.label}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-white">
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
    ? orderedMatchupBatters(matchupSide.batters).map((batter) => ({
        ...batter,
        vsPitcher: batter.vs_pitcher,
      }))
    : orderedBatters(slateSide.batters).map((batter) => ({
        ...batter,
        vsPitcher: null,
      }));

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-medium text-white/55">
        Lineup vs {opposingPitcherName}
      </h3>
      {batters.length === 0 ? (
        <p className="text-xs text-white/50">No batters listed</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] table-fixed text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] text-white/40">
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
}: Props) {
  const [side, setSide] = useState<TeamSide>("away");
  const opposingSide = side === "away" ? "home" : "away";
  const opposingPitcherName =
    matchup?.[opposingSide]?.pitcher.name ??
    game?.[opposingSide].pitcher.name ??
    "TBD";

  return (
    <GameSection
      className="w-full !p-3 sm:w-1/2"
      data-testid="mlb-projected-lineups"
    >
      <div className="mb-3 flex flex-col gap-2">
        <h2 className="text-sm font-semibold leading-snug text-white">
          Projected lineups
          <span className="mt-0.5 block font-normal text-white/45">
            RotoWire expected lineup
          </span>
        </h2>
        <div className="flex items-center gap-1">
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
        <p className="text-xs text-white/50">Loading lineups…</p>
      ) : !game ? (
        <p className="text-xs text-white/50">Lineups unavailable</p>
      ) : (
        <LineupSideView
          slateSide={game[side]}
          matchupSide={matchup?.[side] ?? null}
          opposingPitcherName={opposingPitcherName}
        />
      )}
    </GameSection>
  );
}
