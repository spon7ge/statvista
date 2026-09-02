import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GAME_SECTION_SURFACE, GameSection } from "@/shared/ui/GameSection";

describe("GameSection", () => {
  it("applies the quiet Live-now surface classes", () => {
    render(
      <GameSection>
        <h2>Shot chart</h2>
      </GameSection>,
    );
    const section = screen.getByRole("heading", { name: "Shot chart" }).closest(
      "section",
    );
    expect(section).toHaveClass(
      "rounded",
      "bg-c2",
      "px-3",
      "py-2",
      "border-line",
    );
  });

  it("exports GAME_SECTION_SURFACE matching the Game Info card treatment", () => {
    expect(GAME_SECTION_SURFACE).toBe(
      "overflow-hidden rounded border border-line bg-c2 px-3 py-2",
    );
  });

  it("merges an optional className", () => {
    render(
      <GameSection className="space-y-3">
        <span>inner</span>
      </GameSection>,
    );
    expect(screen.getByText("inner").closest("section")).toHaveClass(
      "space-y-3",
      "rounded",
    );
  });
});
