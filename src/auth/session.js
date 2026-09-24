/**
 * AuthSession — domain shape for Phase 2.
 * Guest is the default; cloud auth is optional and not required to play.
 */

/** Stable id used for guest local saves (not a real account). */
export const GUEST_USER_ID = 'guest';

/**
 * @typedef {'guest' | 'authenticated'} AuthStatus
 * @typedef {{ userId: string | null, status: AuthStatus }} AuthSession
 */

/** @returns {AuthSession} */
export function createGuestSession() {
  return { userId: null, status: 'guest' };
}

/**
 * @param {string} userId
 * @returns {AuthSession}
 */
export function createAuthenticatedSession(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('authenticated session requires userId');
  }
  return { userId, status: 'authenticated' };
}

/**
 * @param {AuthSession | null | undefined} session
 * @returns {boolean}
 */
export function isGuest(session) {
  return !session || session.status === 'guest' || !session.userId;
}

/**
 * Storage key id for SaveRecord.userId (guest → 'guest').
 * @param {AuthSession | null | undefined} session
 * @returns {string}
 */
export function saveUserId(session) {
  if (isGuest(session)) return GUEST_USER_ID;
  return session.userId;
}
