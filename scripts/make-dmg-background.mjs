import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src-tauri/icons/dmg-background.png');

// Finder draws the real app icon and Applications shortcut on top of this
// image, so the background must not contain a fake app icon or labels that
// would collide with the system-drawn icons.
const W = 660;
const H = 400;
const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070b14"/>
      <stop offset="0.6" stop-color="#0b1222"/>
      <stop offset="1" stop-color="#101a30"/>
    </linearGradient>
    <radialGradient id="violet" cx="0.85" cy="0.08" r="0.75">
      <stop offset="0" stop-color="#8b5cf6" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gold" cx="0.12" cy="0.95" r="0.8">
      <stop offset="0" stop-color="#f2b84b" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#f2b84b" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#8fa6cc" stroke-opacity="0.045"/>
    </pattern>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f2b84b"/>
      <stop offset="0.5" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#violet)"/>
  <rect width="${W}" height="${H}" fill="url(#gold)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <text x="${W / 2}" y="54" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="800" fill="#eef4ff">SkyForge Helper</text>
  <text x="${W / 2}" y="78" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="11.5" font-weight="500" letter-spacing="2.2" fill="#8fa6cc">DRAG THE APP INTO APPLICATIONS</text>
  <rect x="${W / 2 - 90}" y="90" width="180" height="2" rx="1" fill="url(#rule)"/>
  <g opacity="0.85">
    <path d="M 300 190 L 360 190" stroke="#9fb4d8" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="7 8"/>
    <path d="M 353 182 L 362 190 L 353 198" fill="none" stroke="#9fb4d8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="10.5" fill="#6f83a6">Unofficial fan project · MIT · © 2026 Beluga_8292 · macOS 12+ Apple silicon</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUT);
console.log('wrote src-tauri/icons/dmg-background.png');
