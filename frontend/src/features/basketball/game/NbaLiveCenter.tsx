import type { GameDetail } from "../lib/types";
import { NbaInGameCenter } from "./NbaInGameCenter";

export function NbaLiveCenter({ detail }: { detail: GameDetail }) {
  return <NbaInGameCenter detail={detail} testId="nba-live-center" />;
}
