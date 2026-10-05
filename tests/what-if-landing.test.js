import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  selectWhatIfCards,
  pathForReplayFrom,
  renderWhatIfCompactHtml,
  saveLastFinished,
  loadLastFinished,
  clearLastFinished,
  LAST_FINISHED_KEY,
  isValidLastFinished,
} from '../src/whatIf.js';
import { getStory } from '../src/stories/index.js';

describe('lastFinished session stash', () => {
  it('saves, loads, validates, and clears romanceForge.lastFinished', () => {
    const mem = {
      _data: {},
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = String(v);
      },
      removeItem(k) {
        delete this._data[k];
      },
    };
    expect(loadLastFinished(mem)).toBeNull();
    saveLastFinished(
      {
        storyId: 'until-the-quiet-breaks',
        path: ['scene1', 'scene2a', 'scene10a'],
        spice: 'hot',
        finishedAt: 123,
      },
      mem
    );
    expect(mem.getItem(LAST_FINISHED_KEY)).toBeTruthy();
    const loaded = loadLastFinished(mem);
    expect(loaded?.storyId).toBe('until-the-quiet-breaks');
    expect(loaded?.spice).toBe('hot');
    expect(loaded?.path).toEqual(['scene1', 'scene2a', 'scene10a']);
    expect(isValidLastFinished(loaded)).toBe(true);
    expect(isValidLastFinished({ storyId: 'x' })).toBe(false);
    clearLastFinished(mem);
    expect(loadLastFinished(mem)).toBeNull();
  });

  it('renderWhatIfCompactHtml is ad-free with dismiss + landing replay', () => {
    const html = renderWhatIfCompactHtml(
      [
        {
          sceneId: 'scene5a',
          choiceId: 'scene6b',
          choiceIndex: 1,
          label: 'Hide the ugliest page',
          layer: 5,
          tease: 'What if you had… Hide the ugliest page',
          chapterLabel: 'Chapter 5',
          source: 'derived',
        },
      ],
      { escapeHtml: (s) => String(s), storyTitle: 'Until the Quiet Breaks' }
    );
    expect(html).toMatch(/data-testid="what-if-compact"/);
    expect(html).toMatch(/data-action="dismiss-what-if-compact"/);
    expect(html).toMatch(/data-action="what-if-replay-landing"/);
    expect(html).toMatch(/Until the Quiet Breaks/);
    expect(html).not.toMatch(/adsense|interstitial|adsbygoogle/i);
  });
});

describe('what-if landing compact DOM', () => {
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
    sessionStorage.clear();
    mod = await import('../src/main.js');
  });

  beforeEach(() => {
    sessionStorage.clear();
    clearLastFinished();
  });

  it('stashes lastFinished when an ending is rendered', () => {
    const story = getStory('until-the-quiet-breaks');
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
    const stashed = loadLastFinished();
    expect(stashed?.storyId).toBe(story.id);
    expect(stashed?.path).toEqual(fullPath);
    expect(stashed?.spice).toBe('warm');
  });

  it('renders compact strip on landing below save prompt; dismiss clears it', () => {
    saveLastFinished({
      storyId: 'until-the-quiet-breaks',
      path: fullPath,
      spice: 'warm',
    });
    mod.setState({
      view: 'landing',
      playerName: '',
      path: [],
      whatIfHighlightId: '',
      _pendingWhatIfReplay: null,
      savePromptVisible: false,
    });
    expect(document.querySelector('[data-testid="what-if-compact"]')).toBeTruthy();
    const cards = document.querySelectorAll(
      '[data-testid="what-if-compact"] [data-testid="what-if-card"]'
    );
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards.length).toBeLessThanOrEqual(2);

    mod.setState({ view: 'landing', savePromptVisible: true });
    const save = document.querySelector('[data-testid="save-prompt"]');
    const strip = document.querySelector('[data-testid="what-if-compact"]');
    expect(save).toBeTruthy();
    expect(strip).toBeTruthy();
    expect(save.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    document.querySelector('[data-testid="what-if-dismiss"]').click();
    expect(loadLastFinished()).toBeNull();
    expect(document.querySelector('[data-testid="what-if-compact"]')).toBeFalsy();
  });

  it('landing Replay from here jumps with name+spice and highlight', async () => {
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
    await new Promise((r) => setTimeout(r, 50));
    expect(mod.state.view).toBe('reader');
    expect(mod.state.playerName).toBe('Elena');
    expect(mod.state.spice).toBe('hot');
    expect(mod.state.sceneId).toBe(target.sceneId);
    expect(mod.state.path).toEqual(pathForReplayFrom(fullPath, target.sceneId));
    expect(mod.state.whatIfHighlightId).toBe(target.choiceId);
  });
});
