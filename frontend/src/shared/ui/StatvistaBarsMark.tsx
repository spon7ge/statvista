type StatvistaBarsMarkProps = {
  className?: string;
};

/** Brand mark: three ascending bars (same geometry as next to “statvista” in HomeNav). */
export function StatvistaBarsMark({
  className = "size-4",
}: StatvistaBarsMarkProps) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-testid="statvista-bars-mark"
    >
      <line x1="6" y1="20" x2="6" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </svg>
  );
}
