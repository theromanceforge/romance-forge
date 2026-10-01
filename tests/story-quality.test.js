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
 *   - a minor named within one paragraph of explicit content (MINOR_ALLOW below)
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

/* ------------------------------------------------------------------------- *
 * MINOR-PROXIMITY HARD CHECK — reviewer-auditable config (keep at the top).
 *
 * Rule: no minor may be present, named, watching or remembered inside sexual
 * content. Mechanically: a Warm (`text`) or Hot (`textHot`) paragraph that
 * mentions a minor (per-story names/references below, or a generic age /
 * child word) FAILS if that paragraph, the one before it, or the one after it
 * contains an explicit/sexual term. The ONLY way past it is an explicit
 * MINOR_ALLOW entry with a real reason. Keep this list tiny.
 * ------------------------------------------------------------------------- */

/**
 * Allowlist for the minor-proximity check. Each entry must name the exact spot:
 *   { story, sceneId, field: 'text'|'textHot', paragraphIndex (1-based) OR snippet, reason }
 * Entries that no longer match anything fail the test (no stale passes).
 * Currently empty: every hit found in the Oct 2026 safety sweep was fixed in
 * the prose instead of allowlisted.
 */
const MINOR_ALLOW = [
  // { story: 'until-the-quiet-breaks', sceneId: 'scene5d', field: 'text', paragraphIndex: 14,
  //   reason: 'why this is not a minor inside sexual content' },
];

/** Per-story minor characters (names) — canonical ages noted for reviewers. */
const MINOR_NAMES = {
  'until-the-quiet-breaks': ['Clara'], // Clara Shaw, 16 ("sixteen going on forty")
  'what-the-sister-kept': ['Renny', 'Irene', 'Renee'], // Renny (Irene; 'Renee' kept as a guard), 16 when she vanished
  'the-living-key': [], // Ashmere trains adults only
  'the-soft-alibi': [], // no minors in cast
};

/** Per-story indirect references to a minor (pronoun-ish phrases that clearly mean her). */
const MINOR_REFS = {
  'until-the-quiet-breaks': /\b(?:(?:my|his|your|John's|little|kid|baby|younger) sister|the kid)\b/i,
  'what-the-sister-kept': /\b(?:(?:missing|dead|vanished|lost|second|another|quieter) (?:girl|teen|kid)s?|second-girl|the girl's sake|for a girl|(?:her|your|my|little|baby|younger) sister|(?:the|a) sister's (?:name|last|letter|fire|kept|fate|bedroom|journal))\b/i,
};

/** Generic age / child words that flag a minor in any story ("like a teenager" similes excluded). */
/** Clock times are never ages: "11:52", "at 4:30", "11 am", "11pm", "11 a.m.", "11:52 p.m.", "eleven o'clock". */
const NOT_CLOCK = String.raw`(?![:.]\d)(?!\s*(?:[ap]\.?\s?m\b\.?|o'clock\b))`;
const AGE_WORD = 'sixteen|seventeen|fifteen|fourteen|thirteen|twelve';
const MINOR_AGE = new RegExp(String.raw`\b(?:(?:at|was|were|turned|she's|he's|barely|only|just) (?:${AGE_WORD}|1[0-7])\b${NOT_CLOCK}(?! (?:years|minutes|hours|days|weeks|months|pages|floors|blocks|feet|o'clock))`
  + String.raw`|\b(?:sixteen|seventeen|fifteen|fourteen|thirteen)\b(?=\s*[,.;!?)—])`
  + String.raw`|(?:${AGE_WORD})-year-olds?|1[0-7]-year-olds?|high school|junior year|sophomore|freshman year|(?<!like a )teen(?:age|aged|ager|agers|s)?\b|schoolgirl|underage)`, 'i');
const MINOR_KIDS = /\b(?:kids?|child|children|schoolkids?|toddlers?)\b/i;

/** Explicit / sexual terms (genitals, sex acts, arousal, orgasm, undressing). */
const EXPLICIT_TERMS = [
  /\bcocks?\b/i, /\bcunts?\b/i, /\bclit\w*/i, /\bpuss(?:y|ies)\b/i, /\bdicks?\b/i, /\bass\b/i,
  /\bfuck(?:s|ed|ing)? (?:me|her|him|you|us|each other)\b/i, /\bfucking (?:her|him|me|you)\b/i, /\bfinger(?:s|ed|ing)? (?:you|her|me|herself)\b/i,
  /\borgasm\w*/i, /\bclimax\w*/i, /\bthrust\w*/i, /\bpenetrat\w*/i, /\bcondoms?\b/i,
  /\binside (?:her|him|me|you)\b(?! (?:coat|jacket|chest|head|mind|pocket|bag|apartment|car|ribs|skull|sleeve|collar|hood|shirt|voice|throat|mouth|palm|house|room|office))/i,
  /\bbetween (?:her|my|his|your|their) (?:legs|thighs)\b/i, /\bnipples?\b/i, /\bbreasts?\b/i, /\btits?\b/i,
  /\berection\b/i, /\bhard-on\b/i, /\barous\w*/i, /\bmoan\w*/i, /\bstraddl\w*/i, /\bnaked\b/i, /\bundress(?:es|ed|ing)? (?:her|him|me|you|herself|himself|each other)\b/i,
  /\bsex\b/i, /\bsexual\w*/i, /\boral\b/i, /\bunderwear\b/i, /\bpanties\b/i, /\bbra\b/i,
  /\blick(?:s|ed|ing)? (?:(?:her|his|my|your) (?:clit|cock|nipples?|breasts?|thighs?|cunt|pussy)|(?:along|up|into) (?:her|him|his|my)|herself)\b/i,
  /\bsuck(?:s|ed|ing)? (?:(?:on|at) (?:her|his|my) (?:nipples?|breasts?|clit|cock|tongue|neck|throat|lip)|him off|his cock|her clit)\w*/i,
  /\bcome for me\b/i, /\bmade (?:her|him|me) come\b/i, /\bmake (?:her|him|me|you) come\b/i, /\bwant(?:ed)? to come\b/i,
  /\b(?:she|he|I|you|and) came (?:apart|hard|undone|again)\b/i, /\bcame apart\b/i, /\b(?:she|he|I|you) came (?:with (?:a|his|her|my) (?:cry|sound|moan|name|gasp)|around (?:his|my|her) (?:fingers|cock|mouth|tongue))/i,
  /\b(?:come|came|coming) in (?:his|her|my|your) (?:pants|jeans)\b/i,
  /\b(?:her|so|already|still|found her|was) slick\b/i, /\bslick (?:between|and aching|heat|with (?:want|her))\b/i, /\bslicked (?:his|her|my) (?:cock|fingers)\b/i,
  /\bspread (?:her|his|my|your) (?:legs|thighs)\b/i, /\bfingers? (?:inside|in her|into her|in you|in your)\b/i, /\bride (?:me|him|you)\b/i,
  /\bwet (?:for|between)\b/i, /\b(?:she|her|I) was (?:so |already |still )?wet\b/i, /\bwet and (?:restless|aching|ready)\b/i,
  /\bgrind(?:s|ing)? (?:against|on|down|into)\b/i, /\bground (?:against|down|into)\b/i, /\b(?:his|my|your) zipper\b/i, /(?<!(?:head|temple|knee|wrist|bruise|scar|ankle|skull|wound|cut|stitch\w*|ribs|jaw|hand|thumb|finger|eye)[^.]{0,15})\bthrobb?\w*/i,
  /\bunbutton\w* (?:her|his|my|your) (?:jeans|shirt|blouse|fly|pants)\b/i, /\bhips? (?:rocked|rolled|bucked|jerked|snapped|tipped)\b/i, /\bbucked\b/i,
  /\bwetter\b/i, /\b(?:her|my|your|own) wetness\b/i, /\bhow wet\b/i, /\b(?:made|make|makes|making|left|leave|keep|keeps|kept|stay|staying) (?:her|you|me)? ?(?:so )?wet\b/i,
  /\b(?:you|she|I)(?:'re| are| was| were| am|'m) (?:so |already |still |shamefully )?(?:wet\b|(?:soaked|dripping) (?:for|through)\b)/i, /\bsoaked (?:through )?(?:her|my|your) (?:underwear|panties|cotton)\b/i,
  /\bdrip(?:s|ping|ped)? (?:on|for) (?:my|his|your) (?:hand|fingers|cock|tongue|thigh|mouth|wrist|planning)\b/i, /\bthighs? (?:pressed|clenched|squeezed) together\b/i,
  /\bfuck(?:s|ed|ing)? over\b/i, /\bfuck(?:s|ed|ing)? (?:the|a|this|that) [\w-]+(?: [\w-]+)? (?:out of|into) (?:you|her|me)\b/i,
  /\bcome (?:on|around) (?:my|his|your) (?:tongue|fingers|cock|hand|mouth)\b/i, /\b(?:come|came) quiet\b/i, /\bedging\b/i, /\bforeplay\b/i, /\bkink\w*/i,
  /\bmouth on her\b(?! (?:mouth|lips|forehead|temple|cheek|hair|hand|knuckles))/i, /\beat (?:you|her) (?:out|quiet|until)\b/i, /\bclench\w* (?:around|empty)\b/i,
  /\b(?:pulse|heat|ache|want)\b[^.]{0,30}\band lower\b/i,
  /\b(?:come|came|coming) on (?:his|my|your|her) (?:hand|fingers|tongue|cock|mouth|thigh)\b/i, /\bnothing underneath\b/i, /\binto her body\b/i, /\bsank onto him\b/i,
  /\bslid (?:into|inside) her\b/i, /\bspill(?:ed|ing)? into her\b/i, /\bfucked\b(?! up)/i, /\bate her\b/i, /\btook him (?:in|into)\b/i, /\bblow ?job\b/i,
  /\binside of (?:her|his|my|your) thighs?\b/i, /\binner thighs?\b/i,
  /\bhard (?:line|length) of (?:him|his)\b/i, /\bhard against (?:her|his|my)\b/i, /\b(?:he|John|Will|Cassian|Nolan) was hard\b/i,
];

const isExplicit = (p) => EXPLICIT_TERMS.some((r) => r.test(p));
const mentionsMinor = (story, p) => {
  const names = MINOR_NAMES[story] || [];
  if (names.length && new RegExp(`\\b(?:${names.join('|')})\\b`).test(p)) return true;
  if (MINOR_REFS[story] && MINOR_REFS[story].test(p)) return true;
  return MINOR_AGE.test(p) || MINOR_KIDS.test(p);
};

/** Returns [{story, sceneId, field, paragraphIndex, paragraph}] for every violation in one field. */
function minorProximityHits(story, sceneId, field, text) {
  const ps = splitParagraphs(text);
  const x = ps.map(isExplicit);
  const hits = [];
  ps.forEach((p, i) => {
    if (!mentionsMinor(story, p)) return;
    if ([i - 1, i, i + 1].some((j) => j >= 0 && j < ps.length && x[j])) {
      hits.push({ story, sceneId, field, paragraphIndex: i + 1, paragraph: p });
    }
  });
  return hits;
}

const allowMatches = (a, h) => a.story === h.story && a.sceneId === h.sceneId && a.field === h.field
  && (a.paragraphIndex ? a.paragraphIndex === h.paragraphIndex : Boolean(a.snippet) && h.paragraph.includes(a.snippet));

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

describe('minor-proximity hard check (all stories, Warm + Hot)', () => {
  const all = [];
  for (const id of STORY_IDS) {
    for (const s of stories[id]) for (const f of FIELDS) all.push(...minorProximityHits(id, s.id, f, s[f]));
  }

  it('allowlist entries are well-formed and carry a real reason', () => {
    const bad = MINOR_ALLOW.filter((a) => !a.story || !a.sceneId || !FIELDS.includes(a.field)
      || !(a.paragraphIndex || a.snippet) || String(a.reason || '').trim().length < 20);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  it('allowlist has no stale entries', () => {
    const stale = MINOR_ALLOW.filter((a) => !all.some((h) => allowMatches(a, h)));
    expect(stale, JSON.stringify(stale, null, 2)).toEqual([]);
  });

  it('no minor is named within one paragraph of explicit content', () => {
    const bad = all.filter((h) => !MINOR_ALLOW.some((a) => allowMatches(a, h)))
      .map((h) => `${h.story} ${h.sceneId}.${h.field} #${h.paragraphIndex}: ${h.paragraph.slice(0, 160)}`);
    expect(bad, fmt(bad)).toEqual([]);
  });

  it('checker catches known-bad cases (self-test)', () => {
    const bad = 'Rain on the glass.\n\nClara watched from the doorway.\n\nHis cock pressed against her hip.';
    expect(minorProximityHits('until-the-quiet-breaks', 'selftest', 'textHot', bad)).toHaveLength(1);
    const teen = 'At sixteen she had kissed him behind the gym.\n\nShe was wet for him now.';
    expect(minorProximityHits('the-soft-alibi', 'selftest', 'text', teen)).toHaveLength(1);
    const far = 'Clara went home to Willow.\n\nThe door shut behind her.\n\nHis cock pressed against her hip.';
    expect(minorProximityHits('until-the-quiet-breaks', 'selftest', 'textHot', far)).toHaveLength(0);
    const simile = 'He kissed her like a teenager.\n\nShe was wet for him.';
    expect(minorProximityHits('the-soft-alibi', 'selftest', 'text', simile)).toHaveLength(0);
  });

  it('clock times never count as ages; real ages still do (self-test)', () => {
    const sex = '\n\nShe was wet for him.';
    const times = ['They met at 11:52 by the pier.', 'The call came at 4:30.', 'He left at 11 am.', 'She texted at 11pm.',
      'Court resumed at 11 a.m.', 'The van idled until 11:52 p.m.', 'It was 10 PM when he knocked.', "She was there at eleven o'clock.",
      "He came at 12 o'clock.", 'At 9:05 a.m. the lab called.', 'She was 11:15 late on the ledger.'];
    for (const t of times) expect(minorProximityHits('the-soft-alibi', 'selftest', 'text', t + sex), t).toHaveLength(0);
    const ages = ['At sixteen she wrote it down.', 'She was 16 that summer.', 'A 16-year-old went missing.', 'Renny was missing at 17.',
      'She was seventeen.', 'Seventeen, and already gone.', 'A teen walked past.', 'They met in high school.', 'He was a teenager then.'];
    for (const a of ages) expect(minorProximityHits('the-soft-alibi', 'selftest', 'text', a + sex), a).toHaveLength(1);
  });
});
