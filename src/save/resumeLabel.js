/**
 * Resume hint labels — prefer scene title; else a short humanized id.
 */

/**
 * Humanize a scene id when no title is available (e.g. scene2a → Scene 2a).
 * @param {string} sceneId
 * @returns {string}
 */
export function humanizeSceneId(sceneId) {
  const id = String(sceneId || '');
  if (!id) return '';
  const m = id.match(/^scene(\d+)([a-z]*)$/i);
  if (m) return `Scene ${m[1]}${m[2] || ''}`;
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Prefer scene title from story when present; else humanized label.
 * @param {string} sceneId
 * @param {{ scenes?: Record<string, { title?: string }> } | null | undefined} [storyObj]
 * @returns {string}
 */
export function resumeSceneLabel(sceneId, storyObj) {
  const id = String(sceneId || '');
  if (!id) return '';
  const scene = storyObj?.scenes?.[id];
  if (scene?.title) return scene.title;
  return humanizeSceneId(id);
}
