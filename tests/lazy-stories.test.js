import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STORY_IDS,
  START_SCENE_ID,
  DEFAULT_STORY_ID,
  getLoadedStory,
  loadStory,
  isKnownStory,
} from '../src/stories/lazy.js';
import { STORIES } from '../src/stories/index.js';

const root = join(__dirname, '..');

describe('lazy story registry', () => {
  it('covers every eager story, with the shared start scene', () => {
    expect([...STORY_IDS].sort()).toEqual(Object.keys(STORIES).sort());
    expect(STORY_IDS).toContain(DEFAULT_STORY_ID);
    for (const s of Object.values(STORIES)) expect(s.startSceneId).toBe(START_SCENE_ID);
  });

  it('loadStory resolves the same story the eager registry builds, and caches it', async () => {
    const a = await loadStory('the-soft-alibi');
    expect(a.id).toBe('the-soft-alibi');
    expect(Object.keys(a.scenes).length).toBe(Object.keys(STORIES['the-soft-alibi'].scenes).length);
    expect(getLoadedStory('the-soft-alibi')).toBe(a);
    expect(await loadStory('the-soft-alibi')).toBe(a);
  });

  it('rejects unknown ids', async () => {
    expect(isKnownStory('nope')).toBe(false);
    await expect(loadStory('nope')).rejects.toThrow(/Unknown story/);
  });

  it('the app entry only reaches story scenes through dynamic import()', () => {
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    expect(main).not.toMatch(/from ['"]\.\/stories\/index\.js['"]/);
    expect(main).not.toMatch(/from ['"]\.\/story\.js['"]/);
    const lazy = readFileSync(join(root, 'src/stories/lazy.js'), 'utf8');
    for (const id of STORY_IDS) expect(lazy).toContain(`import('./${id}.js')`);
    expect(lazy).not.toMatch(/^import .* from ['"]\.\/(until|what|the)-/m);
  });
});
