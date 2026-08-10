import type { ApiWnbaLeaderCategory } from "@/shared/lib/api";
import { LeaderCategoryCard } from "./LeaderCategoryCard";

type LeadersGridProps = {
  categories: ApiWnbaLeaderCategory[];
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons() {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading leaders"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

export function LeadersGrid({
  categories,
  isLoading = false,
  isError = false,
}: LeadersGridProps) {
  return (
    <div className="space-y-6">
      {isLoading ? (
        <Skeletons />
      ) : isError ? (
        <p className="text-sm text-white/40">Leaders unavailable</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <LeaderCategoryCard key={category.key} category={category} />
          ))}
        </div>
      )}
      <p className="text-xs text-white/35">Data: stats.wnba.com</p>
    </div>
  );
}
