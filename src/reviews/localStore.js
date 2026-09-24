/**
 * Guest review storage — localStorage only (not global social proof).
 * One decision per story: submitted review or dismissed forever.
 */

/** @typedef {{ status: 'submitted', storyId: string, stars: number, body: string, displayName: string, spice: 'warm' | 'hot', createdAt: number }} GuestReviewSubmitted */
/** @typedef {{ status: 'dismissed', storyId: string, createdAt: number }} GuestReviewDismissed */
/** @typedef {GuestReviewSubmitted | GuestReviewDismissed} GuestReviewDecision */

const KEY_PREFIX = 'romanceForge.review.';
export const REVIEW_BODY_MAX = 280;

/**
 * @param {string} storyId
 * @returns {string}
 */
export function reviewStorageKey(storyId) {
  return `${KEY_PREFIX}${storyId}`;
}

/**
 * @param {unknown} value
 * @returns {value is GuestReviewDecision}
 */
export function isValidGuestReviewDecision(value) {
  if (!value || typeof value !== 'object') return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  if (typeof v.storyId !== 'string' || !v.storyId) return false;
  if (v.status === 'dismissed') {
    return typeof v.createdAt === 'number';
  }
  if (v.status === 'submitted') {
    const stars = v.stars;
    if (typeof stars !== 'number' || stars < 1 || stars > 5 || !Number.isInteger(stars)) {
      return false;
    }
    if (typeof v.body !== 'string' || v.body.length > REVIEW_BODY_MAX) return false;
    if (typeof v.displayName !== 'string') return false;
    if (v.spice !== 'warm' && v.spice !== 'hot') return false;
    return typeof v.createdAt === 'number';
  }
  return false;
}

/**
 * @param {string} storyId
 * @param {Storage | null} [storage]
 * @returns {GuestReviewDecision | null}
 */
export function getGuestReview(storyId, storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !storyId) return null;
  try {
    const raw = store.getItem(reviewStorageKey(storyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidGuestReviewDecision(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} storyId
 * @param {Storage | null} [storage]
 * @returns {boolean}
 */
export function hasGuestReviewDecision(storyId, storage) {
  return getGuestReview(storyId, storage) != null;
}

/**
 * @param {GuestReviewSubmitted} review
 * @param {Storage | null} [storage]
 */
export function setGuestReview(review, storage) {
  if (!isValidGuestReviewDecision(review) || review.status !== 'submitted') {
    throw new Error('Invalid guest review');
  }
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    store.setItem(reviewStorageKey(review.storyId), JSON.stringify(review));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} storyId
 * @param {Storage | null} [storage]
 */
export function dismissGuestReview(storyId, storage) {
  if (!storyId) return;
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  /** @type {GuestReviewDismissed} */
  const decision = {
    status: 'dismissed',
    storyId,
    createdAt: Date.now(),
  };
  try {
    store.setItem(reviewStorageKey(storyId), JSON.stringify(decision));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} storyId
 * @param {Storage | null} [storage]
 */
export function clearGuestReview(storyId, storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !storyId) return;
  try {
    store.removeItem(reviewStorageKey(storyId));
  } catch {
    /* ignore */
  }
}
