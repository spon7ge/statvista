import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CHROME_TITLE_TOP } from "@/app/layouts/chrome";
import { StatvistaWordmark } from "@/shared/ui/StatvistaWordmark";
import {
  IconCalendar,
  IconGear,
  IconInfo,
  IconList,
  IconNewspaper,
} from "@/shared/ui/Icons";
import {
  LANDING_HREF,
  homeMatchupsHref,
  homePropsHref,
  isActiveSection,
} from "./lib/appNav";
import { prefetchPropsBoard } from "./lib/prefetchPropsBoard";

function rowClass(active: boolean): string {
  return active ? "nav-link is-active" : "nav-link";
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const propsHref = homePropsHref(pathname);
  const propsActive = isActiveSection(pathname, "Props");
  const matchupsHref = homeMatchupsHref(pathname);
  const matchupsActive = isActiveSection(pathname, "Games");
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
          <Link
            to="/about"
            aria-current={pathname === "/about" ? "page" : undefined}
            className={rowClass(pathname === "/about")}
          >
            <IconInfo />
            About
          </Link>
          <Link
            to="/blog"
            aria-current={
              pathname === "/blog" || pathname.startsWith("/blog/")
                ? "page"
                : undefined
            }
            className={rowClass(
              pathname === "/blog" || pathname.startsWith("/blog/"),
            )}
          >
            <IconNewspaper />
            Blog
          </Link>
          <button type="button" className={rowClass(false)}>
            <IconGear />
            Settings
          </button>
        </nav>
      </div>
    </div>
  );
}
