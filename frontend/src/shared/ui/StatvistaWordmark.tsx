type StatvistaWordmarkProps = {
  className?: string;
};

/** Sidebar/header lockup: three ascending bars + larger statvista word. */
export function StatvistaWordmark({ className = "" }: StatvistaWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="statvista"
      className={`wordmark ${className}`.trim()}
    >
      <svg
        data-testid="statvista-mark"
        viewBox="0 0 32 32"
        className="wordmark-mark"
        aria-hidden
      >
        <rect fill="var(--c4)" x="3" y="16" width="7" height="14" rx="1.5" />
        <rect fill="var(--c3)" x="12.5" y="8" width="7" height="22" rx="1.5" />
        <rect fill="var(--c4)" x="22" y="2" width="7" height="28" rx="1.5" />
      </svg>
      <span className="wordmark-type">statvista</span>
    </span>
  );
}
