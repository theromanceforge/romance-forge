/**
 * The Soft Alibi — scene loader
 * Female protagonist (she/her). Romance: Nolan Greer (male LI). Crownspire glass-tower mystery.
 */
import { buildStoryScenes, compareScenes } from "./build.js";

const sceneModules = import.meta.glob(
  "../../artifacts/stories/the-soft-alibi/scenes/scene*.js",
  { eager: true }
);

/** Ordered scene modules discovered via glob (layer, then id). */
export const SCENE_MODULES = Object.values(sceneModules)
  .map((mod) => /** @type {import("../engine.js").Scene} */ (mod.default))
  .filter(Boolean)
  .sort(compareScenes);

/** @type {import("../engine.js").Story} */
export const story = {
  id: "the-soft-alibi",
  title: "The Soft Alibi",
  author: "Romance Forge",
  startSceneId: "scene1",
  scenes: buildStoryScenes(SCENE_MODULES, "the-soft-alibi"),
};

export const SCENE_IDS = SCENE_MODULES.map((s) => s.id);
