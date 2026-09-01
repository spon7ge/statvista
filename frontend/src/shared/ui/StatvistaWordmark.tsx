type StatvistaWordmarkProps = {
  className?: string;
};

/** Sidebar/header lockup: three ascending bars + larger statvista word. */
export function StatvistaWordmark({ className = "" }: StatvistaWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="statvista"
      className={`inline-flex items-center gap-2.5 ${className}`.trim()}
    >
      <svg
        data-testid="statvista-mark"
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        aria-hidden
      >
        <rect fill="#003ca8" x="3" y="16" width="7" height="14" rx="1.5" />
        <rect fill="#0086ff" x="12.5" y="8" width="7" height="22" rx="1.5" />
        <rect fill="#00c1d8" x="22" y="2" width="7" height="28" rx="1.5" />
      </svg>
      <span className="text-[28px] font-semibold leading-none tracking-tight">
        statvista
      </span>
    </span>
  );
}
