import type { GameDetail } from "../lib/types";
import { WnbaInGameCenter } from "./WnbaInGameCenter";

export function WnbaLiveCenter({ detail }: { detail: GameDetail }) {
  return <WnbaInGameCenter detail={detail} testId="wnba-live-center" />;
}
