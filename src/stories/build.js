/**
 * Shared story scene normalization for Romance Forge.
 * Ending = no choices, or choices whose targets are not loaded yet.
 */

/**
 * @param {import("../engine.js").Scene} a
 * @param {import("../engine.js").Scene} b
 */
export function compareScenes(a, b) {
  const layerDiff = (a.layer ?? 0) - (b.layer ?? 0);
  if (layerDiff !== 0) return layerDiff;
  return String(a.id).localeCompare(String(b.id), "en");
}

/**
 * Normalize scene modules into the engine scenes map.
 * Art paths are slug-aware: `/art/${slug}/${id}.png`.
 * @param {import("../engine.js").Scene[]} modules
 * @param {string} [slug='until-the-quiet-breaks']
 * @returns {Record<string, import("../engine.js").Scene>}
 */
export function buildStoryScenes(modules, slug = "until-the-quiet-breaks") {
  const available = new Set(modules.map((s) => s.id));
  return Object.fromEntries(
    modules.map((s) => {
      const rawChoices = Array.isArray(s.choices) ? s.choices : [];
      const targetsReady =
        rawChoices.length === 0 ||
        rawChoices.every((c) => c && available.has(c.id));
      // Keep authored choices only when every target module exists; otherwise
      // expose a temporary ending until the next layer files appear.
      const choices = targetsReady ? rawChoices : [];
      const id = s.id;
      return [
        id,
        {
          ...s,
          art: `/art/${slug}/${id}.png`,
          choices,
          ending: choices.length === 0,
        },
      ];
    })
  );
}
