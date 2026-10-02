/**
 * Build-time share previews (Open Graph + Twitter cards).
 *
 * Link crawlers don't run JS, so tags must be static HTML. This Vite plugin:
 *  - injects landing tags into dist/index.html
 *  - emits dist/<story-id>/index.html per CATALOG story: the same app shell
 *    (asset URLs are absolute under base) with that story's tags. main.js reads
 *    the story id from the path and preselects it.
 *
 * Titles / blurbs / covers come from CATALOG in src/main.js (read from source,
 * since main.js needs a DOM). tests/share-meta.test.js checks it matches the
 * runtime CATALOG.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_ORIGIN = 'https://theromanceforge.github.io';
export const SITE_NAME = 'Romance Forge';
export const LANDING_DESCRIPTION =
  'Interactive branching spicy romance: you read by choosing, and the path burns different each time. Warm or Hot.';
// Real JPEG copy of hero-branching-fire-tree.png (that file is JPEG bytes under a .png name).
export const LANDING_IMAGE = '/brand/hero-branching-fire-tree.jpg';
export const LANDING_IMAGE_ALT = 'Romance Forge — branching fire tree woodcut';

/** Parse `const CATALOG = [...]` out of src/main.js (assetUrl stubbed to identity). */
export function loadCatalog(mainSrc = readFileSync(join(root, 'src/main.js'), 'utf8')) {
  const start = mainSrc.indexOf('const CATALOG = [');
  const end = mainSrc.indexOf('\n];', start);
  if (start < 0 || end < 0) throw new Error('[share-meta] CATALOG not found in src/main.js');
  const literal = mainSrc.slice(start + 'const CATALOG = '.length, end + 2);
  // eslint-disable-next-line no-new-func
  return new Function('assetUrl', `return ${literal};`)((p) => p);
}

/** MIME type from magic bytes (not the extension). */
export function imageType(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Width/height from a PNG or JPEG header. */
export function imageSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Absolute https URL under the site base, e.g. abs('/romance-forge/', 'brand/x.png'). */
export function abs(base, path = '') {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${SITE_ORIGIN}${b}${String(path).replace(/^\//, '')}`;
}

/** Landscape 1280x720 share art: the story's opening scene illustration. */
// Real-JPEG copy of the reader's scene1.png (JPEG bytes under a .png name; left as-is for page weight).
export const storyShareImage = (id) => `/art/${id}/scene1.jpg`;

/** Alt text matching the reader's own scene-art alt ("Illustration: <scene title>"). */
export function storyShareAlt(story) {
  try {
    const src = readFileSync(join(root, 'artifacts/stories', story.id, 'scenes/scene1.js'), 'utf8');
    const m = src.match(/^\s*title:\s*(["'])(.*?)\1,?\s*$/m);
    if (m) return `Illustration: ${m[2]}`;
  } catch {
    /* fall through */
  }
  return `${story.title} — scene art`;
}

/** Meta values for the landing (story = null) or one CATALOG entry. */
export function pageMeta(base, story = null) {
  if (!story) {
    return {
      title: SITE_NAME,
      description: LANDING_DESCRIPTION,
      url: abs(base),
      image: abs(base, LANDING_IMAGE),
      imagePath: LANDING_IMAGE,
      imageAlt: LANDING_IMAGE_ALT,
      type: 'website',
    };
  }
  return {
    title: `${story.title} — ${SITE_NAME}`,
    description: story.blurb,
    url: abs(base, `${story.id}/`),
    image: abs(base, storyShareImage(story.id)),
    imagePath: storyShareImage(story.id),
    imageAlt: storyShareAlt(story),
    type: 'website',
  };
}

export function metaTags(m) {
  const file = join(root, 'public', m.imagePath);
  const size = imageSize(file);
  const type = imageType(file);
  const tags = [
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    `<meta property="og:image" content="${esc(m.image)}" />`,
    `<meta property="og:image:alt" content="${esc(m.imageAlt)}" />`,
    ...(type ? [`<meta property="og:image:type" content="${type}" />`] : []),
    ...(size
      ? [
          `<meta property="og:image:width" content="${size.width}" />`,
          `<meta property="og:image:height" content="${size.height}" />`,
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(m.imageAlt)}" />`,
  ];
  return tags.map((t) => `    ${t}`).join('\n');
}

/** Put the page's <title> + share tags into a built index.html. */
export function injectMeta(html, m) {
  const out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>\n${metaTags(m)}`);
  if (out === html) throw new Error('[share-meta] <title> not found in index.html');
  return out;
}

export default function shareMeta() {
  let base = '/';
  return {
    name: 'romance-forge-share-meta',
    apply: 'build',
    enforce: 'post',
    configResolved(cfg) {
      base = cfg.base;
    },
    generateBundle(_opts, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const shell = String(index.source);
      index.source = injectMeta(shell, pageMeta(base));
      for (const story of loadCatalog().filter((c) => c.available)) {
        this.emitFile({
          type: 'asset',
          fileName: `${story.id}/index.html`,
          source: injectMeta(shell, pageMeta(base, story)),
        });
      }
    },
  };
}
