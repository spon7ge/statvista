import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatvistaWordmark } from "./StatvistaWordmark";

describe("StatvistaWordmark", () => {
  it("labels the lockup statvista and uses the title mark colors", () => {
    render(<StatvistaWordmark />);
    const mark = screen.getByRole("img", { name: "statvista" });
    expect(mark).toHaveClass("w-[186px]");
    expect(mark.querySelector("rect[fill='#0086ff']")).toBeTruthy();
    expect(mark.querySelector("path[fill='#00c1d8']")).toBeTruthy();
    expect(mark.querySelector("rect[fill='#003ca8']")).toBeTruthy();
    expect(mark.querySelector("path[fill='#39cccc']")).toBeTruthy();
    expect(mark.textContent).toBe("statvista");
  });
});
