import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ApiWnbaTeamPreviewResponse } from "@/shared/lib/api";
import { WnbaTeamPreview } from "./WnbaTeamPreview";

const fixture: ApiWnbaTeamPreviewResponse = {
  side: "away",
  team: {
    id: "16",
    abbrev: "MIN",
    name: "Minnesota Lynx",
    logo_url: null,
  },
  leaders: [
    {
      key: "ppg",
      label: "PPG",
      rank: 1,
      value: "26.6",
      player_id: "1",
      last_name: "Collier",
      headshot_url:
        "https://a.espncdn.com/i/headshots/wnba/players/full/1.png",
    },
    {
      key: "rpg",
      label: "RPG",
      rank: 4,
      value: "9.1",
      player_id: "2",
      last_name: "Smith",
      headshot_url: null,
    },
    {
      key: "apg",
      label: "APG",
      rank: null,
      value: "6.2",
      player_id: "3",
      last_name: "Williams",
      headshot_url: null,
    },
    {
      key: "bpg",
      label: "BPG",
      rank: 2,
      value: "1.5",
      player_id: "1",
      last_name: "Collier",
      headshot_url:
        "https://a.espncdn.com/i/headshots/wnba/players/full/1.png",
    },
    {
      key: "spg",
      label: "SPG",
      rank: 5,
      value: "1.8",
      player_id: "4",
      last_name: "Carleton",
      headshot_url: null,
    },
  ],
  roster: [
    {
      player_id: "1",
      name: "N. Collier",
      jersey: "24",
      position: "F",
      gp: 28,
      min: "34.2",
      pts: "26.6",
      reb: "8.5",
      ast: "3.2",
      stl: "1.8",
      blk: "1.5",
      to: "2.1",
      fg_pct: ".512",
      fg3_pct: ".380",
      ft_pct: ".850",
      usg_pct: "26.0",
      efg_pct: "54.2",
      ts_pct: "58.1",
      ast_pct: "18.4",
      ast_to: "1.6",
      oreb_pct: "3.2",
      dreb_pct: "15.1",
      reb_pct: "9.4",
      tov_pct: "11.0",
      off_rtg: "116.0",
      def_rtg: "104.2",
      net_rtg: "11.8",
      pie: "16.4",
      sh_eff: "1.12",
      sc_eff: "1.24",
      ppep: "1.08",
      rtg: "118.4",
      plus_minus: "+6.2",
      headshot_url: null,
    },
  ],
};

describe("WnbaTeamPreview", () => {
  it("renders team leaders and roster table headers", () => {
    render(<WnbaTeamPreview data={fixture} isPending={false} error={null} />);

    expect(
      screen.getByRole("heading", { name: "Team Leaders" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wnba-team-roster-table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roster" })).toBeInTheDocument();

    expect(screen.getByTestId("wnba-team-leader-card-ppg")).toHaveStyle({
      backgroundColor: "#236192",
    });
    expect(screen.getByTestId("wnba-team-leader-card-bpg")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-team-leader-card-spg")).toBeInTheDocument();
    expect(screen.queryByTestId("wnba-team-leader-card-fg_pct")).not.toBeInTheDocument();
    expect(screen.queryByText("SH-EFF")).not.toBeInTheDocument();
    expect(screen.queryByText("SC-EFF")).not.toBeInTheDocument();
    expect(screen.queryByText("PPEP")).not.toBeInTheDocument();
    expect(screen.getByText("RTG")).toBeInTheDocument();
    expect(screen.getByText("+/-")).toBeInTheDocument();
    const leadersGrid = screen.getByTestId("wnba-team-leader-card-ppg").parentElement;
    expect(leadersGrid).toHaveClass("grid-cols-5");

    const rosterTable = screen.getByTestId("wnba-team-roster-table");
    expect(rosterTable.className).toContain("overflow-x-auto");
    for (const col of [
      "POS",
      "GP",
      "MIN",
      "PTS",
      "REB",
      "AST",
      "STL",
      "BLK",
      "TO",
      "FG%",
      "3P%",
      "FT%",
      "USG%",
      "EFG%",
      "TS%",
      "AST%",
      "AST/TO",
      "OREB%",
      "DREB%",
      "REB%",
      "TOV%",
      "OFF",
      "DEF",
      "NET",
      "PIE",
      "RTG",
      "+/-",
    ]) {
      expect(rosterTable).toHaveTextContent(col);
    }
  });

  it("uses root test id", () => {
    render(<WnbaTeamPreview data={fixture} isPending={false} error={null} />);
    expect(screen.getByTestId("wnba-team-preview")).toBeInTheDocument();
  });

  it("renders five leader cards including BPG and SPG", () => {
    render(<WnbaTeamPreview data={fixture} isPending={false} error={null} />);

    expect(screen.getByTestId("wnba-team-leader-card-ppg")).toHaveTextContent(
      "PPG",
    );
    expect(screen.getByTestId("wnba-team-leader-card-rpg")).toHaveTextContent(
      "RPG",
    );
    expect(screen.getByTestId("wnba-team-leader-card-apg")).toHaveTextContent(
      "APG",
    );
    expect(screen.getByTestId("wnba-team-leader-card-bpg")).toHaveTextContent(
      "BPG",
    );
    expect(screen.getByTestId("wnba-team-leader-card-bpg")).toHaveTextContent(
      "1.5",
    );
    expect(screen.getByTestId("wnba-team-leader-card-spg")).toHaveTextContent(
      "SPG",
    );
    expect(screen.getByTestId("wnba-team-leader-card-spg")).toHaveTextContent(
      "1.8",
    );
    expect(screen.getByTestId("wnba-team-leader-headshot-ppg")).toHaveAttribute(
      "src",
      fixture.leaders[0].headshot_url,
    );
  });

  it("uses initials fallback when headshot is null or fails", () => {
    render(<WnbaTeamPreview data={fixture} isPending={false} error={null} />);

    expect(
      screen.getByTestId("wnba-team-leader-headshot-fallback-rpg"),
    ).toHaveTextContent("S");

    fireEvent.error(screen.getByTestId("wnba-team-leader-headshot-ppg"));
    expect(
      screen.getByTestId("wnba-team-leader-headshot-fallback-ppg"),
    ).toHaveTextContent("C");
  });

  it("hides leaders section when empty", () => {
    render(
      <WnbaTeamPreview
        data={{ ...fixture, leaders: [] }}
        isPending={false}
        error={null}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Team Leaders" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("wnba-team-roster-table")).toBeInTheDocument();
  });

  it("shows empty copy when roster empty", () => {
    render(
      <WnbaTeamPreview
        data={{ ...fixture, roster: [] }}
        isPending={false}
        error={null}
      />,
    );

    expect(screen.getByTestId("wnba-team-roster-table")).toHaveTextContent(
      "No season stats available",
    );
  });

  it("shows loading when pending", () => {
    render(<WnbaTeamPreview data={null} isPending={true} error={null} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByTestId("wnba-team-preview")).toBeInTheDocument();
  });

  it("shows error message when load fails", () => {
    render(
      <WnbaTeamPreview
        data={null}
        isPending={false}
        error="Failed to load team preview"
      />,
    );
    expect(screen.getByText("Failed to load team preview")).toBeInTheDocument();
  });
});
