/**
 * Live cloud auth + guest→account handoff (Supabase).
 * Uses publishable client only — never secret key.
 */

import {
  createAuthenticatedSession,
  createGuestSession,
  GUEST_USER_ID,
  isGuest,
} from './session.js';
import { createSaveRecord, isValidSaveRecord } from '../save/record.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

/**
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 * @returns {import('./session.js').AuthSession}
 */
export function sessionFromUser(user) {
  if (user?.id) return createAuthenticatedSession(user.id);
  return createGuestSession();
}

/**
 * @returns {Promise<import('./session.js').AuthSession>}
 */
export async function fetchAuthSession() {
  const client = getSupabaseClient();
  if (!client) return createGuestSession();
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.user) return createGuestSession();
  return sessionFromUser(data.session.user);
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ session: import('./session.js').AuthSession, error: string | null }>}
 */
export async function signInWithPassword(email, password) {
  const client = getSupabaseClient();
  if (!client) {
    return { session: createGuestSession(), error: 'Cloud auth not configured.' };
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { session: createGuestSession(), error: error.message };
  }
  return { session: sessionFromUser(data.user), error: null };
}

/**
 * @param {string} email
 * @param {string} password
 * @param {{ emailRedirectTo?: string }} [opts]
 * @returns {Promise<{ session: import('./session.js').AuthSession, error: string | null, needsConfirm?: boolean }>}
 */
export async function signUpWithPassword(email, password, opts = {}) {
  const client = getSupabaseClient();
  if (!client) {
    return { session: createGuestSession(), error: 'Cloud auth not configured.' };
  }
  const redirectTo =
    opts.emailRedirectTo ||
    (typeof globalThis !== 'undefined' &&
    globalThis.location &&
    typeof globalThis.location.origin === 'string' &&
    globalThis.location.origin.startsWith('http')
      ? `${globalThis.location.origin}/`
      : undefined);
  const { data, error } = await client.auth.signUp({
    email,
    password,
    ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
  });
  if (error) {
    return { session: createGuestSession(), error: error.message };
  }
  if (!data.session || !data.user) {
    return {
      session: createGuestSession(),
      error: null,
      needsConfirm: true,
    };
  }
  return { session: sessionFromUser(data.user), error: null };
}

/**
 * @returns {Promise<void>}
 */
export async function signOutCloud() {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

/**
 * Subscribe to auth changes. Returns unsubscribe.
 * @param {(session: import('./session.js').AuthSession) => void} cb
 * @returns {() => void}
 */
export function onAuthSessionChange(cb) {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    cb(sessionFromUser(session?.user));
  });
  return () => {
    data?.subscription?.unsubscribe?.();
  };
}

/**
 * Copy guest local SaveRecord (and optional in-progress path) to cloud + local user key.
 *
 * @param {{
 *   localStore: { load: Function, save: Function },
 *   cloudStore: { save: Function } | null,
 *   storySlug: string,
 *   userId: string,
 *   inProgress?: { sceneId: string, path: string[] } | null,
 *   guestUserId?: string,
 *   now?: number
 * }} opts
 * @returns {Promise<import('../save/record.js').SaveRecord | null>}
 */
export async function handoffGuestToCloudAccount(opts) {
  const {
    localStore,
    cloudStore,
    storySlug,
    userId,
    inProgress = null,
    guestUserId = GUEST_USER_ID,
    now = Date.now(),
  } = opts;

  if (!storySlug || !userId) {
    throw new Error('handoff requires storySlug and userId');
  }

  let source = localStore.load(guestUserId, storySlug);
  if (!isValidSaveRecord(source) && inProgress?.sceneId && inProgress?.path?.length) {
    source = createSaveRecord({
      userId: guestUserId,
      storySlug,
      sceneId: inProgress.sceneId,
      path: inProgress.path,
      updatedAt: now,
    });
  }

  if (!isValidSaveRecord(source)) return null;

  const copied = createSaveRecord({
    userId,
    storySlug: source.storySlug,
    sceneId: source.sceneId,
    path: [...source.path],
    updatedAt: now,
  });

  localStore.save(copied);
  if (cloudStore) {
    await cloudStore.save(copied);
  }
  return copied;
}

export { isSupabaseConfigured, getSupabaseClient };
