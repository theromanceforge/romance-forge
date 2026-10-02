import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { shouldShowSavePrompt, markSavePromptDismissed } from '../src/save/prompt.js';
import { createGuestSession } from '../src/auth/session.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const reader = main.slice(main.indexOf('function renderReader()'), main.indexOf('function bindSceneArt'));

/** Body of the last CSS rule whose selector is exactly `sel`. */
function lastRule(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...css.matchAll(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`, 'g'))];
  return all.length ? all[all.length - 1][1] : '';
}

describe('reader save prompt never covers prose or choices', () => {
  it('reader renders the inline variant of the save prompt', () => {
    expect(reader).toMatch(/<aside class="save-prompt save-prompt--inline" data-testid="save-prompt"/);
  });

  it('inline prompt sits after the scene article (prose + choices), not inside it', () => {
    const tpl = reader.slice(reader.indexOf('<article class="scene'));
    const articleEnd = tpl.indexOf('</article>');
    expect(tpl.indexOf('${choicesHtml}')).toBeLessThan(articleEnd);
    expect(tpl.indexOf('${savePromptHtml}')).toBeGreaterThan(articleEnd);
  });

  it('inline prompt is in normal flow (not fixed/absolute/sticky)', () => {
    const rule = lastRule('.save-prompt.save-prompt--inline');
    expect(rule).toMatch(/position:\s*static/);
    expect(rule).not.toMatch(/position:\s*(fixed|absolute|sticky)/);
    // nothing later re-floats the inline variant
    const after = css.slice(css.indexOf('.save-prompt.save-prompt--inline'));
    expect(after).not.toMatch(/save-prompt--inline[^{]*\{[^}]*position:\s*(fixed|absolute|sticky)/);
  });

  it('dismiss is wired and persists (Not now hides it next time)', () => {
    expect(reader).toMatch(/data-action="dismiss-save-prompt"/);
    expect(main).toMatch(/markSavePromptDismissed\(\);\s*setState\(\{ savePromptVisible: false \}\)/);
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    const session = createGuestSession();
    expect(shouldShowSavePrompt({ session, alreadyShown: false, storage })).toBe(true);
    markSavePromptDismissed(storage);
    expect(shouldShowSavePrompt({ session, alreadyShown: false, storage })).toBe(false);
  });
});
