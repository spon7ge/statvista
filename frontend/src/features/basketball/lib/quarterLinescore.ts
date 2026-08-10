import type { GameDetail } from "./types";

export type QuarterLinescoreRow = {
  period: number;
  away: number;
  home: number;
};

export type QuarterLinescore = {
  periods: QuarterLinescoreRow[];
  awayTotal: number;
  homeTotal: number;
};

/** Derive per-period scoring deltas from cumulative play scores (scoring plays only). */
export function deriveQuarterLinescore(
  plays: GameDetail["plays"],
  awayTotal: number | null,
  homeTotal: number | null,
): QuarterLinescore | null {
  const scoringPlays = plays.filter((play) => play.scoring);
  if (scoringPlays.length === 0) {
    return null;
  }

  // API delivers plays newest-first; derive deltas in chronological order.
  const chronological = [...scoringPlays].reverse();

  const periods: QuarterLinescoreRow[] = [];
  let prevAway = 0;
  let prevHome = 0;
  let periodEndAway = 0;
  let periodEndHome = 0;
  let currentPeriod = chronological[0].period;

  for (const play of chronological) {
    if (play.period !== currentPeriod) {
      periods.push({
        period: currentPeriod,
        away: periodEndAway - prevAway,
        home: periodEndHome - prevHome,
      });
      prevAway = periodEndAway;
      prevHome = periodEndHome;
      currentPeriod = play.period;
    }
    periodEndAway = play.awayScore;
    periodEndHome = play.homeScore;
  }

  periods.push({
    period: currentPeriod,
    away: periodEndAway - prevAway,
    home: periodEndHome - prevHome,
  });

  const lastPlay = chronological[chronological.length - 1];

  return {
    periods,
    awayTotal: awayTotal ?? lastPlay.awayScore,
    homeTotal: homeTotal ?? lastPlay.homeScore,
  };
}
