import type { ApiMlbLeaderCategory } from "@/shared/lib/api";
import { MlbLeaderCategoryCard } from "./MlbLeaderCategoryCard";

type MlbLeadersGridProps = {
  season: number;
  categories: ApiMlbLeaderCategory[];
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading leaders"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          data-testid="leader-skeleton"
          className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

export function MlbLeadersGrid({
  season,
  categories,
  isLoading = false,
  isError = false,
}: MlbLeadersGridProps) {
  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Leaders
        </h2>
        <p className="mt-2 text-[14px] text-white/40">{season} season</p>
      </header>
      {isLoading ? (
        <Skeletons />
      ) : isError ? (
        <p className="text-[14px] text-white/40">Leaders unavailable</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <MlbLeaderCategoryCard key={category.key} category={category} />
          ))}
        </div>
      )}
      <p className="text-[14px] text-white/35">Data: statsapi.mlb.com</p>
    </section>
  );
}
