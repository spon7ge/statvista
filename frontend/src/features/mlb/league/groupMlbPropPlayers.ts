import type { ApiMlbPropRow } from "@/shared/lib/api";

export type MlbPropPlayerCard = {
  player_name: string;
  player_slug: string;
  prop_count: number;
  team_abbrev: string | null;
  position: string | null;
  headshot_url: string | null;
  stats: string[];
  rows: ApiMlbPropRow[];
};

export function slugifyPlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function groupMlbPropPlayers(props: ApiMlbPropRow[]): MlbPropPlayerCard[] {
  const byName = new Map<string, ApiMlbPropRow[]>();
  for (const p of props) {
    const key = p.player_name.trim();
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
  }
  const cards: MlbPropPlayerCard[] = [];
  for (const [player_name, rows] of byName) {
    const stats = [...new Set(rows.map((r) => r.stat).filter(Boolean))];
    const sample = rows[0]!;
    cards.push({
      player_name,
      player_slug: slugifyPlayerName(player_name),
      prop_count: stats.length,
      team_abbrev: sample.team_abbrev,
      position: sample.position,
      headshot_url: sample.headshot_url,
      stats,
      rows,
    });
  }
  cards.sort(
    (a, b) =>
      b.prop_count - a.prop_count ||
      a.player_name.localeCompare(b.player_name),
  );
  return cards;
}

export function findPlayerBySlug(
  players: MlbPropPlayerCard[],
  slug: string,
): MlbPropPlayerCard | null {
  return players.find((p) => p.player_slug === slug) ?? null;
}

export function uniqueStatRows(rows: ApiMlbPropRow[]): ApiMlbPropRow[] {
  const seen = new Set<string>();
  const out: ApiMlbPropRow[] = [];
  for (const row of rows) {
    if (seen.has(row.stat)) continue;
    seen.add(row.stat);
    out.push(row);
  }
  return out;
}
