import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  activeLeagueFromPath,
  orderedNavLeagues,
  sectionHref,
} from "@/features/home/lib/appNav";
import { prefetchPropsBoard } from "@/features/home/lib/prefetchPropsBoard";

function pillClass(active: boolean): string {
  return active ? "pill is-active" : "pill";
}

export type LeagueSection = "Props" | "Games" | "Legs" | "Arbitrage";

type LeagueSectionSwitcherProps = {
  section: LeagueSection;
};

/** Horizontal league pills under a section title (Props, Games, Legs, Arbitrage). */
export function LeagueSectionSwitcher({ section }: LeagueSectionSwitcherProps) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const activeLeague = activeLeagueFromPath(pathname);
  const leagues = orderedNavLeagues();

  return (
    <nav aria-label="Leagues" className="pill-row">
      {leagues.map((league) => {
        const href = sectionHref(league.id, section);
        const active = activeLeague === league.id;
        const className = pillClass(active);
        const icon = (
          <img
            src={league.icon}
            alt=""
            aria-hidden
            className="size-4 shrink-0 object-contain"
          />
        );
        if (!href) {
          return (
            <span key={league.id} className="min-w-fit">
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
            className="min-w-fit no-underline"
            onPointerEnter={
              section === "Props"
                ? () => prefetchPropsBoard(queryClient, href)
                : undefined
            }
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
