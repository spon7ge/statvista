import { type ReactNode } from "react";

export type MlbPropAppTab = "prizepicks" | "underdog";

/** Shared by game-detail Props tabs; the research board no longer reads `?app=`. */
export function appFromSearch(value: string | null): MlbPropAppTab {
  return value === "underdog" ? "underdog" : "prizepicks";
}

type MlbPropPicksHeaderProps = {
  /** Team + search pills on the right of the title. */
  children?: ReactNode;
};

/**
 * MLB Props title (left) with optional Team / search pills (right).
 * PrizePicks / Underdog tabs stay on game-detail Props, not this page.
 */
export function MlbPropPicksHeader({ children }: MlbPropPicksHeaderProps) {
  return (
    <div data-testid="mlb-prop-picks-header" className="relative z-20 space-y-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h1 className="min-w-0 shrink-0 text-left text-[28px] leading-none font-bold tracking-tight text-white sm:text-[32px]">
          MLB Props
        </h1>
        {children ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
