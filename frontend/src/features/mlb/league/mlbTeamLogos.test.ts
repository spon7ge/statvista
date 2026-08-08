import { describe, expect, it } from "vitest";
import { mlbTeamLogoUrl } from "./mlbTeamLogos";

describe("mlbTeamLogoUrl", () => {
  it("maps NYY to mlbstatic team logo", () => {
    expect(mlbTeamLogoUrl("NYY")).toBe(
      "https://www.mlbstatic.com/team-logos/147.svg",
    );
  });

  it("aliases AZ and ATH", () => {
    expect(mlbTeamLogoUrl("AZ")).toBe(
      "https://www.mlbstatic.com/team-logos/109.svg",
    );
    expect(mlbTeamLogoUrl("ATH")).toBe(
      "https://www.mlbstatic.com/team-logos/133.svg",
    );
  });

  it("returns null for unknown abbrevs", () => {
    expect(mlbTeamLogoUrl("XXX")).toBeNull();
  });
});
