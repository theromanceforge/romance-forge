import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const LIVE = ['until-the-quiet-breaks', 'what-the-sister-kept', 'the-living-key', 'the-soft-alibi'];

let mod;
let app;
beforeAll(async () => {
  window.scrollTo = () => {};
  document.body.innerHTML = '<div id="app"></div>';
  mod = await import('../src/main.js');
  mod.setState({ view: 'landing' });
  app = document.getElementById('app');
});

describe('Called Home lead teaser + Off the Clock coming-soon card', () => {
  it('CATALOG keeps exactly the four live stories, in their existing order, all playable', () => {
    expect(mod.CATALOG.map((c) => c.id)).toEqual(LIVE);
    expect(mod.CATALOG.every((c) => c.available)).toBe(true);
    expect(mod.CATALOG.map((c) => c.id)).not.toContain('called-home');
    expect(mod.CATALOG.map((c) => c.id)).not.toContain('off-the-clock');
  });

  it('COMING_SOON order: Called Home lead, then Off the Clock', () => {
    expect(mod.COMING_SOON.map((c) => [c.id, c.title, c.lead])).toEqual([
      ['called-home', 'Called Home', true],
      ['off-the-clock', 'Off the Clock', false],
    ]);
  });

  it('lead teaser renders at the top, before the forge strip and the playable cover hero', () => {
    const lead = app.querySelector('[data-testid="lead-hero"]');
    expect(lead).toBeTruthy();
    expect(lead.getAttribute('data-story-id')).toBe('called-home');
    expect(lead.querySelector('.lead-title').textContent).toBe('Called Home');
    expect(lead.querySelector('[data-testid="lead-teaser"]').textContent).toBe(
      "The owner's daughter inherits her father's team, and the board wants the aging star gone."
    );
    expect(lead.querySelector('[data-testid="lead-cover"]').getAttribute('src')).toMatch(
      /\/art\/called-home\/palette-test-mood\.jpg$/
    );
    expect(lead.querySelector('[data-testid="lead-swatches"]').getAttribute('src')).toMatch(
      /\/art\/called-home\/palette-test-swatches\.jpg$/
    );
    const order = [...app.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid'));
    const i = (id) => order.indexOf(id);
    expect(i('lead-hero')).toBeGreaterThan(-1);
    expect(i('lead-hero')).toBeLessThan(i('soon-off-the-clock'));
    expect(i('soon-off-the-clock')).toBeLessThan(i('forge-strip'));
    expect(i('forge-strip')).toBeLessThan(i('start-reading'));
  });

  it('Called Home and Off the Clock cannot be started (no picker card, button, form, or share page)', () => {
    for (const id of ['called-home', 'off-the-clock']) {
      expect(app.querySelector(`[data-action="pick-story"][data-story-id="${id}"]`)).toBeNull();
      expect(app.querySelector(`[data-testid="story-${id}"]`)).toBeNull();
    }
    const teasers = app.querySelectorAll('[data-testid="lead-hero"], [data-testid="soon-off-the-clock"]');
    expect(teasers).toHaveLength(2);
    for (const t of teasers) {
      expect(t.querySelector('button, form, input, a, [data-action]')).toBeNull();
    }
    // picker cards = the four live stories in order; hero still a live story
    const cards = [...app.querySelectorAll('[data-action="pick-story"]')].map((b) => b.getAttribute('data-story-id'));
    expect(cards).toEqual(LIVE);
    expect(app.querySelector('#story-heading').textContent).toBe('Until the Quiet Breaks');
    expect(mod.state.storyId).toBe('until-the-quiet-breaks');
  });

  it('live stories keep their existing cover/accent art', () => {
    const byId = Object.fromEntries(mod.CATALOG.map((c) => [c.id, c]));
    for (const id of LIVE) {
      expect(byId[id].accentSrc).toMatch(new RegExp(`/brand/cover-${id}-square\\.png$`));
      expect(byId[id].coverSrc).toMatch(new RegExp(`/brand/cover-${id}\\.png$`));
    }
  });

  it('palette is scoped to the two teasers; :root ink-and-ember and live-story rules unchanged', () => {
    for (const [k, v] of Object.entries({
      '--ink': '#070605', '--charcoal': '#0e0c0a', '--parchment': '#f7f1e4',
      '--amber': '#f0a84a', '--amber-glow': '#f6c070', '--amber-ember': '#d4842e', '--line': '#3a3026',
    })) {
      expect(css).toMatch(new RegExp(`:root \\{[\\s\\S]*?${k}: ${v};`));
    }
    for (const id of LIVE) expect(css).not.toContain(`data-story-id="${id}"`);
    // every new --ch-/--otc- variable lives inside a story-id-scoped rule
    const blocks = css.split('}').filter((b) => /--(ch|otc)-[a-z-]+:/.test(b));
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b).toMatch(/\[data-story-id="(called-home|off-the-clock)"\]/);
    // live-story base rules untouched vs. base commit
    const baseCss = execSync('git show 182481c:src/styles.css', { cwd: root, encoding: 'utf8' });
    expect(css.startsWith(baseCss.trimEnd())).toBe(true);
  });

  it('temporary palette-test art is present in public/', () => {
    for (const f of ['called-home/palette-test-mood.jpg', 'called-home/palette-test-swatches.jpg', 'off-the-clock/palette-test-mood.jpg']) {
      expect(existsSync(join(root, 'public/art', f)), f).toBe(true);
    }
  });
});
