import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../src/auth/supabaseClient.js', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
  __resetSupabaseClientForTests: () => {},
}));

/** Top-level (not inside @media etc.) CSS rules: [{ selectors: string[], body: string }]. */
function topLevelRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let depth = 0;
  let start = 0;
  let selector = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') {
      if (depth === 0) {
        selector = src.slice(start, i).trim();
        start = i + 1;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        if (!selector.startsWith('@')) {
          rules.push({ selectors: selector.split(',').map((x) => x.trim()), body: src.slice(start, i) });
        }
        start = i + 1;
      }
    }
  }
  return rules;
}

const css = fs.readFileSync(path.resolve(__dirname, '../src/styles.css'), 'utf8');
const rules = topLevelRules(css);

let mod;
beforeAll(async () => {
  window.scrollTo = () => {};
  document.body.innerHTML = '<div id="app"></div>';
  mod = await import('../src/main.js');
}, 60000);

describe('landing images keep their aspect-ratio crop at every width', () => {
  it('every landing <img> with width/height attrs and a CSS aspect-ratio also gets height:auto (or a max-height cap) outside media queries', () => {
    const checked = new Set();
    const problems = [];
    for (const id of mod.CATALOG.map((c) => c.id)) {
      mod.setState({ view: 'landing', storyId: id });
      for (const img of document.querySelectorAll('#app img[height]')) {
        for (const cls of img.classList) {
          if (checked.has(cls)) continue;
          checked.add(cls);
          const own = rules.filter((r) => r.selectors.some((sel) => new RegExp(`\\.${cls}$`).test(sel)));
          const hasRatio = own.some((r) => /aspect-ratio:\s*(?!auto)[\d.]+\s*\/\s*[\d.]+/.test(r.body));
          if (!hasRatio) continue;
          const sized = own.some((r) => /(^|[;\s])height:\s*auto/.test(r.body) || /max-height:/.test(r.body));
          if (!sized) problems.push(`.${cls} (img height="${img.getAttribute('height')}")`);
        }
      }
    }
    expect(checked.has('start-dock-cover')).toBe(true);
    expect(problems).toEqual([]);
  });

  it('start-dock cover: phone base rule is height:auto + 6/5 crop', () => {
    const base = rules.find((r) => r.selectors.includes('.start-dock-cover'));
    expect(base.body).toMatch(/height:\s*auto/);
    expect(base.body).toMatch(/aspect-ratio:\s*6 \/ 5/);
  });
});
