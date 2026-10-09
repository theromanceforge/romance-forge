import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, pageMeta } from '../scripts/share-meta.mjs';

vi.mock('../src/auth/supabaseClient.js', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
  __resetSupabaseClientForTests: () => {},
}));

// Scribe's final catalog copy (voice-checked Oct 9). Exact text.
const BLURB = {
  'until-the-quiet-breaks':
    "Fifteen years gone. One letter that never quite asks you to come home. In Somerton the rain hasn't changed, and neither, it seems, has the man who stayed.",
  'what-the-sister-kept':
    "Seven years of Harborwick fog. Then a detective on your doorstep who says your name like it's evidence.",
  'the-living-key':
    'Ashmere Collegium hums with old wards and older secrets. Tonight you stand your trial before the whole cliff, and the man they send for you does not look away.',
  'the-soft-alibi':
    'Crownspire is all glass and good manners. The wine is open, the hour is late, and the man across the hall needs you to remember tonight exactly his way.',
};
const SHORT = {
  'until-the-quiet-breaks': 'Fifteen years gone. One letter. A town in the rain, and the man who stayed.',
  'the-living-key': "The wards are singing wrong—and the handler they send for you won't look away.",
  'what-the-sister-kept': 'Seven years of fog. A detective who already knows your name.',
  'the-soft-alibi': 'A late knock. An open bottle. A neighbor who needs your version of tonight.',
};
const HOOK = {
  'until-the-quiet-breaks': 'Somerton rain. John Shaw still waiting. A quiet that wants to break— on your terms.',
  'the-living-key': 'Ashmere Collegium. Cassian Rook. The wards are singing wrong.',
  'what-the-sister-kept': 'Harborwick fog. William Akers at the door. A secret seven years deep.',
  'the-soft-alibi': 'Crownspire glass. Nolan Greer across the hall. A story he needs you to tell his way.',
};

let mod;
beforeAll(async () => {
  window.scrollTo = () => {};
  document.body.innerHTML = '<div id="app"></div>';
  mod = await import('../src/main.js');
}, 60000);

describe('catalog teaser copy (Scribe final)', () => {
  it('blurb, blurbShort and hook match Scribe exactly', () => {
    for (const c of mod.CATALOG) {
      expect(c.blurb, c.id).toBe(BLURB[c.id]);
      expect(c.blurbShort, c.id).toBe(SHORT[c.id]);
      expect(c.hook, c.id).toBe(HOOK[c.id]);
    }
  });

  it('old hook-spoiling phrases are gone from blurbs and hooks', () => {
    const text = mod.CATALOG.map((c) => `${c.blurb} ${c.blurbShort} ${c.hook}`).join(' ');
    for (const spoiler of [/missing sister/i, /cold case/i, /where Vivienne went/i, /Mrs\. Greer/i, /neighbor-mistress/i, /living key could/i, /Renny/]) {
      expect(text).not.toMatch(spoiler);
    }
  });

  it('share previews (og/twitter description) use the new blurb', () => {
    const catalog = loadCatalog(readFileSync(join(__dirname, '../src/main.js'), 'utf8'));
    for (const c of catalog) {
      expect(c.blurb).toBe(BLURB[c.id]);
      expect(pageMeta('/romance-forge/', c).description).toBe(BLURB[c.id]);
    }
  });

  it('selected card renders full blurb + phone one-liner (CSS swaps them <640px)', () => {
    mod.setState({ view: 'landing', storyId: 'the-soft-alibi' });
    const card = document.querySelector('[data-testid="story-the-soft-alibi"]');
    expect(card.querySelector('[data-testid="blurb-full"]').textContent).toBe(BLURB['the-soft-alibi']);
    expect(card.querySelector('[data-testid="blurb-short"]').textContent).toBe(SHORT['the-soft-alibi']);
    const css = readFileSync(join(__dirname, '../src/styles.css'), 'utf8');
    expect(css).toMatch(
      /\.page\.landing\.cover-landing \.catalog-card \.story-card-blurb\.blurb-full\s*\{\s*display:\s*block;\s*-webkit-line-clamp:\s*unset;/,
    );
    // Must out-rank `.page.landing.cover-landing .catalog-card .story-card-blurb`
    // (display:-webkit-box line clamp), which otherwise shows both spans.
    expect(css).toMatch(
      /\.page\.landing\.cover-landing \.catalog-card \.story-card-blurb\.blurb-short\s*\{\s*display:\s*none;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 639px\)\s*\{\s*\.story-card-blurb\.blurb-full,\s*\.page\.landing\.cover-landing \.catalog-card \.story-card-blurb\.blurb-full\s*\{\s*display:\s*none;/,
    );
  });
});
