import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { selectWhatIfCards, saveLastFinished, clearLastFinished } from '../src/whatIf.js';
import { getStory } from '../src/stories/index.js';

// Deterministic: no live Supabase from .env.local. Otherwise boot fires real
// network calls (auth/getSession, review aggregates, readers-say) whose late
// setState→render() can swap the DOM mid-test.
vi.mock('../src/auth/supabaseClient.js', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
  __resetSupabaseClientForTests: () => {},
}));

const FRAME_MS = 16;
const MOMENTUM_MS = 240; // mirrors src/main.js MOMENTUM_MS

describe('what-if replay scrolls highlighted choice into view', () => {
  let mod;
  let scrollIntoView;
  let focus;
  let scrollTo;
  const fullPath = [
    'scene1',
    'scene2a',
    'scene3a',
    'scene4a',
    'scene5a',
    'scene6a',
    'scene7a',
    'scene8a',
    'scene9a',
    'scene10a',
  ];

  beforeAll(async () => {
    window.scrollTo = () => {};
    document.body.innerHTML = '<div id="app"></div>';
    mod = await import('../src/main.js');
    // Let any boot microtasks (stub stores) settle before timers are faked.
    await vi.dynamicImportSettled();
    await Promise.resolve();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    // Fake setTimeout (momentum beat) and drive rAF off the same fake clock so
    // the double-rAF in scheduleWhatIfHighlightFocus runs only when we advance.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const raf = (cb) => setTimeout(() => cb(Date.now()), FRAME_MS);
    const caf = (id) => clearTimeout(id);
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);
    window.requestAnimationFrame = raf;
    window.cancelAnimationFrame = caf;

    // Prototype-level spies: survive any re-render that replaces elements.
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
    scrollTo = vi.fn();
    window.scrollTo = scrollTo;

    sessionStorage.clear();
    clearLastFinished();
    // Drain any focus request left over from a previous test.
    mod.scheduleWhatIfHighlightFocus();
    vi.runOnlyPendingTimers();
    scrollIntoView.mockClear();
    focus.mockClear();
    scrollTo.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete Element.prototype.scrollIntoView;
  });

  /** Advance past the double rAF (two frames). */
  function flushDoubleRaf() {
    vi.advanceTimersByTime(FRAME_MS * 2);
  }

  function lastCallContext(fn) {
    return fn.mock.contexts[fn.mock.contexts.length - 1];
  }

  it('ending Replay from here schedules scrollIntoView(center) + focus on highlight', () => {
    const story = getStory('until-the-quiet-breaks');
    const cards = selectWhatIfCards(story, fullPath, { spice: 'warm', max: 3 });
    const target = cards[0];
    expect(target.sceneId).toBeTruthy();

    mod.setState({
      view: 'reader',
      storyId: story.id,
      sceneId: fullPath[fullPath.length - 1],
      playerName: 'Elena',
      spice: 'warm',
      path: fullPath,
      whatIfHighlightId: '',
      previousSceneId: fullPath[fullPath.length - 2],
    });

    // Simulate ending page scrolled far down (carry-over bug).
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => 3435 });

    const btn = document.querySelector(
      '[data-testid="what-if-replay"][data-fork-scene-id="' + target.sceneId + '"]'
    );
    expect(btn).toBeTruthy();
    btn.click();

    // Momentum beat: nothing focused yet.
    expect(document.querySelector('[data-testid="momentum"]')).toBeTruthy();
    expect(scrollIntoView).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MOMENTUM_MS);
    expect(mod.state.sceneId).toBe(target.sceneId);
    expect(mod.state.whatIfHighlightId).toBe(target.choiceId);

    const highlighted = document.querySelector('.choice--what-if-highlight');
    expect(highlighted).toBeTruthy();
    expect(highlighted.getAttribute('data-choice-id')).toBe(target.choiceId);
    // Focus waits for the double rAF after render.
    expect(scrollIntoView).not.toHaveBeenCalled();

    flushDoubleRaf();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(lastCallContext(scrollIntoView)).toBe(highlighted);
    const arg = scrollIntoView.mock.calls[0][0] || {};
    expect(arg.block).toBe('center');
    expect(arg.behavior).toBe('auto');
    expect(arg.behavior).not.toBe('smooth');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(lastCallContext(focus)).toBe(highlighted);
  });

  it('landing compact Replay also requests highlight focus', () => {
    const story = getStory('until-the-quiet-breaks');
    const cards = selectWhatIfCards(story, fullPath, { spice: 'hot', max: 2 });
    const target = cards[0];
    saveLastFinished({ storyId: story.id, path: fullPath, spice: 'hot' });

    mod.setState({
      view: 'landing',
      storyId: story.id,
      spice: 'hot',
      playerName: '',
      path: [],
      whatIfHighlightId: '',
      _pendingWhatIfReplay: null,
    });
    document.querySelector('[data-testid="name-input"]').value = 'Elena';
    const btn = document.querySelector(
      '[data-testid="what-if-replay"][data-fork-scene-id="' + target.sceneId + '"]'
    );
    expect(btn).toBeTruthy();
    btn.click();

    // Landing replay renders the reader synchronously (no momentum beat).
    expect(mod.state.view).toBe('reader');
    expect(mod.state.sceneId).toBe(target.sceneId);
    expect(mod.state.whatIfHighlightId).toBe(target.choiceId);
    const highlighted = document.querySelector('.choice--what-if-highlight');
    expect(highlighted).toBeTruthy();
    expect(highlighted.getAttribute('data-choice-id')).toBe(target.choiceId);
    expect(scrollIntoView).not.toHaveBeenCalled();

    flushDoubleRaf();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center', behavior: 'auto' })
    );
    expect(lastCallContext(scrollIntoView)).toBe(highlighted);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(lastCallContext(focus)).toBe(highlighted);
  });

  it('falls back to scrollTo(0,0) when highlight element is missing', () => {
    const story = getStory('until-the-quiet-breaks');
    mod.setState({
      view: 'reader',
      storyId: story.id,
      sceneId: 'scene1',
      playerName: 'Elena',
      spice: 'warm',
      path: ['scene1'],
      whatIfHighlightId: '',
    });
    expect(document.querySelector('.choice--what-if-highlight')).toBeNull();

    mod.requestWhatIfHighlightFocus();
    mod.scheduleWhatIfHighlightFocus();
    expect(scrollTo).not.toHaveBeenCalled();

    flushDoubleRaf();

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
