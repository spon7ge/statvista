import { GameSection } from "@/shared/ui/GameSection";
import {
  GameInfoCalendarIcon,
  GameInfoCloudIcon,
  GameInfoOfficialsIcon,
  GameInfoVenueIcon,
  GameInfoWindIcon,
} from "@/shared/ui/GameInfoIcons";
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
    <GameSection data-testid="mlb-game-info">
      <h3 className="mb-[9px] font-semibold">Game Info</h3>

      <div className="space-y-[13px]">
        {showDate ? (
          <div className="flex items-center gap-[6px]">
            <GameInfoCalendarIcon />
            {formatMlbGameDate(detail.gameDate!)}
          </div>
        ) : null}

        {showVenue ? (
          <div>
            {detail.venue?.trim() ? (
              <p className="flex items-center gap-[6px]">
                <GameInfoVenueIcon />
                {detail.venue.trim()}
              </p>
            ) : venueLocation ? (
              <p className="flex items-center gap-[6px]">
                <GameInfoVenueIcon />
                {venueLocation}
              </p>
            ) : null}
            {detail.venue?.trim() && venueLocation ? (
              <p className="ml-[29px] text-sm text-c3">{venueLocation}</p>
            ) : null}
          </div>
        ) : null}

        {showWeather ? (
          <div className="flex gap-[13px]">
            {detail.weather?.tempF?.trim() ? (
              <p className="flex items-center gap-[6px]">
                <GameInfoCloudIcon />
                {`${detail.weather.tempF.trim()}°`}
              </p>
            ) : null}
            {detail.weather?.wind?.trim() ? (
              <p className="flex items-center gap-[6px]">
                <GameInfoWindIcon />
                {detail.weather.wind.trim()}
              </p>
            ) : null}
          </div>
        ) : null}

        {showUmpires ? (
          <div className="flex gap-[6px]">
            <GameInfoOfficialsIcon />
            <div>
              {UMPIRE_LINES.map(({ key, label }) => {
                const name = detail.umpires?.[key]?.trim();
                if (!name) return null;
                return (
                  <p key={key}>
                    <span className="text-c3">{`${label}: `}</span>
                    {name}
                  </p>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </GameSection>
  );
}
