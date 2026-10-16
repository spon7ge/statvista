import type { GameDetail } from "../lib/types";
import { NbaInGameCenter } from "./NbaInGameCenter";

export function NbaFinalCenter({ detail }: { detail: GameDetail }) {
  return <NbaInGameCenter detail={detail} testId="nba-final-center" />;
}
