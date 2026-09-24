/**
 * Until the Quiet Breaks — legacy entry (re-exports multi-story Quiet Breaks module).
 * Prefer `getStory(id)` / `STORIES` from `./stories/index.js` for multi-title use.
 */
export {
  story,
  SCENE_MODULES,
  SCENE_IDS,
} from "./stories/until-the-quiet-breaks.js";
export { buildStoryScenes } from "./stories/build.js";
