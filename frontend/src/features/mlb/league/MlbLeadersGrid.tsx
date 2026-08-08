import type { ApiMlbLeaderCategory } from "@/shared/lib/api";
import { MlbLeaderCategoryCard } from "./MlbLeaderCategoryCard";

const BATTING_KEYS = new Set([
  "avg",
  "hr",
  "rbi",
  "sb",
  "ops",
  "hits",
]);

const PITCHING_KEYS = new Set([
  "era",
  "whip",
  "so",
  "w",
  "sv",
  "ip",
]);

type MlbLeadersGridProps = {
  categories: ApiMlbLeaderCategory[];
  isLoading?: boolean;
  isError?: boolean;
};

function Skeletons({ count }: { count: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading leaders"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          data-testid="leader-skeleton"
          className="h-72 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

function Section({
  title,
  categories,
}: {
  title: string;
  categories: ApiMlbLeaderCategory[];
}) {
  if (categories.length === 0) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <MlbLeaderCategoryCard key={category.key} category={category} />
        ))}
      </div>
    </div>
  );
}

export function splitLeaderCategories(categories: ApiMlbLeaderCategory[]): {
  batting: ApiMlbLeaderCategory[];
  pitching: ApiMlbLeaderCategory[];
} {
  const batting: ApiMlbLeaderCategory[] = [];
  const pitching: ApiMlbLeaderCategory[] = [];
  for (const category of categories) {
    if (BATTING_KEYS.has(category.key)) batting.push(category);
    else if (PITCHING_KEYS.has(category.key)) pitching.push(category);
  }
  return { batting, pitching };
}

export function MlbLeadersGrid({
  categories,
  isLoading = false,
  isError = false,
}: MlbLeadersGridProps) {
  const { batting, pitching } = splitLeaderCategories(categories);

  return (
    <div className="space-y-10">
      {isLoading ? (
        <div className="space-y-10">
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              Batting
            </h2>
            <Skeletons count={6} />
          </div>
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              Pitching
            </h2>
            <Skeletons count={6} />
          </div>
        </div>
      ) : isError ? (
        <p className="text-[14px] text-white/40">Leaders unavailable</p>
      ) : (
        <>
          <Section title="Batting" categories={batting} />
          <Section title="Pitching" categories={pitching} />
        </>
      )}
      <p className="text-[14px] text-white/35">Data: statsapi.mlb.com</p>
    </div>
  );
}
