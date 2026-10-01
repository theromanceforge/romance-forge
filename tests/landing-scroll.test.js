import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const main = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src/main.js'),
  'utf8'
);
const renderFn = main.slice(main.indexOf('function render() {'), main.indexOf('function revealSpiceMeter'));

describe('landing scroll preservation', () => {
  it('render() keeps overlay/window scroll on landing re-renders', () => {
    expect(renderFn).toMatch(/stayOnLanding/);
    expect(renderFn).toMatch(/nextOverlay\.scrollTop = overlayTop/);
    expect(renderFn).toMatch(/window\.scrollTo\(0, winY\)/);
  });

  it('scroll-to-top only happens when entering the reader from landing', () => {
    expect(renderFn).toMatch(
      /state\.view === 'reader' && _renderedView === 'landing'\) \{\s*window\.scrollTo\(0, 0\)/
    );
  });

  it('story pick reveals spice meter + Begin in overlay and window, after async re-render', () => {
    expect(main).toMatch(/revealSpiceMeter\(\);\s*\/\/[^\n]*\n[^\n]*\n\s*refreshReadersSay\(id\)\.finally\(/);
    expect(main).toMatch(/if \(state\.view === 'landing' && state\.storyId === id\) revealSpiceMeter\(\)/);
    const reveal = main.slice(main.indexOf('function revealSpiceMeter'), main.indexOf('function bindEvents'));
    expect(reveal).toMatch(/overlay\.scrollTop \+= delta/);
    expect(reveal).toMatch(/window\.scrollBy\(0, dy\)/);
  });
});
