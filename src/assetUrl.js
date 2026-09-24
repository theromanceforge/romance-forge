/**
 * Prefix a root-relative asset path with Vite `base` (e.g. `/romance-forge/`).
 * Needed on GitHub Pages so `/brand/...` and `/art/...` do not 404 at domain root.
 * Absolute http(s) URLs and paths that already include the base are unchanged.
 *
 * @param {string} path
 * @returns {string}
 */
export function assetUrl(path) {
  if (!path || typeof path !== 'string') return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  if (base !== '/' && (path === base.slice(0, -1) || path.startsWith(base))) {
    return path;
  }
  const leaf = path.replace(/^\//, '');
  return base.endsWith('/') ? `${base}${leaf}` : `${base}/${leaf}`;
}
