import { describe, it, expect } from 'vitest';
import {
  substituteName,
  getScene,
  getChoices,
  isEnding,
  resolveChoice,
  validateStory,
  getSceneArtPath,
} from '../src/engine.js';
import { story, SCENE_IDS, SCENE_MODULES, buildStoryScenes } from '../src/story.js';

describe('substituteName', () => {
  it('replaces [player_name] with the given name', () => {
    const text = 'Hello, [player_name]. Welcome, [player_name].';
    expect(substituteName(text, 'Eleanor')).toBe(
      'Hello, Eleanor. Welcome, Eleanor.'
    );
  });

  it('falls back to Traveler when name is empty', () => {
    expect(substituteName('Hi [player_name]', '   ')).toBe('Hi Traveler');
  });
});

describe('story sample — Until the Quiet Breaks', () => {
  it('loads every on-disk scene module via glob (no hand-import list)', () => {
    // Layers 1–10: 1+2+4+8+16+16+16+16+8+10 = 97
    expect(SCENE_MODULES.length).toBe(97);
    expect(Object.keys(story.scenes)).toHaveLength(97);
    expect(SCENE_IDS).toHaveLength(97);
    for (const id of [
      'scene1',
      'scene2a',
      'scene2b',
      'scene3a',
      'scene3b',
      'scene3c',
      'scene3d',
      'scene4a',
      'scene4b',
      'scene4c',
      'scene4d',
      'scene4e',
      'scene4f',
      'scene4g',
      'scene4h',
    ]) {
      expect(story.scenes[id]).toBeTruthy();
    }
  });

  it('loads all 16 Layer 5 scenes (scene5a–scene5p)', () => {
    const layer5Ids = 'abcdefghijklmnop'.split('').map((letter) => `scene5${letter}`);
    expect(layer5Ids).toHaveLength(16);
    for (const id of layer5Ids) {
      expect(story.scenes[id]).toBeTruthy();
      expect(story.scenes[id].layer).toBe(5);
    }
    const layer5 = Object.values(story.scenes).filter((s) => s.layer === 5);
    expect(layer5).toHaveLength(16);
  });

  it('loads all 16 Layer 6 scenes (scene6a–scene6p)', () => {
    const layer6Ids = 'abcdefghijklmnop'.split('').map((letter) => `scene6${letter}`);
    expect(layer6Ids).toHaveLength(16);
    for (const id of layer6Ids) {
      expect(story.scenes[id]).toBeTruthy();
      expect(story.scenes[id].layer).toBe(6);
    }
    const layer6 = Object.values(story.scenes).filter((s) => s.layer === 6);
    expect(layer6).toHaveLength(16);
  });

  it('loads all 16 Layer 7 scenes (scene7a–scene7p)', () => {
    const layer7Ids = 'abcdefghijklmnop'.split('').map((letter) => `scene7${letter}`);
    expect(layer7Ids).toHaveLength(16);
    for (const id of layer7Ids) {
      expect(story.scenes[id]).toBeTruthy();
      expect(story.scenes[id].layer).toBe(7);
    }
    const layer7 = Object.values(story.scenes).filter((s) => s.layer === 7);
    expect(layer7).toHaveLength(16);
  });

  it('loads all 16 Layer 8 scenes (scene8a–scene8p)', () => {
    const layer8Ids = 'abcdefghijklmnop'.split('').map((letter) => `scene8${letter}`);
    expect(layer8Ids).toHaveLength(16);
    for (const id of layer8Ids) {
      expect(story.scenes[id]).toBeTruthy();
      expect(story.scenes[id].layer).toBe(8);
    }
    const layer8 = Object.values(story.scenes).filter((s) => s.layer === 8);
    expect(layer8).toHaveLength(16);
  });

  it('loads all 8 Layer 9 scenes (scene9a–scene9h)', () => {
    const layer9Ids = 'abcdefgh'.split('').map((letter) => `scene9${letter}`);
    expect(layer9Ids).toHaveLength(8);
    for (const id of layer9Ids) {
      expect(story.scenes[id]).toBeTruthy();
      expect(story.scenes[id].layer).toBe(9);
    }
    const layer9 = Object.values(story.scenes).filter((s) => s.layer === 9);
    expect(layer9).toHaveLength(8);
  });

  it('loads all 10 Layer 10 endings (scene10a–scene10j)', () => {
    const layer10Ids = 'abcdefghij'.split('').map((letter) => `scene10${letter}`);
    expect(layer10Ids).toHaveLength(10);
    for (const id of layer10Ids) {
      expect(story.scenes[id]).toBeTruthy();
      expect(story.scenes[id].layer).toBe(10);
    }
    const layer10 = Object.values(story.scenes).filter((s) => s.layer === 10);
    expect(layer10).toHaveLength(10);
  });

  it('validates against engine rules', () => {
    const result = validateStory(story);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('non-ending scenes expose exactly 2 choices with valid targets', () => {
    for (const scene of Object.values(story.scenes)) {
      if (!isEnding(scene)) {
        const choices = getChoices(scene);
        expect(choices).toHaveLength(2);
        for (const choice of choices) {
          expect(story.scenes[choice.id]).toBeTruthy();
        }
      }
    }
  });

  it('endings are scenes with empty choices (not a fixed layer)', () => {
    const endings = Object.values(story.scenes).filter((s) => isEnding(s));
    expect(endings.length).toBeGreaterThan(0);
    for (const scene of endings) {
      expect(!scene.choices || scene.choices.length === 0).toBe(true);
      expect(getChoices(scene)).toHaveLength(0);
      // Ending detection is empty choices only — not layer===4 (or any layer)
      expect(scene.layer === 4 && isEnding(scene)).toBe(false);
    }
    // With Layer 5 on disk, Layer 4 continues (not endings)
    const layer4 = Object.values(story.scenes).filter((s) => s.layer === 4);
    expect(layer4.length).toBe(8);
    for (const scene of layer4) {
      expect(isEnding(scene)).toBe(false);
      expect(getChoices(scene)).toHaveLength(2);
    }
    // With Layer 6 on disk, Layer 5 continues (not endings)
    const layer5 = Object.values(story.scenes).filter((s) => s.layer === 5);
    expect(layer5).toHaveLength(16);
    for (const scene of layer5) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        expect(story.scenes[choice.id]).toBeTruthy();
        expect(story.scenes[choice.id].layer).toBe(6);
      }
    }
    // With Layer 7 on disk, Layer 6 continues (not endings)
    const layer6 = Object.values(story.scenes).filter((s) => s.layer === 6);
    expect(layer6).toHaveLength(16);
    for (const scene of layer6) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        expect(story.scenes[choice.id]).toBeTruthy();
        expect(story.scenes[choice.id].layer).toBe(7);
      }
    }
    // With Layer 8 on disk, Layer 7 continues (not endings)
    const layer7 = Object.values(story.scenes).filter((s) => s.layer === 7);
    expect(layer7).toHaveLength(16);
    for (const scene of layer7) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        expect(story.scenes[choice.id]).toBeTruthy();
        expect(story.scenes[choice.id].layer).toBe(8);
      }
    }
    // With Layer 9 on disk, Layer 8 continues (not endings)
    const layer8 = Object.values(story.scenes).filter((s) => s.layer === 8);
    expect(layer8).toHaveLength(16);
    for (const scene of layer8) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        expect(story.scenes[choice.id]).toBeTruthy();
        expect(story.scenes[choice.id].layer).toBe(9);
      }
    }
    // With Layer 10 on disk, Layer 9 continues (not endings)
    const layer9 = Object.values(story.scenes).filter((s) => s.layer === 9);
    expect(layer9).toHaveLength(8);
    for (const scene of layer9) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        expect(story.scenes[choice.id]).toBeTruthy();
        expect(story.scenes[choice.id].layer).toBe(10);
      }
    }
    // Real endings = Layer 10 only (scene10a–10j, choices: [])
    const layer10 = Object.values(story.scenes).filter((s) => s.layer === 10);
    expect(layer10).toHaveLength(10);
    for (const scene of layer10) {
      expect(isEnding(scene)).toBe(true);
      expect(!scene.choices || scene.choices.length === 0).toBe(true);
      expect(getChoices(scene)).toHaveLength(0);
    }
    const allEndings = Object.values(story.scenes).filter((s) => isEnding(s));
    expect(allEndings).toHaveLength(10);
    expect(allEndings.every((s) => s.layer === 10)).toBe(true);
  });

  it('buildStoryScenes treats dangling choice targets as temporary endings', () => {
    const partial = buildStoryScenes([
      {
        id: 'tmpA',
        layer: 1,
        text: 'x',
        choices: [
          { id: 'tmpMissing1', text: 'go' },
          { id: 'tmpMissing2', text: 'leave' },
        ],
      },
      { id: 'tmpB', layer: 2, text: 'y', choices: [] },
    ]);
    expect(partial.tmpA.ending).toBe(true);
    expect(partial.tmpA.choices).toEqual([]);
    expect(partial.tmpB.ending).toBe(true);
  });

  it('start scene is scene1 with diner / Willow branches', () => {
    expect(story.startSceneId).toBe('scene1');
    const start = getScene(story, 'scene1');
    expect(isEnding(start)).toBe(false);
    const choices = getChoices(start);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene2a');
    expect(choices[1].id).toBe('scene2b');
    expect(getScene(story, 'scene2a').title).toMatch(/Diner/i);
    expect(getScene(story, 'scene2b').title).toMatch(/Willow/i);
  });

  it('features John Shaw as male LI (not Lainey)', () => {
    const blob = Object.values(story.scenes)
      .map((s) => [s.text, s.textHot || ''].join('\n'))
      .join('\n');
    expect(blob).toMatch(/John Shaw|John/);
    expect(blob).not.toMatch(/Lainey/);
  });
});

describe('getSceneText spice levels', () => {
  it('returns text for warm and textHot for hot when present', async () => {
    const { getSceneText } = await import('../src/engine.js');
    const scene = getScene(story, 'scene1');
    expect(getSceneText(scene, 'warm')).toBe(scene.text);
    expect(scene.textHot).toBeTruthy();
    expect(getSceneText(scene, 'hot')).toBe(scene.textHot);
  });

  it('falls back to text when textHot is missing', async () => {
    const { getSceneText } = await import('../src/engine.js');
    const scene = { id: 'tmp', layer: 1, text: 'Warm only [player_name].' };
    expect(getSceneText(scene, 'hot')).toBe(scene.text);
    expect(getSceneText(scene, 'warm')).toBe(scene.text);
  });
});

describe('choice navigation', () => {
  it('navigates scene1 → … → scene8a → scene9a → scene10a ending', () => {
    let scene = getScene(story, 'scene1');
    expect(resolveChoice(scene, 'scene2a')).toBe('scene2a');
    scene = getScene(story, 'scene2a');
    expect(resolveChoice(scene, 'scene3a')).toBe('scene3a');
    scene = getScene(story, 'scene3a');
    expect(resolveChoice(scene, 'scene4a')).toBe('scene4a');
    scene = getScene(story, 'scene4a');
    expect(isEnding(scene)).toBe(false);
    expect(getChoices(scene)).toHaveLength(2);
    expect(resolveChoice(scene, 'scene5a')).toBe('scene5a');
    const scene5a = getScene(story, 'scene5a');
    expect(scene5a.layer).toBe(5);
    expect(isEnding(scene5a)).toBe(false);
    expect(getChoices(scene5a)).toHaveLength(2);
    expect(resolveChoice(scene5a, 'scene6a')).toBe('scene6a');
    const scene6a = getScene(story, 'scene6a');
    expect(scene6a.layer).toBe(6);
    expect(isEnding(scene6a)).toBe(false);
    expect(getChoices(scene6a)).toHaveLength(2);
    expect(resolveChoice(scene6a, 'scene7a')).toBe('scene7a');
    const scene7a = getScene(story, 'scene7a');
    expect(scene7a.layer).toBe(7);
    expect(isEnding(scene7a)).toBe(false);
    expect(getChoices(scene7a)).toHaveLength(2);
    expect(resolveChoice(scene7a, 'scene8a')).toBe('scene8a');
    const scene8a = getScene(story, 'scene8a');
    expect(scene8a.layer).toBe(8);
    expect(isEnding(scene8a)).toBe(false);
    expect(getChoices(scene8a)).toHaveLength(2);
    expect(resolveChoice(scene8a, 'scene9a')).toBe('scene9a');
    const scene9a = getScene(story, 'scene9a');
    expect(scene9a.layer).toBe(9);
    expect(isEnding(scene9a)).toBe(false);
    expect(getChoices(scene9a)).toHaveLength(2);
    expect(resolveChoice(scene9a, 'scene10a')).toBe('scene10a');
    const scene10a = getScene(story, 'scene10a');
    expect(scene10a.layer).toBe(10);
    expect(isEnding(scene10a)).toBe(true);
    expect(getChoices(scene10a)).toHaveLength(0);
    expect(story.scenes.scene5b).toBeTruthy();
    expect(story.scenes.scene6b).toBeTruthy();
    expect(story.scenes.scene7b).toBeTruthy();
    expect(story.scenes.scene8b).toBeTruthy();
    expect(story.scenes.scene9b).toBeTruthy();
    expect(story.scenes.scene10j).toBeTruthy();
  });

  it('navigates scene1 → scene2b → scene3d → scene4h → scene5o/scene5p', () => {
    let scene = getScene(story, 'scene1');
    expect(resolveChoice(scene, 'scene2b')).toBe('scene2b');
    scene = getScene(story, 'scene2b');
    expect(resolveChoice(scene, 'scene3d')).toBe('scene3d');
    scene = getScene(story, 'scene3d');
    expect(resolveChoice(scene, 'scene4h')).toBe('scene4h');
    scene = getScene(story, 'scene4h');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices.map((c) => c.id).sort()).toEqual(['scene5o', 'scene5p']);
    expect(resolveChoice(scene, 'scene5o')).toBe('scene5o');
    expect(getScene(story, 'scene5o').layer).toBe(5);
    expect(getScene(story, 'scene5p').layer).toBe(5);
  });

  it('every Layer 4 scene navigates into Layer 5', () => {
    const expected = {
      scene4a: ['scene5a', 'scene5b'],
      scene4b: ['scene5c', 'scene5d'],
      scene4c: ['scene5e', 'scene5f'],
      scene4d: ['scene5g', 'scene5h'],
      scene4e: ['scene5i', 'scene5j'],
      scene4f: ['scene5k', 'scene5l'],
      scene4g: ['scene5m', 'scene5n'],
      scene4h: ['scene5o', 'scene5p'],
    };
    for (const [fromId, targets] of Object.entries(expected)) {
      const scene = getScene(story, fromId);
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      expect(choices.map((c) => c.id)).toEqual(targets);
      for (const target of targets) {
        expect(getScene(story, target).layer).toBe(5);
      }
    }
  });

  it('every Layer 5 scene navigates into Layer 6', () => {
    for (const scene of Object.values(story.scenes).filter((s) => s.layer === 5)) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        const target = getScene(story, choice.id);
        expect(target).toBeTruthy();
        expect(target.layer).toBe(6);
      }
    }
  });

  it('every Layer 6 scene navigates into Layer 7', () => {
    for (const scene of Object.values(story.scenes).filter((s) => s.layer === 6)) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        const target = getScene(story, choice.id);
        expect(target).toBeTruthy();
        expect(target.layer).toBe(7);
      }
    }
  });

  it('every Layer 7 scene navigates into Layer 8', () => {
    for (const scene of Object.values(story.scenes).filter((s) => s.layer === 7)) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        const target = getScene(story, choice.id);
        expect(target).toBeTruthy();
        expect(target.layer).toBe(8);
      }
    }
  });

  it('every Layer 8 scene navigates into Layer 9', () => {
    for (const scene of Object.values(story.scenes).filter((s) => s.layer === 8)) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        const target = getScene(story, choice.id);
        expect(target).toBeTruthy();
        expect(target.layer).toBe(9);
      }
    }
  });

  it('every Layer 9 scene navigates into Layer 10', () => {
    for (const scene of Object.values(story.scenes).filter((s) => s.layer === 9)) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        const target = getScene(story, choice.id);
        expect(target).toBeTruthy();
        expect(target.layer).toBe(10);
      }
    }
  });
});

describe('getSceneArtPath', () => {
  it('uses explicit art when set', () => {
    const scene = { id: 'scene1', layer: 1, text: 'x', art: '/art/custom.png' };
    expect(getSceneArtPath('until-the-quiet-breaks', scene)).toBe('/art/custom.png');
  });

  it('auto-resolves from story id + scene id', () => {
    const scene = { id: 'scene4f', layer: 4, text: 'x' };
    expect(getSceneArtPath('until-the-quiet-breaks', scene)).toBe(
      '/art/until-the-quiet-breaks/scene4f.png'
    );
  });

  it('auto-resolves Layer 5 art paths', () => {
    const scene = { id: 'scene5a', layer: 5, text: 'x' };
    expect(getSceneArtPath('until-the-quiet-breaks', scene)).toBe(
      '/art/until-the-quiet-breaks/scene5a.png'
    );
    expect(getSceneArtPath(story.id, getScene(story, 'scene5p'))).toBe(
      '/art/until-the-quiet-breaks/scene5p.png'
    );
  });

  it('auto-resolves Layer 6 art paths', () => {
    const scene = { id: 'scene6a', layer: 6, text: 'x' };
    expect(getSceneArtPath('until-the-quiet-breaks', scene)).toBe(
      '/art/until-the-quiet-breaks/scene6a.png'
    );
    expect(getSceneArtPath(story.id, getScene(story, 'scene6p'))).toBe(
      '/art/until-the-quiet-breaks/scene6p.png'
    );
  });

  it('auto-resolves Layer 7 art paths', () => {
    const scene = { id: 'scene7a', layer: 7, text: 'x' };
    expect(getSceneArtPath('until-the-quiet-breaks', scene)).toBe(
      '/art/until-the-quiet-breaks/scene7a.png'
    );
    expect(getSceneArtPath(story.id, getScene(story, 'scene7p'))).toBe(
      '/art/until-the-quiet-breaks/scene7p.png'
    );
  });

  it('auto-resolves Layer 8 art paths', () => {
    const scene = { id: 'scene8a', layer: 8, text: 'x' };
    expect(getSceneArtPath('until-the-quiet-breaks', scene)).toBe(
      '/art/until-the-quiet-breaks/scene8a.png'
    );
    expect(getSceneArtPath(story.id, getScene(story, 'scene8p'))).toBe(
      '/art/until-the-quiet-breaks/scene8p.png'
    );
  });

  it('auto-resolves Layer 9 and Layer 10 art paths (files optional)', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene9a'))).toBe(
      '/art/until-the-quiet-breaks/scene9a.png'
    );
    expect(getSceneArtPath(story.id, getScene(story, 'scene10a'))).toBe(
      '/art/until-the-quiet-breaks/scene10a.png'
    );
    expect(getSceneArtPath(story.id, getScene(story, 'scene10j'))).toBe(
      '/art/until-the-quiet-breaks/scene10j.png'
    );
  });
});

describe('story sample — What the Sister Kept', () => {
  it('loads 97 scenes via multi-story registry', async () => {
    const { getStory } = await import('../src/stories/index.js');
    const sister = getStory('what-the-sister-kept');
    expect(Object.keys(sister.scenes)).toHaveLength(97);
    expect(sister.startSceneId).toBe('scene1');
    const result = validateStory(sister);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('slug-aware art paths use /art/what-the-sister-kept/', async () => {
    const { getStory } = await import('../src/stories/index.js');
    const sister = getStory('what-the-sister-kept');
    expect(getSceneArtPath(sister.id, getScene(sister, 'scene4a'))).toBe(
      '/art/what-the-sister-kept/scene4a.png'
    );
    expect(sister.scenes.scene1.art).toBe('/art/what-the-sister-kept/scene1.png');
  });

  it('features William Akers (not John Shaw) and Harborwick', async () => {
    const { getStory } = await import('../src/stories/index.js');
    const sister = getStory('what-the-sister-kept');
    const blob = Object.values(sister.scenes)
      .map((s) => [s.text, s.textHot || ''].join('\n'))
      .join('\n');
    expect(blob).toMatch(/William Akers|Will/);
    expect(blob).toMatch(/Harborwick/);
    expect(blob).not.toMatch(/John Shaw/);
    expect(blob).not.toMatch(/Somerton/);
  });
});
