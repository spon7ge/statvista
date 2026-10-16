import { describe, expect, it } from "vitest";
import {
  LANDING_HREF,
  NAV_LEAGUES,
  activeLeagueFromPath,
  homeMatchupsHref,
  homePropsHref,
  isActiveSection,
  orderedNavLeagues,
  sectionHref,
} from "./appNav";

describe("activeLeagueFromPath", () => {
  it("returns null on the landing redirect path", () => {
    expect(activeLeagueFromPath("/")).toBeNull();
  });

  it("matches league prefixes", () => {
    expect(activeLeagueFromPath("/nba/matchups")).toBe("nba");
    expect(activeLeagueFromPath("/wnba/prop_picks")).toBe("wnba");
    expect(activeLeagueFromPath("/mlb/games/9")).toBe("mlb");
  });

  it("treats /games/:id as WNBA", () => {
    expect(activeLeagueFromPath("/games/401857098")).toBe("wnba");
  });
});

describe("orderedNavLeagues", () => {
  it("lists MLB, WNBA, then NBA", () => {
    expect(orderedNavLeagues().map((l) => l.id)).toEqual(["mlb", "wnba", "nba"]);
  });
});

describe("NAV_LEAGUES", () => {
  it("lists NBA, WNBA, MLB with matchups hrefs", () => {
    expect(NAV_LEAGUES.map((l) => l.id)).toEqual(["nba", "wnba", "mlb"]);
    expect(NAV_LEAGUES[0]?.href).toBe("/nba/matchups");
    expect(NAV_LEAGUES[1]?.href).toBe("/wnba/matchups");
    expect(NAV_LEAGUES[2]?.href).toBe("/mlb/matchups");
    expect(NAV_LEAGUES[0]?.icon).toMatch(/nba_logo/);
    expect(NAV_LEAGUES[1]?.icon).toMatch(/wnba_logo/);
    expect(NAV_LEAGUES[2]?.icon).toBe(
      "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
    );
  });
});

describe("LANDING_HREF", () => {
  it("sends new sessions to MLB matchups", () => {
    expect(LANDING_HREF).toBe("/mlb/matchups");
  });
});

describe("sectionHref", () => {
  it("returns live hrefs for WNBA Props and Games", () => {
    expect(sectionHref("wnba", "Games")).toBe("/wnba/matchups");
    expect(sectionHref("wnba", "Props")).toBe("/wnba/prop_picks");
  });

  it("returns MLB Props href", () => {
    expect(sectionHref("mlb", "Props")).toBe("/mlb/prop_picks");
  });

  it("disables NBA props", () => {
    expect(sectionHref("nba", "Games")).toBe("/nba/matchups");
    expect(sectionHref("nba", "Props")).toBeNull();
  });
});

describe("homePropsHref", () => {
  it("defaults to MLB and follows the current league when it has a board", () => {
    expect(homePropsHref("/")).toBe("/mlb/prop_picks");
    expect(homePropsHref("/mlb/matchups")).toBe("/mlb/prop_picks");
    expect(homePropsHref("/wnba/matchups")).toBe("/wnba/prop_picks");
    expect(homePropsHref("/nba/matchups")).toBe("/mlb/prop_picks");
  });
});

describe("homeMatchupsHref", () => {
  it("defaults to MLB and follows the current league including NBA", () => {
    expect(homeMatchupsHref("/")).toBe("/mlb/matchups");
    expect(homeMatchupsHref("/mlb/prop_picks")).toBe("/mlb/matchups");
    expect(homeMatchupsHref("/wnba/prop_picks")).toBe("/wnba/matchups");
    expect(homeMatchupsHref("/nba/matchups")).toBe("/nba/matchups");
  });
});

describe("isActiveSection", () => {
  it("marks Props and Games from the path", () => {
    expect(isActiveSection("/wnba/matchups", "Games")).toBe(true);
    expect(isActiveSection("/wnba/prop_picks", "Props")).toBe(true);
    expect(isActiveSection("/mlb/prop_picks/player/aaron-judge", "Props")).toBe(
      true,
    );
    expect(isActiveSection("/wnba/prop_picks", "Games")).toBe(false);
  });
});
