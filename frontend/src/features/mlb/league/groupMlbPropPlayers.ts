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

function playerGroupKey(row: ApiMlbPropRow): string | null {
  const name = row.player_name.trim();
  if (!name) return null;
  const team = (row.team_abbrev ?? "").trim().toUpperCase();
  return `${name}\0${team}`;
}

function assignUniqueSlugs(cards: MlbPropPlayerCard[]): void {
  const baseCounts = new Map<string, number>();
  for (const card of cards) {
    const base = slugifyPlayerName(card.player_name);
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }
  for (const card of cards) {
    const base = slugifyPlayerName(card.player_name);
    const teamSlug = slugifyPlayerName(card.team_abbrev ?? "");
    if ((baseCounts.get(base) ?? 0) > 1 && teamSlug) {
      card.player_slug = `${base}-${teamSlug}`;
    } else {
      card.player_slug = base;
    }
  }
}

export function groupMlbPropPlayers(props: ApiMlbPropRow[]): MlbPropPlayerCard[] {
  const byPlayer = new Map<string, ApiMlbPropRow[]>();
  for (const p of props) {
    const key = playerGroupKey(p);
    if (!key) continue;
    const list = byPlayer.get(key) ?? [];
    list.push(p);
    byPlayer.set(key, list);
  }
  const cards: MlbPropPlayerCard[] = [];
  for (const rows of byPlayer.values()) {
    const sample = rows[0]!;
    const player_name = sample.player_name.trim();
    const stats = [...new Set(rows.map((r) => r.stat).filter(Boolean))];
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
  assignUniqueSlugs(cards);
  cards.sort(
    (a, b) =>
      b.prop_count - a.prop_count ||
      a.player_name.localeCompare(b.player_name) ||
      (a.team_abbrev ?? "").localeCompare(b.team_abbrev ?? ""),
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
