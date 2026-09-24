/**
 * SaveRecord — path progress for a story.
 * path[] = scene ids visited in order, including the start scene.
 */

/**
 * @typedef {{
 *   userId: string,
 *   storySlug: string,
 *   sceneId: string,
 *   path: string[],
 *   updatedAt: number | string
 * }} SaveRecord
 */

/**
 * @param {{ userId: string, storySlug: string, sceneId: string, path: string[], updatedAt?: number | string }} fields
 * @returns {SaveRecord}
 */
export function createSaveRecord(fields) {
  const { userId, storySlug, sceneId, path, updatedAt = Date.now() } = fields;
  return {
    userId,
    storySlug,
    sceneId,
    path: Array.isArray(path) ? [...path] : [],
    updatedAt,
  };
}

/**
 * Append a scene id if it is not already the last entry.
 * @param {string[]} path
 * @param {string} sceneId
 * @returns {string[]}
 */
export function appendPath(path, sceneId) {
  const base = Array.isArray(path) ? path : [];
  if (!sceneId) return [...base];
  if (base.length && base[base.length - 1] === sceneId) return [...base];
  return [...base, sceneId];
}

/**
 * Trim path so it ends at sceneId (inclusive). Used when replaying a prior scene.
 * @param {string[]} path
 * @param {string} sceneId
 * @returns {string[]}
 */
export function trimPathToScene(path, sceneId) {
  const base = Array.isArray(path) ? path : [];
  if (!sceneId) return [...base];
  const idx = base.lastIndexOf(sceneId);
  if (idx >= 0) return base.slice(0, idx + 1);
  return [sceneId];
}

/**
 * @param {unknown} value
 * @returns {value is SaveRecord}
 */
export function isValidSaveRecord(value) {
  if (!value || typeof value !== 'object') return false;
  const r = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof r.userId === 'string' &&
    typeof r.storySlug === 'string' &&
    typeof r.sceneId === 'string' &&
    Array.isArray(r.path) &&
    r.path.every((id) => typeof id === 'string') &&
    (typeof r.updatedAt === 'number' || typeof r.updatedAt === 'string')
  );
}
