import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Deterministic: no live Supabase (no network setState→render mid-test).
vi.mock('../src/auth/supabaseClient.js', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
  __resetSupabaseClientForTests: () => {},
}));

const $ = (sel) => document.querySelector(sel);

function typeName(value) {
  const input = /** @type {HTMLInputElement} */ ($('[data-testid="name-input"]'));
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pickSpice(value) {
  const radio = /** @type {HTMLInputElement} */ ($(`[data-testid="spice-${value}"]`));
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('first visit: landing → Begin', () => {
  let mod;

  beforeAll(async () => {
    window.scrollTo = () => {};
    Element.prototype.scrollIntoView = () => {};
    document.body.innerHTML = '<div id="app"></div>';
    sessionStorage.clear();
    mod = await import('../src/main.js');
    await Promise.resolve();
  }, 60000);

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mod.setState({
      view: 'landing',
      storyId: 'the-soft-alibi',
      spice: '',
      playerName: '',
      path: [],
      _pendingResume: false,
      _pendingWhatIfReplay: null,
      savePromptVisible: false,
    });
  });

  it('keeps a typed name when Warm/Hot is picked afterwards (landing re-render)', () => {
    typeName('Jess');
    pickSpice('warm');
    expect(mod.state.spice).toBe('warm');
    expect(/** @type {HTMLInputElement} */ ($('[data-testid="name-input"]')).value).toBe('Jess');
  });

  it('keeps a typed name when a story card is picked afterwards', () => {
    typeName('Jess');
    /** @type {HTMLButtonElement} */ ($('[data-testid="story-the-living-key"]')).click();
    expect(mod.state.storyId).toBe('the-living-key');
    expect(/** @type {HTMLInputElement} */ ($('[data-testid="name-input"]')).value).toBe('Jess');
  });

  it('keeps a typed name across async re-renders (reviews/auth refresh)', () => {
    typeName('Jess');
    mod.setState({ readersSay: [] });
    mod.render();
    expect(/** @type {HTMLInputElement} */ ($('[data-testid="name-input"]')).value).toBe('Jess');
  });

  it('name then Warm then Begin reaches scene 1 of The Soft Alibi', () => {
    typeName('Jess');
    pickSpice('warm');
    /** @type {HTMLFormElement} */ ($('#start-form')).requestSubmit();
    expect(mod.state.view).toBe('reader');
    expect(mod.state.playerName).toBe('Jess');
    expect(mod.state.spice).toBe('warm');
    expect($('[data-testid="scene"]')?.getAttribute('data-scene-id')).toBe('scene1');
    expect($('[data-testid="player-chip"]')?.textContent).toMatch(/Jess/);
  });

  it('start form skips native validation so the inline error always explains what is missing', () => {
    const form = /** @type {HTMLFormElement} */ ($('#start-form'));
    expect(form.noValidate).toBe(true);
    pickSpice('warm');
    /** @type {HTMLFormElement} */ ($('#start-form')).requestSubmit();
    const err = /** @type {HTMLElement} */ ($('[data-testid="start-error"]'));
    expect(mod.state.view).toBe('landing');
    expect(err.hidden).toBe(false);
    expect(err.textContent).toMatch(/Enter your name/);
  });

  it('name is escaped when echoed back into the input', () => {
    typeName('"><img src=x onerror=alert(1)>');
    pickSpice('hot');
    expect($('img[src="x"]')).toBeNull();
    expect(/** @type {HTMLInputElement} */ ($('[data-testid="name-input"]')).value).toBe(
      '"><img src=x onerror=alert(1)>'
    );
  });
});

describe('first visit: mobile sticky Begin', () => {
  let mod;

  beforeAll(async () => {
    mod = await import('../src/main.js');
  }, 60000);

  beforeEach(() => {
    sessionStorage.clear();
    mod.setState({
      view: 'landing',
      storyId: 'the-living-key',
      spice: '',
      playerName: '',
      path: [],
      _pendingResume: false,
      _pendingWhatIfReplay: null,
      savePromptVisible: false,
    });
  });

  it('explains a missing Warm/Hot pick instead of silently scrolling', () => {
    typeName('Jess');
    /** @type {HTMLButtonElement} */ ($('[data-action="sticky-begin"]')).click();
    const err = /** @type {HTMLElement} */ ($('[data-testid="start-error"]'));
    expect(mod.state.view).toBe('landing');
    expect(err.hidden).toBe(false);
    expect(err.textContent).toMatch(/Warm or Hot/);
  });

  it('explains a missing name', () => {
    pickSpice('warm');
    /** @type {HTMLButtonElement} */ ($('[data-action="sticky-begin"]')).click();
    const err = /** @type {HTMLElement} */ ($('[data-testid="start-error"]'));
    expect(err.hidden).toBe(false);
    expect(err.textContent).toMatch(/Enter your name/);
  });

  it('starts The Living Key when name + spice are set', () => {
    pickSpice('warm');
    typeName('Jess');
    /** @type {HTMLButtonElement} */ ($('[data-action="sticky-begin"]')).click();
    expect(mod.state.view).toBe('reader');
    expect(mod.state.storyId).toBe('the-living-key');
    expect($('[data-testid="scene"]')?.getAttribute('data-scene-id')).toBe('scene1');
  });
});

describe('first visit: scene 1 layout', () => {
  it('scene art reserves its space while loading (no prose jump when it arrives)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(path.resolve(__dirname, '../src/styles.css'), 'utf8');
    const rule = css.match(/\.scene-art\[hidden\]\s*\{([^}]*)\}/);
    expect(rule).toBeTruthy();
    expect(rule[1]).not.toMatch(/display:\s*none/);
    expect(rule[1]).toMatch(/visibility:\s*hidden/);
    const src = fs.readFileSync(path.resolve(__dirname, '../src/main.js'), 'utf8');
    // width/height attrs give the browser the aspect ratio before load; they must
    // match the shipped art (all public/art/**/*.png are 1280×720 JPEGs).
    expect(src).toMatch(/class="scene-art-img"[\s\S]{0,200}width="1280"[\s\S]{0,40}height="720"/);
  });
});
