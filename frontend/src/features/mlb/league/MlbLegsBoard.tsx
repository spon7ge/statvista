import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMlbLegs } from "@/features/mlb/hooks/useMlbLegs";
import { bookDisplayName } from "@/features/mlb/lib/mlbBookLabels";
import type { ApiMlbLegsPlay, ApiMlbLegsResponse } from "@/shared/lib/api";
import {
  EXAMPLE_LAYOUT_BANNER,
  mlbLegsExampleEnvelope,
} from "./mlbLegsExample";

type LegsApp = "prizepicks" | "underdog";
type LegsFormat = "power" | "flex" | "standard";

const APP_TABS: { id: LegsApp; label: string }[] = [
  { id: "prizepicks", label: "PrizePicks" },
  { id: "underdog", label: "Underdog" },
];

const POWER_UD_SIZES = [2, 3, 4, 5, 6] as const;

const CHIP =
  "inline-flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-[14px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white";

function chipClass(on: boolean): string {
  return on
    ? `${CHIP} border-white text-white`
    : `${CHIP} border-white/15 text-white/50 hover:text-white/80`;
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

function formatGeneratedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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
  data: ApiMlbLegsResponse | undefined,
): data is ApiMlbLegsResponse {
  return Array.isArray(data?.entries);
}

function emptyCopy(
  data: ApiMlbLegsResponse | undefined,
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

function selectionSearch(
  next: { app: LegsApp; format: LegsFormat; legs: number },
  example: boolean,
): URLSearchParams {
  const params = new URLSearchParams({
    app: next.app,
    format: next.format,
    legs: String(next.legs),
  });
  if (example) params.set("example", "1");
  return params;
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
  const side = leg.side === "over" ? "Over" : "Under";
  const margin =
    leg.margin_pts >= 0
      ? `+${leg.margin_pts.toFixed(1)}`
      : leg.margin_pts.toFixed(1);
  const anchor =
    leg.sharp_anchor === "pinnacle" ? "Pinnacle" : "exchange only";

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.04]">
      <details>
        <summary className="cursor-pointer list-none px-4 py-3 text-[18px] text-white marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">
            {leg.player}
            <span className="font-normal text-white/55"> · {leg.matchup}</span>
          </span>
          <span className="mt-1 block text-[14px] text-white/70">
            {leg.market} {leg.dfs_line} {side} {pct(leg.fair_prob)} {margin}
          </span>
        </summary>
        <div className="space-y-2 border-t border-white/10 px-4 py-3 text-[14px] text-white/70">
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

/** PrizePicks / Underdog controls, chrome, and complete N-pick entries for MLB Legs. */
export function MlbLegsBoard() {
  const [params, setSearchParams] = useSearchParams();
  const { app, format, legs } = parseSelection(params);
  const exampleMode = params.get("example") === "1";
  const { data, isLoading, isError } = useMlbLegs({ app, format, legs });

  useEffect(() => {
    const next = selectionSearch({ app, format, legs }, exampleMode);
    if (
      params.get("app") !== app ||
      params.get("format") !== format ||
      params.get("legs") !== String(legs) ||
      (params.get("example") === "1") !== exampleMode
    ) {
      setSearchParams(next, { replace: true });
    }
  }, [app, format, legs, exampleMode, params, setSearchParams]);

  function write(next: { app: LegsApp; format: LegsFormat; legs: number }) {
    setSearchParams(selectionSearch(next, exampleMode), { replace: true });
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
  const liveEnvelope = isLegsEnvelope(data) ? data : undefined;
  const envelope = exampleMode
    ? mlbLegsExampleEnvelope({ app, format, legs })
    : liveEnvelope;
  const showLoading = !exampleMode && isLoading && !envelope;
  const showError = !exampleMode && isError && !envelope;
  const emptyMessage = emptyCopy(envelope, app, legs);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="DFS app"
        className="flex items-center justify-center gap-1 border-b border-white/10"
      >
        {APP_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`mlb-legs-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={app === tab.id}
            aria-controls={`mlb-legs-${tab.id}-panel`}
            className={`border-b-2 px-5 py-2 text-[18px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              app === tab.id
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
            onClick={() => onAppChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`mlb-legs-${app}-panel`}
        role="tabpanel"
        aria-labelledby={`mlb-legs-${app}-tab`}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="radiogroup"
            aria-label="Format"
            className="flex flex-wrap items-center gap-1"
          >
            {formatOptionsFor(app).map((option) => (
              <RadioChip
                key={option}
                name="mlb-legs-format"
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
                name="mlb-legs-size"
                value={String(n)}
                checked={legs === n}
                onChange={() => write({ app, format, legs: n })}
              >
                {`${n}-pick`}
              </RadioChip>
            ))}
          </div>
        </div>

        <p className="text-[14px] text-white/50">
          Recommended entries for this size. Research only — not a lock.
        </p>

        {exampleMode ? (
          <p className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[14px] text-white/70">
            {EXAMPLE_LAYOUT_BANNER}
          </p>
        ) : null}

        {envelope ? (
          <div className="space-y-2">
            <p className="text-[18px] font-medium text-white">
              Generated {formatGeneratedAt(envelope.generated_at)}
            </p>
            <p className="text-[14px] text-white/50">
              Assumed payouts · base required margin{" "}
              {envelope.base_required_margin_pts.toFixed(1)} pts
            </p>
            <BreakEvenChrome app={app} data={envelope} format={format} />
          </div>
        ) : null}

        {showLoading ? (
          <p className="text-[18px] text-white/50" role="status">
            Loading priced legs…
          </p>
        ) : null}
        {showError ? (
          <p className="text-[18px] text-white/50" role="status">
            Could not load priced legs.
          </p>
        ) : null}
        {emptyMessage && !showLoading && !showError ? (
          <p className="text-[18px] text-white/50">{emptyMessage}</p>
        ) : null}

        {(envelope?.entries ?? []).map((entry) => (
          <section key={entry.rank} aria-label={`Entry ${entry.rank}`}>
            <h2 className="text-[18px] font-medium text-white">
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

function BreakEvenChrome({
  app,
  data,
  format,
}: {
  app: LegsApp;
  data: ApiMlbLegsResponse;
  format: LegsFormat;
}) {
  const tableBe = pct(data.base_break_even);
  let beLine: string;
  if (app === "underdog") {
    if (data.break_even_min != null && data.break_even_max != null) {
      beLine =
        data.break_even_min === data.break_even_max
          ? `PLAY break-even ${pct(data.break_even_min)}`
          : `PLAY break-even ${pct(data.break_even_min)}–${pct(data.break_even_max)}`;
    } else {
      beLine = `Break-even ${tableBe}`;
    }
  } else {
    beLine = `Break-even ${tableBe}`;
  }

  let note: string;
  if (app === "underdog") {
    note =
      "2-pick is the hardest Underdog entry. 4-pick is harder than 3-pick. Complete entries for this size — not a parlay.";
  } else if (format === "flex") {
    note =
      "54.2% is the break-even for an independent 6-leg Flex entry.";
  } else {
    note =
      "3-pick Power is the hardest PrizePicks Power. Complete entries for this size — not a parlay.";
  }

  return (
    <>
      <p className="text-[14px] text-white/50">{beLine}</p>
      <p className="text-[14px] text-white/50">{note}</p>
    </>
  );
}
