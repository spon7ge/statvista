import { GameSection } from "@/shared/ui/GameSection";
import {
  GameInfoBroadcastIcon,
  GameInfoCalendarIcon,
  GameInfoOfficialsIcon,
  GameInfoVenueIcon,
} from "@/shared/ui/GameInfoIcons";
import type { GameDetail } from "../lib/types";
import {
  formatVenueLocation,
  formatWnbaGameDate,
} from "./WnbaGameInfo";

export function NbaGameInfo({ detail }: { detail: GameDetail }) {
  const venue = detail.venue?.trim() || null;
  const location = formatVenueLocation(detail.venueCity, detail.venueState);
  const broadcast = detail.broadcast?.trim() || null;

  return (
    <GameSection data-testid="nba-game-info">
      <h3 className="mb-[9px] font-semibold">Game Info</h3>
      <div className="space-y-[13px]">
        {detail.gameDate ? (
          <p className="flex items-center gap-[6px]">
            <GameInfoCalendarIcon />
            {formatWnbaGameDate(detail.gameDate)}
          </p>
        ) : null}
        {broadcast ? (
          <p className="flex items-center gap-[6px]">
            <GameInfoBroadcastIcon />
            {broadcast}
          </p>
        ) : null}
        {venue || location ? (
          <div>
            <p className="flex items-center gap-[6px]">
              <GameInfoVenueIcon />
              {venue ?? location}
            </p>
            {venue && location ? (
              <p className="ml-[29px] text-sm text-c3">{location}</p>
            ) : null}
          </div>
        ) : null}
        {detail.officials?.length ? (
          <div className="flex gap-[6px]">
            <GameInfoOfficialsIcon />
            <div>
              {detail.officials.map((official, index) => (
                <p key={`${official.order}-${official.name}`}>
                  {index === 0
                    ? `${official.name} (Head Official)`
                    : official.name}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </GameSection>
  );
}
