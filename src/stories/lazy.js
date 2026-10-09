/**
 * Lazy story registry for the app bundle: each story's scenes ship in their
 * own chunk and load when the story is opened (or prefetched on pick).
 * `src/stories/index.js` stays the eager registry for tests/scripts.
 */

/** @type {Record<string, () => Promise<{ story: import("../engine.js").Story }>>} */
const LOADERS = {
  'until-the-quiet-breaks': () => import('./until-the-quiet-breaks.js'),
  'what-the-sister-kept': () => import('./what-the-sister-kept.js'),
  'the-living-key': () => import('./the-living-key.js'),
  'the-soft-alibi': () => import('./the-soft-alibi.js'),
};

export const STORY_IDS = Object.freeze(Object.keys(LOADERS));
export const DEFAULT_STORY_ID = 'until-the-quiet-breaks';
/** Every story opens on this scene (asserted by tests) — usable before load. */
export const START_SCENE_ID = 'scene1';

/** Loaded stories (mutated in place as chunks arrive). @type {Record<string, import("../engine.js").Story>} */
export const LOADED_STORIES = {};
/** @type {Record<string, Promise<import("../engine.js").Story>>} */
const pending = {};

/** @param {string} id */
export function isKnownStory(id) {
  return Object.prototype.hasOwnProperty.call(LOADERS, id);
}

/** @param {string} id @returns {import("../engine.js").Story | null} */
export function getLoadedStory(id) {
  return (id && LOADED_STORIES[id]) || null;
}

/**
 * Load (once) and cache a story. Retries after a failed chunk fetch.
 * @param {string} id
 * @returns {Promise<import("../engine.js").Story>}
 */
export function loadStory(id) {
  if (LOADED_STORIES[id]) return Promise.resolve(LOADED_STORIES[id]);
  if (!isKnownStory(id)) return Promise.reject(new Error(`Unknown story: ${id}`));
  if (!pending[id]) {
    pending[id] = LOADERS[id]()
      .then((mod) => {
        LOADED_STORIES[id] = mod.story;
        return mod.story;
      })
      .catch((err) => {
        delete pending[id];
        throw err;
      });
  }
  return pending[id];
}

/** Fire-and-forget prefetch (never throws). @param {string} id */
export function prefetchStory(id) {
  if (!id || LOADED_STORIES[id] || !isKnownStory(id)) return;
  loadStory(id).catch(() => {});
}

export function preloadAllStories() {
  return Promise.all(STORY_IDS.map((id) => loadStory(id)));
}
