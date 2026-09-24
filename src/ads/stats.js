/**
 * Light interstitial measurement — in-memory + sessionStorage mirror.
 * Exposed as window.__rfAdsStats for debugging.
 * Per-story shown counts live under romanceForge.adsByStory (session).
 */

const STORAGE_KEY = 'romanceForge.adsStats';
const BY_STORY_KEY = 'romanceForge.adsByStory';

/** @typedef {{ shown: number, continue: number, skip: number, sceneAdvance: number }} AdsStats */

/** @type {AdsStats} */
const memory = {
  shown: 0,
  continue: 0,
  skip: 0,
  sceneAdvance: 0,
};

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      shown: Number(parsed.shown) || 0,
      continue: Number(parsed.continue) || 0,
      skip: Number(parsed.skip) || 0,
      sceneAdvance: Number(parsed.sceneAdvance) || 0,
    };
  } catch {
    return null;
  }
}

function writeStored(stats) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

function syncWindow(stats) {
  try {
    if (typeof window !== 'undefined') {
      window.__rfAdsStats = { ...stats };
    }
  } catch {
    /* ignore */
  }
}

function hydrate() {
  const stored = readStored();
  if (stored) {
    memory.shown = stored.shown;
    memory.continue = stored.continue;
    memory.skip = stored.skip;
    memory.sceneAdvance = stored.sceneAdvance;
  }
  syncWindow(memory);
}

hydrate();

/**
 * @returns {AdsStats}
 */
export function getAdsStats() {
  return { ...memory };
}

/**
 * @param {keyof AdsStats} key
 */
export function bumpAdsStat(key) {
  if (!(key in memory)) return;
  memory[key] += 1;
  writeStored(memory);
  syncWindow(memory);
}

/**
 * @returns {Record<string, number>}
 */
function readByStory() {
  try {
    const raw = sessionStorage.getItem(BY_STORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    /** @type {Record<string, number>} */
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = Number(v) || 0;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, number>} map
 */
function writeByStory(map) {
  try {
    sessionStorage.setItem(BY_STORY_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * How many interstitials have been shown for this story in the browser session.
 * @param {string} storyId
 * @returns {number}
 */
export function getStoryAdsShown(storyId) {
  if (!storyId) return 0;
  const map = readByStory();
  return Number(map[storyId]) || 0;
}

/**
 * Bump per-story interstitial count after an ad is actually shown.
 * @param {string} storyId
 * @returns {number} new count
 */
export function bumpStoryAdsShown(storyId) {
  if (!storyId) return 0;
  const map = readByStory();
  const next = (Number(map[storyId]) || 0) + 1;
  map[storyId] = next;
  writeByStory(map);
  return next;
}

/**
 * Reset per-story count (fresh playthrough / start-fresh).
 * @param {string} storyId
 */
export function resetStoryAdsShown(storyId) {
  if (!storyId) return;
  const map = readByStory();
  if (!(storyId in map)) return;
  delete map[storyId];
  writeByStory(map);
}

/** Test helper */
export function __resetAdsStatsForTests() {
  memory.shown = 0;
  memory.continue = 0;
  memory.skip = 0;
  memory.sceneAdvance = 0;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(BY_STORY_KEY);
  } catch {
    /* ignore */
  }
  syncWindow(memory);
}
