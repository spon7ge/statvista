import { GameSection } from "@/shared/ui/GameSection";
import {
  GameInfoBroadcastIcon,
  GameInfoCalendarIcon,
  GameInfoOfficialsIcon,
  GameInfoVenueIcon,
} from "@/shared/ui/GameInfoIcons";
import type { GameDetail, GameDetailOfficial } from "../lib/types";

/** Format YYYY-MM-DD as a calendar date without UTC timezone shift. */
export function formatWnbaGameDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export function formatVenueLocation(
  city: string | null,
  state: string | null,
): string | null {
  const cityPart = city?.trim() || null;
  const stateRaw = state?.trim() || null;
  const statePart = stateRaw
    ? (US_STATE_NAMES[stateRaw.toUpperCase()] ?? stateRaw)
    : null;
  const parts = [cityPart, statePart].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function hasOfficials(
  officials: GameDetailOfficial[] | null,
): officials is GameDetailOfficial[] {
  return Boolean(officials?.length);
}

export function WnbaGameInfo({ detail }: { detail: GameDetail }) {
  const venue = detail.venue?.trim() || null;
  const venueLocation = formatVenueLocation(detail.venueCity, detail.venueState);
  const broadcast = detail.broadcast?.trim() || null;
  const showDate = Boolean(detail.gameDate);
  const showBroadcast = Boolean(broadcast);
  const showVenue = Boolean(venue || venueLocation);
  const showOfficials = hasOfficials(detail.officials);

  return (
    <GameSection data-testid="wnba-game-info">
      <h3 className="mb-[9px] font-semibold">Game Info</h3>

      <div className="space-y-[13px]">
        {showDate ? (
          <div className="flex items-center gap-[6px]">
            <GameInfoCalendarIcon />
            {formatWnbaGameDate(detail.gameDate!)}
          </div>
        ) : null}

        {showBroadcast ? (
          <p className="flex items-center gap-[6px]">
            <GameInfoBroadcastIcon />
            {broadcast}
          </p>
        ) : null}

        {showVenue ? (
          <div>
            {venue ? (
              <p className="flex items-center gap-[6px]">
                <GameInfoVenueIcon />
                {venue}
              </p>
            ) : venueLocation ? (
              <p className="flex items-center gap-[6px]">
                <GameInfoVenueIcon />
                {venueLocation}
              </p>
            ) : null}
            {venue && venueLocation ? (
              <p className="ml-[29px] text-sm text-c3">{venueLocation}</p>
            ) : null}
          </div>
        ) : null}

        {showOfficials ? (
          <div className="flex gap-[6px]">
            <GameInfoOfficialsIcon />
            <div>
              {detail.officials!.map((official, index) => (
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
