import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatvistaWordmark } from "./StatvistaWordmark";

describe("StatvistaWordmark", () => {
  it("labels the lockup statvista with a larger word and the new bars mark", () => {
    render(<StatvistaWordmark />);
    const mark = screen.getByRole("img", { name: "statvista" });
    expect(screen.getByText("statvista")).toHaveClass("text-[28px]");
    expect(screen.getByTestId("statvista-mark")).toBeInTheDocument();
    expect(mark.querySelector("rect[fill='#003ca8']")).toBeTruthy();
    expect(mark.querySelector("rect[fill='#0086ff']")).toBeTruthy();
    expect(mark.querySelector("rect[fill='#00c1d8']")).toBeTruthy();
    expect(mark).not.toHaveClass("w-[186px]");
  });
});
