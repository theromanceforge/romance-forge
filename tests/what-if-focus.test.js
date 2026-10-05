import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { selectWhatIfCards, pathForReplayFrom, saveLastFinished, clearLastFinished } from '../src/whatIf.js';
import { getStory } from '../src/stories/index.js';

describe('what-if replay scrolls highlighted choice into view', () => {
  let mod;
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
  });

  beforeEach(() => {
    sessionStorage.clear();
    clearLastFinished();
    vi.restoreAllMocks();
  });

  async function flushFocus() {
    // momentum (240ms) + double rAF
    await new Promise((r) => setTimeout(r, 300));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  it('ending Replay from here schedules scrollIntoView(center) + focus on highlight', async () => {
    const story = getStory('until-the-quiet-breaks');
    const cards = selectWhatIfCards(story, fullPath, { spice: 'warm', max: 3 });
    const target = cards[0]; // Chapter 9 fork typically
    expect(target.sceneId).toBeTruthy();

    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;

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

    await flushFocus();

    expect(mod.state.sceneId).toBe(target.sceneId);
    expect(mod.state.whatIfHighlightId).toBe(target.choiceId);

    const highlighted = document.querySelector('.choice--what-if-highlight');
    expect(highlighted).toBeTruthy();
    expect(highlighted.getAttribute('data-choice-id')).toBe(target.choiceId);

    // Patch methods on the live element and re-trigger schedule via exported helpers
    highlighted.scrollIntoView = scrollIntoView;
    highlighted.focus = focus;
    mod.requestWhatIfHighlightFocus();
    mod.scheduleWhatIfHighlightFocus();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    expect(scrollIntoView).toHaveBeenCalled();
    const arg = scrollIntoView.mock.calls[0][0] || {};
    expect(arg.block).toBe('center');
    expect(arg.behavior === 'auto' || arg.behavior === undefined || arg.behavior === 'instant').toBe(true);
    expect(arg.behavior).not.toBe('smooth');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('landing compact Replay also requests highlight focus', async () => {
    const story = getStory('until-the-quiet-breaks');
    const cards = selectWhatIfCards(story, fullPath, { spice: 'hot', max: 2 });
    const target = cards[0];
    saveLastFinished({ storyId: story.id, path: fullPath, spice: 'hot' });

    const scrollIntoView = vi.fn();
    const focus = vi.fn();

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
    await new Promise((r) => setTimeout(r, 50));
    expect(mod.state.view).toBe('reader');
    expect(mod.state.whatIfHighlightId).toBe(target.choiceId);

    const highlighted = document.querySelector('.choice--what-if-highlight');
    expect(highlighted).toBeTruthy();
    highlighted.scrollIntoView = scrollIntoView;
    highlighted.focus = focus;
    // Landing path already requested focus once; request again to assert call shape.
    mod.requestWhatIfHighlightFocus();
    mod.scheduleWhatIfHighlightFocus();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center', behavior: 'auto' })
    );
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('falls back to scrollTo(0,0) when highlight element is missing', async () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    mod.requestWhatIfHighlightFocus();
    // Render a non-highlight reader scene so query returns null
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
    // Flag was cleared by setState→render with no highlight; re-request and schedule alone
    mod.requestWhatIfHighlightFocus();
    mod.scheduleWhatIfHighlightFocus();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
