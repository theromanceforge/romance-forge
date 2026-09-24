#!/usr/bin/env node
/**
 * Write The Living Key scene8i–scene8p from hand-written Warm + Hot prose in
 * scripts/living-key-l8ip-parts/<sceneId>.json.
 *
 * GUARDED (2026-09-24): the original version of this script embedded draft
 * prose and topped each scene up to 1500 words with rotating stock pads. Those
 * pads were stripped from the scenes. This version carries no prose, never
 * pads, and refuses to write unless every part passes the story-quality checks
 * (scripts/lib/guarded-scene-writer.mjs): >= 900 real words per version, no
 * repeated paragraphs, no planning/meta language, no truncated labels.
 * Rewrite plan: docs/living-key-rewrite-plan.md.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardedWrite } from "./lib/guarded-scene-writer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
await guardedWrite({
  root: path.resolve(here, ".."),
  storyId: "the-living-key",
  layer: 8,
  partsDir: path.join(here, "living-key-l8ip-parts"),
  ids: ["scene8i", "scene8j", "scene8k", "scene8l", "scene8m", "scene8n", "scene8o", "scene8p"],
  minWords: 900,
});
