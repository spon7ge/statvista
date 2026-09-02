import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/features/home/AppSidebar";
import { LANDING_HREF } from "@/features/home/lib/appNav";
import { IconMenu } from "@/shared/ui/Icons";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { StatvistaWordmark } from "@/shared/ui/StatvistaWordmark";

export function HomeChromeLayout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="shell">
      <header className="site-header">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar-drawer"
          onClick={() => setDrawerOpen(true)}
          className="site-menu-btn"
        >
          <IconMenu />
        </button>
        <Link to={LANDING_HREF} className="nav-brand">
          <StatvistaWordmark />
        </Link>
      </header>

      <aside className="site-aside">
        <AppSidebar />
      </aside>

      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="site-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <div id="app-sidebar-drawer" className="site-drawer">
            <AppSidebar />
          </div>
        </>
      ) : null}

      <div className="site-column">
        <main>
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
