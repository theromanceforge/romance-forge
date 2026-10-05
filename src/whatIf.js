/**
 * Post-play "what if" map — unused sibling teasers on the ending screen.
 * Pure selection + HTML helpers. Data-driven from path + story scenes.
 */

import { getChoiceText, getChoices, isEnding } from "./engine.js";
import { trimPathToScene } from "./save/record.js";

/** @typedef {{ sceneId: string, choiceIndex?: number, target?: string, tease?: string }} WhatIfOverride */

/**
 * @typedef {{
 *   sceneId: string,
 *   choiceId: string,
 *   choiceIndex: number,
 *   label: string,
 *   layer: number,
 *   tease: string,
 *   chapterLabel: string,
 *   source: "derived" | "authored"
 * }} WhatIfCard
 */

/**
 * Ending-scene titles for spoiler checks (layer 10 / ending flag).
 * @param {import("./engine.js").Story} story
 * @returns {string[]}
 */
export function endingTitlesFor(story) {
  if (!story?.scenes) return [];
  return Object.values(story.scenes)
    .filter((s) => s && (s.ending || s.layer === 10 || isEnding(s)))
    .map((s) => (typeof s.title === "string" ? s.title.trim() : ""))
    .filter((t) => t.length >= 4);
}

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeForCompare(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\u2019\u2018']/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when a choice label would reveal an ending title.
 * @param {string} label
 * @param {string[]} endingTitles
 * @returns {boolean}
 */
export function labelRevealsEndingTitle(label, endingTitles) {
  const norm = normalizeForCompare(label);
  if (!norm) return false;
  for (const title of endingTitles || []) {
    const t = normalizeForCompare(title);
    if (!t || t.length < 4) continue;
    if (norm.includes(t)) return true;
  }
  return false;
}

/**
 * Outline-ish / planning labels — flag for Forge Scribe, not for readers to fix.
 * @param {string} label
 * @returns {boolean}
 */
export function isOutlineIshLabel(label) {
  const s = String(label || "").trim().replace(/[‘’]/g, "'");
  if (!s) return true;
  // "Full coop: …", "Ledger private: …", "Broadcast path: …"
  if (/^[A-Za-z][A-Za-z0-9/'\-\s]{0,40}:\s+\S/.test(s)) return true;
  if (/\b(path|coop|ledger|page|thread)\s*:/i.test(s)) return true;
  if (/\b(L\d+|layer\s*\d+|scene\d+)\b/i.test(s)) return true;
  return false;
}

/**
 * Frame alternate choice label as a tease (no prose dump).
 * @param {string} label
 * @returns {string}
 */
export function frameTease(label) {
  const trimmed = String(label || "").trim();
  if (!trimmed) return "What if you had chosen differently?";
  if (/^what if\b/i.test(trimmed)) return trimmed;
  return `What if you had… ${trimmed}`;
}

/**
 * Collect unused sibling choices along a played path.
 * @param {import("./engine.js").Story} story
 * @param {string[]} path
 * @param {import("./engine.js").SpiceLevel} [spice="warm"]
 * @returns {Array<{ sceneId: string, choiceId: string, choiceIndex: number, label: string, layer: number }>}
 */
export function collectUnusedSiblings(story, path, spice = "warm") {
  const base = Array.isArray(path) ? path : [];
  /** @type {Array<{ sceneId: string, choiceId: string, choiceIndex: number, label: string, layer: number }>} */
  const out = [];
  if (!story?.scenes || base.length < 2) return out;

  for (let i = 0; i < base.length - 1; i += 1) {
    const sceneId = base[i];
    const takenId = base[i + 1];
    const scene = story.scenes[sceneId];
    if (!scene || isEnding(scene)) continue;
    let choices;
    try {
      choices = getChoices(scene);
    } catch {
      continue;
    }
    for (let ci = 0; ci < choices.length; ci += 1) {
      const choice = choices[ci];
      if (!choice || choice.id === takenId) continue;
      out.push({
        sceneId,
        choiceId: choice.id,
        choiceIndex: ci,
        label: getChoiceText(choice, spice),
        layer: typeof scene.layer === "number" ? scene.layer : 0,
      });
    }
  }
  return out;
}

/**
 * Resolve authored overrides into cards (skips invalid / missing scenes).
 * @param {import("./engine.js").Story} story
 * @param {WhatIfOverride[]} overrides
 * @param {import("./engine.js").SpiceLevel} [spice="warm"]
 * @returns {WhatIfCard[]}
 */
export function cardsFromOverrides(story, overrides, spice = "warm") {
  if (!Array.isArray(overrides) || !story?.scenes) return [];
  /** @type {WhatIfCard[]} */
  const cards = [];
  for (const o of overrides) {
    if (!o?.sceneId) continue;
    const scene = story.scenes[o.sceneId];
    if (!scene || isEnding(scene)) continue;
    let choices;
    try {
      choices = getChoices(scene);
    } catch {
      continue;
    }
    let choice = null;
    let choiceIndex = -1;
    if (typeof o.target === "string" && o.target) {
      choiceIndex = choices.findIndex((c) => c.id === o.target);
      choice = choiceIndex >= 0 ? choices[choiceIndex] : null;
    } else if (Number.isInteger(o.choiceIndex) && o.choiceIndex >= 0) {
      choiceIndex = o.choiceIndex;
      choice = choices[choiceIndex] || null;
    }
    if (!choice) continue;
    const label = getChoiceText(choice, spice);
    const tease =
      typeof o.tease === "string" && o.tease.trim()
        ? o.tease.trim()
        : frameTease(label);
    const layer = typeof scene.layer === "number" ? scene.layer : 0;
    cards.push({
      sceneId: o.sceneId,
      choiceId: choice.id,
      choiceIndex,
      label,
      layer,
      tease,
      chapterLabel: layer ? `Chapter ${layer}` : "",
      source: "authored",
    });
  }
  return cards;
}

/**
 * Pick 2–3 roads-not-taken cards for the ending screen.
 * Prefers later forks, one per scene, skips ending-title spoilers, dedupes.
 * Authored overrides (CATALOG.whatIf) win when present and valid.
 *
 * @param {import("./engine.js").Story} story
 * @param {string[]} path
 * @param {{
 *   spice?: import("./engine.js").SpiceLevel,
 *   max?: number,
 *   min?: number,
 *   overrides?: WhatIfOverride[],
 * }} [opts]
 * @returns {WhatIfCard[]}
 */
export function selectWhatIfCards(story, path, opts = {}) {
  const spice = opts.spice === "hot" ? "hot" : "warm";
  const max = Math.min(3, Math.max(1, opts.max ?? 3));
  const overrides = opts.overrides;

  if (Array.isArray(overrides) && overrides.length) {
    const authored = cardsFromOverrides(story, overrides, spice).slice(0, max);
    if (authored.length) return authored;
  }

  const endingTitles = endingTitlesFor(story);
  const siblings = collectUnusedSiblings(story, path, spice);

  // Prefer later / more pivotal forks: sort by layer desc, then sceneId.
  const ranked = [...siblings].sort((a, b) => {
    if (b.layer !== a.layer) return b.layer - a.layer;
    return String(b.sceneId).localeCompare(String(a.sceneId), "en");
  });

  /** @type {WhatIfCard[]} */
  const picked = [];
  const usedScenes = new Set();
  const usedChoiceIds = new Set();
  const usedLabels = new Set();

  function tryPick(allowOutline) {
    for (const s of ranked) {
      if (picked.length >= max) break;
      if (usedScenes.has(s.sceneId)) continue;
      if (usedChoiceIds.has(s.choiceId)) continue;
      const labelKey = normalizeForCompare(s.label);
      if (labelKey && usedLabels.has(labelKey)) continue;
      if (labelRevealsEndingTitle(s.label, endingTitles)) continue;
      if (!allowOutline && isOutlineIshLabel(s.label)) continue;

      usedScenes.add(s.sceneId);
      usedChoiceIds.add(s.choiceId);
      if (labelKey) usedLabels.add(labelKey);

      picked.push({
        sceneId: s.sceneId,
        choiceId: s.choiceId,
        choiceIndex: s.choiceIndex,
        label: s.label,
        layer: s.layer,
        tease: frameTease(s.label),
        chapterLabel: s.layer ? `Chapter ${s.layer}` : "",
        source: "derived",
      });
    }
  }

  // Prefer reader-facing labels; only fall back to outline-ish if under max.
  tryPick(false);
  if (picked.length < max) tryPick(true);

  return picked;
}

/**
 * Trim path to the fork scene for "Replay from here".
 * @param {string[]} path
 * @param {string} forkSceneId
 * @returns {string[]}
 */
export function pathForReplayFrom(path, forkSceneId) {
  return trimPathToScene(path, forkSceneId);
}

/**
 * Render the what-if map block (ending screen). No ads markup.
 * @param {WhatIfCard[]} cards
 * @param {{ escapeHtml: (s: string) => string }} helpers
 * @returns {string}
 */
export function renderWhatIfMapHtml(cards, helpers) {
  const escapeHtml = helpers?.escapeHtml || ((s) => String(s ?? ""));
  if (!Array.isArray(cards) || cards.length === 0) return "";

  const items = cards
    .map(
      (c) => `
      <li class="what-if-card" data-testid="what-if-card" data-fork-scene="${escapeHtml(c.sceneId)}" data-choice-id="${escapeHtml(c.choiceId)}">
        ${c.chapterLabel ? `<p class="what-if-chapter" data-testid="what-if-chapter">${escapeHtml(c.chapterLabel)}</p>` : ""}
        <p class="what-if-tease" data-testid="what-if-tease">${escapeHtml(c.tease)}</p>
        <button
          type="button"
          class="btn secondary what-if-replay"
          data-action="what-if-replay"
          data-fork-scene-id="${escapeHtml(c.sceneId)}"
          data-highlight-choice-id="${escapeHtml(c.choiceId)}"
          data-testid="what-if-replay"
        >Replay from here</button>
      </li>`
    )
    .join("");

  return `
    <section class="what-if-map" data-testid="what-if-map" aria-label="Roads not taken">
      <h2 class="what-if-heading" data-testid="what-if-heading">Roads not taken</h2>
      <p class="what-if-sub">A few turns you didn&rsquo;t take — replay from the fork, same name and spice.</p>
      <ul class="what-if-list" data-testid="what-if-list">
        ${items}
      </ul>
    </section>`;
}

/** sessionStorage key for post-finish compact strip (guest-safe, session only). */
export const LAST_FINISHED_KEY = 'romanceForge.lastFinished';

/**
 * @typedef {{
 *   storyId: string,
 *   path: string[],
 *   spice: 'warm' | 'hot' | string,
 *   finishedAt: number
 * }} LastFinished
 */

/**
 * @param {unknown} value
 * @returns {value is LastFinished}
 */
export function isValidLastFinished(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof r.storyId === 'string' &&
    r.storyId.length > 0 &&
    Array.isArray(r.path) &&
    r.path.length >= 2 &&
    r.path.every((id) => typeof id === 'string') &&
    (r.spice === 'warm' || r.spice === 'hot' || typeof r.spice === 'string') &&
    typeof r.finishedAt === 'number'
  );
}

/**
 * @param {Storage | null | undefined} [storage]
 * @returns {LastFinished | null}
 */
export function loadLastFinished(storage) {
  const store =
    storage ??
    (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!store) return null;
  try {
    const raw = store.getItem(LAST_FINISHED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidLastFinished(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ storyId: string, path: string[], spice?: string, finishedAt?: number }} fields
 * @param {Storage | null | undefined} [storage]
 */
export function saveLastFinished(fields, storage) {
  const store =
    storage ??
    (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!store || !fields?.storyId || !Array.isArray(fields.path) || fields.path.length < 2) {
    return;
  }
  const record = {
    storyId: fields.storyId,
    path: [...fields.path],
    spice: fields.spice === 'hot' ? 'hot' : 'warm',
    finishedAt: typeof fields.finishedAt === 'number' ? fields.finishedAt : Date.now(),
  };
  if (!isValidLastFinished(record)) return;
  try {
    store.setItem(LAST_FINISHED_KEY, JSON.stringify(record));
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {Storage | null | undefined} [storage]
 */
export function clearLastFinished(storage) {
  const store =
    storage ??
    (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!store) return;
  try {
    store.removeItem(LAST_FINISHED_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Compact landing strip (1–2 cards) after a finished playthrough.
 * @param {WhatIfCard[]} cards
 * @param {{ escapeHtml: (s: string) => string, storyTitle?: string }} helpers
 * @returns {string}
 */
export function renderWhatIfCompactHtml(cards, helpers) {
  const escapeHtml = helpers?.escapeHtml || ((s) => String(s ?? ''));
  if (!Array.isArray(cards) || cards.length === 0) return '';
  const title = helpers?.storyTitle ? String(helpers.storyTitle) : '';
  const items = cards
    .map(
      (c) => `
      <li class="what-if-card what-if-card--compact" data-testid="what-if-card" data-fork-scene="${escapeHtml(c.sceneId)}" data-choice-id="${escapeHtml(c.choiceId)}">
        ${c.chapterLabel ? `<p class="what-if-chapter" data-testid="what-if-chapter">${escapeHtml(c.chapterLabel)}</p>` : ''}
        <p class="what-if-tease" data-testid="what-if-tease">${escapeHtml(c.tease)}</p>
        <button
          type="button"
          class="btn secondary what-if-replay"
          data-action="what-if-replay-landing"
          data-fork-scene-id="${escapeHtml(c.sceneId)}"
          data-highlight-choice-id="${escapeHtml(c.choiceId)}"
          data-testid="what-if-replay"
        >Replay from here</button>
      </li>`
    )
    .join('');

  return `
    <aside class="what-if-compact" data-testid="what-if-compact" aria-label="Roads not taken">
      <div class="what-if-compact-head">
        <div>
          <p class="what-if-compact-kicker" data-testid="what-if-compact-kicker">Roads not taken</p>
          ${title ? `<p class="what-if-compact-story" data-testid="what-if-compact-story">${escapeHtml(title)}</p>` : ''}
        </div>
        <button
          type="button"
          class="what-if-dismiss"
          data-action="dismiss-what-if-compact"
          data-testid="what-if-dismiss"
          aria-label="Dismiss roads not taken"
        >&times;</button>
      </div>
      <ul class="what-if-list what-if-list--compact" data-testid="what-if-list">
        ${items}
      </ul>
    </aside>`;
}
