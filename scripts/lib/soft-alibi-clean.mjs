/**
 * Shared cleanup rules for The Soft Alibi scene prose.
 *
 * Used by scripts/strip-soft-alibi-padding.mjs (to strip) and by the
 * fatten-soft-alibi-l5..l9 scripts (as a guard, so they can never write
 * padding or planning notes back into reader-facing text).
 */

/** Sentences matching any of these are planning / meta language, not story. */
export const META_PATTERNS = [
  // Layer / tree / spec references
  /\bLayers?\s*\d/, /\bL\d{1,2}\b/, /\bL\d+-open\b/i, /\blater layer\b/i,
  /\btree\b/i, /\bsole[- ]locks?\b/i, /\bspec\b/i, /\bfate lock/i,
  /\bwithout locking\b/i, /\bendings available\b/i, /\bspend us into endings\b/i,
  /\bending floors\b/i, /\boutbound\b/i,
  /\b(this|that|every|each) ending\b/i,
  // Choice / label / verb-as-choice mechanics
  /\bchoice labels?\b/i, /\bchoice verbs?\b/i, /\bverbs? of consequence\b/i,
  /\bconsequence[- ]verbs?\b/i, /\bnext choice\b/i, /\bhook of choice\b/i,
  /^Choice\b/, /\bChoice (waited|hurt|as)\b/i,
  /\bboth (exits|verbs|choices) were real\b/i, /\bthe path offered\b/i,
  /\b(broadcast|leak|recording) path\b/i,
  // Romance-lock / LI / cast rules
  /\bromance[- ]lock/i, /\bromance locked\b/i, /\blocked on Nolan\b/i,
  /\bNolan(-| Greer )only\b/i, /\bNolan-only\b/i, /\bonly LI\b/, /\bLI\b/,
  // Heat-level / POV / content-policy rules
  /\bintimacy-forward\b/i, /\bnever gore\b/i, /\bnot-gore\b/i, /\bgore-porn\b/i,
  /\bviolence cosplay\b/i, /\bas kink\b/i, /\bporn of the missing\b/i,
  /\bpadded (into|with) porn\b/i, /\bPOV\b/, /\bthrough-line\b/i, /\bbody-true\b/i,
  /\bsmut\b/i, /\bWarm\b(?!\s+(light|air|water|hands?))/, /\bHot\b(?!\s+(dread|water|breath))/,
  /\bCrime (stayed|was|as)? ?plot\b/i, /\bheat was trust versus complicity\b/i,
  /\bHeat advanced\b/i, /\bdecorating fear\b/i, /\bpink innocence\b/i, /\bnever pink\b/i,
  /\bdifferent story's mistake\b/i, /\belegant absolutes\b/i, /\bdread engine\b/i,
  /\banchors?\b/i,
  /\bvictim-play\b/i, /\bnon-gore\b/i, /^Heat stayed heat\.?$/, /\bthe only ending\b/i,
  /\bthe (choice|path) (offered|whispered)\b/i,
  // Ambiguity-lock echoes ("keep Vivienne's fate open") stated as a rule
  /\bFour fates (stayed open|contested) on purpose\b/i, /\bremained un-?settled on purpose\b/i,
  /\bfate remained contested on purpose\b/i, /^Unfinished\b[^.]*on purpose/,
  // House-style "mid-want" used as a structural rule (endings / climax placement)
  /\bmid-want (\w+ )?(ending|first)\b/i, /\bMid-want first\b/i,
  /\b(end|ends|ended|exit|exits|exited|locked) mid-want\b/i, /\bmid-want locked\b/i,
  /\bMid-want filed\b/i, /\bclimax (belong|belonged|belonging|did not belong)/i,
  /\bunfinished on purpose\b/i, /\bending on purpose\b/i, /\bheat ended on\b/i,
];

/** "verb" is almost always choice-mechanics talk here; these few uses are real prose. */
const VERB_ALLOW = [
  /Protection was a verb/, /Not Pell's soft verbs/, /without my verbs/,
  /love was still a verb/, /kinder verbs/, /only verb left in her mouth/,
];

/**
 * Delete-only clause trims: remove a meta clause from an otherwise real
 * sentence (never inserts words). Applied before the sentence-level test.
 */
export const CLAUSE_DELETIONS = [
  [/,\s*unfinished on purpose(?=[,.])/g, ""],
  [/,\s*romance locked on Nolan( Greer)?( alone)?(?=[ ,.])/g, ""],
  [/—without (locking|forcing|collapsing)[^.!?"]*/g, ""],
  [/\bL10-(?=open\b)/g, ""],
  [/ into L10(?=[,.—])/g, ""],
  [/ while Vivienne's doors stayed open on purpose(?=[.])/g, ""],
  [/ without gore(?=[,—])/g, ""],
];

export function trimClauses(s) {
  let out = s;
  for (const [re, rep] of CLAUSE_DELETIONS) out = out.replace(re, rep);
  return out;
}

export function isMetaSentence(s) {
  if (META_PATTERNS.some((re) => re.test(s))) return true;
  if (/\bverbs?\b/i.test(s) && !VERB_ALLOW.some((re) => re.test(s))) return true;
  return false;
}

export function wc(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function splitParagraphs(text) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** Split a paragraph into sentences, keeping punctuation and closing quotes. */
export function splitSentences(p) {
  return p.split(/(?<=[.!?…][”"’)*]*)\s+(?=["“*(\[A-Z])/).filter((s) => s.length);
}

function quoteToggles(s) {
  return (s.match(/"/g) || []).length % 2 === 1;
}

/**
 * Remove meta sentences from one paragraph, repairing straight-quote dialogue
 * so a removed sentence never leaves an unbalanced quote behind.
 */
export function stripMetaFromParagraph(p) {
  const sents = splitSentences(p);
  const removed = [];
  const kept = [];
  let inside = false; // dialogue state in the ORIGINAL at each sentence start
  let cur = false; // dialogue state in the NEW text
  for (const s of sents) {
    const startInside = inside;
    const endInside = quoteToggles(s) ? !inside : inside;
    inside = endInside;
    const trimmed = trimClauses(s);
    if (isMetaSentence(trimmed)) {
      removed.push(s);
      continue;
    }
    if (trimmed !== s) removed.push(`[clause trimmed] ${s}`);
    let out = trimmed;
    if (startInside && !cur) out = '"' + out;
    if (!startInside && cur && kept.length) kept[kept.length - 1] += '"';
    kept.push(out);
    cur = endInside;
  }
  if (cur && !inside && kept.length) kept[kept.length - 1] += '"';
  return { text: kept.join(" "), removed };
}

export function stripMeta(text) {
  const removed = [];
  const paras = [];
  for (const p of splitParagraphs(text)) {
    const r = stripMetaFromParagraph(p);
    removed.push(...r.removed);
    if (r.text.trim()) paras.push(r.text.trim());
  }
  return { text: paras.join("\n\n"), removed };
}

/** Return the meta sentences present in a text (empty array = clean). */
export function findMeta(text) {
  const hits = [];
  for (const p of splitParagraphs(text)) for (const s of splitSentences(p)) if (isMetaSentence(s)) hits.push(s);
  return hits;
}

/**
 * Paragraphs that appear verbatim in `minScenes`+ distinct scenes.
 * @param {Array<{id:string,text:string,textHot:string}>} scenes
 */
export function sharedParagraphs(scenes, minScenes = 3) {
  const count = new Map();
  for (const sc of scenes) {
    const seen = new Set([...splitParagraphs(sc.text), ...splitParagraphs(sc.textHot)]);
    for (const p of seen) count.set(p, (count.get(p) || 0) + 1);
  }
  return new Set([...count].filter(([, c]) => c >= minScenes).map(([p]) => p));
}

/** Known stock padding paragraphs start with these (from the L5–L9 fatten pads and earlier L2–L4 pads). */
export const STOCK_PAD_OPENERS = [
  "Elevator chime late in the shaft reminded [player_name] that Crownspire",
  "Wine glass rings on marble looked like Venn diagrams of complicity.",
  "Unused perfume still breathed from a master bath [player_name] should not know.",
  "Brooks's badge flash in the lobby had stopped sounding like missing-persons alone.",
  "Nolan's brutal charm polished boardrooms and bedrooms with the same metal tell.",
  "Crownspire held its hush around her. Choice labels waited",
  "Elevator chime trembled through [player_name]'s teeth and down into",
  "Wine-ringed marble. Thighs tight. Nipples tight under silk",
  "Sex stayed intimacy-forward",
  "Black car idling like a held breath at the curb.",
  "She wanted to finish against glass and knew finishing belonged",
  "Her cunt ached around unanswered questions.",
];

export function isStockPad(p) {
  return STOCK_PAD_OPENERS.some((o) => p.startsWith(o));
}
