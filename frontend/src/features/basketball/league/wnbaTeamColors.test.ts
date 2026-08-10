import { describe, expect, it } from "vitest";

import { resolveWnbaTeamColor, teamColor } from "./wnbaTeamColors";

describe("teamColor", () => {
  it("uses official primary colors", () => {
    expect(teamColor("ATL")).toBe("#E31837");
    expect(teamColor("CON")).toBe("#E03A3E");
    expect(teamColor("GSV")).toBe("#37004D");
    expect(teamColor("IND")).toBe("#E03A3E");
    expect(teamColor("NYL")).toBe("#86CEBC");
    expect(teamColor("PHO")).toBe("#201747");
    expect(teamColor("WAS")).toBe("#0C2340");
  });

  it("supports ESPN abbrev aliases", () => {
    expect(teamColor("GS")).toBe("#37004D");
    expect(teamColor("PHX")).toBe("#201747");
    expect(teamColor("LV")).toBe("#C8102E");
    expect(teamColor("LVA")).toBe("#C8102E");
    expect(teamColor("LAS")).toBe("#552583");
  });
});

describe("resolveWnbaTeamColor", () => {
  it("prefers the primary palette over ESPN secondary accents", () => {
    expect(resolveWnbaTeamColor("PHX", "#E56020")).toBe("#201747");
    expect(resolveWnbaTeamColor("GS", "#553987")).toBe("#37004D");
  });

  it("keeps the provided fallback for unknown abbrevs", () => {
    expect(resolveWnbaTeamColor("XXX", "#ABCDEF")).toBe("#ABCDEF");
  });
});
