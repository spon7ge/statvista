/** Season-log advanced columns shared by NBA and WNBA preview surfaces. */

export const ROSTER_ADVANCED_COLUMNS = [
  { key: "usgPct", label: "USG%" },
  { key: "efgPct", label: "EFG%" },
  { key: "tsPct", label: "TS%" },
  { key: "astPct", label: "AST%" },
  { key: "astTo", label: "AST/TO" },
  { key: "orebPct", label: "OREB%" },
  { key: "drebPct", label: "DREB%" },
  { key: "rebPct", label: "REB%" },
  { key: "tovPct", label: "TOV%" },
  { key: "offRtg", label: "OFF" },
  { key: "defRtg", label: "DEF" },
  { key: "netRtg", label: "NET" },
  { key: "pie", label: "PIE" },
] as const;

export type RosterAdvancedKey = (typeof ROSTER_ADVANCED_COLUMNS)[number]["key"];

export const TEAM_ADVANCED_STATS = [
  { key: "efgPct", label: "EFG%", rankKey: "efgPctRank" },
  { key: "tsPct", label: "TS%", rankKey: "tsPctRank" },
  { key: "astPct", label: "AST%", rankKey: "astPctRank" },
  { key: "astTo", label: "AST/TO", rankKey: "astToRank" },
  { key: "orebPct", label: "OREB%", rankKey: "orebPctRank" },
  { key: "drebPct", label: "DREB%", rankKey: "drebPctRank" },
  { key: "rebPct", label: "REB%", rankKey: "rebPctRank" },
  { key: "tovPct", label: "TOV%", rankKey: "tovPctRank", lowerIsBetter: true },
  { key: "offRtg", label: "OFF", rankKey: "offRtgRank" },
  { key: "defRtg", label: "DEF", rankKey: "defRtgRank", lowerIsBetter: true },
  { key: "netRtg", label: "NET", rankKey: "netRtgRank" },
  { key: "pace", label: "PACE", rankKey: "paceRank" },
  { key: "pie", label: "PIE", rankKey: "pieRank" },
] as const;

export type TeamAdvancedStatKey = (typeof TEAM_ADVANCED_STATS)[number]["key"];
export type TeamAdvancedRankKey = (typeof TEAM_ADVANCED_STATS)[number]["rankKey"];
