/**
 * Multi-story registry — Romance Forge
 */
import { story as quietBreaks } from "./until-the-quiet-breaks.js";
import { story as sisterKept } from "./what-the-sister-kept.js";
import { story as livingKey } from "./the-living-key.js";
import { story as softAlibi } from "./the-soft-alibi.js";

/** @type {Record<string, import("../engine.js").Story>} */
export const STORIES = {
  [quietBreaks.id]: quietBreaks,
  [sisterKept.id]: sisterKept,
  [livingKey.id]: livingKey,
  [softAlibi.id]: softAlibi,
};

/**
 * @param {string} id
 * @returns {import("../engine.js").Story}
 */
export function getStory(id) {
  const story = STORIES[id];
  if (!story) {
    throw new Error(`Unknown story: ${id}`);
  }
  return story;
}

/** Default / legacy Quiet Breaks export for callers that still expect `story`. */
export { quietBreaks as story };
export { buildStoryScenes } from "./build.js";
