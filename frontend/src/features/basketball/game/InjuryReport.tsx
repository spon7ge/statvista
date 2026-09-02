import { GameSection } from "@/shared/ui/GameSection";
import type {
  GameDetail,
  GameDetailInjury,
  GameDetailTeam,
} from "../lib/types";

type InjuryReportProps = {
  detail: GameDetail;
};

function InjuryRow({ injury }: { injury: GameDetailInjury }) {
  return (
    <li className="text-[16px] text-c3">
      <div className="flex items-baseline gap-1.5">
        <span>{injury.name}</span>
        {injury.position ? (
          <span className="text-c3">{injury.position}</span>
        ) : null}
      </div>
      <div className="mt-0.5 text-[16px]">
        <span className="font-medium text-c3">{injury.status}</span>
        {injury.detail ? (
          <span className="text-c3">{` · ${injury.detail}`}</span>
        ) : null}
      </div>
    </li>
  );
}

function InjuryColumn({
  team,
  injuries,
  showEmptyPlaceholder,
}: {
  team: GameDetailTeam;
  injuries: GameDetailInjury[];
  showEmptyPlaceholder: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-c3">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt=""
            className="size-6 shrink-0 object-contain"
          />
        ) : null}
        <span>{team.abbrev}</span>
      </h3>
      {injuries.length > 0 ? (
        <ul className="space-y-2">
          {injuries.map((injury) => (
            <InjuryRow key={injury.name} injury={injury} />
          ))}
        </ul>
      ) : showEmptyPlaceholder ? (
        <p className="text-[16px] text-c3">None listed</p>
      ) : null}
    </div>
  );
}

export function InjuryReport({ detail }: InjuryReportProps) {
  const injuries = detail.injuries;

  if (!injuries) {
    return null;
  }

  const awayHasInjuries = injuries.away.length > 0;
  const homeHasInjuries = injuries.home.length > 0;
  const eitherSideHasInjuries = awayHasInjuries || homeHasInjuries;

  return (
    <GameSection>
      <h2 className="text-center font-semibold text-c3">
        Injury report
      </h2>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <InjuryColumn
          team={detail.away}
          injuries={injuries.away}
          showEmptyPlaceholder={eitherSideHasInjuries && !awayHasInjuries}
        />
        <InjuryColumn
          team={detail.home}
          injuries={injuries.home}
          showEmptyPlaceholder={eitherSideHasInjuries && !homeHasInjuries}
        />
      </div>
    </GameSection>
  );
}
