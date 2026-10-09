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

describe('"Your choice is below" cue', () => {
  /** @type {Array<{ cb: Function, target: Element | null, disconnected: boolean }>} */
  let observers;
  let scrollSpy;

  beforeEach(() => {
    observers = [];
    class FakeIO {
      constructor(cb) {
        this.rec = { cb, target: null, disconnected: false };
        observers.push(this.rec);
      }
      observe(t) {
        this.rec.target = t;
      }
      disconnect() {
        this.rec.disconnected = true;
      }
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIO);
    scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
  });
  afterEach(() => vi.unstubAllGlobals());

  const live = () => observers.filter((o) => !o.disconnected && o.target);
  const fire = (isIntersecting, top) =>
    live().forEach((o) => o.cb([{ isIntersecting, boundingClientRect: { top } }]));

  it('shows on scene 1 while choices are below, hides once they scroll into view', () => {
    enterReader('the-soft-alibi', 'scene1', ['scene1']);
    const cue = /** @type {HTMLElement} */ ($('[data-testid="choice-cue"]'));
    expect(cue).toBeTruthy();
    expect(cue.hidden).toBe(true); // hidden until IO reports
    expect(live()[0].target?.getAttribute('data-testid')).toBe('choice-prompt');
    fire(false, 5000);
    expect(cue.hidden).toBe(false);
    expect(cue.textContent).toMatch(/Your choice is below/);
    fire(true, 400);
    expect(cue.hidden).toBe(true);
    expect(live()).toHaveLength(0);
    // Spice swap re-render of the same scene: cue stays gone.
    /** @type {HTMLButtonElement} */ ($('[data-testid="spice-swap-hot"]')).click();
    expect(/** @type {HTMLElement} */ ($('[data-testid="choice-cue"]')).hidden).toBe(true);
  });

  it('stays hidden when the choices are already in view on render (short scene)', () => {
    enterReader('the-living-key', 'scene1', ['scene1']);
    fire(true, 300);
    expect(/** @type {HTMLElement} */ ($('[data-testid="choice-cue"]')).hidden).toBe(true);
  });

  it('tap scrolls to the choices and hides the cue', () => {
    enterReader('the-living-key', 'scene2a', ['scene1', 'scene2a']);
    fire(false, 4200);
    const cue = /** @type {HTMLButtonElement} */ ($('[data-testid="choice-cue"]'));
    expect(cue.hidden).toBe(false);
    cue.click();
    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.contexts[0]?.getAttribute?.('data-testid')).toBe('choice-prompt');
    expect(cue.hidden).toBe(true);
    // A choice still advances normally afterwards.
    expect(document.querySelectorAll('[data-action="choose"]').length).toBe(2);
  });

  it('is not rendered on endings', () => {
    const story = mod.getStory('the-soft-alibi');
    const ending = Object.values(story.scenes).find((s) => s.ending);
    enterReader('the-soft-alibi', ending.id, ['scene1', ending.id]);
    expect($('[data-testid="choice-cue"]')).toBeNull();
  });
});
