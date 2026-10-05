import { describe, it, expect, beforeAll } from 'vitest';
import { renderAuthModal } from '../src/auth/ui.js';
import { renderEndingReviewPanel } from '../src/reviews/ui.js';

/** Internal planning / dev words that must never reach reader-facing UI copy. */
const FORBIDDEN = [
  /BookTok/i,
  /TikTok/i,
  /\bLayer \d/,
  /\bMVP\b/,
  /\bPhase \d/i,
  /target audience/i,
  /scene module/i,
  /\bTODO\b/,
  /lorem/i,
  /finished playable/i,
  /Contact CS/,
  /cloud auth/i,
  /scene&nbsp;1/,
  /Illustration for scene/i,
];

/** Visible text only (drop tags, attributes like data-testid/class names). */
function visibleText(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll('script, style').forEach((n) => n.remove());
  const attrs = [...clone.querySelectorAll('[alt],[aria-label],[placeholder],[title]')]
    .flatMap((el) => ['alt', 'aria-label', 'placeholder', 'title'].map((a) => el.getAttribute(a) || ''));
  return `${clone.textContent}\n${attrs.join('\n')}`;
}

function expectClean(text) {
  for (const re of FORBIDDEN) expect(text, String(re)).not.toMatch(re);
}

let mod;
beforeAll(async () => {
  window.scrollTo = () => {}; // jsdom has no scrollTo; render() calls it on view change
  document.body.innerHTML = '<div id="app"></div>';
  mod = await import('../src/main.js');
});

describe('reader-facing copy has no internal planning language', () => {
  it('rendered landing is clean and keeps the reader pitch', () => {
    mod.setState({ view: 'landing' });
    const app = document.getElementById('app');
    const text = visibleText(app);
    expectClean(text);
    expect(app.querySelector('[data-testid="forge-strip"]').textContent).toMatch(/wine-night readers/);
    expect(text).toMatch(/Contact us/);
  });

  it('rendered reader shows "Chapter N of 10", never "Layer N"', () => {
    const storyId = mod.CATALOG.find((c) => c.available).id;
    const story = mod.getStory(storyId);
    mod.setState({
      view: 'reader',
      storyId,
      sceneId: story.startSceneId,
      playerName: 'Eleanor',
      spice: 'warm',
      path: [story.startSceneId],
    });
    const app = document.getElementById('app');
    const label = app.querySelector('[data-testid="layer-progress"]');
    expect(label?.textContent.trim()).toBe(`Chapter ${story.scenes[story.startSceneId].layer} of 10`);
    // Scene prose belongs to the writers — only check the chrome around it.
    const chrome = app.cloneNode(true);
    chrome.querySelector('[data-testid="scene-text"]')?.remove();
    expectClean(visibleText(chrome));
    expect(app.innerHTML).not.toMatch(/>\s*Layer \d/);
  });

  it('every story keeps a Chapter label through a later scene', () => {
    for (const c of mod.CATALOG.filter((x) => x.available)) {
      const story = mod.getStory(c.id);
      const later = Object.values(story.scenes).find((s) => s.layer === 5);
      mod.setState({ view: 'reader', storyId: c.id, sceneId: later.id, playerName: 'Eleanor', spice: 'hot', path: [later.id] });
      const label = document.querySelector('[data-testid="layer-progress"]');
      expect(label?.textContent.trim()).toBe('Chapter 5 of 10');
    }
  });

  it('auth modal and ending review panel copy are clean', () => {
    for (const cloudConfigured of [true, false]) {
      const div = document.createElement('div');
      div.innerHTML = renderAuthModal({ open: true, cloudConfigured });
      // The dev-only demo/mock row is intentionally out of scope here.
      div.querySelector('.auth-mock-row')?.remove();
      expectClean(visibleText(div));
    }
    const panel = document.createElement('div');
    panel.innerHTML = renderEndingReviewPanel({ storyId: 'until-the-quiet-breaks', storyTitle: 'Until the Quiet Breaks' });
    expectClean(visibleText(panel));
    expect(panel.textContent).toMatch(/Contact us/);
  });
});

describe('ending-screen closing line', () => {
  const QUIET = "The quiet isn't done with you.";
  const NEUTRAL = 'Your story ends here — for now.';

  function renderEnding(storyId) {
    const story = mod.getStory(storyId);
    const ending = Object.values(story.scenes).find((s) => s.layer === 10 && !(s.choices || []).length);
    expect(ending, `${storyId} has an ending`).toBeTruthy();
    mod.setState({ view: 'reader', storyId, sceneId: ending.id, playerName: 'Eleanor', spice: 'warm', path: [story.startSceneId, ending.id] });
    const note = document.querySelector('[data-testid="ending-note"]');
    expect(note, `${storyId} ending note`).toBeTruthy();
    return note.textContent.trim();
  }

  it('Until the Quiet Breaks keeps its own line', () => {
    expect(renderEnding('until-the-quiet-breaks')).toBe(QUIET);
  });

  it.each(['what-the-sister-kept', 'the-living-key', 'the-soft-alibi'])(
    '%s shows the neutral line, never the Quiet Breaks line',
    (id) => {
      const text = renderEnding(id);
      expect(text).toBe(NEUTRAL);
      expect(document.getElementById('app').textContent).not.toContain(QUIET);
    }
  );

  it('endingLine is optional per CATALOG entry with a neutral fallback', () => {
    expect(mod.DEFAULT_ENDING_LINE).toBe(NEUTRAL);
    expect(mod.endingLineFor('until-the-quiet-breaks')).toBe(QUIET);
    expect(mod.endingLineFor('no-such-story')).toBe(NEUTRAL);
    const withLine = mod.CATALOG.filter((c) => c.endingLine).map((c) => c.id);
    expect(withLine).toEqual(['until-the-quiet-breaks']);
  });
});
