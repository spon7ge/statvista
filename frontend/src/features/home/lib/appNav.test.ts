import { describe, expect, it } from "vitest";
import {
  NAV_LEAGUES,
  activeLeagueFromPath,
  isActiveSection,
  sectionHref,
  sectionsFor,
} from "./appNav";

describe("activeLeagueFromPath", () => {
  it("returns null on home", () => {
    expect(activeLeagueFromPath("/")).toBeNull();
  });

  it("matches league prefixes", () => {
    expect(activeLeagueFromPath("/nba/matchups")).toBe("nba");
    expect(activeLeagueFromPath("/wnba/leaders")).toBe("wnba");
    expect(activeLeagueFromPath("/mlb/games/9")).toBe("mlb");
  });

  it("treats /games/:id as WNBA", () => {
    expect(activeLeagueFromPath("/games/401857098")).toBe("wnba");
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

describe("sectionHref", () => {
  it("returns live hrefs for WNBA explore; chatbot is disabled", () => {
    expect(sectionHref("wnba", "Matchups")).toBe("/wnba/matchups");
    expect(sectionHref("wnba", "Props")).toBe("/wnba/prop_picks");
    expect(sectionHref("wnba", "Leaders")).toBe("/wnba/leaders");
    expect(sectionHref("wnba", "Standings")).toBe("/wnba/standings");
    expect(sectionHref("wnba", "Futures")).toBe("/wnba/futures");
    expect(sectionHref("wnba", "WNBA Chatbot")).toBeNull();
    expect(sectionHref("wnba", "EV+")).toBeNull();
    expect(sectionHref("wnba", "Arbitrage")).toBeNull();
  });

  it("disables NBA props/leaders/standings/futures", () => {
    expect(sectionHref("nba", "Matchups")).toBe("/nba/matchups");
    expect(sectionHref("nba", "Props")).toBeNull();
    expect(sectionHref("nba", "Leaders")).toBeNull();
    expect(sectionHref("nba", "Standings")).toBeNull();
    expect(sectionHref("nba", "Futures")).toBeNull();
    expect(sectionHref("nba", "How it works")).toBeNull();
  });
});

describe("isActiveSection", () => {
  it("marks suffixes the same way LeagueSubnav did", () => {
    expect(isActiveSection("/wnba/standings", "Standings")).toBe(true);
    expect(isActiveSection("/wnba/prop_picks", "Props")).toBe(true);
    expect(isActiveSection("/mlb/prop_picks/player/aaron-judge", "Props")).toBe(
      true,
    );
    expect(isActiveSection("/mlb/chatbot", "MLB Chatbot")).toBe(true);
    expect(isActiveSection("/wnba/leaders", "Matchups")).toBe(false);
  });
});

describe("sectionsFor", () => {
  it("includes EV+ and Arbitrage on WNBA/MLB, not NBA", () => {
    const wnba = sectionsFor("wnba").map((s) => s.label);
    expect(wnba).toContain("EV+");
    expect(wnba).toContain("Arbitrage");
    expect(wnba).toContain("WNBA Chatbot");
    expect(wnba).not.toContain("Playoff race");

    const nba = sectionsFor("nba").map((s) => s.label);
    expect(nba).not.toContain("EV+");
    expect(nba).toContain("Playoff race");
    expect(nba).toContain("How it works");
    expect(nba).toContain("Glossary");
  });

  it("tags explore vs learn groups", () => {
    const mlb = sectionsFor("mlb");
    expect(mlb.find((s) => s.label === "Matchups")?.group).toBe("explore");
    expect(mlb.find((s) => s.label === "MLB Chatbot")?.group).toBe("learn");
  });
});
