import { GameSection } from "@/shared/ui/GameSection";
import type {
  MlbGameDetailTeam,
  MlbGameDetailView,
  MlbInjury,
} from "../lib/types";

type MlbInjuryReportProps = {
  detail: MlbGameDetailView;
};

function InjuryRow({
  injury,
  align,
}: {
  injury: MlbInjury;
  align: "left" | "right";
}) {
  return (
    <li
      className={`text-sm text-white/80 ${align === "right" ? "text-right" : ""}`}
    >
      <div
        className={`flex items-baseline gap-1.5 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span>{injury.name}</span>
        {injury.position ? (
          <span className="text-white/50">{injury.position}</span>
        ) : null}
      </div>
      <div className="mt-0.5 text-xs">
        <span className="font-medium text-white">{injury.status}</span>
        {injury.detail ? (
          <span className="text-white/50">{` · ${injury.detail}`}</span>
        ) : null}
      </div>
    </li>
  );
}

function TeamMark({
  team,
  align,
}: {
  team: MlbGameDetailTeam;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          className="size-5 object-contain"
        />
      ) : null}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-white">
        {team.abbrev}
      </h3>
    </div>
  );
}

function InjuryColumn({
  injuries,
  showEmptyPlaceholder,
  align,
}: {
  injuries: MlbInjury[];
  showEmptyPlaceholder: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "flex flex-col items-end" : undefined}>
      {injuries.length > 0 ? (
        <ul className="space-y-2">
          {injuries.map((injury) => (
            <InjuryRow key={injury.name} injury={injury} align={align} />
          ))}
        </ul>
      ) : showEmptyPlaceholder ? (
        <p className="text-sm text-white/40">None listed</p>
      ) : null}
    </div>
  );
}

export function MlbInjuryReport({ detail }: MlbInjuryReportProps) {
  const injuries = detail.injuries;

  if (!injuries) {
    return null;
  }

  const awayHasInjuries = injuries.away.length > 0;
  const homeHasInjuries = injuries.home.length > 0;
  const eitherSideHasInjuries = awayHasInjuries || homeHasInjuries;

  return (
    <GameSection
      data-testid="mlb-injury-report"
      className="w-full !p-3"
    >
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3">
        <TeamMark team={detail.away} align="left" />
        <h2 className="text-center text-[18px] font-semibold text-white">
          Injuries
        </h2>
        <TeamMark team={detail.home} align="right" />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-3">
        <InjuryColumn
          injuries={injuries.away}
          showEmptyPlaceholder={eitherSideHasInjuries && !awayHasInjuries}
          align="left"
        />
        <div aria-hidden="true" />
        <InjuryColumn
          injuries={injuries.home}
          showEmptyPlaceholder={eitherSideHasInjuries && !homeHasInjuries}
          align="right"
        />
      </div>
    </GameSection>
  );
}
