import { Link } from "react-router-dom";
import { IconArrow } from "@/shared/ui/Icons";
import { SiteFooter } from "@/shared/ui/SiteFooter";

export function NotFoundPage() {
  return (
    <div className="shell">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6">
        <h1 className="page-title">Page not found</h1>
        <p>That route does not exist.</p>
        <Link to="/mlb/matchups" className="inline-flex items-center gap-1">
          Back to games
          <IconArrow />
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
