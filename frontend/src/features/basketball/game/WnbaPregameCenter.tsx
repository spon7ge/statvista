import type { GameDetail } from "../lib/types";
import { InjuryReport } from "./InjuryReport";
import { MatchupPrediction } from "./MatchupPrediction";
import { ProjectedStarters } from "./ProjectedStarters";
import { SeasonLeaders } from "./SeasonLeaders";
import { WnbaBroadcastHeader } from "./WnbaBroadcastHeader";

/** Scheduled game: broadcast slabs (scores may be null) + preview stack, no tabs. */
export function WnbaPregameCenter({ detail }: { detail: GameDetail }) {
  return (
    <div data-testid="wnba-pregame-center" className="space-y-4">
      <WnbaBroadcastHeader detail={detail} />
      <MatchupPrediction detail={detail} />
      <ProjectedStarters detail={detail} />
      <SeasonLeaders detail={detail} />
      <InjuryReport detail={detail} />
    </div>
  );
}
