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

    const rosterTable = screen.getByTestId("wnba-team-roster-table");
    expect(rosterTable.className).toContain("overflow-x-auto");
    for (const col of [
      "#",
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
    ]) {
      expect(rosterTable).toHaveTextContent(col);
    }
  });

  it("uses root test id", () => {
    render(<WnbaTeamPreview data={fixture} isPending={false} error={null} />);
    expect(screen.getByTestId("wnba-team-preview")).toBeInTheDocument();
  });

  it("renders leader cards without team logos", () => {
    render(<WnbaTeamPreview data={fixture} isPending={false} error={null} />);

    const ppgCard = screen.getByTestId("wnba-team-leader-card-ppg");
    expect(ppgCard).toHaveTextContent("PPG");
    expect(ppgCard).toHaveTextContent("26.6");
    expect(ppgCard).toHaveTextContent("Collier");
    expect(screen.getByTestId("wnba-team-leader-rank-ppg")).toHaveTextContent(
      "#1",
    );
    expect(ppgCard.querySelector('img[src*="team-logos"]')).toBeNull();
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
