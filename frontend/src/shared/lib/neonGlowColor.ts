/**
 * Lift dark team hexes into a visible neon band so SVG glow reads on a dark chart.
 */
export function neonGlowColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const neonL = Math.max(l, 0.62);
  const neonS = Math.min(1, Math.max(s, 0.55) * 1.08);
  return hslToHex(h, neonS, neonL);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim();
  const six = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (six) {
    const n = Number.parseInt(six[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const three = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (three) {
    const [r, g, b] = three[1].split("");
    return {
      r: Number.parseInt(`${r}${r}`, 16),
      g: Number.parseInt(`${g}${g}`, 16),
      b: Number.parseInt(`${b}${b}`, 16),
    };
  }
  return null;
}

function rgbToHsl(
  r8: number,
  g8: number,
  b8: number,
): { h: number; s: number; l: number } {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((ch) => ch.toString(16).padStart(2, "0")).join("")}`;
}
