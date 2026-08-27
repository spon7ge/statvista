type ChatLeague = "mlb" | "wnba";

type LeagueChatbotPanelProps = {
  league: ChatLeague;
};

const LEAGUE_LABEL: Record<ChatLeague, string> = {
  mlb: "MLB",
  wnba: "WNBA",
};

export function LeagueChatbotPanel({ league }: LeagueChatbotPanelProps) {
  const title = `${LEAGUE_LABEL[league]} Chatbot`;
  return (
    <div className="space-y-4">
      <h1 className="text-left text-[32px] leading-none font-bold tracking-tight text-white sm:text-[36px]">
        {title}
      </h1>
      <p className="text-sm text-white/40">{title} coming soon.</p>
    </div>
  );
}
