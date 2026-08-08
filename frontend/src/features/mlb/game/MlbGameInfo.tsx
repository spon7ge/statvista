import type { ReactNode } from "react";
import { Building2, Calendar, Cloud, Wind } from "lucide-react";
import type {
  MlbGameDetailView,
  MlbGameUmpires,
  MlbGameWeather,
} from "../lib/types";

type MlbGameInfoProps = {
  detail: MlbGameDetailView;
};

/** Format YYYY-MM-DD as a calendar date without UTC timezone shift. */
export function formatMlbGameDate(isoDate: string): string {
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

function formatVenueLocation(city: string | null, state: string | null): string | null {
  const parts = [city?.trim(), state?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function hasWeather(weather: MlbGameWeather | null): weather is MlbGameWeather {
  if (!weather) return false;
  return Boolean(weather.tempF?.trim() || weather.wind?.trim());
}

function hasUmpires(umpires: MlbGameUmpires | null): umpires is MlbGameUmpires {
  if (!umpires) return false;
  return Boolean(
    umpires.homePlate?.trim() ||
      umpires.firstBase?.trim() ||
      umpires.secondBase?.trim() ||
      umpires.thirdBase?.trim(),
  );
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

function UmpireMaskIcon() {
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
      <path d="M12 3c-3.5 0-6 2.2-6 5.5v3c0 3.3 2.5 5.5 6 5.5s6-2.2 6-5.5v-3C18 5.2 15.5 3 12 3z" />
      <path d="M8 9.5h8" />
      <path d="M9.5 13h5" />
    </svg>
  );
}

const UMPIRE_LINES: {
  key: keyof MlbGameUmpires;
  label: string;
}[] = [
  { key: "homePlate", label: "Home Plate" },
  { key: "firstBase", label: "First Base" },
  { key: "secondBase", label: "Second Base" },
  { key: "thirdBase", label: "Third Base" },
];

export function MlbGameInfo({ detail }: MlbGameInfoProps) {
  const venueLocation = formatVenueLocation(detail.venueCity, detail.venueState);
  const showDate = Boolean(detail.gameDate);
  const showVenue = Boolean(detail.venue?.trim() || venueLocation);
  const showWeather = hasWeather(detail.weather);
  const showUmpires = hasUmpires(detail.umpires);

  return (
    <section
      data-testid="mlb-game-info"
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
    >
      <h2 className="text-base font-semibold text-white">Game Info</h2>

      <div className="mt-4 space-y-4">
        {showDate ? (
          <InfoRow icon={<Calendar className="size-4" aria-hidden="true" />}>
            <p className="text-sm text-white">
              {formatMlbGameDate(detail.gameDate!)}
            </p>
          </InfoRow>
        ) : null}

        {showVenue ? (
          <InfoRow icon={<Building2 className="size-4" aria-hidden="true" />}>
            {detail.venue?.trim() ? (
              <p className="text-sm text-white">{detail.venue.trim()}</p>
            ) : null}
            {venueLocation ? (
              <p className="text-sm text-white/50">{venueLocation}</p>
            ) : null}
          </InfoRow>
        ) : null}

        {showWeather ? (
          <InfoRow icon={<Cloud className="size-4" aria-hidden="true" />}>
            {detail.weather?.tempF?.trim() ? (
              <p className="text-sm text-white">{`${detail.weather.tempF.trim()}°`}</p>
            ) : null}
            {detail.weather?.wind?.trim() ? (
              <div className="flex items-center gap-2 text-sm text-white">
                <Wind className="size-3.5 shrink-0 text-white/50" aria-hidden="true" />
                <span>{detail.weather.wind.trim()}</span>
              </div>
            ) : null}
          </InfoRow>
        ) : null}

        {showUmpires ? (
          <InfoRow icon={<UmpireMaskIcon />}>
            <div className="space-y-1">
              {UMPIRE_LINES.map(({ key, label }) => {
                const name = detail.umpires?.[key]?.trim();
                if (!name) return null;
                return (
                  <p key={key} className="text-sm">
                    <span className="text-white/50">{`${label}: `}</span>
                    <span className="text-white">{name}</span>
                  </p>
                );
              })}
            </div>
          </InfoRow>
        ) : null}
      </div>
    </section>
  );
}
