import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  substituteName,
  getScene,
  getSceneText,
  getChoices,
  isEnding,
  resolveChoice,
  getSceneArtPath,
} from '../src/engine.js';
import { story } from '../src/story.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadHtml() {
  return readFileSync(join(root, 'index.html'), 'utf8');
}

function loadMainSource() {
  return readFileSync(join(root, 'src/main.js'), 'utf8');
}

function loadCss() {
  return readFileSync(join(root, 'src/styles.css'), 'utf8');
}

describe('landing page content', () => {
  it('index.html loads the app shell and branding assets', () => {
    const html = loadHtml();
    expect(html).toMatch(/Romance Forge/i);
    expect(html).toContain('id="app"');
    expect(html).toContain('/src/main.js');
    expect(html).toContain('/src/styles.css');
  });

  it('main.js renders cover-first landing with story CTA and name entry', () => {
    const src = loadMainSource();
    expect(src).toMatch(/Romance Forge/);
    expect(src).toMatch(/Begin the story/);
    expect(src).toMatch(/player-name/);
    expect(src).toMatch(/Until the Quiet Breaks/);
    expect(src).toMatch(/data-testid="landing"/);
    expect(src).toMatch(/data-testid="story-cover"/);
    expect(src).toMatch(/data-testid="start-reading"/);
    expect(src).toMatch(/Jake Shaw/);
    expect(src).toMatch(/Somerton rain/);
    expect(src).not.toMatch(/Lainey/);
    expect(src).not.toMatch(/Who we are/);
    expect(src).not.toMatch(/What we do/);
    expect(src).not.toMatch(/Forge the love story that burns for you/);
  });

  it('forge-strip explains what, purpose, how, and playable now', () => {
    const src = loadMainSource();
    expect(src).toMatch(/data-testid="forge-strip"/);
    expect(src).toMatch(/interactive branching spicy romance/);
    expect(src).toMatch(/wine-night BookTok/);
    expect(src).toMatch(/Choose a title/);
    expect(src).toMatch(/Pick Warm or Hot/);
    expect(src).toMatch(/Branch through choices/);
    expect(src).toMatch(/data-testid="playable-now"/);
    expect(src).toMatch(/Live now:/);
    expect(src).not.toMatch(/Who we are/);
    expect(src).not.toMatch(/What we do/);
    expect(src).not.toMatch(/coming-soon-slot/);
  });

  it('landing references real brand + cover art assets', () => {
    const src = loadMainSource();
    expect(src).toMatch(/\/brand\/logo-heart-anvil\.png/);
    expect(src).toMatch(/\/art\/until-the-quiet-breaks\/scene1\.png/);
    expect(src).toMatch(/data-testid="story-cover"/);
    expect(existsSync(join(root, 'public/brand/logo-heart-anvil.png'))).toBe(true);
    expect(existsSync(join(root, 'public/art/until-the-quiet-breaks/scene1.png'))).toBe(true);
    expect(existsSync(join(root, 'public/brand/hero-branching-fire-tree.png'))).toBe(true);
    expect(existsSync(join(root, 'public/brand/hero-forge-heart.png'))).toBe(true);
    expect(existsSync(join(root, 'public/brand/icons-grid.png'))).toBe(true);
    expect(existsSync(join(root, 'public/brand/forge-master-bw.png'))).toBe(true);
  });

  it('uses ink-and-ember dark theme (charcoal, parchment text, amber — not purple AI palette)', () => {
    const css = loadCss();
    expect(css).toMatch(/--parchment|#f5f0e1/i);
    expect(css).toMatch(/--chocolate|--amber/);
    expect(css).toMatch(/Cormorant Garamond/);
    expect(css).toMatch(/--blush/);
    expect(css).toMatch(/--charcoal|--ink|#0c0b0a|#141210/i);
    expect(css).toMatch(/ink-and-ember|color-scheme:\s*dark/i);
    expect(css).not.toMatch(/#7c3aed|#8b5cf6|purple/i);
  });

  it('start flow is story picker → spice → name on the cover', () => {
    const src = loadMainSource();
    expect(src).toMatch(/data-testid="spice-meter"/);
    expect(src).toMatch(/data-testid="spice-warm"/);
    expect(src).toMatch(/data-testid="spice-hot"/);
    expect(src).toMatch(/Choose Warm or Hot before you start/);
    expect(src).toMatch(/10 endings · Warm/);
    expect(src).not.toMatch(/>Playable</);
    expect(src).toMatch(/Yearning · soft-close emotional heat/);
    expect(src).toMatch(/Explicit body-POV smut/);
    // Both titles available; landing renders multi-story picker
    expect(src).toMatch(/what-the-sister-kept/);
    expect(src).toMatch(/data-testid="story-picker"/);
    expect(src).toMatch(/data-action="pick-story"/);
    expect(src).not.toMatch(/coming-soon-slot/);
  });

  it('cover hero wraps start; sticky begin on mobile when CTA scrolls away', () => {
    const src = loadMainSource();
    const css = loadCss();
    const startIdx = src.indexOf('data-testid="start-reading"');
    const coverIdx = src.indexOf('data-testid="story-cover"');
    expect(startIdx).toBeGreaterThan(-1);
    expect(coverIdx).toBeGreaterThan(-1);
    expect(src).toMatch(/data-testid="sticky-begin"/);
    expect(src).toMatch(/data-action="sticky-begin"/);
    expect(src).toMatch(/IntersectionObserver/);
    expect(css).toMatch(/\.cover\b/);
    expect(css).toMatch(/\.cover-overlay/);
    expect(css).toMatch(/\.sticky-begin/);
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/@media \(min-width:\s*640px\)[\s\S]*\.sticky-begin[\s\S]*display:\s*none/);
  });
});

describe('spice selection required and stored', () => {
  it('main persists spice to sessionStorage and gates start', () => {
    const src = loadMainSource();
    expect(src).toMatch(/romanceForge\.spice/);
    expect(src).toMatch(/sessionStorage\.setItem/);
    expect(src).toMatch(/spice !== 'warm' && spice !== 'hot'/);
    expect(src).toMatch(/getSceneText/);
  });

  it('scene1 exposes distinct Warm and Hot prose', () => {
    const scene = getScene(story, 'scene1');
    const warm = getSceneText(scene, 'warm');
    const hot = getSceneText(scene, 'hot');
    expect(warm).toContain('[player_name]');
    expect(hot).toContain('[player_name]');
    expect(hot).not.toBe(warm);
    expect(hot.length).toBeGreaterThan(100);
  });

  it('hot mode uses textHot when present; warm uses text', () => {
    const scene = getScene(story, 'scene2a');
    expect(getSceneText(scene, 'warm')).toBe(scene.text);
    expect(getSceneText(scene, 'hot')).toBe(scene.textHot);
  });
});

describe('name substitution in reader flow', () => {
  it('scene text includes player name after substitution', () => {
    const scene = getScene(story, 'scene1');
    const rendered = substituteName(getSceneText(scene, 'warm'), 'Mara');
    expect(rendered).toContain('Mara');
    expect(rendered).not.toContain('[player_name]');
  });

  it('deeper scenes also substitute the name', () => {
    const deep = getScene(story, 'scene4b');
    const deepRendered = substituteName(getSceneText(deep, 'warm'), 'Jules');
    expect(deepRendered).toContain('Jules');
    expect(deepRendered).not.toContain('[player_name]');
  });
});

describe('choice navigation to correct scene', () => {
  it('first choice leads to diner (scene2a)', () => {
    const start = getScene(story, 'scene1');
    const choices = getChoices(start);
    expect(choices[0].id).toBe('scene2a');
    const next = getScene(story, resolveChoice(start, choices[0].id));
    expect(next.title).toMatch(/Diner/i);
    expect(isEnding(next)).toBe(false);
  });

  it('second choice leads to Willow Lane (scene2b)', () => {
    const start = getScene(story, 'scene1');
    const choices = getChoices(start);
    expect(choices[1].id).toBe('scene2b');
    const next = getScene(story, resolveChoice(start, choices[1].id));
    expect(next.title).toMatch(/Willow/i);
    expect(isEnding(next)).toBe(false);
  });
});

describe('Layer 5 wiring', () => {
  it('scene4a choices navigate into scene5a and scene5b', () => {
    const scene = getScene(story, 'scene4a');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene5a');
    expect(choices[1].id).toBe('scene5b');
    expect(getScene(story, resolveChoice(scene, 'scene5a')).layer).toBe(5);
    expect(getScene(story, resolveChoice(scene, 'scene5b')).layer).toBe(5);
  });

  it('loads 16 Layer 5 scenes and non-endings still expose exactly 2 choices', () => {
    const layer5 = Object.values(story.scenes).filter((s) => s.layer === 5);
    expect(layer5).toHaveLength(16);
    for (const scene of Object.values(story.scenes)) {
      if (!isEnding(scene)) {
        expect(getChoices(scene)).toHaveLength(2);
      }
    }
  });

  it('Layer 5 scenes each expose 2 choices pointing at loaded Layer 6 scenes', () => {
    const layer5 = Object.values(story.scenes).filter((s) => s.layer === 5);
    expect(layer5).toHaveLength(16);
    for (const scene of layer5) {
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

  it('auto-resolves Layer 5 art under /art/until-the-quiet-breaks/{id}.png', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene5a'))).toBe(
      '/art/until-the-quiet-breaks/scene5a.png'
    );
  });
});

describe('Layer 6 wiring', () => {
  it('scene5a choices navigate into scene6a and scene6b', () => {
    const scene = getScene(story, 'scene5a');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene6a');
    expect(choices[1].id).toBe('scene6b');
    expect(getScene(story, resolveChoice(scene, 'scene6a')).layer).toBe(6);
    expect(getScene(story, resolveChoice(scene, 'scene6b')).layer).toBe(6);
  });

  it('Layer 6 scenes each expose 2 choices pointing at loaded Layer 7 scenes', () => {
    const layer6 = Object.values(story.scenes).filter((s) => s.layer === 6);
    expect(layer6).toHaveLength(16);
    for (const scene of layer6) {
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

  it('auto-resolves Layer 6 art under /art/until-the-quiet-breaks/{id}.png', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene6a'))).toBe(
      '/art/until-the-quiet-breaks/scene6a.png'
    );
  });
});

describe('Layer 7 wiring', () => {
  it('scene6a choices navigate into scene7a and scene7b', () => {
    const scene = getScene(story, 'scene6a');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene7a');
    expect(choices[1].id).toBe('scene7b');
    expect(getScene(story, resolveChoice(scene, 'scene7a')).layer).toBe(7);
    expect(getScene(story, resolveChoice(scene, 'scene7b')).layer).toBe(7);
  });

  it('Layer 7 scenes each expose 2 choices pointing at loaded Layer 8 scenes', () => {
    const layer7 = Object.values(story.scenes).filter((s) => s.layer === 7);
    expect(layer7).toHaveLength(16);
    for (const scene of layer7) {
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

  it('auto-resolves Layer 7 art under /art/until-the-quiet-breaks/{id}.png', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene7a'))).toBe(
      '/art/until-the-quiet-breaks/scene7a.png'
    );
  });
});

describe('Layer 8 wiring', () => {
  it('scene7a choices navigate into scene8a and scene8b', () => {
    const scene = getScene(story, 'scene7a');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene8a');
    expect(choices[1].id).toBe('scene8b');
    expect(getScene(story, resolveChoice(scene, 'scene8a')).layer).toBe(8);
    expect(getScene(story, resolveChoice(scene, 'scene8b')).layer).toBe(8);
  });

  it('Layer 8 scenes each expose 2 choices pointing at loaded Layer 9 scenes', () => {
    const layer8 = Object.values(story.scenes).filter((s) => s.layer === 8);
    expect(layer8).toHaveLength(16);
    for (const scene of layer8) {
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

  it('auto-resolves Layer 8 art under /art/until-the-quiet-breaks/{id}.png', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene8a'))).toBe(
      '/art/until-the-quiet-breaks/scene8a.png'
    );
  });
});

describe('Layer 9 wiring', () => {
  it('scene8a choices navigate into scene9a and scene9b', () => {
    const scene = getScene(story, 'scene8a');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene9a');
    expect(choices[1].id).toBe('scene9b');
    expect(getScene(story, resolveChoice(scene, 'scene9a')).layer).toBe(9);
    expect(getScene(story, resolveChoice(scene, 'scene9b')).layer).toBe(9);
  });

  it('Layer 9 scenes each expose 2 choices pointing at loaded Layer 10 endings', () => {
    const layer9 = Object.values(story.scenes).filter((s) => s.layer === 9);
    expect(layer9).toHaveLength(8);
    for (const scene of layer9) {
      expect(isEnding(scene)).toBe(false);
      const choices = getChoices(scene);
      expect(choices).toHaveLength(2);
      for (const choice of choices) {
        const target = getScene(story, choice.id);
        expect(target).toBeTruthy();
        expect(target.layer).toBe(10);
        expect(isEnding(target)).toBe(true);
      }
    }
  });

  it('auto-resolves Layer 9 art paths (files may be missing — hidden fallback)', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene9a'))).toBe(
      '/art/until-the-quiet-breaks/scene9a.png'
    );
  });
});

describe('Layer 10 endings', () => {
  it('scene9a choices navigate into scene10a and scene10i', () => {
    const scene = getScene(story, 'scene9a');
    expect(isEnding(scene)).toBe(false);
    const choices = getChoices(scene);
    expect(choices).toHaveLength(2);
    expect(choices[0].id).toBe('scene10a');
    expect(choices[1].id).toBe('scene10i');
    expect(getScene(story, resolveChoice(scene, 'scene10a')).layer).toBe(10);
    expect(getScene(story, resolveChoice(scene, 'scene10i')).layer).toBe(10);
  });

  it('loads 10 Layer 10 endings (scene10a–scene10j) with empty choices', () => {
    const layer10Ids = 'abcdefghij'.split('').map((letter) => `scene10${letter}`);
    expect(layer10Ids).toHaveLength(10);
    const layer10 = Object.values(story.scenes).filter((s) => s.layer === 10);
    expect(layer10).toHaveLength(10);
    for (const id of layer10Ids) {
      const scene = getScene(story, id);
      expect(scene).toBeTruthy();
      expect(isEnding(scene)).toBe(true);
      expect(getChoices(scene)).toHaveLength(0);
    }
    const endings = Object.values(story.scenes).filter((s) => isEnding(s));
    expect(endings).toHaveLength(10);
    expect(endings.every((s) => s.layer === 10)).toBe(true);
  });

  it('auto-resolves Layer 10 art paths (files may be missing — hidden fallback)', () => {
    expect(getSceneArtPath(story.id, getScene(story, 'scene10a'))).toBe(
      '/art/until-the-quiet-breaks/scene10a.png'
    );
  });
});

describe('non-ending scenes expose exactly 2 choices', () => {
  it('scene1 exposes exactly two choices', () => {
    const start = getScene(story, 'scene1');
    expect(isEnding(start)).toBe(false);
    expect(getChoices(start)).toHaveLength(2);
  });

  it('reader template binds two choice buttons for non-endings', () => {
    const src = loadMainSource();
    expect(src).toMatch(/data-testid="choices"/);
    expect(src).toMatch(/data-action="choose"/);
    expect(src).toMatch(/getChoices\(scene\)/);
  });
});

describe('DOM reader smoke (jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('can mount landing markup with key content', () => {
    const app = document.getElementById('app');
    app.innerHTML = `
      <main class="page landing cover-landing" data-testid="landing">
        <section data-testid="start-reading">
          <div class="cover">
            <img data-testid="story-cover" alt="cover" />
            <div class="cover-overlay">
              <span class="cover-wordmark">Romance Forge</span>
              <h1>Until the Quiet Breaks</h1>
              <button data-testid="start-btn">Begin the story</button>
              <input data-testid="name-input" />
              <input data-testid="spice-warm" type="radio" name="spice" value="warm" />
              <input data-testid="spice-hot" type="radio" name="spice" value="hot" />
            </div>
          </div>
        </section>
      </main>
    `;
    expect(app.querySelector('[data-testid="landing"]')).toBeTruthy();
    expect(app.querySelector('[data-testid="story-cover"]')).toBeTruthy();
    expect(app.textContent).toMatch(/Romance Forge/);
    expect(app.textContent).toMatch(/Until the Quiet Breaks/);
    expect(app.querySelector('[data-testid="start-btn"]')).toBeTruthy();
    expect(app.querySelector('[data-testid="name-input"]')).toBeTruthy();
    expect(app.querySelector('[data-testid="spice-warm"]')).toBeTruthy();
  });

  it('reader shows exactly two choice buttons for a non-ending scene', () => {
    const scene = getScene(story, 'scene1');
    const choices = getChoices(scene);
    const app = document.getElementById('app');
    const body = substituteName(getSceneText(scene, 'warm'), 'Elena');
    app.innerHTML = `
      <main data-testid="reader">
        <div data-testid="scene-text">${body}</div>
        <div data-testid="choices">
          ${choices
            .map((c) => `<button data-testid="choice-${c.id}">${c.text}</button>`)
            .join('')}
        </div>
      </main>
    `;
    const buttons = app.querySelectorAll('[data-testid="choices"] button');
    expect(buttons).toHaveLength(2);
    expect(app.querySelector('[data-testid="scene-text"]').textContent).toContain(
      'Elena'
    );
    expect(app.querySelector('[data-testid="scene-text"]').textContent).not.toContain(
      '[player_name]'
    );
  });
});

describe('per-scene illustrations', () => {
  it('auto-resolves art path by story + scene id', () => {
    const scene = getScene(story, 'scene4a');
    expect(getSceneArtPath(story.id, scene)).toBe(
      '/art/until-the-quiet-breaks/scene4a.png'
    );
  });

  it('prefers explicit scene.art when present', () => {
    const scene = getScene(story, 'scene1');
    expect(scene.art).toBe('/art/until-the-quiet-breaks/scene1.png');
    expect(getSceneArtPath(story.id, scene)).toBe(scene.art);
  });

  it('ships art files for existing Layers 1–8 scenes; missing L9/L10 art is OK', () => {
    const layerLetters = {
      2: 'ab',
      3: 'abcd',
      4: 'abcdefgh',
      5: 'abcdefghijklmnop',
      6: 'abcdefghijklmnop',
      7: 'abcdefghijklmnop',
      8: 'abcdefghijklmnop',
    };
    const ids = ['scene1'];
    for (const [layer, letters] of Object.entries(layerLetters)) {
      for (const letter of letters) {
        ids.push(`scene${layer}${letter}`);
      }
    }
    expect(ids).toHaveLength(79);
    for (const id of ids) {
      const file = join(root, `public/art/until-the-quiet-breaks/${id}.png`);
      expect(existsSync(file)).toBe(true);
    }
    // L9/L10 art is optional — missing files are fine (reader hidden fallback)
  });

  it('reader wires scene-art with brand-cover fallback (not hide)', () => {
    const src = loadMainSource();
    expect(src).toMatch(/getSceneArtPath/);
    expect(src).toMatch(/data-testid="scene-art"/);
    expect(src).toMatch(/bindSceneArt/);
    expect(src).toMatch(/storyCoverPath|cover-\$\{|coverFallback|artFallback|data-art-fallback/);
    expect(src).toMatch(/useCoverFallback|artFallback/);
    // Must not blank-hide the figure on missing scene art
    expect(src).not.toMatch(/const hide = \(\) =>/);
  });
});

describe('reader UX momentum and endings', () => {
  it('choice prompt, layer progress, and ending copy are wired', () => {
    const src = loadMainSource();
    expect(src).toMatch(/What do you do\?/);
    expect(src).toMatch(/data-testid="choice-prompt"/);
    expect(src).toMatch(/data-testid="layer-progress"/);
    expect(src).toMatch(/Layer \$\{scene\.layer\} of 10/);
    expect(src).toMatch(/The quiet isn't done with you/);
    expect(src).toMatch(/data-testid="replay-last-btn"/);
    expect(src).toMatch(/advanceWithMomentum/);
    expect(src).toMatch(/data-testid="momentum"/);
  });

  it('choice buttons have ember-glow hover styling', () => {
    const css = loadCss();
    expect(css).toMatch(/\.btn\.choice:hover/);
    expect(css).toMatch(/ember|rgba\(232,\s*160,\s*74/i);
    expect(css).toMatch(/choice-prompt/);
    expect(css).toMatch(/momentum-beat/);
    expect(css).toMatch(/\.cover-overlay|hero\.compact|pitch\.compact/);
  });
});


describe('multi-story catalog — What the Sister Kept', () => {
  it('CATALOG exposes Quiet Breaks + Sister Kept + Living Key playable', async () => {
    const { CATALOG } = await import('../src/main.js');
    const byId = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
    expect(byId['until-the-quiet-breaks'].available).toBe(true);
    expect(byId['what-the-sister-kept'].available).toBe(true);
    expect(byId['the-living-key'].available).toBe(true);
    expect(byId['the-living-key'].title).toMatch(/Living Key/i);
    expect(byId['the-living-key'].badge).toMatch(/10 endings/i);
    expect(byId['the-living-key'].badge).not.toMatch(/Coming soon/i);
    expect(Object.keys(byId)).not.toContain('what-the-circle-kept');
    expect(Object.keys(byId)).not.toContain('until-the-ward-breaks');
    expect(Object.keys(byId)).not.toContain('coming-soon-slot');
  });

  it('loads Sister Kept with 97 scenes and scene1 start', async () => {
    const { getStory } = await import('../src/stories/index.js');
    const sister = getStory('what-the-sister-kept');
    expect(sister.id).toBe('what-the-sister-kept');
    expect(sister.title).toMatch(/Sister Kept/i);
    expect(sister.startSceneId).toBe('scene1');
    expect(Object.keys(sister.scenes)).toHaveLength(97);
    expect(sister.scenes.scene1).toBeTruthy();
  });

  it('resolves Sister Kept art under /art/what-the-sister-kept/…', async () => {
    const { getStory } = await import('../src/stories/index.js');
    const sister = getStory('what-the-sister-kept');
    const scene1 = getScene(sister, 'scene1');
    expect(getSceneArtPath(sister.id, scene1)).toBe(
      '/art/what-the-sister-kept/scene1.png'
    );
    const scene5a = getScene(sister, 'scene5a');
    expect(getSceneArtPath(sister.id, scene5a)).toBe(
      '/art/what-the-sister-kept/scene5a.png'
    );
  });

  it('Quiet Breaks still loads alongside Sister Kept', async () => {
    const { getStory, STORIES } = await import('../src/stories/index.js');
    expect(Object.keys(STORIES)).toEqual(
      expect.arrayContaining(['until-the-quiet-breaks', 'what-the-sister-kept', 'the-living-key'])
    );
    const quiet = getStory('until-the-quiet-breaks');
    expect(Object.keys(quiet.scenes)).toHaveLength(97);
    expect(getSceneArtPath(quiet.id, getScene(quiet, 'scene1'))).toBe(
      '/art/until-the-quiet-breaks/scene1.png'
    );
  });

  it('landing copy references Harborwick / Jake Akers for Sister Kept', () => {
    const src = loadMainSource();
    expect(src).toMatch(/Harborwick/);
    expect(src).toMatch(/Jake Akers/);
    expect(src).toMatch(/cover-what-the-sister-kept\.png/);
  });
});
