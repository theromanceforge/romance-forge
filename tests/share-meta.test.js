import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import shareMeta, { loadCatalog, imageType, imageSize, storyShareAlt } from '../scripts/share-meta.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/romance-forge/';
const SITE = 'https://theromanceforge.github.io/romance-forge/';
const STORY_IDS = ['until-the-quiet-breaks', 'what-the-sister-kept', 'the-living-key', 'the-soft-alibi'];

/** Run the plugin's generateBundle on the real index.html shell. */
function generate() {
  const plugin = shareMeta();
  plugin.configResolved({ base: BASE });
  const bundle = { 'index.html': { type: 'asset', source: readFileSync(join(root, 'index.html'), 'utf8') } };
  const emitted = {};
  plugin.generateBundle.call(
    { emitFile: (f) => { emitted[f.fileName] = String(f.source); } },
    {},
    bundle
  );
  return { landing: String(bundle['index.html'].source), ...emitted };
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function meta(html, key) {
  const attr = key.startsWith('og:') ? 'property' : 'name';
  const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)" />`));
  return m ? decode(m[1]) : null;
}

const REQUIRED = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];

describe('share previews (OG + Twitter)', () => {
  it('build-time CATALOG matches the runtime CATALOG in main.js', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const { CATALOG } = await import('../src/main.js');
    const strip = (c) => ({ id: c.id, title: c.title, blurb: c.blurb, available: c.available,
      cover: c.coverSrc.replace(/^\/romance-forge\//, '/').replace(/^\/?/, '/') });
    expect(loadCatalog().map(strip)).toEqual(CATALOG.map(strip));
  });

  it('landing has all tags with absolute https URLs', () => {
    const { landing } = generate();
    for (const k of REQUIRED) expect(meta(landing, k), k).toBeTruthy();
    expect(meta(landing, 'og:title')).toBe('Romance Forge');
    expect(meta(landing, 'og:url')).toBe(SITE);
    expect(meta(landing, 'og:image')).toBe(`${SITE}brand/hero-branching-fire-tree.jpg`);
    expect(meta(landing, 'twitter:image')).toBe(`${SITE}brand/hero-branching-fire-tree.jpg`);
    expect(meta(landing, 'og:image:type')).toBe('image/jpeg');
    expect(meta(landing, 'og:image:width')).toBe('1280');
    expect(meta(landing, 'og:image:height')).toBe('720');
    expect(meta(landing, 'twitter:card')).toBe('summary_large_image');
    expect(landing).toContain('<title>Romance Forge</title>');
  });

  it.each(STORY_IDS)('%s gets its own page with its title, blurb and cover', (id) => {
    const pages = generate();
    const html = pages[`${id}/index.html`];
    expect(html, `${id}/index.html emitted`).toBeTruthy();
    const story = loadCatalog().find((c) => c.id === id);
    for (const k of REQUIRED) expect(meta(html, k), `${id} ${k}`).toBeTruthy();
    expect(meta(html, 'og:title')).toBe(`${story.title} — Romance Forge`);
    expect(meta(html, 'twitter:title')).toBe(`${story.title} — Romance Forge`);
    expect(meta(html, 'og:description')).toBe(story.blurb);
    expect(meta(html, 'twitter:description')).toBe(story.blurb);
    expect(meta(html, 'og:url')).toBe(`${SITE}${id}/`);
    const img = `${SITE}art/${id}/scene1.jpg`;
    expect(meta(html, 'og:image')).toBe(img);
    expect(meta(html, 'twitter:image')).toBe(img);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'og:image:width')).toBe('1280');
    expect(meta(html, 'og:image:height')).toBe('720');
    expect(meta(html, 'og:image:type')).toBe('image/jpeg');
    expect(meta(html, 'og:image:alt')).toBe(storyShareAlt(story));
    expect(meta(html, 'og:image:alt')).toMatch(/^Illustration: \S/);
    expect(meta(html, 'twitter:image:alt')).toBe(meta(html, 'og:image:alt'));
    // share copy is byte-identical to the reader's scene1.png, which stays untouched
    const shareBytes = readFileSync(join(root, 'public/art', id, 'scene1.jpg'));
    expect(shareBytes.equals(readFileSync(join(root, 'public/art', id, 'scene1.png')))).toBe(true);
    expect(html).not.toContain('scene1.png');
    // same app shell: app root + module script still present
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('src/main.js');
  });

  it("every share image's bytes match its extension and declared og:image:type", () => {
    const pages = generate();
    const ext = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    for (const [name, html] of Object.entries(pages)) {
      const url = meta(html, 'og:image');
      const file = join(root, 'public', url.slice(SITE.length));
      const bytes = readFileSync(file);
      const magic = bytes[0] === 0x89 && bytes.toString('latin1', 1, 4) === 'PNG' ? 'image/png'
        : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : 'unknown';
      expect(magic, `${name} ${url}`).toBe(ext[url.split('.').pop().toLowerCase()]);
      expect(meta(html, 'og:image:type'), name).toBe(magic);
      expect(imageType(file)).toBe(magic);
      expect(imageSize(file), name).toEqual({ width: 1280, height: 720 });
    }
  });

  it('reader still loads scene art from scene1.png (share .jpg is tags-only)', async () => {
    const { getSceneArtPath } = await import('../src/engine.js');
    for (const id of STORY_IDS) {
      expect(getSceneArtPath(id, { id: 'scene1' })).toBe(`/art/${id}/scene1.png`);
    }
    const src = readFileSync(join(root, 'src/main.js'), 'utf8');
    expect(src).not.toMatch(/scene1\.jpg/);
  });

  it('main.js deep-links the story from the share path', () => {
    const src = readFileSync(join(root, 'src/main.js'), 'utf8');
    expect(src).toMatch(/location\.pathname[\s\S]{0,200}CATALOG\.some\(\(c\) => c\.id === fromPath && c\.available\)\) return fromPath/);
  });
});
