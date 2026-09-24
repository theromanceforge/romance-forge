/**
 * The Living Key — scene loader
 * Female protagonist (she/her). Romance: Cassian Rook (male LI). Ashmere / Calderyn magical romance.
 */
import { buildStoryScenes, compareScenes } from "./build.js";

const sceneModules = import.meta.glob(
  "../../artifacts/stories/the-living-key/scenes/scene*.js",
  { eager: true }
);

/** Ordered scene modules discovered via glob (layer, then id). */
export const SCENE_MODULES = Object.values(sceneModules)
  .map((mod) => /** @type {import("../engine.js").Scene} */ (mod.default))
  .filter(Boolean)
  .sort(compareScenes);

/** @type {import("../engine.js").Story} */
export const story = {
  id: "the-living-key",
  title: "The Living Key",
  author: "Romance Forge",
  startSceneId: "scene1",
  scenes: buildStoryScenes(SCENE_MODULES, "the-living-key"),
};

export const SCENE_IDS = SCENE_MODULES.map((s) => s.id);
