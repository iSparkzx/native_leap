import { cssVar } from "./util.ts";

/* The three space-tech accents, set once in styles.css as --ion, --nebula and --plasma and read here for canvas
   and WebGL, so changing a hex there recolours the figures and the hero too.
   Ion (electric blue): work moving on its own, and actions. Nebula (violet): results.
   Plasma (cyan): light on dark surfaces only; it is too pale for white paper. */

export type RGB = readonly [number, number, number];
export type Accent = "ion" | "nebula" | "plasma";

const FALLBACK: Record<Accent, RGB> = { ion: [59, 91, 255], nebula: [124, 77, 255], plasma: [62, 197, 255] };
const cache = new Map<Accent, RGB>();

/** An accent as 0–255 RGB. The custom property must be a hex colour. */
export function accentRGB(name: Accent): RGB {
  const hit = cache.get(name);
  if (hit) return hit;
  const hex = cssVar(`--${name}`).replace("#", "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const n = /^[0-9a-f]{6}$/i.test(full) ? parseInt(full, 16) : NaN;
  const rgb: RGB = Number.isNaN(n) ? FALLBACK[name] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(name, rgb);
  return rgb;
}
