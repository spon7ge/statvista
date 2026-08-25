import { describe, expect, it } from "vitest";
import { neonGlowColor } from "./neonGlowColor";

describe("neonGlowColor", () => {
  it("brightens a dark team hex so the halo is visible on a dark chart", () => {
    const glow = neonGlowColor("#37004D");
    expect(glow).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(glow.toUpperCase()).not.toBe("#37004D");
  });

  it("keeps a already-bright team hex in a saturated neon range", () => {
    const glow = neonGlowColor("#E31837");
    expect(glow).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns the input when the value is not a hex color", () => {
    expect(neonGlowColor("navy")).toBe("navy");
  });
});
