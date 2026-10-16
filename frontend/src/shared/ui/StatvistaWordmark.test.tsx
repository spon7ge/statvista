import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatvistaWordmark } from "./StatvistaWordmark";

const faviconSvg = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../public/favicon.svg"),
  "utf8",
);

describe("StatvistaWordmark", () => {
  it("labels the lockup statvista with a larger word and the new bars mark", () => {
    render(<StatvistaWordmark />);
    const mark = screen.getByRole("img", { name: "statvista" });
    expect(screen.getByText("statvista")).toHaveClass("wordmark-type");
    expect(screen.getByTestId("statvista-mark")).toHaveClass("wordmark-mark");
    expect(screen.getByTestId("statvista-mark")).toBeInTheDocument();
    expect(mark.querySelector('rect[fill="var(--c4)"]')).toBeTruthy();
    expect(mark.querySelector('rect[fill="var(--c3)"]')).toBeTruthy();
    expect(mark).not.toHaveClass("w-[186px]");
  });

  it("uses the same bar geometry in the tab favicon", () => {
    expect(faviconSvg).toContain(
      'fill="#f0b429" x="3" y="16" width="7" height="14" rx="1.5"',
    );
    expect(faviconSvg).toContain(
      'fill="#f3ebda" x="12.5" y="8" width="7" height="22" rx="1.5"',
    );
    expect(faviconSvg).toContain(
      'fill="#f0b429" x="22" y="2" width="7" height="28" rx="1.5"',
    );
  });
});
