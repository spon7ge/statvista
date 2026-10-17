import { useEffect, useState } from "react";

type PregamePropRow = {
  game_start_at?: string | null;
  game_id?: string | null;
  game_pk?: number | null;
};

function rowOnSlate(row: PregamePropRow): boolean {
  if (row.game_start_at) return true;
  if (row.game_id) return true;
  return row.game_pk != null;
}

/**
 * Board responses stay cached for 15 minutes, so an open Props page has to
 * drop a row when its listed tip passes without waiting for the next fetch.
 */
const PREGAME_CLOCK_MS = 30_000;

export function excludeStartedPropRows<T extends PregamePropRow>(
  rows: T[],
  now: Date,
): T[] {
  const slateKnown = rows.some(rowOnSlate);
  const nowMs = now.getTime();
  return rows.filter((row) => {
    if (slateKnown && !rowOnSlate(row)) return false;
    if (!row.game_start_at) return true;
    const start = Date.parse(row.game_start_at);
    if (Number.isNaN(start)) return true;
    return start > nowMs;
  });
}

export function usePregameNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), PREGAME_CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
