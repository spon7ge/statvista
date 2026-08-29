import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/shared/ui/SiteFooter";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-white">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-white/55">That route does not exist.</p>
        <Link
          to="/mlb/matchups"
          className="inline-flex items-center gap-1 text-sm font-medium text-white hover:underline"
        >
          Back to games
          <ArrowRight className="size-4" />
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
