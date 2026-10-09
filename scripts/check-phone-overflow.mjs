#!/usr/bin/env node
/**
 * Phone layout check: walks EVERY element (getBoundingClientRect ignores
 * overflow clipping, so this also catches content hidden by an
 * overflow:hidden/clip ancestor) and fails if anything extends past the
 * viewport's right/left edge at 390×844 and 360×780. Also fails if the
 * document scrolls sideways or the page starts zoomed (visualViewport.scale≠1).
 *
 * Pages: landing, landing with a story selected, scene 1 of The Soft Alibi and
 * The Living Key (Warm, default name), and every share page /<story-id>/.
 * Event POSTs are aborted, so prod analytics stay clean.
 *
 * Usage (against `npm run preview` or any served build):
 *   node scripts/check-phone-overflow.mjs [baseUrl]
 * Needs playwright-core + a Chrome/Chromium. Not a project dependency; point
 * RF_PLAYWRIGHT at an installed playwright-core entry if it isn't resolvable,
 * and CHROME_PATH at the browser (default /usr/bin/google-chrome).
 */
import { pathToFileURL } from 'node:url';

const base = (process.argv[2] || 'http://127.0.0.1:4188/romance-forge/').replace(/\/?$/, '/');
const STORY_IDS = ['until-the-quiet-breaks', 'what-the-sister-kept', 'the-living-key', 'the-soft-alibi'];
const SIZES = [
  [390, 844],
  [360, 780],
];

let pw;
try {
  pw = process.env.RF_PLAYWRIGHT
    ? await import(pathToFileURL(process.env.RF_PLAYWRIGHT).href)
    : await import('playwright-core');
} catch {
  console.error('[check-phone-overflow] playwright-core not found (set RF_PLAYWRIGHT=/path/to/playwright-core/index.mjs)');
  process.exit(2);
}
const { chromium } = pw.default ?? pw;

function inspect() {
  const vw = window.innerWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= vw + 0.5 && r.left >= -0.5) continue;
    const parent = el.parentElement?.getBoundingClientRect();
    // Report the outermost offender of each branch only.
    if (parent && (parent.right > vw + 0.5 || parent.left < -0.5)) continue;
    offenders.push(
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` +
        ` left=${r.left.toFixed(1)} right=${r.right.toFixed(1)}`,
    );
  }
  return {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    scale: window.visualViewport ? window.visualViewport.scale : 1,
    offenders,
  };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
let failures = 0;
for (const [width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/rest\/v1\/events/, (r) => r.abort());
  const page = await ctx.newPage();
  const check = async (label) => {
    await page.waitForTimeout(700); // let entrance animations settle
    const r = await page.evaluate(inspect);
    const ok = r.offenders.length === 0 && r.scrollWidth <= r.vw && Math.abs(r.scale - 1) < 0.001;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${width}x${height} ${label}: scrollWidth=${r.scrollWidth} scale=${r.scale}` +
        (r.offenders.length ? `\n      ${r.offenders.slice(0, 10).join('\n      ')}` : ''),
    );
  };
  for (const storyId of ['the-soft-alibi', 'the-living-key']) {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(base, { waitUntil: 'networkidle' });
    if (storyId === 'the-soft-alibi') await check('landing');
    await page.click(`[data-testid="story-${storyId}"]`);
    await check(`landing, ${storyId} selected`);
    await page.locator('label:has-text("Warm")').first().click();
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForSelector('[data-testid="choice-prompt"]', { state: 'attached', timeout: 30000 });
    await check(`${storyId} scene 1`);
  }
  for (const id of STORY_IDS) {
    await page.goto(`${base}${id}/`, { waitUntil: 'networkidle' });
    await check(`share page /${id}/`);
  }
  await ctx.close();
}
await browser.close();
if (failures) {
  console.error(`[check-phone-overflow] ${failures} check(s) failed`);
  process.exit(1);
}
console.log('[check-phone-overflow] all clear');
