// Builds the Míre logo, app icons and favicon from Sora Bold (SPEC-0003 §6).
// Run by hand with `pnpm build:logo`; the generated files are versioned.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import opentype from 'opentype.js';

const ROOT = new URL('../', import.meta.url);
const FONT = 'node_modules/@fontsource/sora/files/sora-latin-700-normal.woff';

const NIGHT = '#0B132B';
const OFF_WHITE = '#F8FAFC';
const EMERALD = '#10B981';
const EMERALD_TEXT = '#047857';

// Geometry in em units (1 em = EM user units).
const EM = 100;
const TRACKING = 0.02 * EM;
const MACRON_WIDTH = 0.52 * EM;
const MACRON_THICKNESS = 0.09 * EM;
const MACRON_GAP = 0.08 * EM;

/** @param {number} n */
const r = (n) => Math.round(n * 100) / 100;

/** @param {number} x @param {number} y @param {number} w @param {number} h */
const rectPath = (x, y, w, h) => `M${r(x)} ${r(y)}H${r(x + w)}V${r(y + h)}H${r(x)}Z`;

/**
 * Lays out a word with Sora Bold on the baseline y = 0 and puts a macron over the letter at
 * `macronIndex`. Returns the letters and macron as path data plus the tight ink box.
 * @param {import('opentype.js').Font} font
 * @param {string} word
 * @param {number} macronIndex
 */
function layout(font, word, macronIndex) {
  const scale = EM / font.unitsPerEm;
  const capHeight = font.tables.os2.sCapHeight * scale;
  let x = 0;
  let letters = '';
  let minX = Infinity;
  let maxX = -Infinity;
  let macron = '';
  [...word].forEach((char, i) => {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(x, 0, EM);
    const box = path.getBoundingBox();
    letters += path.toPathData(2);
    minX = Math.min(minX, box.x1);
    maxX = Math.max(maxX, box.x2);
    if (i === macronIndex) {
      const centre = (box.x1 + box.x2) / 2;
      const top = -(capHeight + MACRON_GAP + MACRON_THICKNESS);
      macron = rectPath(centre - MACRON_WIDTH / 2, top, MACRON_WIDTH, MACRON_THICKNESS);
      minX = Math.min(minX, centre - MACRON_WIDTH / 2);
      maxX = Math.max(maxX, centre + MACRON_WIDTH / 2);
    }
    x += (glyph.advanceWidth ?? 0) * scale + TRACKING;
  });
  const minY = -(capHeight + MACRON_GAP + MACRON_THICKNESS);
  return { letters, macron, box: { x: minX, y: minY, width: maxX - minX, height: -minY } };
}

/**
 * @param {ReturnType<typeof layout>} logo
 * @param {string} letterColor
 * @param {string} macronColor
 */
function logoSvg({ letters, macron, box }, letterColor, macronColor) {
  const viewBox = [box.x, box.y, box.width, box.height].map(r).join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
    `width="${r(box.width)}" height="${r(box.height)}">` +
    `<path fill="${letterColor}" d="${letters}"/>` +
    `<path fill="${macronColor}" d="${macron}"/></svg>\n`
  );
}

/**
 * Square icon with the logo centred and `widthShare` of the side as its width.
 * @param {ReturnType<typeof layout>} logo
 * @param {number} widthShare
 */
function iconSvg({ letters, macron, box }, widthShare) {
  const side = box.width / widthShare;
  const x = box.x - (side - box.width) / 2;
  const y = box.y - (side - box.height) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[x, y, side, side].map(r).join(' ')}">` +
    `<path fill="${NIGHT}" d="${rectPath(x, y, side, side)}"/>` +
    `<path fill="${OFF_WHITE}" d="${letters}"/>` +
    `<path fill="${EMERALD}" d="${macron}"/></svg>\n`
  );
}

/** Favicon: the M with a macron over it on a rounded night square (32 × 32). */
function faviconSvg(/** @type {import('opentype.js').Font} */ font) {
  const m = layout(font, 'M', 0);
  const scale = 21 / m.box.width;
  const tx = (32 - m.box.width * scale) / 2 - m.box.x * scale;
  const ty = (32 - m.box.height * scale) / 2 - m.box.y * scale;
  const transform = `translate(${r(tx)} ${r(ty)}) scale(${r(scale * 1000) / 1000})`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<path fill="${NIGHT}" d="M6 0H26A6 6 0 0 1 32 6V26A6 6 0 0 1 26 32H6A6 6 0 0 1 0 26V6A6 6 0 0 1 6 0Z"/>` +
    `<g transform="${transform}"><path fill="${OFF_WHITE}" d="${m.letters}"/>` +
    `<path fill="${EMERALD}" d="${m.macron}"/></g></svg>\n`
  );
}

/** @param {string} path @param {string} content */
async function write(path, content) {
  await writeFile(new URL(path, ROOT), content);
  console.log(`build-logo: ${path}`);
}

const buffer = await readFile(new URL(FONT, ROOT));
const font = opentype.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);
const logo = layout(font, 'MIRE', 1);

await write('src/brand/logo-light.svg', logoSvg(logo, NIGHT, EMERALD_TEXT));
await write('src/brand/logo-dark.svg', logoSvg(logo, OFF_WHITE, EMERALD));
await write('src/brand/logo-on-top.svg', logoSvg(logo, OFF_WHITE, EMERALD));
const favicon = faviconSvg(font);
await write('public/favicon.svg', favicon);

/** @type {[path: string, svg: string, size: number][]} */
const rasters = [
  ['public/icons/icon-192.png', iconSvg(logo, 0.76), 192],
  ['public/icons/icon-512.png', iconSvg(logo, 0.76), 512],
  ['public/icons/icon-maskable-512.png', iconSvg(logo, 0.62), 512],
  ['public/favicon-32.png', favicon, 32],
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [path, svg, size] of rasters) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({
      path: new URL(path, ROOT).pathname,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`build-logo: ${path}`);
  }
} finally {
  await browser.close();
}
