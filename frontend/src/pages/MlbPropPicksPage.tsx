import { LeagueSubnav } from "@/features/basketball/league/LeagueSubnav";
import { useMlbProps } from "@/features/mlb/hooks/useMlbProps";

const DEFAULT_PARAMS = {
  app: "prizepicks",
  format: "power",
  legs: 4,
} as const;

export function MlbPropPicksPage() {
  const { data, isLoading, isError } = useMlbProps(DEFAULT_PARAMS);
  const showError = isError && !data;

  let status = `${data?.props.length ?? 0} MLB prop picks available.`;
  if (isLoading && !data) status = "Loading MLB prop picks…";
  else if (showError || data?.error) status = "Unable to load MLB prop picks.";
  else if (data?.props.length === 0) status = "No MLB prop picks available.";

  return (
    <div className="space-y-0 pb-8">
      <LeagueSubnav league="mlb" />
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          MLB Prop Picks
        </h1>
        <p className="mt-3 text-sm text-white/45">{status}</p>
      </section>
    </div>
  );
}
