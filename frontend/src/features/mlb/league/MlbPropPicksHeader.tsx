import { type ReactNode } from "react";

export type MlbPropAppTab = "prizepicks" | "underdog";

/** Shared by game-detail Props tabs; the research board no longer reads `?app=`. */
export function appFromSearch(value: string | null): MlbPropAppTab {
  return value === "underdog" ? "underdog" : "prizepicks";
}

type MlbPropPicksHeaderProps = {
  /** Filter pills under the title (same column as the league subnav). */
  children?: ReactNode;
};

/**
 * MLB Props title, matching other MLB league pages (Leaders / Standings).
 * Filter pills sit under the title in the same max-w-6xl column as the subnav.
 * PrizePicks / Underdog tabs stay on game-detail Props, not this page.
 */
export function MlbPropPicksHeader({ children }: MlbPropPicksHeaderProps) {
  return (
    <div data-testid="mlb-prop-picks-header" className="relative z-20 space-y-3">
      <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
        MLB Props
      </h1>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
