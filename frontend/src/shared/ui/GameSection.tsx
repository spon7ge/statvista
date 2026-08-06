import type { ComponentProps } from "react";

/** Quiet surface matching homepage Live now cards. */
export const GAME_SECTION_SURFACE = "rounded-xl bg-[#3a3d42] p-4";

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
