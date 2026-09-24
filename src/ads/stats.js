/**
 * Light interstitial measurement — in-memory + sessionStorage mirror.
 * Exposed as window.__rfAdsStats for debugging.
 */

const STORAGE_KEY = 'romanceForge.adsStats';

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

/** Test helper */
export function __resetAdsStatsForTests() {
  memory.shown = 0;
  memory.continue = 0;
  memory.skip = 0;
  memory.sceneAdvance = 0;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  syncWindow(memory);
}
