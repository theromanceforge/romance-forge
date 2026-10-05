/**
 * Auth mock mode + guest→account handoff (local only).
 * No network. Used for demos/tests until Master wires live Supabase.
 */

import {
  createAuthenticatedSession,
  createGuestSession,
  GUEST_USER_ID,
  isGuest,
} from './session.js';
import { createSaveRecord, isValidSaveRecord } from '../save/record.js';

/** Fake authenticated id for mock handoff demos. */
export const MOCK_USER_ID = 'mock-user';

const AUTH_MOCK_KEY = 'romanceForge.authMock';
const AUTH_SESSION_KEY = 'romanceForge.authSession';

/**
 * Mock auth (Demo button, mock hints, mock signed-in state) is a local-dev
 * affordance only. `import.meta.env.DEV` is statically `false` in production
 * builds, so the gated code is dropped there and stale localStorage flags
 * (romanceForge.authMock / a persisted mock-user session) are ignored.
 * @returns {boolean}
 */
export function isMockAuthAllowed() {
  return Boolean(import.meta.env.DEV);
}

/**
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function isAuthMockEnabled(storage) {
  if (!isMockAuthAllowed()) return false;
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    return store.getItem(AUTH_MOCK_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {boolean} enabled
 * @param {Storage} [storage]
 */
export function setAuthMockEnabled(enabled, storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    if (enabled) store.setItem(AUTH_MOCK_KEY, '1');
    else store.removeItem(AUTH_MOCK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Persist / clear a mock AuthSession (local only).
 * @param {import('./session.js').AuthSession | null} session
 * @param {Storage} [storage]
 */
export function persistAuthSession(session, storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    if (!session || isGuest(session)) {
      store.removeItem(AUTH_SESSION_KEY);
      return;
    }
    store.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ userId: session.userId, status: session.status })
    );
  } catch {
    /* ignore */
  }
}

/**
 * @param {Storage} [storage]
 * @returns {import('./session.js').AuthSession}
 */
export function loadPersistedAuthSession(storage) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return createGuestSession();
  try {
    const raw = store.getItem(AUTH_SESSION_KEY);
    if (!raw) return createGuestSession();
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.status === 'authenticated' &&
      typeof parsed.userId === 'string' &&
      parsed.userId &&
      // A leftover dev mock session must not sign a reader in on production.
      (parsed.userId !== MOCK_USER_ID || isMockAuthAllowed())
    ) {
      return createAuthenticatedSession(parsed.userId);
    }
  } catch {
    /* ignore */
  }
  return createGuestSession();
}

/**
 * Copy a guest SaveRecord onto a mock authenticated userId in the local store.
 * Does not delete the guest record (guest path still works if they dismiss/sign out).
 *
 * @param {{
 *   localStore: { load: Function, save: Function },
 *   storySlug: string,
 *   guestUserId?: string,
 *   mockUserId?: string,
 *   now?: number
 * }} opts
 * @returns {{
 *   session: import('./session.js').AuthSession,
 *   copied: import('../save/record.js').SaveRecord | null
 * }}
 */
export function handoffGuestToMockAccount(opts) {
  const {
    localStore,
    storySlug,
    guestUserId = GUEST_USER_ID,
    mockUserId = MOCK_USER_ID,
    now = Date.now(),
  } = opts;

  if (!storySlug || typeof storySlug !== 'string') {
    throw new Error('handoff requires storySlug');
  }

  const guestRecord = localStore.load(guestUserId, storySlug);
  let copied = null;

  if (isValidSaveRecord(guestRecord)) {
    copied = createSaveRecord({
      userId: mockUserId,
      storySlug: guestRecord.storySlug,
      sceneId: guestRecord.sceneId,
      path: [...guestRecord.path],
      updatedAt: now,
    });
    localStore.save(copied);
  }

  const session = createAuthenticatedSession(mockUserId);
  return { session, copied };
}

/**
 * Message shown when cloud auth is not wired (default submit path).
 */
export const CLOUD_AUTH_NOT_CONFIGURED =
  'Accounts aren’t open yet — your place still saves on this browser.';
