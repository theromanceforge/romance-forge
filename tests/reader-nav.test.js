import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/auth/supabaseClient.js', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
  __resetSupabaseClientForTests: () => {},
}));

const $ = (sel) => document.querySelector(sel);
let mod;

beforeAll(async () => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  document.body.innerHTML = '<div id="app"></div>';
  mod = await import('../src/main.js');
}, 60000);

function enterReader(storyId, sceneId, path) {
  mod.setState({
    view: 'reader',
    storyId,
    sceneId,
    previousSceneId: '',
    path,
    playerName: 'Jess',
    spice: 'warm',
    whatIfHighlightId: '',
    savePromptVisible: false,
  });
}

describe('Restart', () => {
  afterEach(() => vi.useRealTimers());

  it('is hidden on scene 1 of The Soft Alibi and The Living Key', () => {
    for (const id of ['the-soft-alibi', 'the-living-key']) {
      enterReader(id, 'scene1', ['scene1']);
      expect($('[data-testid="choices"]')).toBeTruthy();
      expect($('[data-testid="restart-btn"]')).toBeNull();
    }
  });

  it('needs a second tap elsewhere; the first tap only arms it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    enterReader('the-soft-alibi', 'scene2a', ['scene1', 'scene2a']);
    const btn = /** @type {HTMLButtonElement} */ ($('[data-testid="restart-btn"]'));
    expect(btn).toBeTruthy();
    btn.click();
    expect(mod.state.view).toBe('reader');
    expect(btn.textContent).toMatch(/Tap again to restart/);
    // Disarms after a few seconds.
    vi.advanceTimersByTime(4100);
    expect(btn.textContent.trim()).toBe('Restart');
    btn.click();
    expect(mod.state.view).toBe('reader');
    btn.click();
    expect(mod.state.view).toBe('landing');
  });
});
