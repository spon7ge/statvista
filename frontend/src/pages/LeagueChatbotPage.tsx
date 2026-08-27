import { LeagueChatbotPanel } from "@/features/basketball/league/LeagueChatbotPanel";

type LeagueChatbotPageProps = {
  league: "mlb" | "wnba";
};

export function LeagueChatbotPage({ league }: LeagueChatbotPageProps) {
  return (
    <div className="space-y-0 pb-8">
      <section className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 sm:pb-20">
        <LeagueChatbotPanel league={league} />
      </section>
    </div>
  );
}
