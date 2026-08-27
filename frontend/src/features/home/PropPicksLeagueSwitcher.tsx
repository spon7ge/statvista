import { Link, useLocation } from "react-router-dom";
import {
  NAV_LEAGUES,
  activeLeagueFromPath,
  sectionHref,
} from "@/features/home/lib/appNav";
import type { LeagueSlug } from "@/shared/lib/types";

/** PrizePicks-style order: MLB first, then the other leagues we support. */
const PILL_ORDER: readonly LeagueSlug[] = ["mlb", "wnba", "nba"];

const PILL =
  "flex w-fit min-w-fit items-center gap-2 rounded-xl border border-white/15 bg-transparent py-1.5 pr-2.5 pl-1.5 text-sm font-bold text-white/70";

function pillClass(active: boolean, enabled: boolean): string {
  if (!enabled) {
    return `${PILL} cursor-not-allowed opacity-20`;
  }
  if (active) {
    return `${PILL} bg-[#1e1e1e]`;
  }
  return PILL;
}

/** Horizontal league pills under the Props title. */
export function PropPicksLeagueSwitcher() {
  const { pathname } = useLocation();
  const activeLeague = activeLeagueFromPath(pathname);
  const leagues = PILL_ORDER.flatMap((id) => {
    const league = NAV_LEAGUES.find((item) => item.id === id);
    return league ? [league] : [];
  });

  return (
    <nav aria-label="Leagues" className="flex gap-1 overflow-x-auto">
      {leagues.map((league) => {
        const href = sectionHref(league.id, "Props");
        const active = activeLeague === league.id;
        const className = pillClass(active, Boolean(href));
        const icon = (
          <img
            src={league.icon}
            alt=""
            aria-hidden
            className={`size-4 shrink-0 object-contain ${active ? "" : "grayscale"}`}
          />
        );
        if (!href) {
          return (
            <span key={league.id} className="min-w-fit outline-0">
              <button type="button" disabled className={className}>
                {icon}
                {league.label}
              </button>
            </span>
          );
        }
        return (
          <Link
            key={league.id}
            to={href}
            aria-current={active ? "page" : undefined}
            className="min-w-fit no-underline outline-0"
          >
            <span className={className}>
              {icon}
              {league.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
