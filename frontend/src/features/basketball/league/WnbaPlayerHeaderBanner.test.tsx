import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WNBA_PLAYER_BANNER_BROWN,
  WnbaPlayerHeaderBanner,
} from "./WnbaPlayerHeaderBanner";

describe("WnbaPlayerHeaderBanner", () => {
  it("renders a brown banner with the player title", () => {
    render(<WnbaPlayerHeaderBanner title="A'ja Wilson" />);

    const header = screen.getByTestId("wnba-player-header-banner");
    expect(
      screen.getByRole("heading", { name: "A'ja Wilson" }),
    ).toBeInTheDocument();
    const banner = header.querySelector("div.rounded-3xl");
    expect(banner).toHaveStyle({ backgroundColor: "rgb(124, 45, 18)" });
    expect(WNBA_PLAYER_BANNER_BROWN).toBe("#7C2D12");
  });
});
