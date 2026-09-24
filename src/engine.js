/**
 * Romance Forge scene engine
 * Data shape supports a future 9-layer tree (1→2→4→8→16→16→16→8→10).
 * Non-ending scenes expose exactly two choices.
 * Spice: 'warm' (default text) | 'hot' (textHot when present).
 */

/**
 * @typedef {'warm' | 'hot'} SpiceLevel
 * @typedef {{ id: string, text: string, textHot?: string }} Choice
 * @typedef {{
 *   id: string,
 *   layer: number,
 *   title?: string,
 *   text: string,
 *   textHot?: string,
 *   art?: string,
 *   choices?: [Choice, Choice],
 *   ending?: boolean
 * }} Scene
 * @typedef {{ id: string, title: string, author?: string, startSceneId: string, scenes: Record<string, Scene> }} Story
 */

/**
 * Replace [player_name] tokens in scene text.
 * @param {string} text
 * @param {string} playerName
 * @returns {string}
 */
export function substituteName(text, playerName) {
  const name = (playerName || 'Traveler').trim() || 'Traveler';
  return text.replaceAll('[player_name]', name);
}

/**
 * Resolve body copy for the current spice level.
 * Default `text` is Warm; `textHot` overrides when spice is hot.
 * @param {Scene} scene
 * @param {SpiceLevel} [spice='warm']
 * @returns {string}
 */
export function getSceneText(scene, spice = 'warm') {
  if (spice === 'hot' && scene.textHot) {
    return scene.textHot;
  }
  return scene.text;
}

/**
 * Resolve a choice label for the current spice level.
 * @param {Choice} choice
 * @param {SpiceLevel} [spice='warm']
 * @returns {string}
 */
export function getChoiceText(choice, spice = 'warm') {
  if (spice === 'hot' && choice.textHot) {
    return choice.textHot;
  }
  return choice.text;
}


/**
 * Resolve illustration path for a scene.
 * Prefers explicit `scene.art`; otherwise auto-resolves
 * `/art/${storyId}/${scene.id}.png` (missing files fall back in the UI).
 * @param {string} storyId
 * @param {Scene} scene
 * @returns {string}
 */
export function getSceneArtPath(storyId, scene) {
  if (scene.art && typeof scene.art === 'string' && scene.art.trim()) {
    return scene.art.trim();
  }
  const slug = storyId || 'until-the-quiet-breaks';
  return `/art/${slug}/${scene.id}.png`;
}

/**
 * @param {Story} story
 * @param {string} sceneId
 * @returns {Scene}
 */
export function getScene(story, sceneId) {
  const scene = story.scenes[sceneId];
  if (!scene) {
    throw new Error(`Unknown scene: ${sceneId}`);
  }
  return scene;
}

/**
 * Whether a scene is an ending (no further choices).
 * @param {Scene} scene
 * @returns {boolean}
 */
export function isEnding(scene) {
  return Boolean(scene.ending) || !scene.choices || scene.choices.length === 0;
}

/**
 * Non-ending scenes must expose exactly two choices.
 * @param {Scene} scene
 * @returns {Choice[]}
 */
export function getChoices(scene) {
  if (isEnding(scene)) {
    return [];
  }
  if (!scene.choices || scene.choices.length !== 2) {
    throw new Error(
      `Scene "${scene.id}" is non-ending and must have exactly two choices`
    );
  }
  return scene.choices;
}

/**
 * Resolve the next scene id from a choice.
 * @param {Scene} scene
 * @param {string} choiceId
 * @returns {string}
 */
export function resolveChoice(scene, choiceId) {
  const choices = getChoices(scene);
  const match = choices.find((c) => c.id === choiceId);
  if (!match) {
    throw new Error(`Choice "${choiceId}" not found on scene "${scene.id}"`);
  }
  return match.id;
}

/**
 * Validate story structure for MVP rules.
 * @param {Story} story
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStory(story) {
  const errors = [];
  if (!story.startSceneId || !story.scenes[story.startSceneId]) {
    errors.push('Missing or invalid startSceneId');
  }
  for (const scene of Object.values(story.scenes)) {
    if (!isEnding(scene)) {
      if (!scene.choices || scene.choices.length !== 2) {
        errors.push(`Scene "${scene.id}" must have exactly 2 choices`);
      } else {
        for (const choice of scene.choices) {
          if (!story.scenes[choice.id]) {
            errors.push(
              `Scene "${scene.id}" choice "${choice.id}" points to missing scene`
            );
          }
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
