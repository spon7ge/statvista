import { BrandHero } from "@/features/home/BrandHero";
import { LiveNowSection } from "@/features/home/LiveNowSection";
import { StoriesSection } from "@/features/home/StoriesSection";
import { LeagueCtaSection } from "@/features/home/LeagueCtaSection";
import { mergeLeagueScoreboards } from "@/features/home/lib/mergeLeagueScoreboards";
import { useMlbScoreboard } from "@/features/mlb/hooks/useMlbScoreboard";
import { useWnbaScoreboard } from "@/features/basketball/hooks/useWnbaScoreboard";

export function HomePage() {
  const wnba = useWnbaScoreboard();
  const mlb = useMlbScoreboard();
  const { liveGames, isLoading, hasNeverLoaded } = mergeLeagueScoreboards([
    wnba,
    mlb,
  ]);
  return (
    <>
      <BrandHero />
      <LiveNowSection
        games={liveGames}
        isLoading={isLoading}
        isError={hasNeverLoaded}
      />
      <StoriesSection />
      <LeagueCtaSection />
    </>
  );
}
