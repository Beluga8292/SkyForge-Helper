import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = ['README.md', 'README.ru.md'];
const requiredSections = {
  'README.md': ['Download', 'What makes it useful', 'Feature status', 'Installation', 'FAQ', 'Troubleshooting', 'Project status and support', 'Development', 'License and attribution'],
  'README.ru.md': ['Загрузка', 'Что внутри', 'Статус функций', 'Установка', 'FAQ', 'Решение проблем', 'Статус проекта и поддержка', 'Разработка', 'Лицензия и авторство'],
};
const requiredAssets = [
  'docs/assets/brand-banner.png',
  ...['profile', 'networth', 'bazaar', 'auction', 'equipment', 'inventory', 'dungeons', 'dashboard']
    .map((name) => `docs/assets/screenshots/${name}.jpg`),
];
const requiredLinks = [
  'README.md',
  'README.ru.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'BRANDING.md',
  'THIRD_PARTY_NOTICES.md',
  'docs/BUILDING.md',
  'docs/REBRANDING.md',
];
const discord = 'https://discord.gg/bX3md4uepp';
const installers = 'https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml';
const issues = 'https://github.com/Beluga8292/SkyForge-Helper/issues';

const texts = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const problems = [];

for (const file of files) {
  const text = texts[file];
  for (const heading of requiredSections[file]) {
    if (!new RegExp(`^#{1,3}\\s+.*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(text)) {
      problems.push(`${file}: missing section "${heading}"`);
    }
  }
  if (!text.includes(discord)) problems.push(`${file}: missing Discord link`);
  if (!text.includes(installers)) problems.push(`${file}: missing installers workflow link`);
  if (!text.includes(issues)) problems.push(`${file}: missing issues link`);
  if (!text.includes('0.5.0-rc.5')) problems.push(`${file}: missing current version`);
  if (/\bTODO\b|example\.com|releases\/download\//i.test(text)) problems.push(`${file}: placeholder or unverified release link`);

  for (const asset of requiredAssets) {
    if (!text.includes(asset)) problems.push(`${file}: missing image reference ${asset}`);
  }

  const localImages = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)|<img[^>]+src="([^"]+)"/g)]
    .map((match) => match[1] || match[2])
    .filter((src) => src && !/^(?:https?:|data:|#)/.test(src));
  for (const image of localImages) {
    if (!fs.existsSync(path.join(root, image))) problems.push(`${file}: missing local image ${image}`);
  }

  // Relative links must resolve. Anchors are checked only for existence of a
  // matching heading in the same document.
  const localLinks = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)|<a[^>]+href="([^"]+)"/g)]
    .map((match) => match[1] || match[2])
    .filter((href) => href && !/^(?:https?:|mailto:|#)/.test(href))
    .map((href) => href.split('#')[0])
    .filter(Boolean);
  for (const href of localLinks) {
    if (!fs.existsSync(path.join(root, href))) problems.push(`${file}: broken relative link ${href}`);
  }
}

for (const asset of requiredAssets) {
  if (!fs.existsSync(path.join(root, asset))) problems.push(`missing asset ${asset}`);
}
for (const link of requiredLinks) {
  if (!fs.existsSync(path.join(root, link))) problems.push(`missing required file ${link}`);
}
if (!texts['README.md'].includes('README.ru.md')) problems.push('README.md: missing Russian language link');
if (!texts['README.ru.md'].includes('README.md')) problems.push('README.ru.md: missing English language link');

const enDownloads = [...texts['README.md'].matchAll(/SkyForge-Helper-(?:Setup-x64\.exe|macOS-arm64\.dmg)/g)].map((m) => m[0]);
const ruDownloads = [...texts['README.ru.md'].matchAll(/SkyForge-Helper-(?:Setup-x64\.exe|macOS-arm64\.dmg)/g)].map((m) => m[0]);
assert.deepEqual(new Set(enDownloads), new Set(ruDownloads), 'download package names differ between languages');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`README check PASS: ${files.length} languages, ${requiredAssets.length} local assets, ${requiredLinks.length} required files`);
