import { describe, expect, it } from "vitest";

import { resolveMlbTeamColor, teamColor } from "./mlbTeamColors";

describe("teamColor", () => {
  it("uses canonical and legacy Arizona aliases", () => {
    expect(teamColor("ARI")).toBe("#A71930");
    expect(teamColor("AZ")).toBe("#A71930");
  });

  it("uses canonical and legacy Athletics aliases", () => {
    expect(teamColor("ATH")).toBe("#003831");
    expect(teamColor("OAK")).toBe("#003831");
  });

  it("uses official primary colors (not secondary accents)", () => {
    expect(teamColor("CLE")).toBe("#00385D");
    expect(teamColor("DET")).toBe("#0C2340");
    expect(teamColor("HOU")).toBe("#002D62");
    expect(teamColor("MIL")).toBe("#12284B");
    expect(teamColor("NYM")).toBe("#002D72");
    expect(teamColor("NYY")).toBe("#0C2340");
    expect(teamColor("TB")).toBe("#092C5C");
  });
});

describe("resolveMlbTeamColor", () => {
  it("prefers the primary palette over API fallback colors", () => {
    expect(resolveMlbTeamColor("LAD", "#1D4ED8")).toBe("#005A9C");
  });

  it("keeps the provided fallback for unknown abbrevs", () => {
    expect(resolveMlbTeamColor("XXX", "#ABCDEF")).toBe("#ABCDEF");
  });
});
