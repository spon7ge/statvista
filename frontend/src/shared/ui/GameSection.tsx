import type { ComponentProps } from "react";

/** Card chrome matching the Game Info reference: rounded-2xl, 13×9 padding, light border. */
export const GAME_SECTION_SURFACE =
  "overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e] px-[13px] py-[9px]";

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
