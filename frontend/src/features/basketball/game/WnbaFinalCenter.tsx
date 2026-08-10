import type { GameDetail } from "../lib/types";
import { WnbaInGameCenter } from "./WnbaInGameCenter";

export function WnbaFinalCenter({ detail }: { detail: GameDetail }) {
  return <WnbaInGameCenter detail={detail} testId="wnba-final-center" />;
}
