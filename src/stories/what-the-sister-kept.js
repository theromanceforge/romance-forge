/**
 * What the Sister Kept — scene loader
 * Female protagonist (she/her). Romance: William Akers (male LI). Harborwick mystery.
 */
import { buildStoryScenes, compareScenes } from "./build.js";

const sceneModules = import.meta.glob(
  "../../artifacts/stories/what-the-sister-kept/scenes/scene*.js",
  { eager: true }
);

/** Ordered scene modules discovered via glob (layer, then id). */
export const SCENE_MODULES = Object.values(sceneModules)
  .map((mod) => /** @type {import("../engine.js").Scene} */ (mod.default))
  .filter(Boolean)
  .sort(compareScenes);

/** @type {import("../engine.js").Story} */
export const story = {
  id: "what-the-sister-kept",
  title: "What the Sister Kept",
  author: "Romance Forge",
  startSceneId: "scene1",
  scenes: buildStoryScenes(SCENE_MODULES, "what-the-sister-kept"),
};

export const SCENE_IDS = SCENE_MODULES.map((s) => s.id);
