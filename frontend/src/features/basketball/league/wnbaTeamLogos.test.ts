import { describe, expect, it } from "vitest";
import { wnbaTeamLogoUrl } from "./wnbaTeamLogos";

describe("wnbaTeamLogoUrl", () => {
  it("maps ESPN and Stats tricodes to espncdn logos", () => {
    expect(wnbaTeamLogoUrl("LVA")).toBe(
      "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png",
    );
    expect(wnbaTeamLogoUrl("lv")).toBe(
      "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png",
    );
    expect(wnbaTeamLogoUrl("NYL")).toBe(
      "https://a.espncdn.com/i/teamlogos/wnba/500/ny.png",
    );
    expect(wnbaTeamLogoUrl("PHX")).toBe(
      "https://a.espncdn.com/i/teamlogos/wnba/500/phx.png",
    );
  });

  it("returns null for unknown abbrevs", () => {
    expect(wnbaTeamLogoUrl("XYZ")).toBeNull();
    expect(wnbaTeamLogoUrl("")).toBeNull();
  });
});
