#!/usr/bin/env node
/**
 * CEO lock: Quiet Breaks LI Jake Shaw → John Shaw;
 * Sister Kept LI Jake Akers → William Akers (formal) / Will (casual).
 * Does not touch soft-alibi fattening scenes; only IP-lock docs if flagged.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(js|mjs|md|json|txt|html)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function replaceAll(s, pairs) {
  let out = s;
  for (const [from, to] of pairs) {
    out = typeof from === 'string' ? out.split(from).join(to) : out.replace(from, to);
  }
  return out;
}

/** Quiet Breaks: Jake Shaw → John Shaw; bare Jake → John */
function transformQuiet(content) {
  return replaceAll(content, [
    ['Jake Shaw', 'John Shaw'],
    [/\bJake's\b/g, "John's"],
    [/\bJake\b/g, 'John'],
  ]);
}

/**
 * Sister Kept:
 * 1) Jake Akers → William Akers (formal full name everywhere first)
 * 2) Detective Jake → Detective William (badge/formal without surname)
 * 3) remaining bare Jake → Will (dialogue/intimacy/casual)
 */
function transformSister(content) {
  return replaceAll(content, [
    ["Jake Akers's", "William Akers's"],
    ['Jake Akers', 'William Akers'],
    [/\bDetective Jake\b/g, 'Detective William'],
    [/\bJake's\b/g, "Will's"],
    [/\bJake\b/g, 'Will'],
  ]);
}

/** Soft-alibi IP-lock mentions of the other books' LIs only */
function transformSoftAlibiIpLock(content) {
  // Do NOT touch "CEO Jake" — only character LI names in IP locks.
  return replaceAll(content, [
    ['Jake Shaw', 'John Shaw'],
    ['Jake Akers', 'William Akers'],
  ]);
}

const targets = [
  {
    label: 'quiet-breaks',
    files: [
      ...walk(path.join(ROOT, 'artifacts/stories/until-the-quiet-breaks')),
      path.join(ROOT, 'src/stories/until-the-quiet-breaks.js'),
    ],
    fn: transformQuiet,
  },
  {
    label: 'sister-kept',
    files: [
      ...walk(path.join(ROOT, 'artifacts/stories/what-the-sister-kept')),
      path.join(ROOT, 'src/stories/what-the-sister-kept.js'),
    ],
    fn: transformSister,
  },
  {
    label: 'soft-alibi-iplock',
    files: [
      path.join(ROOT, 'artifacts/stories/the-soft-alibi/PREMISE.md'),
      path.join(ROOT, 'artifacts/stories/the-soft-alibi/TREE.md'),
    ],
    fn: transformSoftAlibiIpLock,
  },
  {
    label: 'catalog-tests',
    files: [
      path.join(ROOT, 'src/main.js'),
      path.join(ROOT, 'tests/engine.test.js'),
      path.join(ROOT, 'tests/app.test.js'),
    ],
    // Catalog/tests mention both LIs — apply both story transforms carefully:
    // Quiet first (Jake Shaw → John Shaw), then Sister (Jake Akers → William…, bare Jake → Will).
    // After Quiet, remaining Jake in these files should be Sister Kept / CEO-test strings.
    fn: (c) => transformSister(transformQuiet(c)),
  },
];

let changed = 0;
for (const t of targets) {
  for (const file of t.files) {
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = t.fn(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed++;
      console.log(`[${t.label}] ${path.relative(ROOT, file)}`);
    }
  }
}
console.log(`Updated ${changed} files.`);
