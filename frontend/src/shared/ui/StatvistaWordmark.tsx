type StatvistaWordmarkProps = {
  className?: string;
};

/** Sidebar/header lockup: colored bars + statvista word, sized like the reference title. */
export function StatvistaWordmark({
  className = "w-[150px] mx-[22px]",
}: StatvistaWordmarkProps) {
  return (
    <svg
      viewBox="0 0 425.2 70.9"
      xmlSpace="preserve"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="statvista"
    >
      <rect fill="#0086ff" x="53" y="1.7" width="15.1" height="67.4" />
      <path
        fill="#00c1d8"
        d="M97.3,49.2c3.1-1,6-2.7,8-5.3c-3.1,0.8-5.9,1.4-8.7,1.5c-1.8,0.1-3.5,0.1-5.3-0.1v-11v-8.8
	c0-9.9-8-17.9-17.9-17.9V43c3.1,0,5.7,2.5,5.7,5.7v8.2c0,6.8,5.5,12.3,12.3,12.3h8.9v-8.9h-3.4c-3,0-5.5-2.5-5.5-5.5v-4.6
	C93.4,50.1,95.4,49.8,97.3,49.2z M80.5,29.2c-1.4-1.4-1.4-3.8,0-5.2c0,1,0.6,2.4,1.8,3.5c1.1,1.1,2.5,1.7,3.5,1.8
	C84.3,30.7,81.9,30.7,80.5,29.2z"
      />
      <rect fill="#003ca8" x="32.6" y="17.2" width="15.1" height="51.9" />
      <path
        fill="#39cccc"
        d="M12.2,28.3v20.2l0,0c0,1.8-1.1,4-3,5.9c-1.9,1.9-4.1,3-5.9,3c2.5,2.4,6.4,2.4,8.9,0v11.8h15.1V13.2
	C19,13.2,12.2,19.9,12.2,28.3z"
      />
      <text
        x="118"
        y="58"
        fill="currentColor"
        fontSize="56"
        fontWeight="600"
        fontFamily="calibre, calibre-fallback, ui-sans-serif, system-ui, sans-serif"
      >
        statvista
      </text>
    </svg>
  );
}
