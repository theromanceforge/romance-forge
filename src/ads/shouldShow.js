/**
 * Gate for between-scene interstitial — pure, unit-tested matrix.
 *
 * Never show: ads off, auth/save flows, first scene of session, L10 endings.
 * Safe: mid-path choice → before next non-ending scene.
 */

/**
 * @param {{
 *   adsEnabled?: boolean,
 *   fromSceneId?: string,
 *   toSceneId?: string,
 *   pathLength?: number,
 *   isEnding?: boolean,
 *   isAuthFlow?: boolean,
 *   isStartScene?: boolean,
 *   isReplay?: boolean,
 *   reason?: 'between-scene' | 'post-play' | 'between-layer',
 * }} opts
 * @returns {boolean}
 */
export function shouldShowInterstitial(opts = {}) {
  const {
    adsEnabled = false,
    fromSceneId = '',
    toSceneId = '',
    pathLength = 0,
    isEnding = false,
    isAuthFlow = false,
    isStartScene = false,
    isReplay = false,
    reason = 'between-scene',
  } = opts;

  if (!adsEnabled) return false;
  if (isAuthFlow) return false;
  if (isReplay) return false;

  // Post-play return to landing — allowed soft placement (no scene destination).
  if (reason === 'post-play') {
    return true;
  }

  if (isEnding) return false;
  if (isStartScene) return false;
  if (!fromSceneId || !toSceneId) return false;

  // First scene of a new session: path is still only the start (or empty).
  // Mid-path choices append → pathLength >= 2.
  if (pathLength < 2) return false;

  // Extra safety: never tax advance into an obvious L10 ending id.
  if (/^scene10/i.test(String(toSceneId))) return false;

  return true;
}

/**
 * Heuristic: destination looks like an L10 ending reveal.
 * @param {{ ending?: boolean, layer?: number, id?: string, choices?: unknown[] } | null | undefined} scene
 * @param {string} [toSceneId]
 * @returns {boolean}
 */
export function isEndingDestination(scene, toSceneId = '') {
  const id = (scene && scene.id) || toSceneId || '';
  if (scene) {
    if (scene.ending) return true;
    if (scene.layer === 10) return true;
    if (!scene.choices || scene.choices.length === 0) return true;
  }
  if (/^scene10/i.test(String(id))) return true;
  return false;
}
