/**
 * Until the Quiet Breaks — scene loader
 * Female protagonist (she/her). Romance: John Shaw (male LI).
 */
import { buildStoryScenes, compareScenes } from "./build.js";

const sceneModules = import.meta.glob(
  "../../artifacts/stories/until-the-quiet-breaks/scenes/scene*.js",
  { eager: true }
);

/** Ordered scene modules discovered via glob (layer, then id). */
export const SCENE_MODULES = Object.values(sceneModules)
  .map((mod) => /** @type {import("../engine.js").Scene} */ (mod.default))
  .filter(Boolean)
  .sort(compareScenes);

/** @type {import("../engine.js").Story} */
export const story = {
  id: "until-the-quiet-breaks",
  title: "Until the Quiet Breaks",
  author: "Romance Forge",
  startSceneId: "scene1",
  scenes: buildStoryScenes(SCENE_MODULES, "until-the-quiet-breaks"),
};

export const SCENE_IDS = SCENE_MODULES.map((s) => s.id);
