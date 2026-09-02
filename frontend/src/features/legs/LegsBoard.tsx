import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { bookDisplayName } from "@/features/mlb/lib/mlbBookLabels";
import type {
  ApiLegsResponse,
  ApiMlbLegsPlay,
  LegsParams,
} from "@/shared/lib/api";

type LegsApp = "prizepicks" | "underdog";
type LegsFormat = "power" | "flex" | "standard";

type LegsQuery = {
  data: ApiLegsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
};

const APP_TABS: { id: LegsApp; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

const POWER_UD_SIZES = [2, 3, 4, 5, 6] as const;

const CHIP =
  "inline-flex cursor-pointer items-center rounded border px-3 py-1.5 text-[14px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white";

function chipClass(on: boolean): string {
  return on
    ? `${CHIP} border-c4 text-c3`
    : `${CHIP} border-line text-c3 hover:text-c3`;
}

function parseApp(value: string | null): LegsApp {
  return value === "underdog" ? "underdog" : "prizepicks";
}

function parseEntrySize(value: string | null): number {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 2 && n <= 6) return n;
  return 4;
}

function parseSelection(params: URLSearchParams): {
  app: LegsApp;
  format: LegsFormat;
  legs: number;
} {
  const app = parseApp(params.get("app"));
  const size = parseEntrySize(params.get("legs"));
  if (app === "underdog") {
    return { app, format: "standard", legs: size };
  }
  if (params.get("format") === "flex") {
    return { app, format: "flex", legs: 6 };
  }
  return { app, format: "power", legs: size };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatOptionsFor(app: LegsApp): LegsFormat[] {
  return app === "underdog" ? ["standard"] : ["power", "flex"];
}

function formatLabel(format: LegsFormat): string {
  if (format === "flex") return "Flex";
  if (format === "standard") return "Standard";
  return "Power";
}

function isLegsEnvelope(
  data: ApiLegsResponse | undefined,
): data is ApiLegsResponse {
  return Array.isArray(data?.entries);
}

function emptyCopy(
  data: ApiLegsResponse | undefined,
  app: LegsApp,
  legs: number,
): string | null {
  if (!isLegsEnvelope(data)) return null;
  if (data.warnings.includes("dfs_snapshot_stale")) {
    return "DFS snapshot is stale. PLAY is withheld until a fresher snapshot.";
  }
  if (
    data.lines_seeded === 0 ||
    data.warnings.includes("prizepicks_unavailable") ||
    data.warnings.includes("underdog_unavailable")
  ) {
    return app === "underdog"
      ? "No Underdog snapshot available."
      : "No PrizePicks snapshot available.";
  }
  if (data.entries.length === 0) {
    return `No complete ${legs}-pick entry for this format.`;
  }
  return null;
}

function selectionSearch(next: {
  app: LegsApp;
  format: LegsFormat;
  legs: number;
}): URLSearchParams {
  return new URLSearchParams({
    app: next.app,
    format: next.format,
    legs: String(next.legs),
  });
}

function RadioChip({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: string;
}) {
  return (
    <label className={chipClass(checked)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {children}
    </label>
  );
}

function PlayRow({ leg }: { leg: ApiMlbLegsPlay }) {
  const [imgFailed, setImgFailed] = useState(false);
  const side = leg.side === "over" ? "Over" : "Under";
  const margin =
    leg.margin_pts >= 0
      ? `+${leg.margin_pts.toFixed(1)}`
      : leg.margin_pts.toFixed(1);
  const anchor =
    leg.sharp_anchor === "pinnacle" ? "Pinnacle" : "exchange only";
  const showImg = Boolean(leg.headshot_url) && !imgFailed;
  const initial = (leg.player.trim()[0] ?? "?").toUpperCase();

  return (
    <li className="rounded border border-line bg-c2">
      <details>
        <summary className="cursor-pointer list-none px-4 py-4 text-c3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
          <div className="flex flex-col items-center text-center">
            {showImg ? (
              <img
                src={leg.headshot_url!}
                alt={leg.player}
                className="size-16 rounded-full bg-c2 object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-16 items-center justify-center rounded-full bg-c2 text-lg font-semibold text-c3"
              >
                {initial}
              </span>
            )}
            {leg.matchup ? (
              <p className="mt-2 text-[14px] text-c3">{leg.matchup}</p>
            ) : null}
            <p className="mt-1 text-[16px] font-semibold">{leg.player}</p>
            <p className="mt-1 text-[14px] text-c3">
              {leg.market} {leg.dfs_line} {side} {pct(leg.fair_prob)} {margin}
            </p>
          </div>
        </summary>
        <div className="space-y-2 border-t border-line px-4 py-3 text-[14px] text-c3">
          <p>Sharp anchor: {anchor}</p>
          <p>Effective required margin {leg.required_margin_pts.toFixed(1)} pts</p>
          {leg.books_used.length > 0 ? (
            <ul className="space-y-1">
              {leg.books_used.map((book) => (
                <li key={book.book}>
                  {bookDisplayName(book.book)} {book.line} Over {book.over} / Under{" "}
                  {book.under} {pct(book.devigged_prob)} hold {pct(book.hold)}{" "}
                  {book.devig} weight {book.weight}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/** PrizePicks / Underdog controls, chrome, and complete N-pick entries. */
export function LegsBoard({
  useLegs,
}: {
  useLegs: (params: LegsParams) => LegsQuery;
}) {
  const [params, setSearchParams] = useSearchParams();
  const { app, format, legs } = parseSelection(params);
  const { data, isLoading, isError } = useLegs({ app, format, legs });

  useEffect(() => {
    const next = selectionSearch({ app, format, legs });
    if (
      params.get("app") !== app ||
      params.get("format") !== format ||
      params.get("legs") !== String(legs) ||
      params.has("example")
    ) {
      setSearchParams(next, { replace: true });
    }
  }, [app, format, legs, params, setSearchParams]);

  function write(next: { app: LegsApp; format: LegsFormat; legs: number }) {
    setSearchParams(selectionSearch(next), { replace: true });
  }

  function onAppChange(next: LegsApp) {
    if (next === "underdog") {
      write({ app: next, format: "standard", legs });
      return;
    }
    write({
      app: next,
      format: format === "flex" ? "flex" : "power",
      legs: format === "flex" ? 6 : legs,
    });
  }

  function onFormatChange(next: LegsFormat) {
    write({
      app,
      format: next,
      legs: next === "flex" ? 6 : legs,
    });
  }

  const sizeOptions = format === "flex" ? ([6] as const) : POWER_UD_SIZES;
  const envelope = isLegsEnvelope(data) ? data : undefined;
  const showLoading = isLoading && !envelope;
  const showError = isError && !envelope;
  const emptyMessage = emptyCopy(envelope, app, legs);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="DFS app"
        className="flex items-center justify-center gap-1 border-b border-line"
      >
        {APP_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`legs-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={app === tab.id}
            aria-controls={`legs-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-[16px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              app === tab.id
                ? "border-c4 text-c3"
                : "border-transparent text-c3 hover:text-c3"
            }`}
            onClick={() => onAppChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`legs-${app}-panel`}
        role="tabpanel"
        aria-labelledby={`legs-${app}-tab`}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div
              role="radiogroup"
              aria-label="Format"
              className="flex flex-wrap items-center gap-1"
            >
              {formatOptionsFor(app).map((option) => (
                <RadioChip
                  key={option}
                  name="legs-format"
                  value={option}
                  checked={format === option}
                  onChange={() => onFormatChange(option)}
                >
                  {formatLabel(option)}
                </RadioChip>
              ))}
            </div>
            <div
              role="radiogroup"
              aria-label="Entry size"
              className="flex flex-wrap items-center gap-1"
            >
              {sizeOptions.map((n) => (
                <RadioChip
                  key={n}
                  name="legs-size"
                  value={String(n)}
                  checked={legs === n}
                  onChange={() => write({ app, format, legs: n })}
                >
                  {`${n}-pick`}
                </RadioChip>
              ))}
            </div>
          </div>
          {envelope ? (
            <p className="text-[14px] text-c3">
              breakeven: {pct(envelope.base_break_even)}
            </p>
          ) : null}
        </div>

        {showLoading ? (
          <p className="text-[16px] text-c3" role="status">
            Loading priced legs…
          </p>
        ) : null}
        {showError ? (
          <p className="text-[16px] text-c3" role="status">
            Could not load priced legs.
          </p>
        ) : null}
        {emptyMessage && !showLoading && !showError ? (
          <p className="text-[16px] text-c3">{emptyMessage}</p>
        ) : null}

        {(envelope?.entries ?? []).map((entry) => (
          <section key={entry.rank} aria-label={`Entry ${entry.rank}`}>
            <h2 className="text-[16px] font-medium text-c3">
              Entry {entry.rank}
            </h2>
            <ul className="space-y-2">
              {entry.legs.map((leg) => (
                <PlayRow
                  key={`${entry.rank}-${leg.rank}-${leg.player}-${leg.market}`}
                  leg={leg}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
