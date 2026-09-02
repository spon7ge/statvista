/** Flat game-flow strokes. Glow and neon are banned. */
export function shouldNeonGameFlow(status: string): boolean {
  return status === "live" || status === "halftime" || status === "final";
}

export const FLOW_HOME = "var(--c4)";
export const FLOW_AWAY = "var(--c3)";
export const FLOW_MUTED = "var(--text-muted)";
export const FLOW_RULE = "var(--border-color)";
