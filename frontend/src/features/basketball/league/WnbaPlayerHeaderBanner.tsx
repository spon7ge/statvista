export const WNBA_PLAYER_BANNER_BROWN = "#7C2D12";

export function WnbaPlayerHeaderBanner({ title }: { title: string }) {
  return (
    <div data-testid="wnba-player-header-banner" className="relative z-20">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6"
        style={{ backgroundColor: WNBA_PLAYER_BANNER_BROWN }}
      >
        <div className="relative z-10 flex min-h-[7.5rem] items-end">
          <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
