// Deterministic generative art for the collection: one SVG moth per token id.
// The same id always gives the same bytes, so the provenance hash can be recomputed by anyone.
import { keccak256, toBytes } from "viem";

export const COLLECTION_SALT = "lumen-moths/v1";

type Weighted<T> = ReadonlyArray<readonly [T, number]>;

const PALETTES = {
  Luna: { wing: "#b8f2c8", edge: "#5fbf86", accent: "#f4e27a", body: "#e9f7d9" },
  "Rosy Maple": { wing: "#f7a8c4", edge: "#f2d36b", accent: "#fff1a8", body: "#fbe3a0" },
  Atlas: { wing: "#e2873f", edge: "#7a3b1f", accent: "#f6e1c1", body: "#b8642e" },
  Ghost: { wing: "#eef0f7", edge: "#b9bfd6", accent: "#ffffff", body: "#d9dcea" },
  Cobalt: { wing: "#5b8cff", edge: "#1f3a99", accent: "#a9e4ff", body: "#3459c9" },
  Gilded: { wing: "#f2c14e", edge: "#9a6a12", accent: "#fff3c4", body: "#d99a21" },
  Obsidian: { wing: "#3a3550", edge: "#a07cff", accent: "#e1d4ff", body: "#2a2638" },
} as const;

const BACKGROUNDS = {
  Midnight: ["#0b1026", "#1b2350"],
  Dusk: ["#2a1846", "#7a3a62"],
  Aurora: ["#06261f", "#1f5f6b"],
  Ember: ["#2b0f0a", "#6b2a14"],
  Moonlit: ["#1a2233", "#4a5878"],
} as const;

type PaletteName = keyof typeof PALETTES;
type BackgroundName = keyof typeof BACKGROUNDS;

const TRAITS = {
  Palette: [
    ["Luna", 22], ["Rosy Maple", 20], ["Atlas", 18], ["Ghost", 14],
    ["Cobalt", 12], ["Gilded", 9], ["Obsidian", 5],
  ] as Weighted<PaletteName>,
  Wings: [["Rounded", 40], ["Hooked", 25], ["Scalloped", 20], ["Swallowtail", 15]] as Weighted<string>,
  Pattern: [["Bands", 28], ["Eyespots", 24], ["Veins", 22], ["Speckles", 18], ["Plain", 8]] as Weighted<string>,
  Antennae: [["Feathered", 50], ["Thread", 35], ["Clubbed", 15]] as Weighted<string>,
  Background: [["Midnight", 30], ["Dusk", 22], ["Moonlit", 20], ["Aurora", 16], ["Ember", 12]] as Weighted<BackgroundName>,
  Glow: [["None", 45], ["Faint", 30], ["Bright", 18], ["Radiant", 7]] as Weighted<string>,
} as const;

export type Traits = { [K in keyof typeof TRAITS]: (typeof TRAITS)[K][number][0] };

/** sfc32 seeded from keccak256(salt:id): small, fast and identical in Node and browsers. */
function rng(id: number): () => number {
  const h = toBytes(keccak256(toBytes(`${COLLECTION_SALT}:${id}`)));
  const word = (i: number) => ((h[i] << 24) | (h[i + 1] << 16) | (h[i + 2] << 8) | h[i + 3]) >>> 0;
  let a = word(0), b = word(4), c = word(8), d = word(12);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, options: Weighted<T>): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return options[options.length - 1][0];
}

export function traitsFor(id: number): Traits {
  const rand = rng(id);
  return {
    Palette: pick(rand, TRAITS.Palette),
    Wings: pick(rand, TRAITS.Wings),
    Pattern: pick(rand, TRAITS.Pattern),
    Antennae: pick(rand, TRAITS.Antennae),
    Background: pick(rand, TRAITS.Background),
    Glow: pick(rand, TRAITS.Glow),
  };
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Right-side wing outlines (centre x = 200). Left side is the mirror image. */
function wingPaths(shape: string, spread: number): { fore: string; hind: string } {
  const s = spread;
  switch (shape) {
    case "Hooked":
      return {
        fore: `M206 168 C${f(240 + s)} ${f(120 - s)} ${f(318 + s)} 92 ${f(352 + s)} 104 C${f(338 + s)} 120 ${f(330 + s)} 150 ${f(338 + s)} 176 C${f(300 + s)} 206 248 214 206 204 Z`,
        hind: `M206 206 C246 214 ${f(300 + s)} 224 ${f(306 + s)} 262 C${f(304 + s)} 300 260 ${f(318 + s / 2)} 226 302 C212 284 206 250 206 228 Z`,
      };
    case "Scalloped":
      return {
        fore: `M206 168 C236 122 ${f(300 + s)} ${f(98 - s)} ${f(342 + s)} 116 C${f(330 + s)} 130 ${f(352 + s)} 146 ${f(336 + s)} 160 C${f(348 + s)} 176 ${f(326 + s)} 186 ${f(318 + s)} 194 C282 210 236 214 206 204 Z`,
        hind: `M206 206 C244 212 ${f(290 + s)} 222 ${f(302 + s)} 246 C${f(314 + s)} 262 ${f(296 + s)} 274 ${f(298 + s)} 288 C280 300 270 ${f(296 + s / 2)} 252 306 C236 300 210 272 206 230 Z`,
      };
    case "Swallowtail":
      return {
        fore: `M206 168 C238 118 ${f(304 + s)} ${f(96 - s)} ${f(346 + s)} 120 C${f(352 + s)} 150 ${f(334 + s)} 182 ${f(310 + s)} 198 C270 212 232 212 206 204 Z`,
        hind: `M206 206 C240 212 ${f(286 + s)} 222 ${f(292 + s)} 252 C${f(290 + s)} 276 262 288 250 292 C${f(262 + s / 2)} 320 ${f(270 + s / 2)} 350 ${f(262 + s / 2)} 372 C240 340 230 312 222 296 C210 276 206 250 206 230 Z`,
      };
    default: // Rounded
      return {
        fore: `M206 168 C236 120 ${f(306 + s)} ${f(94 - s)} ${f(348 + s)} 128 C${f(366 + s)} 162 ${f(332 + s)} 196 ${f(300 + s)} 204 C262 214 230 212 206 204 Z`,
        hind: `M206 206 C246 210 ${f(304 + s)} 220 ${f(310 + s)} 256 C${f(314 + s)} 290 270 ${f(312 + s / 2)} 236 300 C214 286 206 254 206 230 Z`,
      };
  }
}

function patternMarks(pattern: string, rand: () => number, accent: string, edge: string): string {
  const marks: string[] = [];
  switch (pattern) {
    case "Eyespots": {
      const r = 14 + rand() * 6;
      marks.push(
        `<circle cx="292" cy="156" r="${f(r)}" fill="${edge}"/>`,
        `<circle cx="292" cy="156" r="${f(r * 0.62)}" fill="${accent}"/>`,
        `<circle cx="294" cy="153" r="${f(r * 0.24)}" fill="#1a1426"/>`,
        `<circle cx="262" cy="258" r="${f(r * 0.7)}" fill="${edge}"/>`,
        `<circle cx="262" cy="258" r="${f(r * 0.38)}" fill="${accent}"/>`,
      );
      break;
    }
    case "Bands":
      for (let i = 0; i < 3; i++) {
        const y = 136 + i * 22 + rand() * 6;
        marks.push(`<path d="M214 ${f(y + 30)} Q280 ${f(y - 10)} 350 ${f(y + 6)}" stroke="${i === 1 ? accent : edge}" stroke-width="${f(5 + rand() * 4)}" fill="none" stroke-linecap="round" opacity="0.85"/>`);
      }
      marks.push(`<path d="M214 236 Q262 226 300 252" stroke="${edge}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8"/>`);
      break;
    case "Veins":
      for (let i = 0; i < 5; i++) {
        const ex = 300 + i * 10 + rand() * 12;
        const ey = 108 + i * 22 + rand() * 8;
        marks.push(`<path d="M208 190 Q${f(250 + i * 8)} ${f(160 + i * 6)} ${f(ex)} ${f(ey)}" stroke="${edge}" stroke-width="1.6" fill="none" opacity="0.9"/>`);
      }
      for (let i = 0; i < 3; i++) {
        marks.push(`<path d="M208 214 Q${f(240 + i * 10)} ${f(236 + i * 8)} ${f(270 + i * 14)} ${f(272 + i * 10)}" stroke="${edge}" stroke-width="1.4" fill="none" opacity="0.85"/>`);
      }
      break;
    case "Speckles":
      for (let i = 0; i < 18; i++) {
        const x = 232 + rand() * 100;
        const y = 128 + rand() * 150;
        marks.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + rand() * 3.5)}" fill="${rand() < 0.5 ? accent : edge}" opacity="0.9"/>`);
      }
      break;
    default:
      break;
  }
  return marks.join("");
}

function antennae(kind: string, color: string): string {
  const right = "M204 150 C214 120 230 98 250 84";
  const tip = kind === "Clubbed" ? `<circle cx="250" cy="84" r="5" fill="${color}"/>` : "";
  const feathers =
    kind === "Feathered"
      ? Array.from({ length: 7 }, (_, i) => {
          const t = i / 6;
          const x = 206 + t * 42;
          const y = 146 - t * 60;
          return `<path d="M${f(x)} ${f(y)} l${f(9 - t * 4)} ${f(-2 - t * 3)}" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`;
        }).join("")
      : "";
  return `<g fill="none"><path d="${right}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>${feathers}${tip}</g>`;
}

export function renderMoth(id: number): string {
  const traits = traitsFor(id);
  // A second stream for shape jitter, so adding a trait later doesn't shift these values.
  const rand = rng(id + 1_000_000);
  const pal = PALETTES[traits.Palette];
  const [bg0, bg1] = BACKGROUNDS[traits.Background];
  const spread = rand() * 14 - 4;
  const { fore, hind } = wingPaths(traits.Wings, spread);
  const glow = { None: 0, Faint: 0.25, Bright: 0.45, Radiant: 0.7 }[traits.Glow] ?? 0;

  const stars = Array.from({ length: 26 }, () => {
    const x = rand() * 400;
    const y = rand() * 400;
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + rand() * 1.4)}" fill="#fff" opacity="${f(0.25 + rand() * 0.6)}"/>`;
  }).join("");

  const marks = traits.Pattern === "Plain" ? "" : patternMarks(traits.Pattern, rand, pal.accent, pal.edge);
  // Marks are clipped to the wing outline, then the whole right side is mirrored for the left.
  const wing =
    `<g clip-path="url(#wings)"><rect width="400" height="400" fill="${pal.wing}"/>${marks}</g>` +
    `<path d="${hind}" fill="none" stroke="${pal.edge}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="${fore}" fill="none" stroke="${pal.edge}" stroke-width="3" stroke-linejoin="round"/>`;

  const segments = Array.from({ length: 5 }, (_, i) =>
    `<ellipse cx="200" cy="${226 + i * 16}" rx="${f(11 - i * 1.4)}" ry="9" fill="${pal.body}" stroke="${pal.edge}" stroke-width="1.5"/>`,
  ).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg0}"/><stop offset="1" stop-color="${bg1}"/></linearGradient>`,
    `<radialGradient id="glow"><stop offset="0" stop-color="${pal.accent}" stop-opacity="${glow}"/><stop offset="1" stop-color="${pal.accent}" stop-opacity="0"/></radialGradient>`,
    `<clipPath id="wings"><path d="${fore}"/><path d="${hind}"/></clipPath></defs>`,
    `<rect width="400" height="400" fill="url(#bg)"/>`,
    stars,
    `<circle cx="300" cy="80" r="26" fill="#fdf6d8" opacity="0.18"/>`,
    glow > 0 ? `<circle cx="200" cy="210" r="190" fill="url(#glow)"/>` : "",
    `<g>${antennae(traits.Antennae, pal.edge)}</g>`,
    `<g transform="matrix(-1 0 0 1 400 0)">${antennae(traits.Antennae, pal.edge)}</g>`,
    `<g>${wing}</g>`,
    `<g transform="matrix(-1 0 0 1 400 0)">${wing}</g>`,
    `<ellipse cx="200" cy="182" rx="14" ry="26" fill="${pal.body}" stroke="${pal.edge}" stroke-width="2"/>`,
    segments,
    `<circle cx="200" cy="150" r="11" fill="${pal.body}" stroke="${pal.edge}" stroke-width="2"/>`,
    `</svg>`,
  ].join("");
}

export function renderUnrevealed(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14122a"/><stop offset="1" stop-color="#2c2450"/></linearGradient>`,
    `<radialGradient id="g"><stop offset="0" stop-color="#f4e27a" stop-opacity="0.35"/><stop offset="1" stop-color="#f4e27a" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="400" height="400" fill="url(#bg)"/>`,
    `<circle cx="200" cy="215" r="150" fill="url(#g)"/>`,
    `<path d="M200 60 L200 108" stroke="#8b80b8" stroke-width="3"/>`,
    `<path d="M200 108 C150 120 140 200 158 262 C170 304 230 304 242 262 C260 200 250 120 200 108 Z" fill="#c9b78f" stroke="#7d6a45" stroke-width="4"/>`,
    ...[140, 172, 204, 236, 266].map(
      (y, i) => `<path d="M${164 - (i === 0 ? -10 : 0)} ${y} Q200 ${y + 14} ${236 + (i === 0 ? -10 : 0)} ${y}" stroke="#7d6a45" stroke-width="3" fill="none"/>`,
    ),
    `<text x="200" y="352" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#d9d2f2" letter-spacing="3">UNREVEALED</text>`,
    `</svg>`,
  ].join("");
}

export function encodeToken(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function processData(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function encodeToken(data: unknown): unknown {
  if (!data) return null;
  return data;
}