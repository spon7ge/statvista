import type { ReactNode } from "react";
import { Calendar, Landmark, TvMinimalPlay } from "lucide-react";
import { GameSection } from "@/shared/ui/GameSection";
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

function InfoRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-white/50">{icon}</div>
      <div className="min-w-0 space-y-0.5">{children}</div>
    </div>
  );
}

function WhistleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 14a4 4 0 1 1 8 0v2H8v-2z" />
      <path d="M10 14V9a2 2 0 1 1 4 0v5" />
      <path d="M9 18h6" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
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
    <GameSection className="!p-3" data-testid="wnba-game-info">
      <h2 className="text-[18px] font-semibold text-white">Game Info</h2>

      <div className="mt-4 space-y-4">
        {showDate ? (
          <InfoRow icon={<Calendar className="size-4" aria-hidden="true" />}>
            <p className="text-sm text-white">
              {formatWnbaGameDate(detail.gameDate!)}
            </p>
          </InfoRow>
        ) : null}

        {showBroadcast ? (
          <InfoRow icon={<TvMinimalPlay className="size-4" aria-hidden="true" />}>
            <p className="text-sm text-white">{broadcast}</p>
          </InfoRow>
        ) : null}

        {showVenue ? (
          <InfoRow icon={<Landmark className="size-4" aria-hidden="true" />}>
            {venue ? <p className="text-sm text-white">{venue}</p> : null}
            {venueLocation ? (
              <p className="text-sm text-white/50">{venueLocation}</p>
            ) : null}
          </InfoRow>
        ) : null}

        {showOfficials ? (
          <InfoRow icon={<WhistleIcon />}>
            <div className="space-y-1">
              {detail.officials!.map((official, index) => (
                <p
                  key={`${official.order}-${official.name}`}
                  className="text-sm text-white"
                >
                  {index === 0
                    ? `${official.name} (Head Official)`
                    : official.name}
                </p>
              ))}
            </div>
          </InfoRow>
        ) : null}
      </div>
    </GameSection>
  );
}
