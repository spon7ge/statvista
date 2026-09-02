import { useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { StatvistaWordmark } from "@/shared/ui/StatvistaWordmark";
import {
  IconCalendar,
  IconChevron,
  IconGear,
  IconHome,
  IconInfo,
  IconLayers,
  IconList,
  IconSwap,
} from "@/shared/ui/Icons";
import {
  LANDING_HREF,
  activeLeagueFromPath,
  homeArbitrageHref,
  homeLegsHref,
  homeMatchupsHref,
  homePropsHref,
  isActiveSection,
  orderedNavLeagues,
} from "./lib/appNav";
import { prefetchPropsBoard } from "./lib/prefetchPropsBoard";

function rowClass(active: boolean): string {
  return active ? "nav-link is-active" : "nav-link";
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const [leaguesOpen, setLeaguesOpen] = useState(true);
  const leaguesId = useId();
  const propsHref = homePropsHref(pathname);
  const propsActive = isActiveSection(pathname, "Props");
  const legsHref = homeLegsHref(pathname);
  const legsActive = isActiveSection(pathname, "Legs");
  const arbitrageHref = homeArbitrageHref(pathname);
  const arbitrageActive = isActiveSection(pathname, "Arbitrage");
  const matchupsHref = homeMatchupsHref(pathname);
  const matchupsActive = isActiveSection(pathname, "Games");
  const activeLeague = activeLeagueFromPath(pathname);
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchPropsBoard(queryClient, propsHref);
  }, [queryClient, propsHref]);

  return (
    <div className={`sidebar ${CHROME_TITLE_TOP}`}>
      <Link to={LANDING_HREF} className="nav-brand chrome-title-row">
        <StatvistaWordmark />
      </Link>

      <div className="nav-scroll">
        <nav aria-label="Primary">
          <div className="nav-panel">
            <div className="nav-group">
              <div className="nav-item">
                <Link
                  to={LANDING_HREF}
                  aria-current={pathname === "/" ? "page" : undefined}
                  className={rowClass(pathname === "/")}
                >
                  <IconHome />
                  Home
                </Link>
                <button
                  type="button"
                  className="nav-toggle"
                  aria-expanded={leaguesOpen}
                  aria-controls={leaguesId}
                  aria-label={leaguesOpen ? "Hide leagues" : "Show leagues"}
                  onClick={() => setLeaguesOpen((open) => !open)}
                >
                  <IconChevron />
                </button>
              </div>
              <div id={leaguesId} className="nav-sub" hidden={!leaguesOpen}>
                {orderedNavLeagues().map((league) => (
                  <Link
                    key={league.id}
                    to={league.href}
                    aria-current={activeLeague === league.id ? "page" : undefined}
                    className={rowClass(activeLeague === league.id)}
                  >
                    <img
                      src={league.icon}
                      alt=""
                      aria-hidden
                      className="nav-logo"
                    />
                    {league.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              to={propsHref}
              aria-current={propsActive ? "page" : undefined}
              className={rowClass(propsActive)}
              onPointerEnter={() => prefetchPropsBoard(queryClient, propsHref)}
            >
              <IconList />
              Props
            </Link>
            <Link
              to={legsHref}
              aria-current={legsActive ? "page" : undefined}
              className={rowClass(legsActive)}
            >
              <IconLayers />
              Legs
            </Link>
            <Link
              to={arbitrageHref}
              aria-current={arbitrageActive ? "page" : undefined}
              className={rowClass(arbitrageActive)}
            >
              <IconSwap />
              Arbitrage
            </Link>
            <Link
              to={matchupsHref}
              aria-current={matchupsActive ? "page" : undefined}
              className={rowClass(matchupsActive)}
            >
              <IconCalendar />
              Games
            </Link>
          </div>
        </nav>

        <nav aria-label="Site" className="nav-panel">
          <button type="button" className={rowClass(false)}>
            <IconInfo />
            About
          </button>
          <button type="button" className={rowClass(false)}>
            <IconList />
            Blog
          </button>
          <button type="button" className={rowClass(false)}>
            <IconGear />
            Settings
          </button>
        </nav>
      </div>
    </div>
  );
}
