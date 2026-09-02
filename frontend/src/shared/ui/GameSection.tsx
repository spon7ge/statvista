import type { ComponentProps } from "react";

/** Card chrome: 16px radius, no outline, c2 fill. */
export const GAME_SECTION_SURFACE =
  "game-section overflow-hidden bg-c2 px-3 py-2";

export function GameSection({
  children,
  className = "",
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={`${GAME_SECTION_SURFACE} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  );
}
