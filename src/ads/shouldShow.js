/**
 * Gate for between-scene interstitial — pure, unit-tested matrix.
 *
 * Cap: max 2 interstitials per story session (mid + end).
 * Never show: ads off, auth/save flows, first scene of session, L10 endings.
 * Mid: between-scene once pathLength >= 5 and none shown yet.
 * End: post-play return to landing (when under cap).
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
 *   adsShownThisStory?: number,
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
    adsShownThisStory = 0,
  } = opts;

  if (!adsEnabled) return false;
  if (isAuthFlow) return false;
  if (isReplay) return false;

  // Hard cap: at most 2 interstitials per story session.
  if (adsShownThisStory >= 2) return false;

  // Post-play return to landing — end slot when under cap.
  if (reason === 'post-play') {
    return adsShownThisStory < 2;
  }

  if (isEnding) return false;
  if (isStartScene) return false;
  if (!fromSceneId || !toSceneId) return false;

  // First scene / early path: don't tax the hook (pathLength < 2).
  if (pathLength < 2) return false;

  // Extra safety: never tax advance into an obvious L10 ending id.
  if (/^scene10/i.test(String(toSceneId))) return false;

  // Mid slot only: first eligible between-scene once roughly mid-story.
  // After mid is used, between-scene stays off (end slot is post-play).
  if (pathLength >= 5 && adsShownThisStory === 0) {
    return true;
  }

  return false;
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
