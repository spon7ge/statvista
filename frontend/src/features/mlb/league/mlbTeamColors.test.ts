import { describe, expect, it } from "vitest";

import { teamColor } from "./mlbTeamColors";

describe("teamColor", () => {
  it("uses canonical and legacy Arizona aliases", () => {
    expect(teamColor("ARI")).toBe("#A71930");
    expect(teamColor("AZ")).toBe("#A71930");
  });

  it("uses canonical and legacy Athletics aliases", () => {
    expect(teamColor("ATH")).toBe("#003831");
    expect(teamColor("OAK")).toBe("#003831");
  });
});
