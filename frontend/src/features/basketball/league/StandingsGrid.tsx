import type { ApiWnbaStandingsConference } from "@/shared/lib/api";
import { StandingsConferenceCard } from "./StandingsConferenceCard";

type StandingsGridProps = {
  conferences: ApiWnbaStandingsConference[];
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons() {
  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      aria-label="Loading standings"
    >
      {Array.from({ length: 2 }, (_, i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

export function StandingsGrid({
  conferences,
  isLoading = false,
  isError = false,
}: StandingsGridProps) {
  return (
    <div className="space-y-6">
      {isLoading ? (
        <Skeletons />
      ) : isError ? (
        <p className="text-sm text-white/40">Standings unavailable</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {conferences.map((conference) => (
            <StandingsConferenceCard
              key={conference.key}
              conference={conference}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-white/35">Data: ESPN</p>
    </div>
  );
}
