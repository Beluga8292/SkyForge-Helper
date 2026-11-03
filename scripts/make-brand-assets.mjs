import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/assets');
const ICON = path.join(ROOT, 'src-tauri/icons/icon.png');
fs.mkdirSync(OUT, { recursive: true });

const icon = fs.readFileSync(ICON).toString('base64');

function banner({ width, height, titleSize, subtitleSize, bodySize, compact }) {
  const iconSize = compact ? 118 : 144;
  const iconX = compact ? 64 : 96;
  const textX = iconX + iconSize + (compact ? 40 : 52);
  const top = compact ? 82 : 96;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070b14"/>
      <stop offset="0.55" stop-color="#0b1222"/>
      <stop offset="1" stop-color="#101a30"/>
    </linearGradient>
    <radialGradient id="violet" cx="0.86" cy="0.1" r="0.7">
      <stop offset="0" stop-color="#8b5cf6" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gold" cx="0.1" cy="0.95" r="0.75">
      <stop offset="0" stop-color="#f2b84b" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#f2b84b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.72" stop-color="#dce9ff"/>
      <stop offset="1" stop-color="#f5c45e"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f2b84b"/>
      <stop offset="0.5" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#8fa6cc" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#violet)"/>
  <rect width="${width}" height="${height}" fill="url(#gold)"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="20" fill="none" stroke="#9db4dd" stroke-opacity="0.16"/>
  <g>
    <rect x="${iconX - 10}" y="${top - 10}" width="${iconSize + 20}" height="${iconSize + 20}" rx="${compact ? 30 : 34}" fill="#0a0f1c" stroke="#8b5cf6" stroke-opacity="0.45" stroke-width="1.5"/>
    <image x="${iconX}" y="${top}" width="${iconSize}" height="${iconSize}" href="data:image/png;base64,${icon}"/>
  </g>
  <text x="${textX}" y="${top + (compact ? 30 : 40)}" font-family="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${subtitleSize}" font-weight="600" letter-spacing="5" fill="#9fb4d8">HYPIXEL SKYBLOCK DESKTOP COMPANION</text>
  <text x="${textX}" y="${top + (compact ? 96 : 118)}" font-family="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${titleSize}" font-weight="800" letter-spacing="-1" fill="url(#title)">SKYFORGE HELPER</text>
  <text x="${textX}" y="${top + (compact ? 142 : 172)}" font-family="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${bodySize}" font-weight="400" fill="#a7b7d4">Your Hypixel SkyBlock Companion — profiles, Networth, markets,</text>
  <text x="${textX}" y="${top + (compact ? 170 : 204)}" font-family="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${bodySize}" font-weight="400" fill="#a7b7d4">auctions and planning in one clean desktop app.</text>
  <rect x="${textX}" y="${top + (compact ? 196 : 236)}" width="${compact ? 520 : 700}" height="3" rx="1.5" fill="url(#rule)"/>
  <g font-family="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" font-size="${compact ? 17 : 19}" font-weight="600" fill="#d8e4f8">
    <rect x="${textX}" y="${top + (compact ? 220 : 264)}" width="${compact ? 112 : 128}" height="38" rx="19" fill="#8b5cf6" fill-opacity="0.13" stroke="#8b5cf6" stroke-opacity="0.35"/>
    <text x="${textX + (compact ? 22 : 25)}" y="${top + (compact ? 244 : 290)}">Profiles</text>
    <rect x="${textX + (compact ? 124 : 140)}" y="${top + (compact ? 220 : 264)}" width="${compact ? 114 : 132}" height="38" rx="19" fill="#f2b84b" fill-opacity="0.10" stroke="#f2b84b" stroke-opacity="0.32"/>
    <text x="${textX + (compact ? 146 : 165)}" y="${top + (compact ? 244 : 290)}">Networth</text>
    <rect x="${textX + (compact ? 250 : 284)}" y="${top + (compact ? 220 : 264)}" width="${compact ? 100 : 116}" height="38" rx="19" fill="#22d3ee" fill-opacity="0.10" stroke="#22d3ee" stroke-opacity="0.30"/>
    <text x="${textX + (compact ? 272 : 306)}" y="${top + (compact ? 244 : 290)}">Markets</text>
    <rect x="${textX + (compact ? 362 : 412)}" y="${top + (compact ? 220 : 264)}" width="${compact ? 138 : 160}" height="38" rx="19" fill="#e2e8f0" fill-opacity="0.06" stroke="#9db4dd" stroke-opacity="0.22"/>
    <text x="${textX + (compact ? 384 : 436)}" y="${top + (compact ? 244 : 290)}">Planning</text>
  </g>
  <text x="${width - (compact ? 64 : 96)}" y="${height - (compact ? 46 : 54)}" text-anchor="end" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="${compact ? 15 : 17}" fill="#6f83a6">Unofficial • MIT • © 2026 Beluga_8292</text>
</svg>`;
}

const bannerSvg = banner({ width: 1600, height: 500, titleSize: 72, subtitleSize: 20, bodySize: 24, compact: false });
const socialSvg = banner({ width: 1280, height: 640, titleSize: 72, subtitleSize: 20, bodySize: 24, compact: true });

await sharp(Buffer.from(bannerSvg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'brand-banner.png'));
await sharp(Buffer.from(socialSvg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'social-preview.png'));
await sharp(ICON).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'icon.png'));

console.log('wrote docs/assets/brand-banner.png, social-preview.png, icon.png');
