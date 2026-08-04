import { useState } from "react";
import {
  MlbPregameBroadcastHeader,
  type PregameTab,
} from "./MlbPregameBroadcastHeader";
import type { MlbGameDetailView } from "./types";

export function MlbPregameCenter({ detail }: { detail: MlbGameDetailView }) {
  const [activeTab, setActiveTab] = useState<PregameTab>("preview");

  const stub =
    activeTab === "preview"
      ? "Preview coming soon"
      : activeTab === "away"
        ? `${detail.away.name} preview coming soon`
        : `${detail.home.name} preview coming soon`;

  return (
    <div data-testid="mlb-pregame-center" className="space-y-4">
      <MlbPregameBroadcastHeader
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <p className="text-sm text-white/60">{stub}</p>
    </div>
  );
}
