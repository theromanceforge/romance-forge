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

  it('is visible on the first frame when the choices start below the fold (no IO wait)', () => {
    const real = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const top = this.getAttribute?.('data-testid') === 'choice-prompt' ? 5200 : 0;
      return { top, bottom: top + 30, left: 0, right: 0, width: 0, height: 30, x: 0, y: top, toJSON() {} };
    };
    try {
      enterReader('the-soft-alibi', 'scene1', ['scene1']);
      expect(/** @type {HTMLElement} */ ($('[data-testid="choice-cue"]')).hidden).toBe(false);
    } finally {
      Element.prototype.getBoundingClientRect = real;
    }
  });

  it('stays on the visible area when the page is zoomed (visualViewport)', () => {
    const listeners = {};
    const vv = {
      scale: 1.06,
      offsetLeft: 24,
      offsetTop: 0,
      width: window.innerWidth / 1.06,
      height: window.innerHeight / 1.06,
      addEventListener: (t, fn) => (listeners[t] = fn),
      removeEventListener: (t) => delete listeners[t],
    };
    vi.stubGlobal('visualViewport', vv);
    enterReader('the-soft-alibi', 'scene1', ['scene1']);
    fire(false, 5000);
    const cue = /** @type {HTMLElement} */ ($('[data-testid="choice-cue"]'));
    const lift = parseInt(cue.style.getPropertyValue('--cue-lift'), 10);
    expect(lift).toBe(Math.round(window.innerHeight - vv.height));
    expect(parseInt(cue.style.getPropertyValue('--cue-dx'), 10)).toBe(
      Math.round(vv.offsetLeft + vv.width / 2 - window.innerWidth / 2),
    );
    // Back to 1x: offsets cleared.
    Object.assign(vv, { scale: 1, offsetLeft: 0, width: window.innerWidth, height: window.innerHeight });
    listeners.resize();
    expect(cue.style.getPropertyValue('--cue-lift')).toBe('');
    // Reaching the choices removes the listeners.
    fire(true, 300);
    expect(listeners.resize).toBeUndefined();
    expect(listeners.scroll).toBeUndefined();
  });

  it('is not rendered on endings', () => {
    const story = mod.getStory('the-soft-alibi');
    const ending = Object.values(story.scenes).find((s) => s.ending);
    enterReader('the-soft-alibi', ending.id, ['scene1', ending.id]);
    expect($('[data-testid="choice-cue"]')).toBeNull();
  });
});

describe('browser Back inside a story', () => {
  afterEach(() => vi.useRealTimers());

  const pop = (st) => window.dispatchEvent(new PopStateEvent('popstate', { state: st }));

  function startFromLanding(storyId) {
    mod.setState({
      view: 'landing',
      storyId,
      spice: 'warm',
      playerName: '',
      path: [],
      _pendingResume: false,
      _pendingWhatIfReplay: null,
      savePromptVisible: false,
    });
    history.replaceState({ rf: 'landing' }, '');
    /** @type {HTMLFormElement} */ ($('#start-form')).requestSubmit();
  }

  it('Back steps to the previous scene, then from scene 1 to the catalog', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    localStorage.clear();
    startFromLanding('the-soft-alibi');
    expect(mod.state.view).toBe('reader');
    const scene1Entry = history.state;
    expect(scene1Entry).toMatchObject({ rf: 'scene', storyId: 'the-soft-alibi', sceneId: 'scene1', depth: 1 });

    /** @type {HTMLButtonElement} */ ($('[data-action="choose"]')).click();
    vi.advanceTimersByTime(300);
    const next = mod.state.sceneId;
    expect(next).toMatch(/^scene2/);
    expect(history.state).toMatchObject({ rf: 'scene', sceneId: next, depth: 2 });

    // Back → scene 1 (reader stays in the story, name/spice kept, no interstitial).
    pop(scene1Entry);
    expect(mod.state.view).toBe('reader');
    expect(mod.state.sceneId).toBe('scene1');
    expect(mod.state.path).toEqual(['scene1']);
    expect(mod.state.spice).toBe('warm');
    expect($('[data-testid="scene"]')?.getAttribute('data-scene-id')).toBe('scene1');

    // Back from scene 1 → catalog (not off-site); Continue offer is there.
    pop({ rf: 'landing' });
    expect(mod.state.view).toBe('landing');
    expect($('[data-testid="landing"]')).toBeTruthy();
    expect($('[data-testid="resume-offer"]')).toBeTruthy();

    // Forward → back into the story at the right scene.
    pop({ ...scene1Entry, sceneId: next, path: ['scene1', next], depth: 2 });
    expect(mod.state.view).toBe('reader');
    expect(mod.state.sceneId).toBe(next);
  });

  it('spice swap does not add history entries', () => {
    startFromLanding('the-living-key');
    const before = history.length;
    /** @type {HTMLButtonElement} */ ($('[data-testid="spice-swap-hot"]')).click();
    expect(mod.state.spice).toBe('hot');
    expect(history.length).toBe(before);
    expect(history.state).toMatchObject({ sceneId: 'scene1' });
  });

  it('Back from the catalog entry when already on the landing is a no-op', () => {
    mod.setState({ view: 'landing' });
    pop(null);
    expect(mod.state.view).toBe('landing');
  });
});
