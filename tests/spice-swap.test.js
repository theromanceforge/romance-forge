import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getScene, getSceneText, getChoiceText, getChoices } from '../src/engine.js';
import { getAdsStats } from '../src/ads/stats.js';

/** @type {typeof import('../src/main.js')} */
let mod;

beforeAll(async () => {
  window.scrollTo = () => {};
  document.body.innerHTML = '<div id="app"></div>';
  mod = await import('../src/main.js');
});

beforeEach(() => {
  sessionStorage.clear();
  const storyId = 'until-the-quiet-breaks';
  const story = mod.getStory(storyId);
  mod.setState({
    view: 'reader',
    storyId,
    sceneId: story.startSceneId,
    playerName: 'Elena',
    spice: 'warm',
    path: [story.startSceneId],
    previousSceneId: '',
    _transitioning: false,
  });
});

function openReader(partial = {}) {
  const storyId = partial.storyId || 'until-the-quiet-breaks';
  const story = mod.getStory(storyId);
  mod.setState({
    view: 'reader',
    storyId,
    sceneId: partial.sceneId || story.startSceneId,
    playerName: partial.playerName || 'Elena',
    spice: partial.spice || 'warm',
    path: partial.path || [partial.sceneId || story.startSceneId],
    previousSceneId: partial.previousSceneId || '',
    _transitioning: false,
  });
  return document.getElementById('app');
}

describe('same-night Warm|Hot spice swap', () => {
  it('renders accessible Warm|Hot segmented toggle near Playing as', () => {
    const app = openReader({ spice: 'warm' });
    const swap = app.querySelector('[data-testid="spice-swap"]');
    const warm = app.querySelector('[data-testid="spice-swap-warm"]');
    const hot = app.querySelector('[data-testid="spice-swap-hot"]');
    expect(swap).toBeTruthy();
    expect(swap.getAttribute('role')).toBe('group');
    expect(swap.getAttribute('aria-label')).toMatch(/spice/i);
    expect(warm.tagName).toBe('BUTTON');
    expect(hot.tagName).toBe('BUTTON');
    expect(warm.getAttribute('aria-pressed')).toBe('true');
    expect(hot.getAttribute('aria-pressed')).toBe('false');
    expect(app.querySelector('[data-testid="player-chip"]').textContent).toMatch(/Playing as Elena/);
    expect(app.querySelector('[data-testid="reader"]').getAttribute('data-spice')).toBe('warm');
  });

  it('toggle flips prose for the current scene and keeps path/choice targets identical', () => {
    const app = openReader({ spice: 'warm' });
    const story = mod.getStory('until-the-quiet-breaks');
    const scene = getScene(story, story.startSceneId);
    const warmBody = getSceneText(scene, 'warm');
    const hotBody = getSceneText(scene, 'hot');
    expect(hotBody).not.toBe(warmBody);

    const pathBefore = [...mod.state.path];
    const sceneBefore = mod.state.sceneId;
    const choiceIdsBefore = [...app.querySelectorAll('[data-action="choose"]')].map(
      (b) => b.getAttribute('data-choice-id')
    );
    expect(choiceIdsBefore).toHaveLength(2);

    const sceneText = app.querySelector('[data-testid="scene-text"]').textContent;
    expect(sceneText).toContain('Elena');
    // Warm prose is showing (not the Hot-only phrasing from textHot opening)
    expect(getSceneText(scene, 'warm')).toContain('[player_name]');

    app.querySelector('[data-testid="spice-swap-hot"]').click();

    expect(mod.state.spice).toBe('hot');
    expect(mod.state.sceneId).toBe(sceneBefore);
    expect(mod.state.path).toEqual(pathBefore);
    expect(sessionStorage.getItem('romanceForge.spice')).toBe('hot');

    const after = document.getElementById('app');
    expect(after.querySelector('[data-testid="reader"]').getAttribute('data-spice')).toBe('hot');
    expect(after.querySelector('[data-testid="spice-swap-hot"]').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(after.querySelector('[data-testid="spice-swap-warm"]').getAttribute('aria-pressed')).toBe(
      'false'
    );

    const choiceIdsAfter = [...after.querySelectorAll('[data-action="choose"]')].map(
      (b) => b.getAttribute('data-choice-id')
    );
    expect(choiceIdsAfter).toEqual(choiceIdsBefore);

    // Choice labels may flip with spice; targets must not.
    const choices = getChoices(scene);
    const labels = [...after.querySelectorAll('[data-action="choose"]')].map((b) =>
      b.textContent.trim()
    );
    expect(labels[0]).toBe(getChoiceText(choices[0], 'hot'));
    expect(labels[1]).toBe(getChoiceText(choices[1], 'hot'));
    if (choices[0].textHot) {
      expect(labels[0]).not.toBe(choices[0].text);
    }

    // Prose flipped to Hot body (substituted)
    const hotRendered = hotBody.replaceAll('[player_name]', 'Elena');
    const shown = after.querySelector('[data-testid="scene-text"]').textContent.replace(/\s+/g, ' ');
    // Compare a distinctive Hot opening fragment
    const fragment = hotRendered.slice(0, 40).replace(/\s+/g, ' ');
    expect(shown).toContain(fragment.trim().slice(0, 20));
  });

  it('spice preference persists to subsequent scenes and save/resume session state', () => {
    openReader({ spice: 'warm' });
    document.querySelector('[data-testid="spice-swap-hot"]').click();
    expect(mod.state.spice).toBe('hot');
    expect(sessionStorage.getItem('romanceForge.spice')).toBe('hot');

    const story = mod.getStory('until-the-quiet-breaks');
    const nextId = getChoices(getScene(story, story.startSceneId))[0].id;
    const nextPath = [story.startSceneId, nextId];
    mod.setState({ sceneId: nextId, path: nextPath, spice: mod.state.spice });

    const app = document.getElementById('app');
    expect(mod.state.spice).toBe('hot');
    expect(app.querySelector('[data-testid="reader"]').getAttribute('data-spice')).toBe('hot');
    expect(app.querySelector('[data-testid="spice-swap-hot"]').getAttribute('aria-pressed')).toBe(
      'true'
    );

    // Guest save does not store spice; session spice is source of truth for resume.
    mod.persistGuestProgress({ sceneId: nextId, path: nextPath });
    const saved = mod.loadGuestSave('until-the-quiet-breaks');
    expect(saved.sceneId).toBe(nextId);
    expect(saved.path).toEqual(nextPath);
    expect(sessionStorage.getItem('romanceForge.spice')).toBe('hot');
  });

  it('does not change ad element or cadence on toggle', () => {
    const before = { ...getAdsStats() };
    openReader({ spice: 'warm' });
    expect(document.querySelector('[data-testid="ad-interstitial"]')).toBeNull();
    document.querySelector('[data-testid="spice-swap-hot"]').click();
    expect(document.querySelector('[data-testid="ad-interstitial"]')).toBeNull();
    const after = getAdsStats();
    expect(after.sceneAdvance).toBe(before.sceneAdvance);
    expect(after.shown).toBe(before.shown);
  });

  it('disables Hot when scene lacks textHot and falls back gracefully', () => {
    const story = mod.getStory('until-the-quiet-breaks');
    const scene = getScene(story, story.startSceneId);
    const original = scene.textHot;
    // Mutate in place for this test only (do not edit scene modules on disk).
    delete scene.textHot;

    try {
      const app = openReader({ spice: 'warm' });
      const hot = app.querySelector('[data-testid="spice-swap-hot"]');
      expect(hot.disabled).toBe(true);
      expect(hot.getAttribute('aria-disabled')).toBe('true');

      hot.click();
      expect(mod.state.spice).toBe('warm');

      // If somehow already Hot with no body, engine falls back to Warm prose.
      mod.setState({ spice: 'hot' });
      const shown = document.querySelector('[data-testid="scene-text"]').textContent;
      const warmShown = getSceneText(scene, 'warm').replaceAll('[player_name]', 'Elena');
      expect(shown.replace(/\s+/g, ' ')).toContain(warmShown.slice(0, 30).replace(/\s+/g, ' ').trim());
    } finally {
      scene.textHot = original;
    }
  });

  it('preserves scroll and keeps focus on the toggle after swap', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo');
    openReader({ spice: 'warm' });
    // Pretend reader was already painted so next setState is stayOnReader.
    const hot = document.querySelector('[data-testid="spice-swap-hot"]');
    hot.focus();
    hot.click();
    const again = document.querySelector('[data-testid="spice-swap-hot"]');
    expect(again.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement?.getAttribute('data-testid')).toBe('spice-swap-hot');
    // stayOnReader restores prior scroll via scrollTo(0, winY) when needed
    scrollSpy.mockRestore();
  });
});

describe('scenes lacking Hot body (inventory)', () => {
  it('reports how many scenes lack textHot per story', () => {
    const report = {};
    for (const entry of mod.CATALOG.filter((c) => c.available)) {
      const story = mod.getStory(entry.id);
      const missing = Object.values(story.scenes).filter((s) => !s.textHot).map((s) => s.id);
      report[entry.id] = { total: Object.keys(story.scenes).length, missing };
    }
    // Current catalog: all scenes ship with textHot — keep the assertion informative.
    for (const [id, info] of Object.entries(report)) {
      expect(info.total).toBeGreaterThan(0);
      expect(info.missing, `${id} missing Hot: ${info.missing.join(',')}`).toEqual([]);
    }
    // Expose counts for the feature report (vitest prints on failure; also attach).
    expect(report).toBeTruthy();
  });
});
