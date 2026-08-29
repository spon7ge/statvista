import { type ReactNode, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MatchupsHeader } from "@/features/basketball/league/MatchupsHeader";
import { MatchupsPanel } from "@/features/basketball/league/MatchupsPanel";
import {
  isValidEtDate,
  parseMatchupDateParam,
  shiftEtDate,
  slateEtDate,
} from "@/shared/lib/matchupSlateDate";
import type { LeagueSlug } from "@/features/basketball/league/types";
import { mapToMatchupGames } from "@/shared/lib/mapScoreboard";
import { useMlbScoreboard } from "@/features/mlb/hooks/useMlbScoreboard";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";

type LeagueMatchupsPageProps = {
  league: LeagueSlug;
};

function MatchupsShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-0 pb-8">
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20 md:pr-[150px]">
        <MatchupsHeader />
        {children}
      </section>
    </div>
  );
}

export function LeagueMatchupsPage({ league }: LeagueMatchupsPageProps) {
  if (league === "wnba") {
    return <WnbaMatchupsPage />;
  }

  if (league === "mlb") {
    return <MlbMatchupsPage />;
  }

  return (
    <MatchupsShell>
      <p className="text-sm text-white/40">NBA games coming soon.</p>
    </MatchupsShell>
  );
}

function WnbaMatchupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = slateEtDate();
  const raw = searchParams.get("date");
  const selectedDate = parseMatchupDateParam(raw, today);

  useEffect(() => {
    if (raw !== null && !isValidEtDate(raw)) {
      setSearchParams({}, { replace: true });
    }
  }, [raw, setSearchParams]);

  const { games, isLoading, hasNeverLoaded } = useWnbaScoreboard(selectedDate);
  const matchupGames = mapToMatchupGames(games);

  const setDate = (next: string) => {
    if (next === today) setSearchParams({});
    else setSearchParams({ date: next });
  };

  return (
    <MatchupsShell>
      <MatchupsPanel
        games={matchupGames}
        isLoading={isLoading}
        isError={hasNeverLoaded}
        selectedDate={selectedDate}
        todayDate={today}
        onPrevDay={() => setDate(shiftEtDate(selectedDate, -1))}
        onNextDay={() => setDate(shiftEtDate(selectedDate, 1))}
        onGoToday={() => setDate(today)}
      />
    </MatchupsShell>
  );
}

function MlbMatchupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = slateEtDate();
  const raw = searchParams.get("date");
  const selectedDate = parseMatchupDateParam(raw, today);

  useEffect(() => {
    if (raw !== null && !isValidEtDate(raw)) {
      setSearchParams({}, { replace: true });
    }
  }, [raw, setSearchParams]);

  const { games, isLoading, hasNeverLoaded } = useMlbScoreboard(selectedDate);
  const matchupGames = mapToMatchupGames(games);

  const setDate = (next: string) => {
    if (next === today) setSearchParams({});
    else setSearchParams({ date: next });
  };

  return (
    <MatchupsShell>
      <MatchupsPanel
        games={matchupGames}
        isLoading={isLoading}
        isError={hasNeverLoaded}
        selectedDate={selectedDate}
        todayDate={today}
        onPrevDay={() => setDate(shiftEtDate(selectedDate, -1))}
        onNextDay={() => setDate(shiftEtDate(selectedDate, 1))}
        onGoToday={() => setDate(today)}
      />
    </MatchupsShell>
  );
}
