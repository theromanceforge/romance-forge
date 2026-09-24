/**
 * Phase 3 free-tier ads config — kill switch + AdSense ids from Vite env.
 * Default: ads OFF until VITE_ADS_ENABLED=true (safe for Pages without secrets).
 */

/**
 * @typedef {{ enabled: boolean, clientId: string, slot: string, hasClient: boolean }} AdsConfig
 */

/**
 * Read ads env. Pure enough for tests when `env` is injected.
 * @param {Record<string, string | boolean | undefined>} [env]
 * @returns {AdsConfig}
 */
export function getAdsConfig(env = import.meta.env || {}) {
  const rawEnabled = env.VITE_ADS_ENABLED;
  const enabled =
    rawEnabled === true ||
    String(rawEnabled ?? '')
      .trim()
      .toLowerCase() === 'true';
  const clientId = String(env.VITE_ADSENSE_CLIENT_ID || '').trim();
  const slot = String(env.VITE_ADSENSE_SLOT || '').trim();
  return {
    enabled,
    clientId,
    slot,
    hasClient: Boolean(clientId),
  };
}

/** @returns {boolean} */
export function areAdsEnabled(env) {
  return getAdsConfig(env).enabled;
}
