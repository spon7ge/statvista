import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatvistaWordmark } from "./StatvistaWordmark";

describe("StatvistaWordmark", () => {
  it("labels the lockup statvista with a larger word and the new bars mark", () => {
    render(<StatvistaWordmark />);
    const mark = screen.getByRole("img", { name: "statvista" });
    expect(screen.getByText("statvista")).toHaveClass("wordmark-type");
    expect(screen.getByTestId("statvista-mark")).toBeInTheDocument();
    expect(mark.querySelector('rect[fill="var(--c4)"]')).toBeTruthy();
    expect(mark.querySelector('rect[fill="var(--c3)"]')).toBeTruthy();
    expect(mark).not.toHaveClass("w-[186px]");
  });
});
