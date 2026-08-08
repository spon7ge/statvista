import type { ApiMlbStandingsLeague } from "@/shared/lib/api";
import { MlbStandingsDivisionCard } from "./MlbStandingsDivisionCard";

type MlbStandingsGridProps = {
  leagues: ApiMlbStandingsLeague[];
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons({ count }: { count: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading standings"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          data-testid="standings-skeleton"
          className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

function LeagueSection({
  title,
  divisions,
}: {
  title: string;
  divisions: ApiMlbStandingsLeague["divisions"];
}) {
  if (divisions.length === 0) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {divisions.map((division) => (
          <MlbStandingsDivisionCard key={division.key} division={division} />
        ))}
      </div>
    </div>
  );
}

export function MlbStandingsGrid({
  leagues,
  isLoading = false,
  isError = false,
}: MlbStandingsGridProps) {
  const americanLeague = leagues.find((league) => league.key === "al");
  const nationalLeague = leagues.find((league) => league.key === "nl");

  return (
    <div className="space-y-10">
      {isLoading ? (
        <div className="space-y-10">
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              American League
            </h2>
            <Skeletons count={3} />
          </div>
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              National League
            </h2>
            <Skeletons count={3} />
          </div>
        </div>
      ) : isError ? (
        <p className="text-[14px] text-white/40">Standings unavailable</p>
      ) : (
        <>
          {americanLeague ? (
            <LeagueSection
              title={americanLeague.label}
              divisions={americanLeague.divisions}
            />
          ) : null}
          {nationalLeague ? (
            <LeagueSection
              title={nationalLeague.label}
              divisions={nationalLeague.divisions}
            />
          ) : null}
        </>
      )}
      <p className="text-[14px] text-white/35">Data: statsapi.mlb.com</p>
    </div>
  );
}
