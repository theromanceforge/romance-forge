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

  it('story pick reveals spice meter + Begin above the sticky bar, surviving async re-renders', () => {
    expect(main).toMatch(/_revealUntil = Date\.now\(\) \+ \d+;\s*revealSpiceMeter\(\);/);
    expect(renderFn).toMatch(/if \(Date\.now\(\) < _revealUntil\) revealSpiceMeter\(\)/);
    expect(main).toMatch(/\['wheel', 'pointerdown', 'keydown'\][\s\S]{0,120}_revealUntil = 0/);
    const reveal = main.slice(main.indexOf('function revealSpiceMeter'), main.indexOf('function bindEvents'));
    expect(reveal).toMatch(/querySelector\('\.sticky-begin'\)/);
    expect(reveal).toMatch(/const viewBottom = window\.innerHeight - stickyH/);
    expect(reveal).toMatch(/overlay\.scrollTop \+= delta\(Math\.max\(o\.top, 0\), Math\.min\(o\.bottom, viewBottom\)\)/);
    expect(reveal).toMatch(/delta\(0, viewBottom\)/);
  });
});
