import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/features/home/AppSidebar";
import { LANDING_HREF } from "@/features/home/lib/appNav";
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
    <div className="flex min-h-screen flex-col bg-background text-white sm:flex-row">
      <header className="flex h-12 items-center gap-3 border-b border-white/10 px-4 sm:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar-drawer"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-1.5 text-white hover:bg-white/5"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden />
        </button>
        <Link to={LANDING_HREF} className="text-white no-underline">
          <StatvistaWordmark />
        </Link>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col self-stretch sm:flex">
        <AppSidebar />
      </aside>

      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/60 sm:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="app-sidebar-drawer"
            className="fixed inset-y-0 left-0 z-50 w-60 bg-background sm:hidden"
          >
            <AppSidebar />
          </div>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
