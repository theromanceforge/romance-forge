/**
 * Story quality guardrail (root-cause fix for padded / meta-leaking scenes).
 *
 * Runs the same checks as `node scripts/audit-stories.mjs` over every story and
 * FAILS on:
 *   - repeated-paragraph padding > 5% of a scene's words (text or textHot)
 *   - reader-visible meta / planning language (hand-checked list in
 *     scripts/lib/story-quality.mjs) in prose or in choice labels
 *   - leftover old love-interest names (Jake Shaw, Jake Akers, Lane Shaw, Jake)
 *   - truncated choice labels
 *   - empty text / textHot
 * Short scenes and long sentences are reported as warnings only (for now).
 *
 * Known false positives are allowlisted explicitly below (sentence substrings).
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STORY_IDS, loadStoryScenes, repeatedPadding, findMetaHits, findLabelMeta,
  findOldNames, isTruncatedLabel, endingNamePatterns, wc, splitParagraphs, splitSentences,
} from '../scripts/lib/story-quality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIELDS = ['text', 'textHot'];
const MAX_PAD_PCT = 5;
const SHORT_WARN_WORDS = 250;
const LONG_SENTENCE_WARN = 45;

/** Explicit allowlist of human-checked false positives. Keep it tiny. */
const ALLOW = [
  // (story optional) — substring of the sentence / label that is legitimate prose.
  { story: 'until-the-quiet-breaks', text: 'without asking what was under the garnish' }, // 4c plate metaphor
];

/** Stories whose cleanup has not landed yet (skipped by the hard checks). */
const PENDING = new Set([]);

const stories = {};
for (const id of STORY_IDS) stories[id] = await loadStoryScenes(ROOT, id);

const fmt = (list) => list.slice(0, 25).join('\n') + (list.length > 25 ? `\n… +${list.length - 25} more` : '');

describe.each(STORY_IDS.filter((id) => !PENDING.has(id)))('story quality: %s', (id) => {
  const scenes = stories[id];
  const extra = endingNamePatterns(scenes);

  it('loads scenes', () => {
    expect(scenes.length).toBeGreaterThan(10);
  });

  it('has no empty text / textHot', () => {
    const bad = scenes.flatMap((s) => FIELDS.filter((f) => !String(s[f] || '').trim()).map((f) => `${s.id}.${f}`));
    expect(bad, fmt(bad)).toEqual([]);
  });

  it(`has no scene with > ${MAX_PAD_PCT}% repeated-paragraph padding`, () => {
    const bad = [];
    for (const f of FIELDS) {
      const { perScene } = repeatedPadding(scenes, f);
      for (const [sid, r] of Object.entries(perScene)) if (r.pct > MAX_PAD_PCT) bad.push(`${sid}.${f}: ${r.pct.toFixed(1)}% (${r.repeated}/${r.total} words)`);
    }
    expect(bad, fmt(bad)).toEqual([]);
  });

  it('has no meta / planning language in prose', () => {
    const bad = [];
    for (const s of scenes) for (const f of FIELDS) {
      for (const h of findMetaHits(s[f], id, extra, ALLOW)) bad.push(`${s.id}.${f} [${h.term}]: ${h.sentence.slice(0, 160)}`);
    }
    expect(bad, fmt(bad)).toEqual([]);
  });

  it('has no meta / planning language in choice labels or scene titles', () => {
    const bad = [];
    for (const s of scenes) for (const term of findLabelMeta(s.title, id, [], ALLOW)) bad.push(`${s.id}.title [${term}]: ${s.title}`);
    for (const s of scenes) for (const c of s.choices || []) for (const f of FIELDS) {
      const label = c[f];
      if (!label) continue;
      for (const term of findLabelMeta(label, id, extra, ALLOW)) bad.push(`${s.id}→${(c.id || c.nextScene)}.${f} [${term}]: ${label}`);
    }
    expect(bad, fmt(bad)).toEqual([]);
  });

  it('has no truncated choice labels', () => {
    const bad = [];
    const titles = Object.fromEntries(scenes.map((s) => [s.id, s.title]));
    for (const s of scenes) for (const c of s.choices || []) for (const f of FIELDS) {
      if (f === 'textHot' && !c[f]) continue;
      if (isTruncatedLabel(c[f], titles[c.id || c.nextScene])) bad.push(`${s.id}→${(c.id || c.nextScene)}.${f}: ${JSON.stringify(c[f])}`);
    }
    expect(bad, fmt(bad)).toEqual([]);
  });

  it('has no leftover old love-interest names', () => {
    const bad = [];
    for (const s of scenes) {
      const blobs = [['title', s.title], ...FIELDS.map((f) => [f, s[f]]),
        ...(s.choices || []).flatMap((c) => FIELDS.map((f) => [`choice→${(c.id || c.nextScene)}.${f}`, c[f]]))];
      for (const [where, t] of blobs) for (const h of findOldNames(t || '')) {
        if (ALLOW.some((a) => (!a.story || a.story === id) && h.sentence.includes(a.text))) continue;
        bad.push(`${s.id}.${where} [${h.term}]: ${h.sentence.slice(0, 160)}`);
      }
    }
    expect(bad, fmt(bad)).toEqual([]);
  });

  it('warns (does not fail) on short scenes and long sentences', () => {
    const short = [];
    let long = 0;
    for (const s of scenes) for (const f of FIELDS) {
      const n = wc(s[f]);
      if (n < SHORT_WARN_WORDS) short.push(`${s.id}.${f}=${n}`);
      for (const p of splitParagraphs(s[f])) for (const sen of splitSentences(p)) if (wc(sen) > LONG_SENTENCE_WARN) long++;
    }
    if (short.length || long) {
      console.warn(`[story-quality] ${id}: ${short.length} fields under ${SHORT_WARN_WORDS} words${short.length ? ` (${short.slice(0, 12).join(', ')}${short.length > 12 ? ', …' : ''})` : ''}; ${long} sentences over ${LONG_SENTENCE_WARN} words`);
    }
    expect(true).toBe(true);
  });
});

it('every story is either checked or explicitly pending', () => {
  for (const id of STORY_IDS) expect(stories[id].length, id).toBeGreaterThan(0);
  expect([...PENDING].every((id) => STORY_IDS.includes(id))).toBe(true);
});
