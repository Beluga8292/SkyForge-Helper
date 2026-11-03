import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = ['README.md', 'README.ru.md'];
const releaseTag = 'v0.5.0-rc.5-installers';
const requiredSections = {
  'README.md': [
    'Built for SkyBlock players',
    'Everything in one app',
    'Installation',
    'FAQ',
    'Troubleshooting',
    'Community and support',
    'Development',
    'License and credits',
  ],
  'README.ru.md': [
    'Создан для игроков SkyBlock',
    'Всё в одном приложении',
    'Установка',
    'FAQ',
    'Решение проблем',
    'Сообщество и поддержка',
    'Разработка',
    'Лицензия и авторство',
  ],
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
];
const discord = 'https://discord.gg/bX3md4uepp';
const issues = 'https://github.com/Beluga8292/SkyForge-Helper/issues';
const releasePage = `https://github.com/Beluga8292/SkyForge-Helper/releases/tag/${releaseTag}`;
const expectedDownloads = {
  windows: `https://github.com/Beluga8292/SkyForge-Helper/releases/download/${releaseTag}/SkyForge-Helper-Setup-x64.exe`,
  macos: `https://github.com/Beluga8292/SkyForge-Helper/releases/download/${releaseTag}/SkyForge-Helper-macOS-arm64.dmg`,
};

const texts = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const problems = [];

function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

for (const file of files) {
  const text = texts[file];
  for (const heading of requiredSections[file]) {
    if (!new RegExp(`^#{1,3}\\s+.*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(text)) {
      problems.push(`${file}: missing section "${heading}"`);
    }
  }
  if (!text.includes(discord)) problems.push(`${file}: missing Discord link`);
  if (!text.includes(issues)) problems.push(`${file}: missing issues link`);
  if (!text.includes('0.5.0-rc.5')) problems.push(`${file}: missing current version`);
  if (!text.includes(releasePage)) problems.push(`${file}: missing release page link`);
  if (!text.includes('actions/workflows/ci.yml/badge.svg?branch=main')) problems.push(`${file}: missing CI badge`);
  if (!text.includes('actions/workflows/installers.yml/badge.svg?branch=main')) problems.push(`${file}: missing installer badge`);
  if (!text.includes('MIT')) problems.push(`${file}: missing license statement`);

  // Public presentation must not leak internal stage or readiness language.
  for (const forbidden of [/\bSTAGE\s*\d/i, /\bBLOCKED\b/i, /\bNOT TESTED\b/i, /\bNOT STARTED\b/i, /\bPARTIAL\b/]) {
    if (forbidden.test(text)) problems.push(`${file}: internal status language matched ${forbidden}`);
  }
  if (/localhost|127\.0\.0\.1|\/Users\//i.test(text)) {
    problems.push(`${file}: internal host or path in public README`);
  }
  if (/releases\/latest|releases\/download\/[^)\s]*example|download\/\s*\)/i.test(text)) {
    problems.push(`${file}: placeholder or unstable release link`);
  }

  for (const asset of requiredAssets) {
    if (!text.includes(asset)) problems.push(`${file}: missing image reference ${asset}`);
  }

  const localImages = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)|<img[^>]+src="([^"]+)"/g)]
    .map((match) => match[1] || match[2])
    .filter((src) => src && !/^(?:https?:|data:|#)/.test(src));
  for (const image of localImages) {
    if (!fs.existsSync(path.join(root, image))) problems.push(`${file}: missing local image ${image}`);
  }

  const localLinks = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)|<a[^>]+href="([^"]+)"/g)]
    .map((match) => match[1] || match[2])
    .filter((href) => href && !/^(?:https?:|mailto:)/.test(href));
  for (const href of localLinks) {
    const [target, fragment] = href.split('#');
    if (target) {
      if (!fs.existsSync(path.join(root, target))) problems.push(`${file}: broken relative link ${target}`);
      continue;
    }
    if (fragment) {
      const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slug(match[1]));
      if (!headings.includes(fragment)) problems.push(`${file}: broken anchor #${fragment}`);
    }
  }

  const downloads = [...text.matchAll(/https:\/\/github\.com\/Beluga8292\/SkyForge-Helper\/releases\/download\/[^)\s"]+/g)].map((match) => match[0]);
  assert.deepEqual(new Set(downloads), new Set(Object.values(expectedDownloads)), `${file}: download asset URLs differ from the validated release`);
}

for (const asset of requiredAssets) {
  if (!fs.existsSync(path.join(root, asset))) problems.push(`missing asset ${asset}`);
}
for (const link of requiredLinks) {
  if (!fs.existsSync(path.join(root, link))) problems.push(`missing required file ${link}`);
}
if (!texts['README.md'].includes('README.ru.md')) problems.push('README.md: missing Russian language link');
if (!texts['README.ru.md'].includes('README.md')) problems.push('README.ru.md: missing English language link');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

if (process.argv.includes('--network')) {
  const urls = [
    discord,
    releasePage,
    ...Object.values(expectedDownloads),
    'https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/ci.yml/badge.svg?branch=main',
    'https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml/badge.svg?branch=main',
  ];
  for (const url of urls) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) problems.push(`${url}: HTTP ${response.status}`);
    const type = response.headers.get('content-type') ?? '';
    const binary = expectedDownloads && Object.values(expectedDownloads).includes(url);
    if (binary && /text\/html/i.test(type)) problems.push(`${url}: returned an HTML page instead of a file`);
    if (/badge\.svg/.test(url) && !/svg/i.test(type)) problems.push(`${url}: badge is not an SVG`);
    console.log(`${response.status} ${type.split(';')[0]} ${url}`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}

console.log(`README check PASS: ${files.length} languages, ${requiredAssets.length} local assets, ${requiredLinks.length} required files, ${Object.keys(expectedDownloads).length} release assets`);
