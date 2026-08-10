import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { GameSection } from "@/shared/ui/GameSection";
import type { GameDetail } from "../lib/types";

function InfoRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-white/50">{icon}</div>
      <div className="min-w-0 space-y-0.5">{children}</div>
    </div>
  );
}

export function WnbaGameInfo({ detail }: { detail: GameDetail }) {
  const venue = detail.venue?.trim() || null;

  return (
    <GameSection data-testid="wnba-game-info">
      <h2 className="text-[18px] font-semibold text-white">Game Info</h2>

      <div className="mt-4 space-y-4">
        {venue ? (
          <InfoRow icon={<Building2 className="size-4" aria-hidden="true" />}>
            <p className="text-sm text-white">{venue}</p>
          </InfoRow>
        ) : null}
      </div>
    </GameSection>
  );
}
